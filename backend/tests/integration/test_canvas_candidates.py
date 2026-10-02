"""Canvas choices belong to the job that requested them."""

from sqlalchemy.orm import sessionmaker

from app.api import canvas
from app.models.generation_status import GenerationStatus
from app.services.viz.router import Routing


def test_candidates_stay_with_their_job(client, db_session, sample_document, monkeypatch):
    sample_document.status = "ready"
    db_session.commit()
    monkeypatch.setattr(canvas, "SessionLocal", sessionmaker(bind=db_session.bind))
    monkeypatch.setattr(canvas, "_sections_for", lambda doc: [{"id": "s0", "text": "Source"}])
    decisions = iter([
        Routing(template_id="flowchart", confidence=0.3, probabilities={"flowchart": 0.3}),
        Routing(template_id="mindmap", confidence=0.4, probabilities={"mindmap": 0.4}),
    ])
    monkeypatch.setattr(canvas.viz_router, "route", lambda **kwargs: next(decisions))

    jobs = []
    for request in ("Show the process", "Show related ideas"):
        response = client.post("/api/canvas/generate", json={
            "document_id": sample_document.id, "request_text": request,
        })
        assert response.status_code == 200
        jobs.append(response.json()["job_id"])

    for job, template in zip(jobs, ("flowchart", "mindmap")):
        response = client.get(f"/api/canvas/candidates/{job}")
        assert response.status_code == 200
        assert response.json()["candidates"][0]["id"] == template

    assert client.get("/api/canvas/candidates/nonexistent").status_code == 404


def test_pending_job_has_no_choices(client, db_session):
    db_session.add(GenerationStatus(job_id="pending-canvas", status="pending"))
    db_session.commit()
    assert client.get("/api/canvas/candidates/pending-canvas").status_code == 409


def test_unavailable_routing_offers_fallback_choices(client, db_session, sample_document, monkeypatch):
    sample_document.status = "ready"
    db_session.commit()
    monkeypatch.setattr(canvas, "SessionLocal", sessionmaker(bind=db_session.bind))
    monkeypatch.setattr(canvas, "_sections_for", lambda doc: [{"id": "s0", "text": "Source"}])

    def unavailable(**kwargs):
        raise canvas.viz_router.RoutingUnavailable("No key")

    monkeypatch.setattr(canvas.viz_router, "route", unavailable)
    response = client.post("/api/canvas/generate", json={
        "document_id": sample_document.id, "request_text": "Explain this",
    })
    job = response.json()["job_id"]
    choices = client.get(f"/api/canvas/candidates/{job}")
    assert choices.status_code == 200
    assert len(choices.json()["candidates"]) == 3
    assert all(item["probability"] is None for item in choices.json()["candidates"])
