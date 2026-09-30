from ..services.source_names import display_name
from ..services.notebooks import resolve_notebook_id
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Response
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel
from typing import Optional
import os

from ..utils.cache import invalidate_stats_cache
from ..db import get_db
from ..models.test import Test
from ..models.flagged_question import FlaggedQuestion
from ..utils.http_headers import content_disposition
from .questions import FLASHCARD_PLACEHOLDER

router = APIRouter()


class CreateDeckRequest(BaseModel):
    name: str
    description: Optional[str] = ""
    notebook_id: Optional[int] = None


class UpdateDeckRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


@router.post("/")
async def create_deck(request: CreateDeckRequest, db: Session = Depends(get_db)):
    """Create a new empty deck"""
    deck = Test(name=request.name, description=request.description or "",
                notebook_id=resolve_notebook_id(db, request.notebook_id))
    db.add(deck)
    db.commit()
    invalidate_stats_cache()
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
    # Eagerly load deck_questions to avoid N+1 when counting
    decks = db.query(Test).options(joinedload(Test.deck_questions)).offset(skip).limit(limit).all()

    return [
        {
            "id": deck.id,
            "notebook_id": deck.notebook_id,
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
    # Eagerly load deck_questions and their questions/documents to avoid N+1
    from ..models.deck import DeckQuestion
    from ..models.question import Question

    deck = (
        db.query(Test)
        .options(
            joinedload(Test.deck_questions)
            .joinedload(DeckQuestion.question)
            .joinedload(Question.document),
            joinedload(Test.deck_questions)
            .joinedload(DeckQuestion.question)
            .selectinload(Question.tags),
        )
        .filter(Test.id == deck_id)
        .first()
    )

    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    # Get unique documents that contributed to this deck
    document_ids = set()
    documents_dict = {}
    for question in deck.questions:
        if question.document_id and question.document_id not in document_ids:
            document_ids.add(question.document_id)
            if question.document:
                documents_dict[question.document_id] = {
                    "id": question.document.id,
                    "filename": question.document.original_filename,
                    "title": question.document.title,
                    "display_name": display_name(question.document),
                }

    documents = list(documents_dict.values())

    return {
        "id": deck.id,
        "notebook_id": deck.notebook_id,
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
                # The deck page filters and edits by tag, so it needs them here.
                "tags": [{"id": t.id, "name": t.name, "color": t.color} for t in q.tags],
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
    invalidate_stats_cache()
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

    db.query(FlaggedQuestion).filter_by(deck_id=deck_id).delete(synchronize_session="fetch")
    db.delete(deck)
    db.commit()
    invalidate_stats_cache()

    return {"message": "Deck deleted successfully"}


@router.post("/import/csv")
async def import_csv(
    file: UploadFile = File(...), deck_name: Optional[str] = None,
    notebook_id: Optional[int] = None, db: Session = Depends(get_db)
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
    deck = Test(name=name, description="Imported from CSV",
                notebook_id=resolve_notebook_id(db, notebook_id))
    db.add(deck)
    db.flush()  # Get ID

    count = 0
    for row in csv_reader:
        if len(row) < 2:
            continue

        front = row[0].strip()
        back = row[1].strip()

        if not front or not back:
            continue

        # Create Question
        question = Question(question_text=front, explanation=back, difficulty="medium")
        db.add(question)
        db.flush()

        # Create a default option (since our model requires options for MCQs)
        # For flashcard mode, this might be ignored or used as the "reveal"
        option = QuestionOption(
            question_id=question.id, option_text=FLASHCARD_PLACEHOLDER, is_correct=True, order=0
        )
        db.add(option)

        # Link to Deck
        test_question = TestQuestion(deck_id=deck.id, question_id=question.id, order=count)
        db.add(test_question)
        count += 1

    db.commit()
    invalidate_stats_cache()

    return {
        "id": deck.id,
        "name": deck.name,
        "num_questions": count,
        "message": f"Successfully imported {count} cards",
    }


@router.get("/{deck_id}/export/anki")
async def export_deck_to_anki(deck_id: int, db: Session = Depends(get_db)):
    """Export deck to Anki .apkg format"""
    from ..services.anki_export import AnkiExporter
    from ..models.test import Test
    import tempfile

    deck = db.query(Test).filter(Test.id == deck_id).first()

    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    if not deck.questions:
        raise HTTPException(status_code=400, detail="Deck has no questions")

    # Create temporary file for export
    with tempfile.NamedTemporaryFile(mode="wb", suffix=".apkg", delete=False) as tmp_file:
        output_path = tmp_file.name

    try:
        # Export to Anki
        exporter = AnkiExporter()
        exporter.export_test(db, deck, output_path)

        # Read file content
        with open(output_path, "rb") as f:
            content = f.read()

        # Clean up temp file
        os.unlink(output_path)

        # Return file
        filename = f"{deck.name.replace(' ', '_')}.apkg"
        return Response(
            content=content,
            media_type="application/octet-stream",
            headers={"Content-Disposition": content_disposition(filename)},
        )

    except Exception as e:
        # Clean up on error
        if os.path.exists(output_path):
            os.unlink(output_path)
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.get("/{deck_id}/export/csv")
async def export_deck_to_csv(deck_id: int, db: Session = Depends(get_db)):
    """Export deck to CSV format compatible with Anki import"""
    from ..services.csv_export import CSVExporter
    from ..models.test import Test
    import tempfile

    deck = db.query(Test).filter(Test.id == deck_id).first()

    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    if not deck.questions:
        raise HTTPException(status_code=400, detail="Deck has no questions")

    # Create temporary file for export
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".csv", delete=False, encoding="utf-8-sig"
    ) as tmp_file:
        output_path = tmp_file.name

    try:
        # Export to CSV
        exporter = CSVExporter()
        exporter.export_test(db, deck, output_path)

        # Read file content
        with open(output_path, "r", encoding="utf-8-sig") as f:
            content = f.read()

        # Clean up temp file
        os.unlink(output_path)

        # Return file
        filename = f"{deck.name.replace(' ', '_')}.csv"
        return Response(
            content=content.encode("utf-8-sig"),
            media_type="text/csv",
            headers={"Content-Disposition": content_disposition(filename)},
        )

    except Exception as e:
        # Clean up on error
        if os.path.exists(output_path):
            os.unlink(output_path)
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.get("/{deck_id}/export/anki-csv")
async def export_deck_to_anki_csv(deck_id: int, db: Session = Depends(get_db)):
    """Export deck to Anki All-In-One CSV format"""
    from ..services.anki_all_in_one_export import AnkiAllInOneExporter
    from ..models.test import Test
    import tempfile

    deck = db.query(Test).filter(Test.id == deck_id).first()

    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    if not deck.questions:
        raise HTTPException(status_code=400, detail="Deck has no questions")

    # Create temporary file for export
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".csv", delete=False, encoding="utf-8-sig"
    ) as tmp_file:
        output_path = tmp_file.name

    try:
        # Export to CSV
        exporter = AnkiAllInOneExporter()
        exporter.export_test(db, deck, output_path)

        # Read file content
        with open(output_path, "r", encoding="utf-8-sig") as f:
            content = f.read()

        # Clean up temp file
        os.unlink(output_path)

        # Return file
        filename = f"{deck.name.replace(' ', '_')}_AllInOne.csv"
        return Response(
            content=content.encode("utf-8-sig"),
            media_type="text/csv",
            headers={"Content-Disposition": content_disposition(filename)},
        )

    except Exception as e:
        # Clean up on error
        if os.path.exists(output_path):
            os.unlink(output_path)
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")
