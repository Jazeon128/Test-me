from unittest.mock import Mock

import pytest
from app.models.canvas import Canvas, CanvasRoutingLog
from app.models.flagged_question import FlaggedQuestion
from app.api import documents as api


def add_canvas(db, document):
    canvas = Canvas(document_id=document.id, request_text="Diagram", template="flow", payload_json={}, sources_json=[])
    db.add(canvas)
    db.flush()
    db.add(CanvasRoutingLog(canvas_id=canvas.id, document_id=document.id, request_text="Diagram"))
    db.add(CanvasRoutingLog(document_id=document.id, request_text="Pending"))
    db.add(FlaggedQuestion(document_id=document.id, payload={}, reasons=[]))
    db.commit()


def test_canvas_delete_commits_before_file_removal(client, db_session, sample_document, tmp_path, monkeypatch):
    path = tmp_path / "source.md"
    path.write_text("Source")
    sample_document.file_path = str(path)
    add_canvas(db_session, sample_document)
    remove = api.os.remove
    commit = db_session.commit
    committed = False
    def checked_commit():
        nonlocal committed
        commit()
        committed = True
    monkeypatch.setattr(db_session, "commit", checked_commit)
    def checked_remove(filename):
        assert committed
        assert db_session.get(type(sample_document), sample_document.id) is None
        assert db_session.query(Canvas).count() == 0
        remove(filename)
    monkeypatch.setattr(api.os, "remove", checked_remove)
    response = client.delete(f"/api/documents/{sample_document.id}")
    assert response.status_code == 200
    assert db_session.query(CanvasRoutingLog).count() == 0
    assert db_session.query(FlaggedQuestion).count() == 0
    assert not path.exists()


@pytest.mark.asyncio
async def test_commit_failure_keeps_file(db_session, sample_document, tmp_path, monkeypatch):
    path = tmp_path / "source.md"
    path.write_text("Source")
    sample_document.file_path = str(path)
    add_canvas(db_session, sample_document)
    monkeypatch.setattr(db_session, "commit", Mock(side_effect=RuntimeError("commit failed")))
    with pytest.raises(RuntimeError, match="commit failed"):
        await api.delete_document(sample_document.id, db_session)
    assert path.exists()


def test_file_removal_failure_returns_200(client, db_session, sample_document, tmp_path, monkeypatch):
    path = tmp_path / "source.md"
    path.write_text("Source")
    sample_document.file_path = str(path)
    add_canvas(db_session, sample_document)
    monkeypatch.setattr(api.os, "remove", Mock(side_effect=OSError("locked")))
    assert client.delete(f"/api/documents/{sample_document.id}").status_code == 200
    assert db_session.query(Canvas).count() == 0
