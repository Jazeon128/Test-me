from sqlalchemy.orm import sessionmaker
import pytest

from app.api import canvas as canvas_api
from app.models.canvas import Canvas
from app.models.generation_status import GenerationStatus
from app.models.notebook import Notebook
from app.models.document import DocumentType


def test_finished_canvas_provenance(client, db_session, sample_document, monkeypatch):
    notebook = Notebook(name="Canvas sources")
    db_session.add(notebook)
    db_session.flush()
    sample_document.notebook_id = notebook.id
    db_session.commit()
    sample_document.status = "ready"
    db_session.commit()
    monkeypatch.setattr(canvas_api, "SessionLocal", sessionmaker(bind=db_session.get_bind()))
    monkeypatch.setattr(canvas_api, "_sections_for", lambda document: [
        dict(id="s0", text="Source text", heading="Topic", page=1),
    ])
    monkeypatch.setattr(canvas_api.viz_generator, "generate", lambda **kwargs: {"nodes": [], "edges": []})
    response = client.post("/api/canvas/generate", json=dict(
        document_id=sample_document.id, request_text="Draw the process", template="flowchart",
    ))
    assert response.status_code == 200
    db_session.expire_all()
    job = db_session.query(GenerationStatus).one()
    canvas = db_session.query(Canvas).one()
    assert job.status == "completed"
    assert job.kind == "canvas"
    assert job.result_id == canvas.id
    assert job.deck_id is None
    assert job.notebook_id == notebook.id
    assert job.source_ids == [sample_document.id]


@pytest.mark.parametrize("file_type,title,expected", [
    (DocumentType.PDF, "Cells.pdf", "Cells"),
    (DocumentType.YOUTUBE, "How cells work.pdf", "How cells work.pdf"),
    (DocumentType.PDF, None, "test_document"),
])
def test_canvas_and_document_source_context(client, db_session, sample_document, file_type, title, expected):
    notebook = Notebook(name="Biology")
    db_session.add(notebook)
    db_session.flush()
    sample_document.notebook_id = notebook.id
    sample_document.title = title
    sample_document.file_type = file_type
    canvas = Canvas(document=sample_document, request_text="Draw cells", template="flowchart",
                    payload_json={"nodes": [], "edges": []}, sources_json=[])
    db_session.add(canvas)
    db_session.commit()

    serialized = canvas_api._serialize(canvas)
    assert serialized["source_name"] == expected
    assert serialized["document_name"] == (title or sample_document.original_filename)
    response = client.get(f"/api/canvas/{canvas.id}")
    assert response.status_code == 200
    assert response.json()["source_name"] == expected
    assert response.json()["notebook_id"] == notebook.id
    assert response.json()["notebook_name"] == "Biology"

    response = client.get(f"/api/documents/{sample_document.id}")
    assert response.status_code == 200
    assert response.json()["display_name"] == expected
    assert response.json()["notebook_id"] == notebook.id
    assert response.json()["notebook_name"] == "Biology"


def test_document_without_notebook(client, sample_document):
    response = client.get(f"/api/documents/{sample_document.id}")
    assert response.status_code == 200
    assert response.json()["notebook_id"] is None
    assert response.json()["notebook_name"] is None
