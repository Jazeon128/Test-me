import pytest
import importlib.util
from pathlib import Path
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import text
from sqlalchemy.orm import sessionmaker

from app import db as database
from app.api import documents
from app.models.deck import Deck
from app.models.document import Document
from app.models.generation_status import GenerationStatus
from app.models.notebook import Notebook


@pytest.fixture
def fake_generation(db_session, monkeypatch):
    monkeypatch.setattr(database, "SessionLocal", sessionmaker(bind=db_session.get_bind()))

    class FakeGenerator:
        def __init__(self, **kwargs):
            self.flagged_questions = []
            self.failed_batches = []

        def generate_questions(self, parsed, num_questions, **kwargs):
            return [dict(question=f"Q{index}", options=[dict(option="A", text="Answer")],
                         correct_answer="A") for index in range(num_questions)]

    monkeypatch.setattr(documents, "QuestionGenerator", FakeGenerator)


def upload(client, **data):
    return client.post("/api/documents/upload", data=dict(num_questions=1, skip_preflight=True, **data),
                       files={"files": ("topic.md", b"# Topic\n\nLearn these useful facts about the topic.", "text/markdown")})


@pytest.mark.parametrize("existing", [False, True])
@pytest.mark.parametrize("path", ["create", "csv", "upload"])
def test_unsorted(client, db_session, fake_generation, existing, path):
    if existing:
        db_session.add(Notebook(name="Unsorted"))
        db_session.commit()
    if path == "create":
        response = client.post("/api/decks/", json={"name": "New"})
    elif path == "csv":
        response = client.post("/api/decks/import/csv", files={"file": ("cards.csv", b"Front,Back\nQ,A\n")})
    else:
        response = upload(client)
    assert response.status_code == 200
    db_session.expire_all()
    notebook = db_session.query(Notebook).filter_by(name="Unsorted").one()
    deck = db_session.query(Deck).one()
    assert deck.notebook_id == notebook.id
    if path == "upload":
        source = db_session.query(Document).one()
        assert source.notebook_id == notebook.id
        assert deck.source_ids == [source.id]
        job = db_session.query(GenerationStatus).one()
        assert job.notebook_id == notebook.id
        assert job.source_ids == [source.id]
        assert job.result_id == job.deck_id == deck.id
        assert job.kind == "quiz"


@pytest.mark.parametrize("path", ["create", "csv", "upload"])
def test_explicit_notebook_and_unknown(client, db_session, fake_generation, path):
    notebook = Notebook(name="Explicit")
    db_session.add(notebook)
    db_session.commit()

    def send(notebook_id):
        if path == "create":
            return client.post("/api/decks/", json=dict(name="New", notebook_id=notebook_id))
        if path == "csv":
            return client.post(f"/api/decks/import/csv?notebook_id={notebook_id}",
                               files={"file": ("cards.csv", b"Front,Back\nQ,A\n")})
        return upload(client, notebook_id=notebook_id)

    assert send(999999).status_code == 404
    assert send(notebook.id).status_code == 200
    assert db_session.query(Deck).one().notebook_id == notebook.id


def test_regenerate_upload_stores_ready_passages(client, db_session, fake_generation):
    deck_id = client.post("/api/decks/", json=dict(name="Regenerate")).json()["id"]
    response = upload(client, deck_id=deck_id, regenerate=True)
    assert response.status_code == 200
    db_session.expire_all()
    source = db_session.query(Document).one()
    assert source.status == "ready"
    assert source.passages
    assert source.content
    assert source.parsed_at is not None
    job = db_session.query(GenerationStatus).one()
    assert job.kind == "regenerate"
    assert job.source_ids == [source.id]
    assert job.status == "completed"


def test_regenerate_parse_failure(client, db_session, fake_generation, monkeypatch):
    def fail(*args):
        raise ValueError("Broken document")
    monkeypatch.setattr(documents.MarkdownParser, "parse", fail)
    deck_id = client.post("/api/decks/", json=dict(name="Regenerate")).json()["id"]
    assert upload(client, deck_id=deck_id, regenerate=True).status_code == 200
    db_session.expire_all()
    source = db_session.query(Document).one()
    assert source.status == "failed"
    assert source.error_message == "Broken document"
    assert not source.passages


def test_migration_creates_unsorted_and_keeps_assignment_on_downgrade(db_session):
    path = Path(__file__).resolve().parents[2] / "alembic/versions/c3f9a2d6e8b4_add_artifact_provenance.py"
    spec = importlib.util.spec_from_file_location("provenance_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    deck = Deck(name="Orphan")
    source = Document(filename="source.md", original_filename="source.md", file_type="MARKDOWN",
                      file_path="unused", file_size=1)
    db_session.add_all([deck, source])
    db_session.commit()
    with db_session.get_bind().begin() as connection:
        context = MigrationContext.configure(connection)
        with Operations.context(context):
            migration.downgrade()
            migration.upgrade()
            notebook_id = connection.execute(text("SELECT id FROM notebooks WHERE name='Unsorted'")).scalar_one()
            for table in ("decks", "documents"):
                assert connection.execute(text(f"SELECT notebook_id FROM {table}")).scalar_one() == notebook_id
            migration.downgrade()
            for table in ("decks", "documents"):
                assert connection.execute(text(f"SELECT notebook_id FROM {table}")).scalar_one() == notebook_id
            migration.upgrade()


@pytest.mark.parametrize("existing", [False, True])
@pytest.mark.parametrize("confirmed", [False, True])
def test_failed_legacy_upload_deletes_only_new_empty_deck(
    client, db_session, fake_generation, monkeypatch, existing, confirmed,
):
    from app.exceptions import AIServiceError

    class FailedGenerator:
        def __init__(self, **kwargs):
            pass

        def generate_questions(self, *args, **kwargs):
            raise AIServiceError(message="The free-tier quota is used up (429).", provider="gemini")

    monkeypatch.setattr(documents, "QuestionGenerator", FailedGenerator)
    data = {}
    if existing:
        data["deck_id"] = client.post("/api/decks/", json=dict(name="Existing")).json()["id"]
    if confirmed:
        monkeypatch.setattr(documents, "_typesafe_key", lambda db: "fake-key")
        monkeypatch.setattr(documents, "assess_sources", lambda sources, key: [dict(
            document_id=source["id"], filename=source["filename"], checked=True,
            worth_generating=False, is_teachable=0.1, is_transcript=0.1,
        ) for source in sources])
        response = client.post("/api/documents/upload", data=dict(num_questions=1, **data), files={
            "files": ("topic.md", b"# Topic\n\nLearn these useful facts about the topic.", "text/markdown"),
        })
    else:
        response = upload(client, **data)
    assert response.status_code == 200
    result = response.json()
    if confirmed:
        assert result["status"] == "needs_confirmation"
        assert client.post(f"/api/documents/jobs/{result['job_id']}/confirm").status_code == 200
    db_session.expire_all()
    job = db_session.query(GenerationStatus).one()
    assert job.deck_created is (not existing)
    assert job.status == "failed"
    assert "quota is used up" in job.error_message
    assert job.logs
    if existing:
        assert db_session.get(Deck, result["deck_id"]) is not None
        assert job.deck_id == job.result_id == result["deck_id"]
    else:
        assert db_session.get(Deck, result["deck_id"]) is None
        assert job.deck_id is None
        assert job.result_id is None
