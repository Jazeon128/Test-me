from pathlib import Path

import pytest
from sqlalchemy.orm import sessionmaker

from app.models.document import Document, DocumentType
from app.models.passage import DocumentPassage
from app.models.deck import Deck
from app.models.generation_status import GenerationStatus
from app.models.notebook import Notebook
from app.models.settings import Settings
from app.services import ingest
from app.services.ai.sourcing import SourceAssessment
from app.services.parsers import MarkdownParser, YouTubeParser


@pytest.fixture
def notebook(db_session, monkeypatch):
    monkeypatch.setattr(ingest, "SessionLocal", sessionmaker(bind=db_session.get_bind()))
    notebook = Notebook(name="Sources")
    db_session.add(notebook)
    db_session.commit()
    return notebook


def upload(client, notebook):
    return client.post(f"/api/notebooks/{notebook.id}/sources", files={
        "files": ("topic.md", b"# Topic\n\nLearn these useful facts.", "text/markdown"),
    })


def test_markdown_ready_without_generation(client, db_session, notebook, monkeypatch):
    def unexpected(*args, **kwargs):
        pytest.fail("No preflight without a key")
    monkeypatch.setattr(ingest.sourcing, "assess_source", unexpected)
    response = upload(client, notebook)
    assert response.status_code == 202
    source = response.json()["sources"][0]
    assert source["status"] == "processing"
    assert source["duplicate"] is False
    document = db_session.get(Document, source["id"])
    assert document.status == "ready"
    assert document.parsed_at is not None
    assert document.preflight is None
    assert document.content
    assert document.passages
    assert db_session.query(Deck).count() == 0
    assert db_session.query(GenerationStatus).count() == 0


def test_preflight(client, db_session, notebook, monkeypatch):
    db_session.add(Settings(key="typesafe_api_key", value="fake-key"))
    db_session.commit()
    calls = []
    def assess(title, text, key):
        calls.append((title, text, key))
        return SourceAssessment(is_teachable=0.2, is_transcript=0.8)
    monkeypatch.setattr(ingest.sourcing, "assess_source", assess)
    response = upload(client, notebook)
    document = db_session.get(Document, response.json()["sources"][0]["id"])
    assert document.preflight == dict(checked=True, worth_generating=False,
                                      is_teachable=0.2, is_transcript=0.8)
    assert len(calls) == 1
    assert calls[0][2] == "fake-key"
    assert document.status == "ready"


def test_duplicate(client, db_session, notebook, monkeypatch):
    calls = []
    original = MarkdownParser.parse
    def parse(self, path):
        calls.append(path)
        return original(self, path)
    monkeypatch.setattr(MarkdownParser, "parse", parse)
    first = upload(client, notebook).json()["sources"][0]
    second = upload(client, notebook).json()["sources"][0]
    assert second["duplicate"] is True
    assert first["id"] == second["id"]
    assert db_session.query(Document).count() == 1
    assert len(calls) == 1


def test_youtube(client, db_session, notebook, monkeypatch):
    monkeypatch.setattr(YouTubeParser, "fetch_title", lambda url: "Video title")
    monkeypatch.setattr(YouTubeParser, "get_transcript", lambda self, video_id: "Transcript " * 400)
    response = client.post(f"/api/notebooks/{notebook.id}/sources", data={
        "youtube_url": "https://youtu.be/abcdefghijk",
    })
    assert response.status_code == 202
    source = response.json()["sources"][0]
    assert source["display_name"] == "Video title"
    document = db_session.get(Document, source["id"])
    assert document.file_type == DocumentType.YOUTUBE
    assert document.title == "Video title"
    assert document.status == "ready"
    assert Path(document.file_path).read_text() == "https://youtu.be/abcdefghijk"
    assert [p.locator for p in document.passages] == [
        f"Part {i + 1}" for i in range(len(document.passages))
    ]


@pytest.mark.parametrize("data, expected", [({}, 422), ({"youtube_url": "invalid"}, 400)])
def test_invalid_input(client, notebook, data, expected):
    assert client.post(f"/api/notebooks/{notebook.id}/sources", data=data).status_code == expected


def test_unknown_notebook(client):
    assert client.post("/api/notebooks/999999/sources").status_code == 404


def test_parse_failure(client, db_session, notebook, monkeypatch):
    def fail(self, path):
        raise ValueError("Cannot parse this source")
    monkeypatch.setattr(MarkdownParser, "parse", fail)
    response = upload(client, notebook)
    assert response.status_code == 202
    document = db_session.get(Document, response.json()["sources"][0]["id"])
    assert document.status == "failed"
    assert document.error_message == "Cannot parse this source"
    assert not document.passages


def test_readding_failed_source_retries_parse(client, db_session, notebook, monkeypatch):
    original = MarkdownParser.parse

    def fail(self, path):
        raise ValueError("Cannot parse this source")
    monkeypatch.setattr(MarkdownParser, "parse", fail)
    first = upload(client, notebook).json()["sources"][0]
    monkeypatch.setattr(MarkdownParser, "parse", original)
    second = upload(client, notebook).json()["sources"][0]
    assert second["id"] == first["id"]
    assert second["duplicate"] is True
    document = db_session.get(Document, first["id"])
    db_session.refresh(document)
    assert document.status == "ready"
    assert document.passages


def test_listings_and_deletion(client, db_session, notebook):
    source = upload(client, notebook).json()["sources"][0]
    document = db_session.get(Document, source["id"])
    count = len(document.passages)
    for listing in [
        client.get(f"/api/notebooks/{notebook.id}").json()["documents"][0],
        client.get("/api/documents/").json()[0],
        client.get(f"/api/documents/{document.id}").json(),
    ]:
        assert listing["passage_count"] == count
        assert listing["status"] == "ready"
        assert listing["error_message"] is None
        assert listing["preflight"] is None
    assert client.delete(f"/api/documents/{document.id}").status_code == 200
    assert db_session.query(DocumentPassage).count() == 0


def test_legacy_process_stores_passages(db_session, notebook, monkeypatch):
    from app.api import documents
    import app.db
    monkeypatch.setattr(app.db, "SessionLocal", sessionmaker(bind=db_session.get_bind()))
    class FakeGenerator:
        flagged_questions = []
        def __init__(self, **kwargs):
            pass
        def generate_questions(self, *args, **kwargs):
            return []
    monkeypatch.setattr(documents, "QuestionGenerator", FakeGenerator)
    document, _ = ingest.save_source(db_session, notebook_id=notebook.id,
                                    filename="legacy.md", content=b"# Legacy\n\nSource text with useful facts to study.")
    documents.process_document(document.id, document.file_path, document.file_type, 1, "mixed")
    db_session.refresh(document)
    assert document.status == "ready"
    assert document.parsed_at is not None
    assert document.passages


def test_legacy_parse_failure(db_session, notebook, monkeypatch):
    from app.api import documents
    import app.db
    monkeypatch.setattr(app.db, "SessionLocal", sessionmaker(bind=db_session.get_bind()))
    def fail(self, path):
        raise ValueError("Parse failed")
    monkeypatch.setattr(MarkdownParser, "parse", fail)
    document, _ = ingest.save_source(db_session, notebook_id=notebook.id,
                                    filename="bad.md", content=b"Source")
    documents.process_document(document.id, document.file_path, document.file_type, 1, "mixed")
    db_session.refresh(document)
    assert document.status == "failed"
    assert document.error_message == "Parse failed"
