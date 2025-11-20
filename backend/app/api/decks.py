from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional

from ..db import get_db
from ..models.test import Test
from ..models.document import Document

router = APIRouter()


class CreateDeckRequest(BaseModel):
    name: str
    description: Optional[str] = ""


class UpdateDeckRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


@router.post("/")
async def create_deck(request: CreateDeckRequest, db: Session = Depends(get_db)):
    """Create a new empty deck"""
    deck = Test(name=request.name, description=request.description or "")
    db.add(deck)
    db.commit()
    db.refresh(deck)

    return {
        "id": deck.id,
        "name": deck.name,
        "description": deck.description,
        "num_questions": 0,
        "created_at": deck.created_at,
    }


@router.get("/")
async def list_decks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """List all decks"""
    decks = db.query(Test).offset(skip).limit(limit).all()

    return [
        {
            "id": deck.id,
            "name": deck.name,
            "description": deck.description,
            "num_questions": len(deck.questions),
            "created_at": deck.created_at,
        }
        for deck in decks
    ]


@router.get("/{deck_id}")
async def get_deck(deck_id: int, db: Session = Depends(get_db)):
    """Get deck details with all questions"""
    deck = db.query(Test).filter(Test.id == deck_id).first()

    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    # Get unique documents that contributed to this deck
    document_ids = set()
    for question in deck.questions:
        document_ids.add(question.document_id)

    documents = []
    for doc_id in document_ids:
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if doc:
            documents.append({
                "id": doc.id,
                "filename": doc.original_filename,
                "title": doc.title,
            })

    return {
        "id": deck.id,
        "name": deck.name,
        "description": deck.description,
        "num_questions": len(deck.questions),
        "documents": documents,
        "questions": [
            {
                "id": q.id,
                "question_text": q.question_text,
                "difficulty": q.difficulty,
                "document_id": q.document_id,
            }
            for q in deck.questions
        ],
        "created_at": deck.created_at,
    }


@router.put("/{deck_id}")
async def update_deck(deck_id: int, request: UpdateDeckRequest, db: Session = Depends(get_db)):
    """Update deck name/description"""
    deck = db.query(Test).filter(Test.id == deck_id).first()

    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    if request.name is not None:
        deck.name = request.name
    if request.description is not None:
        deck.description = request.description

    db.commit()
    db.refresh(deck)

    return {
        "id": deck.id,
        "name": deck.name,
        "description": deck.description,
        "num_questions": len(deck.questions),
    }


@router.delete("/{deck_id}")
async def delete_deck(deck_id: int, db: Session = Depends(get_db)):
    """Delete a deck (questions remain)"""
    deck = db.query(Test).filter(Test.id == deck_id).first()

    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    db.delete(deck)
    db.commit()

    return {"message": "Deck deleted successfully"}


@router.post("/import/csv")
async def import_csv(
    file: UploadFile = File(...),
    deck_name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Import a deck from a CSV file (Front, Back format)"""
    import csv
    import io
    from ..models.question import Question, QuestionOption
    from ..models.test import TestQuestion

    # Read file content
    content = await file.read()
    text_content = content.decode("utf-8")
    
    # Parse CSV
    csv_reader = csv.reader(io.StringIO(text_content))
    
    # Create Deck
    name = deck_name or file.filename.replace(".csv", "").replace("_", " ").title()
    deck = Test(name=name, description="Imported from CSV")
    db.add(deck)
    db.flush() # Get ID
    
    count = 0
    for row in csv_reader:
        if len(row) < 2:
            continue
            
        front = row[0].strip()
        back = row[1].strip()
        
        if not front or not back:
            continue
            
        # Create Question
        question = Question(
            question_text=front,
            explanation=back,
            difficulty="medium"
        )
        db.add(question)
        db.flush()
        
        # Create a default option (since our model requires options for MCQs)
        # For flashcard mode, this might be ignored or used as the "reveal"
        option = QuestionOption(
            question_id=question.id,
            option_text="Flip to see answer",
            is_correct=True,
            order=0
        )
        db.add(option)
        
        # Link to Deck
        test_question = TestQuestion(
            test_id=deck.id,
            question_id=question.id,
            order=count
        )
        db.add(test_question)
        count += 1
        
    db.commit()
    
    return {
        "id": deck.id,
        "name": deck.name,
        "num_questions": count,
        "message": f"Successfully imported {count} cards"
    }
