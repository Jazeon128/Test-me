from datetime import datetime, timedelta, timezone

from sqlalchemy import event

from app.models.canvas import Canvas
from app.models.deck import Deck
from app.models.document import Document, DocumentType
from app.models.flagged_question import FlaggedQuestion
from app.models.generation_status import GenerationStatus
from app.models.notebook import Notebook
from app.models.passage import DocumentPassage
from app.models.question import Question
from app.models.user_progress import UserProgress


def populate(db):
    notebook = Notebook(name="Workspace", description="Study", icon="📚")
    other = Notebook(name="Other")
    db.add_all([notebook, other])
    db.flush()
    sources = []
    for index in range(2):
        source = Document(notebook_id=notebook.id, filename=f"{index}.md",
                          original_filename=f"{index}.md", file_type=DocumentType.MARKDOWN,
                          file_path="unused", file_size=10, status="ready", num_pages=1)
        db.add(source)
        db.flush()
        db.add(DocumentPassage(document_id=source.id, ordinal=0, section_index=0, locator="Part 1",
                               text="Content", char_start=0, char_end=7))
        sources.append(source)
    questions = [Question(document_id=sources[0].id, question_text=f"Q{index}", difficulty="easy")
                 for index in range(3)]
    db.add_all(questions)
    db.flush()
    decks = [Deck(name="Quiz", notebook_id=notebook.id, source_ids=[sources[0].id]),
             Deck(name="Cards", notebook_id=notebook.id, kind="flashcards", source_ids=[sources[1].id])]
    db.add_all(decks)
    db.flush()
    decks[0].questions = questions
    decks[1].questions = [questions[0]]
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    db.add_all([
        UserProgress(question_id=questions[0].id, next_review_date=now - timedelta(days=1),
                     times_seen=4, times_correct=3),
        UserProgress(question_id=questions[1].id, next_review_date=now + timedelta(days=1),
                     times_seen=1, times_correct=0),
        FlaggedQuestion(deck_id=decks[0].id, status="pending", payload={}, reasons=[]),
        FlaggedQuestion(deck_id=decks[0].id, status="approved", payload={}, reasons=[]),
        Canvas(document_id=sources[0].id, title="Map", template="flowchart", request_text="Draw",
               payload_json={}, sources_json=[]),
        GenerationStatus(job_id="running", notebook_id=notebook.id, status="processing",
                         kind="quiz", source_ids=[sources[0].id], deck_id=decks[0].id,
                         result_id=decks[0].id),
        GenerationStatus(job_id="finished", notebook_id=notebook.id, status="completed"),
        GenerationStatus(job_id="other", notebook_id=other.id, status="pending"),
    ])
    db.commit()
    return notebook, sources, decks


def test_full_workspace(client, db_session):
    notebook, sources, decks = populate(db_session)
    response = client.get(f"/api/notebooks/{notebook.id}/workspace")
    assert response.status_code == 200
    body = response.json()
    assert set(body) == {"notebook", "sources", "artifacts", "jobs", "progress"}
    assert body["notebook"] == dict(id=notebook.id, name="Workspace", description="Study", icon="📚")
    assert [s["id"] for s in body["sources"]] == [sources[1].id, sources[0].id]
    for source in body["sources"]:
        assert set(source) == {"id", "display_name", "file_type", "num_pages", "created_at", "status",
                               "error_message", "preflight", "passage_count"}
        assert source["passage_count"] == 1
        assert source["status"] == "ready"
    artifacts = body["artifacts"]
    assert [d["id"] for d in artifacts["decks"]] == [decks[1].id, decks[0].id]
    quiz = artifacts["decks"][1]
    assert set(quiz) == {"id", "name", "kind", "source_ids", "question_count", "due_count",
                         "new_count", "held_back_count", "created_at"}
    assert [quiz[k] for k in ["question_count", "due_count", "new_count", "held_back_count"]] == [3, 1, 1, 1]
    assert artifacts["decks"][0]["kind"] == "flashcards"
    assert artifacts["decks"][0]["source_ids"] == [sources[1].id]
    assert len(artifacts["canvases"]) == 1
    assert set(artifacts["canvases"][0]) == {"id", "title", "document_id", "created_at"}
    assert artifacts["canvases"][0]["document_id"] == sources[0].id
    assert [j["job_id"] for j in body["jobs"]] == ["running"]
    assert body["jobs"][0] == db_session.query(GenerationStatus).filter_by(job_id="running").one().to_dict()
    assert body["progress"] == dict(question_count=3, answered_count=2, correct_rate=0.6, due_count=1)


def test_statement_count_independent_of_decks(client, db_session):
    notebook = Notebook(name="Fixed queries")
    db_session.add(notebook)
    db_session.flush()
    db_session.add(Deck(name="Deck 1", notebook_id=notebook.id))
    db_session.commit()
    notebook_id = notebook.id
    statements = []
    engine = db_session.get_bind()

    def record(*args):
        statements.append(args[2])

    event.listen(engine, "before_cursor_execute", record)
    try:
        db_session.expire_all()
        first = client.get(f"/api/notebooks/{notebook_id}/workspace")
        assert first.status_code == 200
        one_count = len(statements)
        for index in range(4):
            source = Document(notebook_id=notebook_id, filename=f"{index}.md",
                              original_filename=f"{index}.md", file_type=DocumentType.MARKDOWN,
                              file_path="unused", file_size=10, status="ready")
            db_session.add(source)
            db_session.flush()
            question = Question(document_id=source.id, question_text="New", difficulty="easy")
            db_session.add(question)
            db_session.flush()
            deck = Deck(name=f"Deck {index + 2}", notebook_id=notebook_id)
            db_session.add(deck)
            db_session.flush()
            deck.questions = [question]
        db_session.commit()
        db_session.expire_all()
        statements.clear()
        second = client.get(f"/api/notebooks/{notebook_id}/workspace")
        assert second.status_code == 200
        assert len(second.json()["artifacts"]["decks"]) == 5
        assert len(statements) == one_count == 9
    finally:
        event.remove(engine, "before_cursor_execute", record)
    assert first.json()["progress"]["correct_rate"] is None


def test_unknown_notebook(client):
    assert client.get("/api/notebooks/999999/workspace").status_code == 404


def test_answered_count_matches_existing_notebook_stats(client, db_session):
    notebook, _, decks = populate(db_session)
    question = decks[0].questions[2]
    db_session.add(UserProgress(question_id=question.id, times_seen=0, times_correct=0,
                                next_review_date=datetime.now(timezone.utc).replace(tzinfo=None)
                                + timedelta(days=1)))
    db_session.commit()
    workspace = client.get(f"/api/notebooks/{notebook.id}/workspace").json()
    from app.utils.cache import stats_cache
    stats_cache.invalidate_all()
    stats = client.get("/api/progress/stats/by-notebook").json()
    row = next(row for row in stats if row["notebook_id"] == notebook.id)
    assert workspace["progress"]["answered_count"] == row["questions_seen"] == 3
    assert workspace["progress"]["correct_rate"] == row["success_rate"] == 0.6
    assert workspace["artifacts"]["decks"][1]["new_count"] == 0
