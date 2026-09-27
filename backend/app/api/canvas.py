"""Generate and serve canvases: diagrams drawn from a document.

The flow is route, then fill. Jev picks the visual form from the request and the
shape of the material; the configured AI provider fills that form's schema. When
Jev is not confident enough, or is not configured at all, the person picks.
"""

import uuid
from typing import Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..config import settings as config_settings
from ..db import SessionLocal, get_db
from ..models.canvas import Canvas, CanvasRoutingLog
from ..models.document import Document
from ..models.generation_status import GenerationStatus
from ..models.settings import Settings
from ..services.ai.question_generator import QuestionGenerator
from ..services.parsers import get_parser_for_type
from ..services.viz import generator as viz_generator
from ..services.viz import router as viz_router
from ..services.viz import templates as viz_templates
from ..utils.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


class GenerateCanvasRequest(BaseModel):
    document_id: int
    request_text: str
    # Set when the person picked from the low-confidence picker, which skips
    # routing entirely.
    template: Optional[str] = None


class UpdateCanvasRequest(BaseModel):
    layout: Optional[Dict] = None
    title: Optional[str] = None


def _typesafe_key(db: Session) -> str:
    """The settings table first, then the environment, like the AI key."""
    row = db.query(Settings).filter(Settings.key == "typesafe_api_key").first()
    if row and row.value:
        return row.value
    return config_settings.TYPESAFE_API_KEY


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


def _ask_for_a_choice(db, status, message: str) -> None:
    """Hand the decision back to the person."""
    status.status = "needs_choice"
    status.current_step = "Pick how this should be drawn"
    status.error_message = None
    status.add_log(message)
    db.commit()


def _decide_template(db, request, document, sections, status, step):
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
            title=document.title or document.original_filename,
            sections=sections,
            api_key=_typesafe_key(db),
        )
    except viz_router.RoutingUnavailable as exc:
        logger.info("canvas_routing_unavailable", reason=str(exc))
        _log_routing(db, request, None, None, needs_choice=True)
        _ask_for_a_choice(db, status, f"Routing unavailable: {exc}")
        return None

    if not routing.is_confident:
        _log_routing(db, request, routing, None, needs_choice=True)
        _ask_for_a_choice(
            db,
            status,
            f"Not confident enough to choose ({routing.confidence:.0%}); asking instead",
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

        document = db.query(Document).filter(Document.id == request.document_id).first()
        sections = _sections_for(document)
        if not sections:
            raise ValueError("This document has no readable text to draw from.")

        decision = _decide_template(db, request, document, sections, status, step)
        if decision is None:
            return
        template, routing, routing_log_id = decision

        payload = viz_generator.generate(
            db=db,
            template=template,
            request_text=request.request_text,
            title=document.title or document.original_filename,
            sections=sections,
            granularity_index=routing.granularity_index if routing else 1,
            orientation=routing.orientation if routing else "horizontal",
            needs_grouping=routing.needs_grouping if routing else False,
        )

        step("Placing the nodes", 85)

        canvas = Canvas(
            document_id=document.id,
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
        status.deck_id = canvas.id  # reused as the result id for this job type
        status.add_log(f"Drew {template.title.lower()} #{canvas.id}")
        db.commit()

    except Exception as exc:  # noqa: BLE001 - the job records its own failure
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
) -> Optional[int]:
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


@router.post("/generate")
async def generate_canvas(
    request: GenerateCanvasRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """Start a canvas. Returns a job id to poll at /api/status/{job_id}."""
    document = db.query(Document).filter(Document.id == request.document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    if request.template and request.template not in viz_templates.TEMPLATES:
        raise HTTPException(status_code=400, detail=f"Unknown template: {request.template}")

    job_id = f"canvas-{uuid.uuid4().hex[:12]}"
    status = GenerationStatus(job_id=job_id, status="pending", progress=0)
    status.add_log("Queued")
    db.add(status)
    db.commit()

    background_tasks.add_task(_run_generation, job_id, request)
    return {"job_id": job_id}


@router.get("/candidates/{job_id}")
async def routing_candidates(job_id: str, db: Session = Depends(get_db)):
    """The templates to offer when routing was not confident enough."""
    log = db.query(CanvasRoutingLog).order_by(CanvasRoutingLog.created_at.desc()).first()
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

    return {
        "id": canvas.id,
        "document_id": canvas.document_id,
        "document_name": (document.title or document.original_filename) if document else None,
        "notebook_id": notebook.id if notebook else None,
        "notebook_name": notebook.name if notebook else None,
        "notebook_icon": notebook.icon if notebook else None,
        "request_text": canvas.request_text,
        "template": canvas.template,
        "template_title": template.title if template else canvas.template,
        "title": canvas.title,
        "payload": canvas.payload_json,
        "layout": canvas.layout_json,
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
    canvases = (
        db.query(Canvas)
        .filter(Canvas.document_id == document_id)
        .order_by(Canvas.created_at.desc())
        .all()
    )
    return [_serialize(c) for c in canvases]


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

    if request.layout is not None:
        canvas.layout_json = request.layout
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

    node = _find_node(canvas.payload_json, node_id)
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
            "id": section["id"],
            "heading": section.get("heading"),
            "page": section.get("page"),
            "text": section["text"],
        },
    }


@router.post("/{canvas_id}/nodes/{node_id}/questions")
async def questions_for_node(
    canvas_id: int, node_id: str, count: int = 3, db: Session = Depends(get_db)
):
    """Generate questions scoped to one node's source passage.

    This is the seam back into the existing quiz engine: a node on the canvas
    becomes practice on exactly the passage it came from.
    """
    canvas = db.query(Canvas).filter(Canvas.id == canvas_id).first()
    if not canvas:
        raise HTTPException(status_code=404, detail="Canvas not found")

    node = _find_node(canvas.payload_json, node_id)
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found on this canvas")

    section = next(
        (s for s in canvas.sources_json if s["id"] == node.get("source_section_id")), None
    )
    if section is None:
        raise HTTPException(
            status_code=409,
            detail="This node has no source passage, so there is nothing to be tested on.",
        )

    from ..services.parsers.base_parser import ParsedDocument, ParsedSection

    scoped = ParsedDocument(
        full_text=section["text"],
        sections=[ParsedSection(text=section["text"], page=section.get("page"))],
        title=node.get("label") or canvas.title,
    )

    generator = QuestionGenerator(db=db)
    questions = generator.generate_questions(
        parsed_doc=scoped, num_questions=count, difficulty="mixed"
    )
    return {"node_id": node_id, "questions": questions}


def _find_node(payload: Dict, node_id: str) -> Optional[Dict]:
    """Find a node by id anywhere in a template payload."""
    if isinstance(payload, dict):
        if payload.get("id") == node_id and "label" in payload:
            return payload
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
