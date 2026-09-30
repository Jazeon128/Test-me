from pathlib import Path
import tempfile

import pytest

from app.models.document import Document, DocumentType
from app.services import ingest
from scripts.backfill_source_passages import run


@pytest.fixture
def source_path():
    with tempfile.NamedTemporaryFile(suffix=".md", delete=False) as handle:
        path = Path(handle.name)
    try:
        yield path
    finally:
        path.unlink(missing_ok=True)


def test_dry_run(db_session, source_path, capsys):
    path = source_path
    path.write_text("# Topic\n\nUseful source text with enough facts to study.")
    document = Document(filename="source.md", original_filename="source.md",
                        file_type=DocumentType.MARKDOWN, file_path=str(path), file_size=20)
    db_session.add(document)
    db_session.commit()
    run(db_session, apply=False)
    db_session.expire_all()
    assert not document.passages
    assert document.content is None
    assert document.parsed_at is None
    assert document.status == "processing"
    assert "passages=" in capsys.readouterr().out


def test_apply(db_session, source_path, monkeypatch, capsys):
    def unexpected(*args, **kwargs):
        raise AssertionError("Backfill must not assess sources")
    monkeypatch.setattr(ingest.sourcing, "assess_source", unexpected)
    path = source_path
    path.write_text("# Topic\n\nUseful source text with enough facts to study.")
    document = Document(filename="source.md", original_filename="source.md",
                        file_type=DocumentType.MARKDOWN, file_path=str(path), file_size=20)
    db_session.add(document)
    db_session.commit()
    run(db_session, apply=True)
    assert document.passages
    assert document.content
    assert document.status == "ready"
    assert document.parsed_at is not None
    assert document.preflight is None
    assert "passages=" in capsys.readouterr().out
    run(db_session, apply=True)
    assert capsys.readouterr().out == ""


def test_missing_file(db_session, source_path, capsys):
    source_path.unlink()
    document = Document(filename="missing.md", original_filename="missing.md",
                        file_type=DocumentType.MARKDOWN, file_path=str(source_path),
                        file_size=20)
    db_session.add(document)
    db_session.commit()
    run(db_session, apply=False)
    assert document.status == "processing"
    assert "failed: Missing file" in capsys.readouterr().out
    run(db_session, apply=True)
    assert document.status == "failed"
    assert "Missing file" in document.error_message
    assert "failed: Missing file" in capsys.readouterr().out


@pytest.mark.parametrize("content", [None, "Stored transcript " * 200])
def test_youtube_backfill_is_offline(db_session, source_path, monkeypatch, content):
    def unexpected(*args, **kwargs):
        raise AssertionError("Offline backfill must not fetch a transcript")
    monkeypatch.setattr(ingest.YouTubeParser, "get_transcript", unexpected)
    source_path.write_text("https://youtu.be/abcdefghijk")
    document = Document(filename="video.youtube", original_filename="video.youtube",
                        file_type=DocumentType.YOUTUBE, file_path=str(source_path),
                        file_size=28, content=content, title="Saved title")
    db_session.add(document)
    db_session.commit()
    run(db_session, apply=True)
    if content:
        assert document.status == "ready"
        assert document.passages
        assert document.title == "Saved title"
        assert document.passages[0].locator == "Part 1"
    else:
        assert document.status == "failed"
        assert "No stored YouTube transcript" in document.error_message
