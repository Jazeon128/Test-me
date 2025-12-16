from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional
from pydantic import BaseModel

from app.db.database import get_db
from app.models.question import Question
from app.models.test import Test as Deck
from app.api.tags import Tag

router = APIRouter()

class SearchResult(BaseModel):
    type: str  # 'question' or 'deck'
    id: int
    title: str
    subtitle: Optional[str] = None
    url: str

class SearchResponse(BaseModel):
    results: List[SearchResult]

@router.get("/", response_model=SearchResponse)
def search(
    q: str = Query(..., min_length=2, description="Search query"),
    db: Session = Depends(get_db)
):
    results = []
    
    # Search Decks
    decks = db.query(Deck).filter(
        or_(
            Deck.name.ilike(f"%{q}%"),
            Deck.description.ilike(f"%{q}%")
        )
    ).limit(5).all()
    
    for deck in decks:
        results.append(SearchResult(
            type="deck",
            id=deck.id,
            title=deck.name,
            subtitle=f"{deck.num_questions} cards" + (f" • {deck.description}" if deck.description else ""),
            url=f"/decks/{deck.id}"
        ))
        
    # Search Questions
    questions = db.query(Question).filter(
        or_(
            Question.question_text.ilike(f"%{q}%"),
            Question.explanation.ilike(f"%{q}%")
        )
    ).limit(10).all()
    
    for question in questions:
        # Truncate long text
        front_preview = (question.question_text[:75] + '...') if len(question.question_text) > 75 else question.question_text
        back_preview = (question.explanation[:75] + '...') if question.explanation and len(question.explanation) > 75 else (question.explanation or "")
        
        # Find which deck this question belongs to (if any)
        # This is a bit expensive, but for 10 results it's fine.
        # Ideally we'd join with DeckQuestion and Deck.
        deck_id = None
        if question.deck_questions:
            deck_id = question.deck_questions[0].deck_id

        url = f"/decks/{deck_id}?question={question.id}" if deck_id else f"/questions/{question.id}"

        results.append(SearchResult(
            type="question",
            id=question.id,
            title=front_preview,
            subtitle=back_preview,
            url=url
        ))
        
    return {"results": results}
