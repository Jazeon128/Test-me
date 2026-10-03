"""Notebooks: the topic a set of sources and everything made from them belongs to."""

from typing import Dict, List, Optional, Literal
import uuid

from fastapi import Query, APIRouter, Depends, HTTPException, BackgroundTasks, File, Form, UploadFile, WebSocket
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy.orm import Session, sessionmaker

from ..config import settings
from ..utils.origin import is_cross_site_write
from ..services.voice import live
from ..services.secrets import get_secret
from ..services.ai.clients import setting
from ..services.source_names import display_name
from ..utils.cache import invalidate_stats_cache
from ..db import get_db
from ..models.canvas import Canvas
from ..models.deck import Deck
from ..models.document import Document
from ..models.notebook import Notebook
from ..models.chat_message import ChatMessage
from ..services.chat.retrieve import retrieve
from ..services.chat.answer import answer, REFUSAL, validate_citations
from ..services.ai.question_generator import explain_provider_error
from ..models.generation_status import GenerationStatus
from ..services.generation import GenerateRequest, selected_sources, question_split
from ..services.workspace import notebook_workspace
from ..services.question_bank import question_bank, held_back, bulk_questions, practice_questions
from .questions import delete_question_data
from .documents import process_document
from ..services.ingest import save_source, parse_source_task, passage_counts, source_fields
from ..services.parsers import YouTubeParser
from ..utils.file_validation import validate_upload_file

router = APIRouter()


@router.post("/{notebook_id}/generate", status_code=202)
async def generate_artifact(
    notebook_id: int, request: GenerateRequest, background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if not db.get(Notebook, notebook_id):
        raise HTTPException(status_code=404, detail="Notebook not found")
    try:
        sources = selected_sources(db, notebook_id, request)
    except HTTPException as error:
        if isinstance(error.detail, dict):
            return JSONResponse(status_code=error.status_code, content=error.detail)
        raise
    counts = passage_counts(db, [source.id for source in sources])
    split = question_split({source.id: counts.get(source.id, 0) for source in sources},
                           request.num_questions)
    name = display_name(sources[0])
    if len(sources) > 1:
        name += f" + {len(sources) - 1} more"
    deck = Deck(notebook_id=notebook_id, kind=request.kind,
                source_ids=[source.id for source in sources], name=request.deck_name or name)
    db.add(deck)
    db.flush()
    job = GenerationStatus(job_id=str(uuid.uuid4()), status="pending", notebook_id=notebook_id,
                           deck_created=True,
                           source_ids=deck.source_ids, kind=request.kind, deck_id=deck.id,
                           result_id=deck.id, total_documents=sum(s["num_questions"] > 0 for s in split),
                           total_questions_requested=request.num_questions)
    item_name = "Card" if request.kind == "flashcards" else "Question"
    job.add_log(f"{item_name} split: {split}")
    db.add(job)
    db.commit()
    invalidate_stats_cache()
    by_id = {source.id: source for source in sources}
    for share in split:
        if share["num_questions"]:
            source = by_id[share["source_id"]]
            background_tasks.add_task(process_document, source.id, source.file_path, source.file_type,
                                      share["num_questions"], request.difficulty, deck.id,
                                      request.custom_prompt, job.job_id,
                                      card_type="flashcard" if request.kind == "flashcards" else "mcq")
    return dict(job_id=job.job_id, deck_id=deck.id, split=split)


@router.get("/{notebook_id}/workspace")
async def get_workspace(notebook_id: int, db: Session = Depends(get_db)):
    notebook = db.get(Notebook, notebook_id)
    if notebook is None:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return notebook_workspace(db, notebook)


@router.post("/{notebook_id}/sources", status_code=202)
async def add_sources(
    notebook_id: int,
    background_tasks: BackgroundTasks,
    files: Optional[List[UploadFile]] = File(None),
    youtube_url: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    if not db.get(Notebook, notebook_id):
        raise HTTPException(status_code=404, detail="Notebook not found")
    if not files and not youtube_url:
        raise HTTPException(status_code=422, detail="Provide files or a YouTube URL")
    if youtube_url and not YouTubeParser.extract_video_id(youtube_url):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")
    inputs = []
    for file in files or []:
        inputs.append((file.filename, await validate_upload_file(file)))
    if youtube_url:
        inputs.append(("video.youtube", youtube_url.encode("utf-8")))
    sources = []
    for filename, content in inputs:
        document, created = await run_in_threadpool(
            save_source, db, notebook_id=notebook_id, filename=filename, content=content,
        )
        sources.append(dict(id=document.id, display_name=display_name(document),
                            file_type=document.file_type.value, status=document.status,
                            duplicate=not created))
        # A duplicate that failed before is parsed again, so re-adding retries it.
        if created or document.status == "failed":
            background_tasks.add_task(parse_source_task, document.id)
    return {"sources": sources}


class NotebookRequest(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None


def _validate_icon(icon: Optional[str]) -> None:
    if icon is not None and not (1 <= len(icon) <= 16 and any(ord(c) > 127 for c in icon)):
        raise HTTPException(status_code=400, detail="Icon must be an emoji.")


def _counts(db: Session, notebook_id: int) -> Dict[str, int]:
    document_ids = [
        row[0] for row in db.query(Document.id).filter(Document.notebook_id == notebook_id).all()
    ]
    canvases = (
        db.query(Canvas).filter(Canvas.document_id.in_(document_ids)).count() if document_ids else 0
    )
    return {
        "sources": len(document_ids),
        "canvases": canvases,
        "decks": db.query(Deck).filter(Deck.notebook_id == notebook_id).count(),
    }


def _serialize(db: Session, notebook: Notebook) -> Dict:
    return {
        "id": notebook.id,
        "name": notebook.name,
        "description": notebook.description,
        "icon": notebook.icon,
        "created_at": notebook.created_at.isoformat() if notebook.created_at else None,
        "updated_at": notebook.updated_at.isoformat() if notebook.updated_at else None,
        **_counts(db, notebook.id),
    }


@router.get("/")
async def list_notebooks(db: Session = Depends(get_db)) -> List[Dict]:
    notebooks = db.query(Notebook).order_by(Notebook.updated_at.desc()).all()
    return [_serialize(db, n) for n in notebooks]


@router.post("/")
async def create_notebook(request: NotebookRequest, db: Session = Depends(get_db)):
    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="A notebook needs a name")

    _validate_icon(request.icon)

    notebook = Notebook(name=name, description=request.description, icon=request.icon)
    db.add(notebook)
    db.commit()
    invalidate_stats_cache()
    db.refresh(notebook)
    return _serialize(db, notebook)


@router.get("/{notebook_id}")
async def get_notebook(notebook_id: int, db: Session = Depends(get_db)):
    notebook = db.query(Notebook).filter(Notebook.id == notebook_id).first()
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")

    documents = (
        db.query(Document)
        .filter(Document.notebook_id == notebook_id)
        .order_by(Document.created_at.desc())
        .all()
    )
    document_ids = [d.id for d in documents]
    counts = passage_counts(db, document_ids)

    canvases = (
        db.query(Canvas)
        .filter(Canvas.document_id.in_(document_ids))
        .order_by(Canvas.created_at.desc())
        .all()
        if document_ids
        else []
    )

    decks = (
        db.query(Deck)
        .filter(Deck.notebook_id == notebook_id)
        .order_by(Deck.created_at.desc())
        .all()
    )

    return {
        **_serialize(db, notebook),
        "documents": [
            {
                "id": d.id,
                "name": display_name(d),
                "display_name": display_name(d),
                "file_type": d.file_type.value if d.file_type else None,
                "num_pages": d.num_pages,
                **source_fields(d, counts),
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in documents
        ],
        "canvases": [
            {
                "id": c.id,
                "template": c.template,
                "title": c.title,
                "request_text": c.request_text,
                "document_id": c.document_id,
                "routing_confidence": c.routing_confidence,
                "chosen_by_user": c.chosen_by_user,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in canvases
        ],
        "decks": [
            {
                "id": d.id,
                "name": d.name,
                "description": d.description,
                "num_questions": len(d.questions),
            }
            for d in decks
        ],
    }


@router.patch("/{notebook_id}")
async def update_notebook(
    notebook_id: int, request: NotebookRequest, db: Session = Depends(get_db)
):
    notebook = db.query(Notebook).filter(Notebook.id == notebook_id).first()
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")

    if request.icon != "":
        _validate_icon(request.icon)

    if request.name is not None and request.name.strip():
        notebook.name = request.name.strip()
    if request.description is not None:
        notebook.description = request.description
    if request.icon is not None:
        notebook.icon = request.icon or None

    db.commit()
    invalidate_stats_cache()
    db.refresh(notebook)
    return _serialize(db, notebook)


@router.delete("/{notebook_id}")
async def delete_notebook(notebook_id: int, db: Session = Depends(get_db)):
    """Delete an empty notebook.

    A notebook holding sources is not deleted implicitly: that would take its
    documents, canvases and decks with it. Move or remove those first.
    """
    notebook = db.query(Notebook).filter(Notebook.id == notebook_id).first()
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")

    counts = _counts(db, notebook_id)
    if counts["sources"] or counts["decks"]:
        raise HTTPException(
            status_code=409,
            detail=(
                f"This notebook still holds {counts['sources']} source(s) and "
                f"{counts['decks']} deck(s). Move or delete them first."
            ),
        )

    db.delete(notebook)
    db.commit()
    invalidate_stats_cache()
    return {"success": True}


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    source_ids: List[int] = Field(min_length=1)

    @field_validator("message")
    @classmethod
    def nonempty_message(cls, value):
        if not value.strip():
            raise ValueError("A message must contain text")
        return value


def _chat_notebook(db, notebook_id):
    if db.get(Notebook, notebook_id) is None:
        raise HTTPException(status_code=404, detail="Notebook not found")


def _chat_sources(db, notebook_id, source_ids):
    sources = db.query(Document).filter(Document.id.in_(source_ids)).all()
    if {source.id for source in sources if source.notebook_id == notebook_id} != set(source_ids):
        raise HTTPException(status_code=400, detail="A selected source is not in this notebook")
    return [source.id for source in sources if source.status == "processing"]


def _chat_message(db, turn):
    citations = []
    for stored in turn.citations or []:
        citation = dict(stored)
        if db.get(Document, citation["document_id"]) is None:
            citation.update(removed=True, display_name="Removed source")
            citation.pop("excerpt", None)
        citations.append(citation)
    _, _, invalid, uncited = validate_citations(
        turn.content, max((citation["n"] for citation in citations), default=0),
    )
    voice = turn.mode == "voice"
    return dict(id=turn.id, role=turn.role, mode=turn.mode, content=turn.content, citations=citations,
                refused=turn.refused,
                uncited=uncited and not turn.refused and turn.role == "assistant" and not voice,
                invalid_citations=invalid, model=turn.model, created_at=turn.created_at.isoformat())


def _chat_history(db, notebook_id, limit=6, before=None):
    query = db.query(ChatMessage).filter(ChatMessage.notebook_id == notebook_id)
    if before is not None:
        query = query.filter(ChatMessage.id < before)
    return list(reversed(query.order_by(ChatMessage.id.desc()).limit(limit).all()))


@router.post("/{notebook_id}/chat")
def post_chat(notebook_id: int, request: ChatRequest, db: Session = Depends(get_db)):
    _chat_notebook(db, notebook_id)
    processing = _chat_sources(db, notebook_id, request.source_ids)
    if processing:
        return JSONResponse(status_code=409, content={
            "detail": "Selected sources are still processing", "processing": processing,
        })
    history = _chat_history(db, notebook_id)
    prior = (db.query(ChatMessage)
             .filter(ChatMessage.notebook_id == notebook_id, ChatMessage.role == "user")
             .order_by(ChatMessage.id.desc()).first())
    previous = prior.content if prior else ""
    user = ChatMessage(notebook_id=notebook_id, role="user", content=request.message,
                       source_ids=request.source_ids)
    db.add(user)
    db.commit()
    passages = retrieve(db, notebook_id, request.source_ids, request.message, previous)
    result = dict(content=REFUSAL, citations=[], refused=True, model=None,
                  uncited=False, invalid_citations=[])
    if passages:
        try:
            result = answer(db, passages, history, request.message, previous)
        except Exception as error:
            provider = getattr(error, "details", {}).get("provider", "")
            raise HTTPException(status_code=502, detail=explain_provider_error(
                str(error), provider or "gemini")) from error
    assistant = ChatMessage(notebook_id=notebook_id, role="assistant",
                            **{key: result[key] for key in ("content", "citations", "refused", "model")})
    db.add(assistant)
    db.commit()
    db.refresh(assistant)
    return {**_chat_message(db, assistant), "uncited": result["uncited"],
            "invalid_citations": result["invalid_citations"]}


@router.get("/{notebook_id}/chat")
def get_chat(notebook_id: int, limit: int = Query(50, ge=1, le=200),
             before: Optional[int] = Query(None, ge=1), db: Session = Depends(get_db)):
    _chat_notebook(db, notebook_id)
    return [_chat_message(db, turn) for turn in _chat_history(db, notebook_id, limit, before)]


@router.delete("/{notebook_id}/chat")
def clear_chat(notebook_id: int, db: Session = Depends(get_db)):
    _chat_notebook(db, notebook_id)
    db.query(ChatMessage).filter(ChatMessage.notebook_id == notebook_id).delete()
    db.commit()
    return {"success": True}


@router.get("/{notebook_id}/questions")
def get_question_bank(
    notebook_id: int,
    search: Optional[str] = None,
    deck_id: Optional[int] = Query(None, ge=1),
    source_id: Optional[int] = Query(None, ge=1),
    tag_id: Optional[int] = Query(None, ge=1),
    difficulty: Optional[Literal["easy", "medium", "hard"]] = None,
    card_type: Optional[Literal["mcq", "flashcard"]] = None,
    status: Optional[Literal["due", "new", "learning", "mastered"]] = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=50),
    db: Session = Depends(get_db),
):
    _chat_notebook(db, notebook_id)
    return question_bank(db, notebook_id, offset=offset, limit=limit, search=search,
                         deck_id=deck_id, source_id=source_id, tag_id=tag_id,
                         difficulty=difficulty, card_type=card_type, status=status)


@router.get("/{notebook_id}/held-back")
def get_held_back(notebook_id: int, db: Session = Depends(get_db)):
    _chat_notebook(db, notebook_id)
    return held_back(db, notebook_id)


class BankSelectionRequest(BaseModel):
    question_ids: List[int] = Field(min_length=1, max_length=500)

    @field_validator('question_ids')
    @classmethod
    def unique_ids(cls, value):
        if len(set(value)) != len(value):
            raise ValueError('Question ids must be unique')
        return value


class BankPracticeRequest(BankSelectionRequest):
    question_ids: List[int] = Field(min_length=1, max_length=200)


class BankBulkRequest(BankSelectionRequest):
    action: Literal['add_to_deck', 'remove_from_deck', 'tag', 'untag', 'delete']
    deck_id: Optional[int] = None
    new_deck_name: Optional[str] = Field(None, min_length=1, max_length=255)
    tag_id: Optional[int] = None

    @model_validator(mode='after')
    def action_fields(self):
        if self.action == 'add_to_deck':
            if (self.deck_id is None) == (self.new_deck_name is None):
                raise ValueError('Supply exactly one of deck_id or new_deck_name')
        if self.new_deck_name is not None and not self.new_deck_name.strip():
            raise ValueError('Deck name must contain text')
        if self.action == 'remove_from_deck' and self.deck_id is None:
            raise ValueError('Supply deck_id')
        if self.action in ('tag', 'untag') and self.tag_id is None:
            raise ValueError('Supply tag_id')
        return self


@router.post('/{notebook_id}/questions/bulk')
def post_bank_bulk(notebook_id: int, request: BankBulkRequest, db: Session = Depends(get_db)):
    _chat_notebook(db, notebook_id)
    result = bulk_questions(db, notebook_id, request, delete_question_data)
    invalidate_stats_cache()
    return result


@router.post('/{notebook_id}/questions/practice')
def post_bank_practice(notebook_id: int, request: BankPracticeRequest, db: Session = Depends(get_db)):
    _chat_notebook(db, notebook_id)
    return practice_questions(db, notebook_id, request.question_ids)


@router.websocket("/{notebook_id}/voice")
async def voice_chat(websocket: WebSocket, notebook_id: int, source_ids: str = "",
                     db: Session = Depends(get_db)):
    if is_cross_site_write("POST", websocket.headers.get("origin"), None, settings.CORS_ORIGINS):
        await websocket.close(code=1008)
        return
    await websocket.accept()
    try:
        _chat_notebook(db, notebook_id)
        ids = _voice_source_ids(source_ids)
        if _chat_sources(db, notebook_id, ids):
            raise HTTPException(status_code=409, detail="Selected sources are still processing")
    except HTTPException as error:
        await live.reject(websocket, error.detail)
        return
    key = get_secret("gemini", db=db, config=settings)
    if not key:
        await live.reject(websocket, "Voice mode needs a Gemini API key. Add one in Settings.")
        return
    if live.SESSION_LOCK.locked():
        await live.reject(websocket, "A voice session is already running.")
        return
    await live.SESSION_LOCK.acquire()
    try:
        model = setting(db, "voice_model") or "gemini-3.8-live"
        bridge = live.Bridge(websocket, sessionmaker(bind=db.get_bind()), notebook_id, ids,
                             live.default_connect(key), model, _chat_message)
        await bridge.run()
    finally:
        live.SESSION_LOCK.release()


def _voice_source_ids(value):
    try:
        ids = [int(part) for part in value.split(",")]
        if not ids or any(source_id < 1 for source_id in ids):
            raise ValueError()
        return ids
    except ValueError as error:
        raise HTTPException(status_code=400,
                            detail="A selected source is not in this notebook") from error
