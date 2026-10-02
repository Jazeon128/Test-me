"""Uploads schedule generation without source judgment."""
from unittest.mock import Mock

import pytest

from app.api import documents
from app.models.settings import Settings
from app.services import jev


def test_upload_with_key_schedules_without_jev(client, db_session, monkeypatch):
    db_session.add(Settings(key="typesafe_api_key", value="fake-key"))
    db_session.commit()
    ask = Mock(side_effect=AssertionError("Upload must not call Jev"))
    monkeypatch.setattr(jev, "ask", ask)
    scheduled = Mock()
    monkeypatch.setattr(documents, "process_document", scheduled)
    response = client.post("/api/documents/upload", files={
        "files": ("notes.md", b"# Topic\n\nThe user chooses this material.", "text/markdown"),
    })
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "processing"
    assert "preflight" not in body
    scheduled.assert_called_once()
    assert scheduled.call_args.args[0] == body["documents"][0]["id"]
    ask.assert_not_called()
    for action in ("confirm", "cancel"):
        assert client.post(f"/api/documents/jobs/{body['job_id']}/{action}").status_code == 404


@pytest.mark.parametrize("action", ["confirm", "cancel"])
def test_removed_routes_are_404(client, action):
    assert client.post(f"/api/documents/jobs/unknown/{action}").status_code == 404
