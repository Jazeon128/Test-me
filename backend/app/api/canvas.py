"""Generate and serve canvases: diagrams drawn from a document.

The flow is route, then fill. Jev picks the visual form from the request and the
shape of the material; the configured AI provider fills that form's schema. When
Jev is not confident enough, or is not configured at all, the person picks.
"""

import json
import uuid
from typing import Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, object_session

from .documents import _save_generated_question
from ..models.deck import Deck
from ..models.flagged_question import FlaggedQuestion
from ..utils.cache import invalidate_stats_cache
from ..db import SessionLocal, get_db
from ..models.canvas import Canvas, CanvasRoutingLog, canvas_source_ids
from ..models.document import Document
from ..models.generation_status import GenerationStatus
from ..services.ai.question_generator import QuestionGenerator
from ..services import activity
from ..services.parsers import get_parser_for_type
from ..services.typesafe_key import typesafe_key as _typesafe_key
from ..services.source_names import display_name
from ..services.viz import generator as viz_generator
from ..services.viz import router as viz_router
from ..services.viz import templates as viz_templates
from ..utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


class GenerateCanvasRequest(BaseModel):
    document_id: Optional[int] = None
    source_ids: Optional[List[int]] = Field(default=None, min_length=1, max_length=10)
    request_text: str
    # Set when the person picked from the low-confidence picker, which skips
    # routing entirely.
    template: Optional[str] = None

    @model_validator(mode="after")
    def resolve_sources(self):
        if self.source_ids is None:
            if self.document_id is None:
                raise ValueError("Provide source_ids or document_id")
            self.source_ids = [self.document_id]
        elif self.document_id is not None and self.source_ids != [self.document_id]:
            raise ValueError("source_ids must equal [document_id] when both are given")
        self.source_ids = list(dict.fromkeys(self.source_ids))
        self.document_id = self.source_ids[0]
        return self


class UpdateCanvasRequest(BaseModel):
    layout: Optional[Dict] = None
    title: Optional[str] = None
    edited: Optional[Dict] = None

    @model_validator(mode="after")
    def validate_edited(self):
        if self.edited is not None:
            _validate_edited(self.edited)
        return self


def _check_strings(value):
    if isinstance(value, str) and len(value) > 2000:
        raise ValueError("String fields must be at most 2000 characters")
    if isinstance(value, dict):
        for key, item in value.items():
            _check_strings(key)
            _check_strings(item)
    elif isinstance(value, list):
        for item in value:
            _check_strings(item)


def _graph_ids(items, limit):
    if not isinstance(items, list) or len(items) > limit:
        raise ValueError(f"Expected at most {limit} graph items")
    ids = []
    for item in items:
        if not isinstance(item, dict) or not isinstance(item.get("id"), str):
            raise ValueError("Graph items require string ids")
        ids.append(item["id"])
    if len(set(ids)) != len(ids):
        raise ValueError("Graph ids must be unique")
    return set(ids)


def _validate_edited(graph):
    if type(graph.get("schema_version")) is not int or graph["schema_version"] != 1:
        raise ValueError("Expected schema_version 1")
    node_ids = _graph_ids(graph.get("nodes"), 400)
    _graph_ids(graph.get("edges"), 800)
    for node in graph["nodes"]:
        if not isinstance(node.get("data"), dict) or not isinstance(node.get("position"), dict):
            raise ValueError("Nodes require data and position")
    for edge in graph["edges"]:
        endpoints = [edge.get("source"), edge.get("target")]
        if any(not isinstance(value, str) or value not in node_ids for value in endpoints):
            raise ValueError("Edge endpoints must exist")
    _check_strings(graph)
    if len(json.dumps(graph, ensure_ascii=False).encode("utf-8")) > 1_000_000:
        raise ValueError("Edited graph must be at most 1000000 bytes")


def _sections_for(document: Document) -> List[Dict]:
    """Re-parse the document into citable sections.

    Sections are not persisted anywhere, so they are rebuilt here and then
    stored on the canvas, which is what lets a node resolve its source later
    without parsing the file again.
    """
    parser = get_parser_for_type(document.file_type)
    parsed = parser.parse(document.file_path)

    sections = []
    for index, section in enumerate(parsed.sections):
        text = (section.text or "").strip()
        if not text:
            continue
        sections.append(
            {
                "id": f"s{index}",
                "heading": section.section or "",
                "page": section.page,
                "text": text,
            }
        )
    return sections


@router.get("/templates")
async def list_templates():
    """Every form the canvas can draw. The frontend mirrors these ids."""
    return [
        {
            "id": template.id,
            "title": template.title,
            "description": template.description,
            "layout": template.layout,
        }
        for template in viz_templates.TEMPLATES.values()
    ]


def _ask_for_a_choice(db, status, message: str, routing_log_id: int) -> None:
    """Hand the decision back to the person."""
    status.status = "needs_choice"
    status.current_step = "Pick how this should be drawn"
    status.error_message = None
    status.pending_request = {"routing_log_id": routing_log_id}
    status.add_log(message)
    db.commit()


def _decide_template(db, request, title, sections, status, step):
    """Settle which template to draw.

    Returns (template, routing, routing_log_id), or None when the decision has
    been handed to the person and the job should stop here.
    """
    if request.template:
        template = viz_templates.get(request.template)
        step(f"Drawing the {template.title.lower()} you chose", 30)
        return template, None, None

    step("Choosing a form for this material", 25)
    try:
        routing = viz_router.route(
            request_text=request.request_text,
            title=title,
            sections=sections,
            api_key=_typesafe_key(db),
        )
    except viz_router.RoutingUnavailable as exc:
        logger.info("canvas_routing_unavailable", reason=str(exc))
        routing_log_id = _log_routing(db, request, None, None, needs_choice=True)
        _ask_for_a_choice(db, status, f"Routing unavailable: {exc}", routing_log_id)
        return None

    if not routing.is_confident:
        routing_log_id = _log_routing(db, request, routing, None, needs_choice=True)
        _ask_for_a_choice(
            db,
            status,
            f"Not confident enough to choose ({routing.confidence:.0%}); asking instead",
            routing_log_id,
        )
        return None

    # Log the decision now, not after the fill. A fill that fails would
    # otherwise discard a routing answer that was made and acted on, biasing
    # the log toward runs that happened to succeed.
    routing_log_id = _log_routing(db, request, routing, None, needs_choice=False)

    template = viz_templates.get(routing.template_id)
    step(f"Drawing a {template.title.lower()}", 40)
    return template, routing, routing_log_id


def _run_generation(job_id: str, request: GenerateCanvasRequest) -> None:
    """Route and fill, in the background, reporting progress as it goes."""
    db = SessionLocal()
    try:
        status = db.query(GenerationStatus).filter(GenerationStatus.job_id == job_id).first()

        def step(message: str, progress: int) -> None:
            status.current_step = message
            status.progress = progress
            status.add_log(message)
            db.commit()

        status.status = "processing"
        step("Reading the document", 10)

        documents = _load_sources(db, request.source_ids)
        document = documents[0]
        names = [display_name(doc) for doc in documents]
        title = names[0] if len(names) == 1 else f"{len(names)} sources: " + "; ".join(names)
        sections = viz_generator.pick_sections([
            [{**section, "id": f"d{doc.id}-{section['id']}",
              "document_id": doc.id, "source_name": display_name(doc)}
             for section in _sections_for(doc)]
            for doc in documents
        ])
        if not sections:
            raise ValueError("This document has no readable text to draw from.")

        decision = _decide_template(db, request, title, sections, status, step)
        if decision is None:
            return
        template, routing, routing_log_id = decision

        payload = viz_generator.generate(
            db=db,
            template=template,
            request_text=request.request_text,
            title=title,
            sections=sections,
            source_count=len(documents),
            granularity_index=routing.granularity_index if routing else 1,
            orientation=routing.orientation if routing else "horizontal",
            needs_grouping=routing.needs_grouping if routing else False,
        )

        step("Placing the nodes", 85)

        canvas = Canvas(
            document_id=document.id,
            source_ids=request.source_ids,
            request_text=request.request_text,
            template=template.id,
            title=request.request_text[:200],
            payload_json=payload,
            sources_json=sections,
            routing_confidence=routing.confidence if routing else None,
            chosen_by_user=request.template is not None,
        )
        db.add(canvas)
        db.commit()
        db.refresh(canvas)

        activity.record_canvas(db)
        activity.check_awards(db)

        if routing_log_id is not None:
            log_row = (
                db.query(CanvasRoutingLog).filter(CanvasRoutingLog.id == routing_log_id).first()
            )
            if log_row:
                log_row.canvas_id = canvas.id
                db.commit()

        status.status = "completed"
        status.progress = 100
        status.current_step = "Done"
        status.result_id = canvas.id
        status.add_log(f"Drew {template.title.lower()} #{canvas.id}")
        db.commit()

    except Exception as exc:
        logger.error("canvas_generation_failed", job_id=job_id, error=str(exc))
        status = db.query(GenerationStatus).filter(GenerationStatus.job_id == job_id).first()
        if status:
            status.status = "failed"
            status.error_message = str(exc)
            status.add_log(f"Failed: {exc}", level="error")
            db.commit()
    finally:
        db.close()


def _log_routing(
    db: Session,
    request: GenerateCanvasRequest,
    routing: Optional[viz_router.Routing],
    canvas_id: Optional[int],
    needs_choice: bool,
) -> int:
    """Record one routing decision. Returns the row id so a canvas can be linked."""
    row = CanvasRoutingLog(
        canvas_id=canvas_id,
        document_id=request.document_id,
        request_text=request.request_text,
        chosen_template=routing.template_id if routing else None,
        confidence=routing.confidence if routing else 0.0,
        probabilities_json=routing.probabilities if routing else None,
        shape_signals_json=routing.shape_signals if routing else None,
        granularity_index=routing.granularity_index if routing else None,
        auto_applied=not needs_choice and request.template is None,
        user_override=request.template,
        duration_ms=routing.duration_ms if routing else None,
        input_tokens=routing.input_tokens if routing else None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row.id


def _load_sources(db, source_ids, validate_status=False):
    documents = []
    for source_id in source_ids:
        document = db.get(Document, source_id)
        if document is None:
            raise HTTPException(404, f"Source {source_id} not found")
        documents.append(document)
    if not validate_status:
        return documents
    if len({doc.notebook_id for doc in documents}) != 1:
        raise HTTPException(400, "All sources must belong to the same notebook")
    for document in documents:
        if document.status == "processing":
            raise HTTPException(409, f"Source {document.id} is still processing")
        if document.status == "failed":
            raise HTTPException(400, f"Source {document.id} failed processing")
    return documents


@router.post("/generate")
async def generate_canvas(
    request: GenerateCanvasRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Start a canvas. Returns a job id to poll at /api/status/{job_id}."""
    documents = _load_sources(db, request.source_ids, validate_status=True)
    document = documents[0]

    if request.template and request.template not in viz_templates.TEMPLATES:
        raise HTTPException(status_code=400, detail=f"Unknown template: {request.template}")

    job_id = f"canvas-{uuid.uuid4().hex[:12]}"
    status = GenerationStatus(job_id=job_id, status="pending", progress=0,
                              kind="canvas", notebook_id=document.notebook_id,
                              source_ids=request.source_ids)
    status.add_log("Queued")
    db.add(status)
    db.commit()

    background_tasks.add_task(_run_generation, job_id, request)
    return {"job_id": job_id}


@router.get("/candidates/{job_id}")
async def routing_candidates(job_id: str, db: Session = Depends(get_db)):
    """The templates to offer when routing was not confident enough."""
    status = db.query(GenerationStatus).filter(GenerationStatus.job_id == job_id).first()
    if not status:
        raise HTTPException(status_code=404, detail="Generation job not found")
    if status.status != "needs_choice":
        raise HTTPException(status_code=409, detail="This job is not waiting for a canvas choice")
    routing_log_id = (status.pending_request or {}).get("routing_log_id")
    log = db.query(CanvasRoutingLog).filter(CanvasRoutingLog.id == routing_log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="No routing decision found")

    probabilities = log.probabilities_json or {}
    ranked = sorted(probabilities.items(), key=lambda kv: kv[1], reverse=True)

    candidates = []
    for template_id, probability in ranked:
        template = viz_templates.TEMPLATES.get(template_id)
        if template is None:
            continue
        candidates.append(
            {
                "id": template.id,
                "title": template.title,
                "description": template.description,
                "probability": round(float(probability), 3),
            }
        )
        if len(candidates) >= viz_router.CANDIDATES_OFFERED:
            break

    if not candidates:
        candidates = [
            {
                "id": t.id,
                "title": t.title,
                "description": t.description,
                "probability": None,
            }
            for t in list(viz_templates.TEMPLATES.values())[: viz_router.CANDIDATES_OFFERED]
        ]

    return {
        "confidence": log.confidence,
        "reason": (
            "This material could be drawn several ways, and none stood out."
            if log.confidence
            else "Automatic routing is not configured, so pick a form."
        ),
        "candidates": candidates,
    }


def _serialize(canvas: Canvas) -> Dict:
    """One canvas, with enough context to say what it is and where it belongs.

    The document and notebook are included because a canvas opened directly by
    URL otherwise gives no clue which subject it came from.
    """
    template = viz_templates.TEMPLATES.get(canvas.template)
    document = canvas.document
    notebook = document.notebook if document else None

    db = object_session(canvas)
    sources = [db.get(Document, source_id) for source_id in canvas_source_ids(canvas)]
    return {
        "source_ids": canvas_source_ids(canvas),
        "sources": [{"id": doc.id, "name": display_name(doc)} for doc in sources if doc],
        "id": canvas.id,
        "document_id": canvas.document_id,
        "document_name": (document.title or document.original_filename) if document else None,
        "source_name": display_name(document) if document else None,
        "notebook_id": notebook.id if notebook else None,
        "notebook_name": notebook.name if notebook else None,
        "notebook_icon": notebook.icon if notebook else None,
        "request_text": canvas.request_text,
        "template": canvas.template,
        "template_title": template.title if template else canvas.template,
        "title": canvas.title,
        "payload": canvas.payload_json,
        "layout": canvas.layout_json,
        "edited": canvas.edited_json,
        "has_edits": canvas.edited_json is not None,
        "routing_confidence": canvas.routing_confidence,
        "chosen_by_user": canvas.chosen_by_user,
        "created_at": canvas.created_at.isoformat() if canvas.created_at else None,
    }


@router.get("/")
async def list_all_canvases(db: Session = Depends(get_db)):
    """Every canvas, newest first, with the document each was drawn from."""
    rows = (
        db.query(Canvas)
        .join(Document, Canvas.document_id == Document.id)
        .order_by(Canvas.created_at.desc())
        .all()
    )
    out = []
    for canvas in rows:
        item = _serialize(canvas)
        item["node_count"] = _count_nodes(canvas.payload_json)
        del item["payload"]
        out.append(item)
    return out


def _count_nodes(payload: Dict) -> int:
    """How many nodes a payload holds, whatever its template's shape."""
    return sum(1 for _ in _walk_labelled(payload))


def _walk_labelled(payload):
    if isinstance(payload, dict):
        if "label" in payload and "id" in payload:
            yield payload
        for value in payload.values():
            yield from _walk_labelled(value)
    elif isinstance(payload, list):
        for item in payload:
            yield from _walk_labelled(item)


@router.get("/document/{document_id}")
async def list_canvases(document_id: int, db: Session = Depends(get_db)):
    document = db.get(Document, document_id)
    if document is None:
        return []
    canvases = (
        db.query(Canvas)
        .join(Document, Canvas.document_id == Document.id)
        .filter(Document.notebook_id == document.notebook_id)
        .order_by(Canvas.created_at.desc())
        .all()
    )
    return [_serialize(c) for c in canvases if document_id in canvas_source_ids(c)]


@router.get("/{canvas_id}")
async def get_canvas(canvas_id: int, db: Session = Depends(get_db)):
    canvas = db.query(Canvas).filter(Canvas.id == canvas_id).first()
    if not canvas:
        raise HTTPException(status_code=404, detail="Canvas not found")
    return _serialize(canvas)


@router.patch("/{canvas_id}")
async def update_canvas(
    canvas_id: int, request: UpdateCanvasRequest, db: Session = Depends(get_db)
):
    """Persist hand edits: node positions, and a renamed canvas."""
    canvas = db.query(Canvas).filter(Canvas.id == canvas_id).first()
    if not canvas:
        raise HTTPException(status_code=404, detail="Canvas not found")

    if "layout" in request.model_fields_set:
        canvas.layout_json = request.layout
    if "edited" in request.model_fields_set:
        canvas.edited_json = request.edited
    if request.title is not None:
        canvas.title = request.title

    db.commit()
    db.refresh(canvas)
    return _serialize(canvas)


@router.get("/{canvas_id}/nodes/{node_id}/source")
async def node_source(canvas_id: int, node_id: str, db: Session = Depends(get_db)):
    """The passage a node came from."""
    canvas = db.query(Canvas).filter(Canvas.id == canvas_id).first()
    if not canvas:
        raise HTTPException(status_code=404, detail="Canvas not found")

    node = _find_canvas_node(canvas, node_id)
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found on this canvas")

    section_id = node.get("source_section_id")
    section = next((s for s in canvas.sources_json if s["id"] == section_id), None)
    if section is None:
        return {"node_id": node_id, "label": node.get("label"), "section": None}

    return {
        "node_id": node_id,
        "label": node.get("label"),
        "section": {
            "document_id": section.get("document_id", canvas.document_id),
            "source_name": section.get("source_name") or display_name(canvas.document),
            "id": section["id"],
            "heading": section.get("heading"),
            "page": section.get("page"),
            "text": section["text"],
        },
    }


def _node_canvas(db, canvas_id, node_id):
    canvas = db.get(Canvas, canvas_id)
    if canvas is None:
        raise HTTPException(404, "Canvas not found")
    node = _find_canvas_node(canvas, node_id)
    if node is None:
        raise HTTPException(404, "Node not found on this canvas")
    return canvas, node


def _matches_node(reference, canvas_id, node_id):
    reference = reference or {}
    return reference.get("canvas_id") == canvas_id and reference.get("node_id") == node_id


def _question_json(question):
    options = sorted(question.options, key=lambda option: option.order)
    return {
        "id": question.id, "question": question.question_text,
        "card_type": question.card_type,
        "options": [{"option": chr(65 + option.order), "text": option.option_text}
                    for option in options],
        "correct_answer": next((chr(65 + option.order) for option in options
                                if option.is_correct), None),
        "explanation": question.explanation,
    }


def _node_questions(db, canvas, node_id, generated=False):
    deck = db.query(Deck).filter_by(canvas_id=canvas.id).first()
    questions = []
    held_back = 0
    if deck is not None:
        questions = [_question_json(q) for q in deck.questions
                     if _matches_node(q.source_reference, canvas.id, node_id)]
        held_back = sum(_matches_node(row.payload.get("reference"), canvas.id, node_id)
                        for row in db.query(FlaggedQuestion).filter_by(
                            deck_id=deck.id, status="pending").all())
    return {
        "node_id": node_id, "deck_id": deck.id if deck else None,
        "notebook_id": canvas.document.notebook_id, "questions": questions,
        "held_back": held_back, "generated": generated,
    }


@router.get("/{canvas_id}/nodes/{node_id}/questions")
async def saved_questions_for_node(canvas_id: int, node_id: str, db: Session = Depends(get_db)):
    canvas, _ = _node_canvas(db, canvas_id, node_id)
    return _node_questions(db, canvas, node_id)


def _canvas_deck(db, canvas_id, notebook_id, source_ids, name):
    deck = db.query(Deck).filter_by(canvas_id=canvas_id).first()
    if deck is not None:
        return deck
    deck = Deck(notebook_id=notebook_id, kind="quiz", canvas_id=canvas_id,
                source_ids=source_ids, name=name)
    db.add(deck)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        deck = db.query(Deck).filter_by(canvas_id=canvas_id).one()
    return deck


def _with_node_reference(data, canvas_id, node_id):
    return {**data, "reference": {**(data.get("reference") or {}),
                                  "canvas_id": canvas_id, "node_id": node_id}}


@router.post("/{canvas_id}/nodes/{node_id}/questions")
async def questions_for_node(
    canvas_id: int, node_id: str, count: int = Query(3, ge=1, le=10),
    more: bool = False, db: Session = Depends(get_db),
):
    """Generate and save practice questions scoped to a node's passage."""
    canvas, node = _node_canvas(db, canvas_id, node_id)
    saved = _node_questions(db, canvas, node_id)
    if not more and saved["questions"]:
        return saved
    section = next((s for s in canvas.sources_json
                    if s["id"] == node.get("source_section_id")), None)
    if section is None:
        raise HTTPException(409, "This node has no source passage, so there is nothing to be tested on.")
    from ..services.parsers.base_parser import ParsedDocument, ParsedSection

    scoped = ParsedDocument(
        full_text=section["text"],
        sections=[ParsedSection(text=section["text"], page=section.get("page"))],
        title=node.get("label") or canvas.title,
    )
    document_id = section.get("document_id", canvas.document_id)
    notebook_id = saved["notebook_id"]
    source_ids = canvas_source_ids(canvas)
    name = f"Canvas: {canvas.title or canvas.request_text}"[:255]
    db.rollback()
    generator = QuestionGenerator(db=db)
    questions = generator.generate_questions(
        parsed_doc=scoped, num_questions=count, difficulty="mixed"
    )
    db.rollback()
    try:
        deck = _canvas_deck(db, canvas_id, notebook_id, source_ids, name)
        for data in questions:
            _save_generated_question(db, _with_node_reference(data, canvas_id, node_id), document_id, deck)
        for data in generator.flagged_questions:
            payload = _with_node_reference(data, canvas_id, node_id)
            db.add(FlaggedQuestion(
                deck_id=deck.id, document_id=document_id,
                job_id=f"canvas-node-{canvas_id}-{node_id}",
                payload={key: value for key, value in payload.items() if key != "flags"},
                reasons=data["flags"],
            ))
        db.commit()
    except Exception:
        db.rollback()
        raise
    invalidate_stats_cache()
    return _node_questions(db, db.get(Canvas, canvas_id), node_id, generated=True)


def _find_canvas_node(canvas, node_id):
    if canvas.edited_json is not None:
        for node in canvas.edited_json["nodes"]:
            if node["id"] == node_id:
                return node["data"]
    return _find_node(canvas.payload_json, node_id)


def _matrix_cell(payload: Dict, node_id: str) -> Optional[Dict]:
    """Resolve a matrix cell's generated id."""
    cells = payload.get("cells")
    if isinstance(cells, list):
        for index, cell in enumerate(cells):
            if node_id == f"cell-{index}" and isinstance(cell, dict):
                return {
                    **cell,
                    "id": node_id,
                    "label": cell.get("value") or f"{cell.get('option', '')}: {cell.get('criterion', '')}",
                }
    return None


def _find_node(payload: Dict, node_id: str) -> Optional[Dict]:
    """Find a node by id anywhere in a template payload."""
    if isinstance(payload, dict):
        if payload.get("id") == node_id and "label" in payload:
            return payload
        cell = _matrix_cell(payload, node_id)
        if cell is not None:
            return cell
        for value in payload.values():
            found = _find_node(value, node_id)
            if found is not None:
                return found
    elif isinstance(payload, list):
        for item in payload:
            found = _find_node(item, node_id)
            if found is not None:
                return found
    return None
