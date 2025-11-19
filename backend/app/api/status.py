from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models.generation_status import GenerationStatus

router = APIRouter()


@router.get("/{job_id}")
async def get_generation_status(job_id: str, db: Session = Depends(get_db)):
    """Get the status of a question generation job"""
    status = db.query(GenerationStatus).filter(GenerationStatus.job_id == job_id).first()

    if not status:
        raise HTTPException(status_code=404, detail="Generation job not found")

    return status.to_dict()


@router.get("/deck/{deck_id}")
async def get_deck_generation_status(deck_id: int, db: Session = Depends(get_db)):
    """Get the most recent generation status for a deck"""
    status = (
        db.query(GenerationStatus)
        .filter(GenerationStatus.deck_id == deck_id)
        .order_by(GenerationStatus.created_at.desc())
        .first()
    )

    if not status:
        raise HTTPException(status_code=404, detail="No generation jobs found for this deck")

    return status.to_dict()
