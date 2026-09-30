"""Notebook defaults shared by artifact creation paths."""

from fastapi import HTTPException

from ..models.notebook import Notebook


def unsorted_notebook_id(db):
    notebook = db.query(Notebook).filter_by(name="Unsorted").first()
    if notebook is None:
        notebook = Notebook(name="Unsorted")
        db.add(notebook)
        db.flush()
    return notebook.id


def resolve_notebook_id(db, notebook_id):
    if notebook_id is None:
        return unsorted_notebook_id(db)
    if db.get(Notebook, notebook_id) is None:
        raise HTTPException(status_code=404, detail="Notebook not found")
    return notebook_id
