from sqlalchemy.orm import sessionmaker

from app.api import canvas as canvas_api
from app.models.canvas import Canvas
from app.models.generation_status import GenerationStatus
from app.models.notebook import Notebook


def test_finished_canvas_provenance(client, db_session, sample_document, monkeypatch):
    notebook = Notebook(name="Canvas sources")
    db_session.add(notebook)
    db_session.flush()
    sample_document.notebook_id = notebook.id
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
