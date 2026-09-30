from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models.flagged_question import FlaggedQuestion
from ..models.deck import Deck
from .documents import _save_generated_question

router = APIRouter()


@router.get("")
def list_flagged(deck_id: int, db: Session = Depends(get_db)):
    items = db.query(FlaggedQuestion).filter_by(deck_id=deck_id, status="pending").order_by(
        FlaggedQuestion.created_at.desc(), FlaggedQuestion.id.desc()
    ).all()
    return [
        {
            "id": item.id,
            **{key: item.payload.get(key) for key in (
                "question", "options", "correct_answer", "explanation"
            )},
            "reasons": item.reasons,
            "document_id": item.document_id,
            "created_at": item.created_at,
        }
        for item in items
    ]


def _pending(item_id: int, db: Session):
    item = db.get(FlaggedQuestion, item_id)
    if item is None:
        raise HTTPException(status_code=404, detail="Held-back question not found")
    if item.status != "pending":
        raise HTTPException(status_code=409, detail="This question has already been resolved")
    return item


@router.post("/{item_id}/restore")
def restore(item_id: int, db: Session = Depends(get_db)):
    item = _pending(item_id, db)
    deck = db.get(Deck, item.deck_id) if item.deck_id is not None else None
    if deck is None:
        raise HTTPException(status_code=409, detail="This question's deck no longer exists")
    question = _save_generated_question(db, item.payload, item.document_id, deck)
    item.status = "restored"
    item.resolved_at = datetime.now()
    db.commit()
    return {"question_id": question.id}


@router.post("/{item_id}/discard")
def discard(item_id: int, db: Session = Depends(get_db)):
    item = _pending(item_id, db)
    item.status = "discarded"
    item.resolved_at = datetime.now()
    db.commit()
    return {"status": item.status}
