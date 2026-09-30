"""Upload stores the public oEmbed title before generation."""
from unittest.mock import Mock

import pytest
import requests

from app.models.document import Document


@pytest.mark.parametrize("failure,expected", [
    (False, "Cloud fundamentals"), (True, "YouTube video dQw4w9WgXcQ"),
])
def test_upload_stores_youtube_title(client, db_session, monkeypatch, failure, expected):
    response = Mock()
    response.json.return_value = {"title": "Cloud fundamentals"}
    fetch = Mock(return_value=response)
    if failure:
        fetch.side_effect = requests.Timeout("Timed out")
    monkeypatch.setattr("app.services.parsers.youtube.requests.get", fetch)
    monkeypatch.setattr("app.api.documents.process_document", Mock())
    result = client.post(
        "/api/documents/upload",
        files={"files": ("video.youtube", b"https://youtu.be/dQw4w9WgXcQ", "text/plain")},
        data={"num_questions": "1"},
    )
    assert result.status_code == 200, result.text
    document = db_session.query(Document).one()
    assert document.title == expected
    assert result.json()["documents"][0]["display_name"] == expected
    fetch.assert_called_once_with(
        "https://www.youtube.com/oembed",
        params={"url": "https://youtu.be/dQw4w9WgXcQ", "format": "json"}, timeout=10,
    )


def test_source_lists_use_display_name(client, db_session, sample_test, sample_document):
    from app.models.notebook import Notebook

    notebook = Notebook(name="Cloud")
    db_session.add(notebook)
    db_session.flush()
    sample_document.notebook_id = notebook.id
    sample_document.original_filename = "AWS-cheat-sheet.docx.pdf"
    sample_document.title = "AWS Cheat Sheet.docx"
    db_session.commit()
    expected = "AWS Cheat Sheet"
    assert client.get(f"/api/documents/{sample_document.id}").json()["display_name"] == expected
    assert client.get("/api/documents/").json()[0]["display_name"] == expected
    assert client.get(f"/api/notebooks/{notebook.id}").json()["documents"][0]["display_name"] == expected
    assert client.get(f"/api/decks/{sample_test.id}").json()["documents"][0]["display_name"] == expected
