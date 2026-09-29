"""Source pre-flight: judge uploads before any generation is scheduled.

The judgment itself is faked. What is tested is the policy around it: a
rejected source holds the job, confirm generates from the stored file, cancel
removes what the upload created, and an unchecked source never blocks.
"""

import os

import pytest

from app.api import documents
from app.models.deck import Deck
from app.models.document import Document
from app.models.generation_status import GenerationStatus
from app.services.ai import sourcing

NOTES = "# Photosynthesis\n\nChlorophyll absorbs light and drives the Calvin cycle.\n"


@pytest.fixture
def scheduled(monkeypatch):
    """Record generation instead of running it."""
    calls = []
    monkeypatch.setattr(documents, "process_document", lambda *args: calls.append(args))
    return calls


def _judge(monkeypatch, teachable, checked=True):
    monkeypatch.setattr(documents, "_typesafe_key", lambda db: "test-key")
    monkeypatch.setattr(
        sourcing,
        "assess_source",
        lambda title, text, api_key, **kwargs: sourcing.SourceAssessment(
            is_teachable=teachable, is_transcript=0.1, checked=checked
        ),
    )


def _upload(client, **data):
    files = [("files", ("notes.md", NOTES.encode(), "text/markdown"))]
    response = client.post("/api/documents/upload", files=files, data=data)
    assert response.status_code == 200, response.text
    return response.json()


def test_no_key_skips_preflight_and_generates(client, scheduled):
    body = _upload(client)
    assert body["status"] == "processing"
    assert body["preflight"] == []
    assert len(scheduled) == 1


def test_teachable_source_generates_and_reports_the_check(client, monkeypatch, scheduled):
    _judge(monkeypatch, teachable=0.93)
    body = _upload(client)

    assert body["status"] == "processing"
    assert body["preflight"][0]["checked"] is True
    assert body["preflight"][0]["is_teachable"] == 0.93
    assert len(scheduled) == 1


def test_unteachable_source_waits_and_schedules_nothing(client, db_session, monkeypatch, scheduled):
    _judge(monkeypatch, teachable=0.05)
    body = _upload(client)

    assert body["status"] == "needs_confirmation"
    assert body["preflight"][0]["worth_generating"] is False
    assert scheduled == []

    job = db_session.query(GenerationStatus).filter_by(job_id=body["job_id"]).one()
    assert job.status == "awaiting_confirmation"
    assert job.pending_request["documents"][0]["filename"] == "notes.md"


def test_unchecked_source_never_blocks(client, monkeypatch, scheduled):
    _judge(monkeypatch, teachable=1.0, checked=False)
    body = _upload(client)

    assert body["status"] == "processing"
    assert body["preflight"][0]["checked"] is False
    assert len(scheduled) == 1


def test_skip_preflight_is_honoured(client, monkeypatch, scheduled):
    _judge(monkeypatch, teachable=0.05)
    body = _upload(client, skip_preflight="true")
    assert body["status"] == "processing"
    assert body["preflight"] == []


def test_confirm_generates_from_the_stored_file(client, db_session, monkeypatch, scheduled):
    _judge(monkeypatch, teachable=0.05)
    body = _upload(client)

    response = client.post(f"/api/documents/jobs/{body['job_id']}/confirm")

    assert response.status_code == 200
    assert response.json()["status"] == "processing"
    assert len(scheduled) == 1
    document_id, file_path = scheduled[0][0], scheduled[0][1]
    assert document_id == body["documents"][0]["id"]
    assert os.path.exists(file_path), "confirm must reuse the stored upload"

    job = db_session.query(GenerationStatus).filter_by(job_id=body["job_id"]).one()
    db_session.refresh(job)
    assert job.status == "pending"
    assert job.pending_request is None


def test_cancel_removes_the_upload_and_its_new_deck(client, db_session, monkeypatch, scheduled):
    _judge(monkeypatch, teachable=0.05)
    body = _upload(client)
    document = db_session.query(Document).filter_by(id=body["documents"][0]["id"]).one()
    stored_path = document.file_path

    response = client.post(f"/api/documents/jobs/{body['job_id']}/cancel")

    assert response.status_code == 200
    assert response.json()["deck_removed"] is True
    db_session.expire_all()
    assert db_session.query(Document).filter_by(id=body["documents"][0]["id"]).count() == 0
    assert db_session.query(Deck).filter_by(id=body["deck_id"]).count() == 0
    assert not os.path.exists(stored_path)
    assert scheduled == []


def test_cancel_keeps_an_existing_deck(client, db_session, monkeypatch, scheduled):
    deck = Deck(name="Existing")
    db_session.add(deck)
    db_session.commit()
    _judge(monkeypatch, teachable=0.05)

    body = _upload(client, deck_id=str(deck.id))
    response = client.post(f"/api/documents/jobs/{body['job_id']}/cancel")

    assert response.json()["deck_removed"] is False
    db_session.expire_all()
    assert db_session.query(Deck).filter_by(id=deck.id).count() == 1


def test_a_job_can_only_be_answered_once(client, monkeypatch, scheduled):
    _judge(monkeypatch, teachable=0.05)
    body = _upload(client)

    assert client.post(f"/api/documents/jobs/{body['job_id']}/confirm").status_code == 200
    assert client.post(f"/api/documents/jobs/{body['job_id']}/confirm").status_code == 409
    assert client.post(f"/api/documents/jobs/{body['job_id']}/cancel").status_code == 409
    assert len(scheduled) == 1


def test_unknown_job_is_404(client):
    assert client.post("/api/documents/jobs/nope/confirm").status_code == 404
