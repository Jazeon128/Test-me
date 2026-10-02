"""Load notebook workspace with a fixed number of grouped queries."""

from datetime import datetime, timezone

from sqlalchemy import case, func

from ..models.canvas import Canvas
from ..models.deck import Deck, DeckQuestion
from ..models.document import Document
from ..models.flagged_question import FlaggedQuestion
from ..models.generation_status import GenerationStatus
from ..models.question import Question
from ..models.user_progress import UserProgress
from .ingest import passage_counts, source_fields
from .source_names import display_name


def _iso(value):
    return value.isoformat() if value else None


def _deck_counts(db, notebook_id, now):
    rows = db.query(
        DeckQuestion.deck_id, func.count(DeckQuestion.question_id),
        func.sum(case((UserProgress.next_review_date <= now, 1), else_=0)),
        func.sum(case((UserProgress.id.is_(None), 1), else_=0)),
    ).join(Deck, Deck.id == DeckQuestion.deck_id).outerjoin(
        UserProgress, UserProgress.question_id == DeckQuestion.question_id,
    ).filter(Deck.notebook_id == notebook_id).group_by(DeckQuestion.deck_id).all()
    return {row[0]: dict(question_count=row[1], due_count=row[2], new_count=row[3]) for row in rows}


def question_notebook_membership(db):
    """Union document and deck membership for either direction of lookup."""
    via_document = db.query(
        Question.id.label("question_id"), Document.notebook_id.label("notebook_id"),
    ).join(Document, Question.document_id == Document.id)
    via_deck = db.query(DeckQuestion.question_id, Deck.notebook_id).join(Deck)
    return via_document.union(via_deck).subquery()


def question_notebook_ids(db, question_id):
    membership = question_notebook_membership(db)
    return [row[0] for row in db.query(membership.c.notebook_id).filter(
        membership.c.question_id == question_id, membership.c.notebook_id.isnot(None),
    ).all()]


def _progress(db, notebook_id, now):
    membership = question_notebook_membership(db)
    ids = db.query(membership.c.question_id).filter(
        membership.c.notebook_id == notebook_id,
    ).subquery()
    row = db.query(
        func.count(ids.c.question_id),
        func.count(UserProgress.id),
        func.sum(UserProgress.times_seen), func.sum(UserProgress.times_correct),
        func.sum(case((UserProgress.next_review_date <= now, 1), else_=0)),
    ).select_from(ids).outerjoin(UserProgress, UserProgress.question_id == ids.c.question_id).one()
    return dict(question_count=row[0], answered_count=row[1] or 0,
                correct_rate=row[3] / row[2] if row[2] else None, due_count=row[4] or 0)


def notebook_workspace(db, notebook):
    notebook_id = notebook.id
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    sources = db.query(Document).filter_by(notebook_id=notebook_id).order_by(
        Document.created_at.desc(), Document.id.desc(),
    ).all()
    counts = passage_counts(db, [source.id for source in sources])
    decks = db.query(Deck).filter_by(notebook_id=notebook_id).order_by(
        Deck.created_at.desc(), Deck.id.desc(),
    ).all()
    deck_counts = _deck_counts(db, notebook_id, now)
    held_back = dict(db.query(FlaggedQuestion.deck_id, func.count(FlaggedQuestion.id)).join(
        Deck, Deck.id == FlaggedQuestion.deck_id,
    ).filter(Deck.notebook_id == notebook_id, FlaggedQuestion.status == "pending").group_by(
        FlaggedQuestion.deck_id,
    ).all())
    canvases = db.query(Canvas).join(Document).filter(Document.notebook_id == notebook_id).order_by(
        Canvas.created_at.desc(), Canvas.id.desc(),
    ).all()
    jobs = db.query(GenerationStatus).filter(
        GenerationStatus.notebook_id == notebook_id,
        GenerationStatus.status.in_(["pending", "processing", "awaiting_confirmation", "needs_choice"]),
    ).order_by(GenerationStatus.created_at.desc()).all()
    return {
        "notebook": dict(id=notebook.id, name=notebook.name,
                         description=notebook.description, icon=notebook.icon),
        "sources": [dict(id=source.id, display_name=display_name(source),
                         file_type=source.file_type.value, num_pages=source.num_pages,
                         created_at=_iso(source.created_at), **source_fields(source, counts))
                    for source in sources],
        "artifacts": {
            "decks": [dict(id=deck.id, name=deck.name, kind=deck.kind, source_ids=deck.source_ids,
                           created_at=_iso(deck.created_at), held_back_count=held_back.get(deck.id, 0),
                           **deck_counts.get(deck.id, dict(question_count=0, due_count=0, new_count=0)))
                      for deck in decks],
            "canvases": [dict(id=canvas.id, title=canvas.title, document_id=canvas.document_id,
                              created_at=_iso(canvas.created_at)) for canvas in canvases],
        },
        "jobs": [job.to_dict() for job in jobs],
        "progress": _progress(db, notebook_id, now),
    }
