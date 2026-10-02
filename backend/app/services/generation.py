"""Validate selected sources and allocate a deck's total question budget."""

from typing import Literal, Optional

from fastapi import HTTPException
from pydantic import BaseModel, Field

from ..models.document import Document
from ..models.deck import Deck, DeckQuestion
from ..models.flagged_question import FlaggedQuestion
from ..utils.cache import invalidate_stats_cache


class GenerateRequest(BaseModel):
    source_ids: list[int] = Field(min_length=1)
    kind: Literal["quiz", "flashcards"]
    num_questions: int = Field(ge=1, le=100)
    difficulty: Literal["easy", "medium", "hard", "mixed"]
    custom_prompt: Optional[str] = None
    deck_name: Optional[str] = None


def remove_failed_empty_deck(db, job):
    """Remove only this failed job's new deck if no study material was saved."""
    if job.status != "failed" or not job.deck_created or job.deck_id is None:
        return
    if db.query(DeckQuestion).filter_by(deck_id=job.deck_id).first() is not None:
        return
    if db.query(FlaggedQuestion).filter_by(deck_id=job.deck_id, status="pending").first() is not None:
        return
    deck = db.get(Deck, job.deck_id)
    if deck is not None:
        # Keep reviewed rows without leaving their foreign key pointing at a
        # deleted deck. Pending rows above always preserve the deck.
        db.query(FlaggedQuestion).filter_by(deck_id=deck.id).update({"deck_id": None})
        db.delete(deck)
    job.deck_id = None
    job.result_id = None
    job.add_log("Removed the empty deck created by this failed job")
    invalidate_stats_cache()


def question_split(counts, total):
    """Largest remainder allocation using integer arithmetic and id tie breaks.

    With no passages at all, use equal weights so the requested total is kept.
    """
    weights = counts if sum(counts.values()) else dict.fromkeys(counts, 1)
    denominator = sum(weights.values())
    shares = {source_id: total * weight // denominator for source_id, weight in weights.items()}
    order = sorted(weights, key=lambda source_id: (
        -(total * weights[source_id] % denominator), source_id,
    ))
    for source_id in order[:total - sum(shares.values())]:
        shares[source_id] += 1
    return [{"source_id": source_id, "num_questions": shares[source_id]}
            for source_id in sorted(shares)]


def selected_sources(db, notebook_id, request):
    ids = sorted(set(request.source_ids))
    sources = db.query(Document).filter(Document.id.in_(ids),
                                        Document.notebook_id == notebook_id).order_by(Document.id).all()
    missing = sorted(set(ids) - {source.id for source in sources})
    if missing:
        raise HTTPException(status_code=400, detail=f"Sources outside this notebook: {missing}")
    processing = [source.id for source in sources if source.status == "processing"]
    if processing:
        raise HTTPException(status_code=409, detail={
            "detail": "Sources are still processing", "processing": processing,
        })
    failed = [source.id for source in sources if source.status == "failed"]
    if failed:
        raise HTTPException(status_code=400, detail=f"Failed sources: {failed}")
    return sources
