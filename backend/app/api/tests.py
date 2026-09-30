"""
DEPRECATED: This module is deprecated. Use decks.py instead.

This module provides backward compatibility by redirecting to the decks API.
All new code should use /api/decks endpoints instead of /api/tests.
"""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
import os
import tempfile

from ..db import get_db
from ..models.test import Test
from ..models.question import Question
from ..services.anki_export import AnkiExporter
from ..services.csv_export import CSVExporter
from ..services.anki_all_in_one_export import AnkiAllInOneExporter
from ..utils.http_headers import content_disposition

router = APIRouter()


class CreateTestRequest(BaseModel):
    name: str
    description: str = ""
    question_ids: List[int]


class StartTestSessionRequest(BaseModel):
    test_id: int
    time_limit_seconds: int = 30  # Time limit per question


@router.post("/")
async def create_test(request: CreateTestRequest, db: Session = Depends(get_db)):
    """
    DEPRECATED: Use POST /api/decks/ instead

    Create a new test from selected questions
    """
    # Validate questions exist
    questions = db.query(Question).filter(Question.id.in_(request.question_ids)).all()

    if len(questions) != len(request.question_ids):
        raise HTTPException(status_code=400, detail="Some questions not found")

    # Create test
    test = Test(
        name=request.name,
        description=request.description,
    )
    test.questions = questions

    db.add(test)
    db.commit()
    db.refresh(test)

    return {
        "id": test.id,
        "name": test.name,
        "description": test.description,
        "num_questions": len(test.questions),
        "created_at": test.created_at,
    }


@router.get("/{test_id}")
async def get_test(test_id: int, db: Session = Depends(get_db)):
    """
    DEPRECATED: Use GET /api/decks/{deck_id} instead

    Get test details
    """
    test = db.query(Test).filter(Test.id == test_id).first()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    return {
        "id": test.id,
        "name": test.name,
        "description": test.description,
        "num_questions": len(test.questions),
        "questions": [
            {
                "id": q.id,
                "question_text": q.question_text,
                "difficulty": q.difficulty,
            }
            for q in test.questions
        ],
        "created_at": test.created_at,
    }


@router.get("/")
async def list_tests(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """
    DEPRECATED: Use GET /api/decks/ instead

    List all tests
    """
    tests = db.query(Test).offset(skip).limit(limit).all()

    return [
        {
            "id": test.id,
            "name": test.name,
            "description": test.description,
            "num_questions": len(test.questions),
            "created_at": test.created_at,
        }
        for test in tests
    ]


@router.delete("/{test_id}")
async def delete_test(test_id: int, db: Session = Depends(get_db)):
    """
    DEPRECATED: Use DELETE /api/decks/{deck_id} instead

    Delete a test
    """
    test = db.query(Test).filter(Test.id == test_id).first()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    db.delete(test)
    db.commit()

    return {"message": "Test deleted successfully"}


@router.get("/{test_id}/export/anki")
async def export_test_to_anki(test_id: int, db: Session = Depends(get_db)):
    """
    DEPRECATED: Use GET /api/decks/{deck_id}/export/anki instead

    Export test to Anki .apkg format
    """
    test = db.query(Test).filter(Test.id == test_id).first()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    if not test.questions:
        raise HTTPException(status_code=400, detail="Test has no questions")

    # Create temporary file for export
    with tempfile.NamedTemporaryFile(mode="wb", suffix=".apkg", delete=False) as tmp_file:
        output_path = tmp_file.name

    try:
        # Export to Anki
        exporter = AnkiExporter()
        exporter.export_test(db, test, output_path)

        # Read file content
        with open(output_path, "rb") as f:
            content = f.read()

        # Clean up temp file
        os.unlink(output_path)

        # Return file
        filename = f"{test.name.replace(' ', '_')}.apkg"
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


@router.get("/{test_id}/export/csv")
async def export_test_to_csv(test_id: int, db: Session = Depends(get_db)):
    """
    DEPRECATED: Use GET /api/decks/{deck_id}/export/csv instead

    Export test to CSV format compatible with Anki import
    """
    test = db.query(Test).filter(Test.id == test_id).first()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    if not test.questions:
        raise HTTPException(status_code=400, detail="Test has no questions")

    # Create temporary file for export
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".csv", delete=False, encoding="utf-8-sig"
    ) as tmp_file:
        output_path = tmp_file.name

    try:
        # Export to CSV
        exporter = CSVExporter()
        exporter.export_test(db, test, output_path)

        # Read file content
        with open(output_path, "r", encoding="utf-8-sig") as f:
            content = f.read()

        # Clean up temp file
        os.unlink(output_path)

        # Return file
        filename = f"{test.name.replace(' ', '_')}.csv"
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


@router.get("/{test_id}/export/anki-csv")
async def export_test_to_anki_csv(test_id: int, db: Session = Depends(get_db)):
    """
    DEPRECATED: Use GET /api/decks/{deck_id}/export/anki-csv instead

    Export test to Anki All-In-One CSV format
    """
    test = db.query(Test).filter(Test.id == test_id).first()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    if not test.questions:
        raise HTTPException(status_code=400, detail="Test has no questions")

    # Create temporary file for export
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".csv", delete=False, encoding="utf-8-sig"
    ) as tmp_file:
        output_path = tmp_file.name

    try:
        # Export to CSV
        exporter = AnkiAllInOneExporter()
        exporter.export_test(db, test, output_path)

        # Read file content
        with open(output_path, "r", encoding="utf-8-sig") as f:
            content = f.read()

        # Clean up temp file
        os.unlink(output_path)

        # Return file
        filename = f"{test.name.replace(' ', '_')}_AllInOne.csv"
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


@router.post("/{test_id}/start")
async def start_test_session(
    test_id: int, time_limit_seconds: int = 30, db: Session = Depends(get_db)
):
    """
    DEPRECATED: This endpoint is deprecated

    Start a test session - returns questions in order without answers

    Args:
        test_id: ID of the test to start
        time_limit_seconds: Time limit per question (default 30s)
    """
    test = db.query(Test).filter(Test.id == test_id).first()

    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    # Return questions without revealing correct answers
    questions = [
        {
            "id": q.id,
            "question_text": q.question_text,
            "options": [
                {
                    "option": chr(65 + opt.order),
                    "text": opt.option_text,
                }
                for opt in sorted(q.options, key=lambda x: x.order)
            ],
            "difficulty": q.difficulty,
        }
        for q in test.questions
    ]

    return {
        "test_id": test.id,
        "test_name": test.name,
        "num_questions": len(questions),
        "time_limit_seconds": time_limit_seconds,
        "questions": questions,
    }
