"""Notebooks: the topic a set of sources and everything made from them belongs to."""

from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..models.canvas import Canvas
from ..models.deck import Deck
from ..models.document import Document
from ..models.notebook import Notebook

router = APIRouter()


class NotebookRequest(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = None


def _validate_icon(icon: Optional[str]) -> None:
    if icon is not None and not (1 <= len(icon) <= 16 and any(ord(c) > 127 for c in icon)):
        raise HTTPException(status_code=400, detail="Icon must be an emoji.")


def _counts(db: Session, notebook_id: int) -> Dict[str, int]:
    document_ids = [
        row[0] for row in db.query(Document.id).filter(Document.notebook_id == notebook_id).all()
    ]
    canvases = (
        db.query(Canvas).filter(Canvas.document_id.in_(document_ids)).count() if document_ids else 0
    )
    return {
        "sources": len(document_ids),
        "canvases": canvases,
        "decks": db.query(Deck).filter(Deck.notebook_id == notebook_id).count(),
    }


def _serialize(db: Session, notebook: Notebook) -> Dict:
    return {
        "id": notebook.id,
        "name": notebook.name,
        "description": notebook.description,
        "icon": notebook.icon,
        "created_at": notebook.created_at.isoformat() if notebook.created_at else None,
        "updated_at": notebook.updated_at.isoformat() if notebook.updated_at else None,
        **_counts(db, notebook.id),
    }


@router.get("/")
async def list_notebooks(db: Session = Depends(get_db)) -> List[Dict]:
    notebooks = db.query(Notebook).order_by(Notebook.updated_at.desc()).all()
    return [_serialize(db, n) for n in notebooks]


@router.post("/")
async def create_notebook(request: NotebookRequest, db: Session = Depends(get_db)):
    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="A notebook needs a name")

    _validate_icon(request.icon)

    notebook = Notebook(name=name, description=request.description, icon=request.icon)
    db.add(notebook)
    db.commit()
    db.refresh(notebook)
    return _serialize(db, notebook)


@router.get("/{notebook_id}")
async def get_notebook(notebook_id: int, db: Session = Depends(get_db)):
    notebook = db.query(Notebook).filter(Notebook.id == notebook_id).first()
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")

    documents = (
        db.query(Document)
        .filter(Document.notebook_id == notebook_id)
        .order_by(Document.created_at.desc())
        .all()
    )
    document_ids = [d.id for d in documents]

    canvases = (
        db.query(Canvas)
        .filter(Canvas.document_id.in_(document_ids))
        .order_by(Canvas.created_at.desc())
        .all()
        if document_ids
        else []
    )

    decks = (
        db.query(Deck)
        .filter(Deck.notebook_id == notebook_id)
        .order_by(Deck.created_at.desc())
        .all()
    )

    return {
        **_serialize(db, notebook),
        "documents": [
            {
                "id": d.id,
                "name": d.title or d.original_filename,
                "file_type": d.file_type.value if d.file_type else None,
                "num_pages": d.num_pages,
                "created_at": d.created_at.isoformat() if d.created_at else None,
            }
            for d in documents
        ],
        "canvases": [
            {
                "id": c.id,
                "template": c.template,
                "title": c.title,
                "request_text": c.request_text,
                "document_id": c.document_id,
                "routing_confidence": c.routing_confidence,
                "chosen_by_user": c.chosen_by_user,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in canvases
        ],
        "decks": [
            {
                "id": d.id,
                "name": d.name,
                "description": d.description,
                "num_questions": len(d.questions),
            }
            for d in decks
        ],
    }


@router.patch("/{notebook_id}")
async def update_notebook(
    notebook_id: int, request: NotebookRequest, db: Session = Depends(get_db)
):
    notebook = db.query(Notebook).filter(Notebook.id == notebook_id).first()
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")

    if request.icon != "":
        _validate_icon(request.icon)

    if request.name is not None and request.name.strip():
        notebook.name = request.name.strip()
    if request.description is not None:
        notebook.description = request.description
    if request.icon is not None:
        notebook.icon = request.icon or None

    db.commit()
    db.refresh(notebook)
    return _serialize(db, notebook)


@router.delete("/{notebook_id}")
async def delete_notebook(notebook_id: int, db: Session = Depends(get_db)):
    """Delete an empty notebook.

    A notebook holding sources is not deleted implicitly: that would take its
    documents, canvases and decks with it. Move or remove those first.
    """
    notebook = db.query(Notebook).filter(Notebook.id == notebook_id).first()
    if not notebook:
        raise HTTPException(status_code=404, detail="Notebook not found")

    counts = _counts(db, notebook_id)
    if counts["sources"] or counts["decks"]:
        raise HTTPException(
            status_code=409,
            detail=(
                f"This notebook still holds {counts['sources']} source(s) and "
                f"{counts['decks']} deck(s). Move or delete them first."
            ),
        )

    db.delete(notebook)
    db.commit()
    return {"success": True}
