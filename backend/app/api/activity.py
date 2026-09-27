"""The activity record: heat map, streak, totals, awards, mascot state."""

from typing import Dict

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..db import get_db
from ..models.activity import Award
from ..services import activity

router = APIRouter()


@router.get("/")
async def get_activity(days: int = Query(365, ge=7, le=730), db: Session = Depends(get_db)) -> Dict:
    """Everything the Progress page needs in one call."""
    return {
        "streak": activity.current_streak(db),
        "longest_streak": activity.longest_streak(db),
        "totals": activity.totals(db),
        "mood": activity.mood(db),
        "heatmap": activity.heatmap(db, days_back=days),
    }


@router.get("/mood")
async def get_mood(db: Session = Depends(get_db)) -> Dict:
    """Just the mascot, for the header."""
    return activity.mood(db)


@router.get("/awards")
async def list_awards(db: Session = Depends(get_db)):
    earned = db.query(Award).order_by(Award.created_at.desc()).all()
    earned_codes = {a.code for a in earned}

    locked = [
        {"code": spec.code, "title": spec.title, "description": spec.description}
        for group in (
            activity.STREAK_AWARDS,
            activity.ANSWER_AWARDS,
            activity.CANVAS_AWARDS,
            activity.MASTERY_AWARDS,
            {0: activity.ACCURACY_AWARD},
        )
        for spec in group.values()
        if spec.code not in earned_codes
    ]

    return {
        "earned": [
            {
                "code": a.code,
                "title": a.title,
                "description": a.description,
                "detail": a.detail,
                "earned_at": a.created_at.isoformat() if a.created_at else None,
            }
            for a in earned
        ],
        "locked": locked,
    }
