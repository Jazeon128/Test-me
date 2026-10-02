from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel, ConfigDict

from ..db import get_db
from ..models import Tag, Question, Notebook
from ..services.workspace import question_notebook_ids

router = APIRouter()


class TagBase(BaseModel):
    name: str
    color: str = "blue"


class TagCreate(TagBase):
    notebook_id: int | None = None


class TagResponse(TagBase):
    id: int
    notebook_id: int | None
    shared: bool

    model_config = ConfigDict(from_attributes=True)


@router.get("/", response_model=List[TagResponse])
def get_tags(notebook_id: int | None = None, db: Session = Depends(get_db)):
    """List notebook tags followed by shared tags."""
    return db.query(Tag).filter(or_(
        Tag.notebook_id == notebook_id, Tag.notebook_id.is_(None),
    )).order_by(Tag.notebook_id.is_(None), Tag.name).all()


class TagDetail(TagResponse):
    question_count: int


@router.get("/{tag_id}", response_model=TagDetail)
def get_tag(tag_id: int, db: Session = Depends(get_db)):
    tag = db.get(Tag, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    return {**TagResponse.model_validate(tag).model_dump(), "question_count": len(tag.questions)}


@router.post("/", response_model=TagResponse)
def create_tag(tag: TagCreate, db: Session = Depends(get_db)):
    """Create a new tag"""
    if tag.notebook_id is not None and not db.get(Notebook, tag.notebook_id):
        raise HTTPException(status_code=404, detail="Notebook not found")
    if tag.notebook_id is not None and db.query(Tag).filter(
        Tag.name == tag.name, Tag.notebook_id.is_(None),
    ).first():
        raise HTTPException(status_code=400, detail="A shared tag has this name.")
    if db.query(Tag).filter(Tag.name == tag.name, Tag.notebook_id == tag.notebook_id).first():
        raise HTTPException(status_code=400, detail="Tag already exists")

    db_tag = Tag(name=tag.name, color=tag.color, notebook_id=tag.notebook_id)
    db.add(db_tag)
    db.commit()
    db.refresh(db_tag)
    return db_tag


@router.delete("/{tag_id}")
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    """Delete a tag"""
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    affected_questions = len(tag.questions)
    db.delete(tag)
    db.commit()
    return {"success": True, "affected_questions": affected_questions}


@router.post("/questions/{question_id}/tags/{tag_id}")
def add_tag_to_question(question_id: int, tag_id: int, db: Session = Depends(get_db)):
    """Add a tag to a question"""
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    if tag.notebook_id is not None and tag.notebook_id not in question_notebook_ids(db, question_id):
        raise HTTPException(status_code=400, detail="This tag belongs to another notebook.")

    if tag not in question.tags:
        question.tags.append(tag)
        db.commit()

    return {"success": True}


@router.delete("/questions/{question_id}/tags/{tag_id}")
def remove_tag_from_question(question_id: int, tag_id: int, db: Session = Depends(get_db)):
    """Remove a tag from a question"""
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    if tag in question.tags:
        question.tags.remove(tag)
        db.commit()

    return {"success": True}
