from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from ..db import get_db
from ..models.question import Question, QuestionOption

router = APIRouter()


@router.get("/{question_id}")
async def get_question(question_id: int, db: Session = Depends(get_db)):
    """Get a single question with options"""
    question = db.query(Question).filter(Question.id == question_id).first()

    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    return format_question(question)


@router.get("/document/{document_id}")
async def get_document_questions(
    document_id: int,
    skip: int = 0,
    limit: int = 100,
    difficulty: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all questions for a document"""
    query = db.query(Question).filter(Question.document_id == document_id)

    if difficulty:
        query = query.filter(Question.difficulty == difficulty)

    questions = query.offset(skip).limit(limit).all()

    return [format_question(q) for q in questions]


@router.delete("/{question_id}")
async def delete_question(question_id: int, db: Session = Depends(get_db)):
    """Delete a question"""
    question = db.query(Question).filter(Question.id == question_id).first()

    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    db.delete(question)
    db.commit()

    return {"message": "Question deleted successfully"}


def format_question(question: Question) -> dict:
    """Format question for API response"""
    return {
        "id": question.id,
        "document_id": question.document_id,
        "question_text": question.question_text,
        "options": [
            {
                "id": opt.id,
                "text": opt.option_text,
                "option": chr(65 + opt.order),  # A, B, C, D
                "is_correct": opt.is_correct,
            }
            for opt in sorted(question.options, key=lambda x: x.order)
        ],
        "explanation": question.explanation,
        "difficulty": question.difficulty,
        "source_reference": question.source_reference,
        "created_at": question.created_at,
    }
