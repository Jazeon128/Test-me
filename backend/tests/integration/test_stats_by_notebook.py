"""Per-notebook progress aggregation.

Covers the two routes a question can take to a notebook (through its document,
and through a deck), the de-duplication between them, and the denominators used
for the rates shown on the notebook cards.
"""

from datetime import datetime, timedelta

import pytest

from app.models.deck import Deck, DeckQuestion
from app.models.document import Document, DocumentType
from app.models.notebook import Notebook
from app.models.question import Question
from app.models.user_progress import UserProgress
from app.utils.cache import stats_cache


@pytest.fixture(autouse=True)
def clear_stats_cache():
    """stats_cache is a module-level singleton with a 5 minute TTL, so without
    this one test's result is served to the next."""
    stats_cache.invalidate_all()
    yield
    stats_cache.invalidate_all()


def _document(db, notebook_id, name="notes.pdf"):
    doc = Document(
        notebook_id=notebook_id,
        filename=name,
        original_filename=name,
        file_path=f"/uploads/{name}",
        file_type=DocumentType.PDF,
        file_size=1024,
    )
    db.add(doc)
    db.flush()
    return doc


def _question(db, document_id=None, text="Q"):
    question = Question(document_id=document_id, question_text=text, difficulty="medium")
    db.add(question)
    db.flush()
    return question


def _progress(db, question_id, seen, correct, mastered=False, due_days=1, last=None):
    progress = UserProgress(
        question_id=question_id,
        times_seen=seen,
        times_correct=correct,
        times_incorrect=seen - correct,
        is_mastered=mastered,
        next_review_date=datetime.utcnow() + timedelta(days=due_days),
        last_attempt_date=last,
    )
    db.add(progress)
    db.flush()
    return progress


@pytest.fixture
def notebook(db_session):
    nb = Notebook(name="Pharmacology", icon="💊")
    db_session.add(nb)
    db_session.flush()
    return nb


def test_returns_empty_list_when_no_notebooks(client):
    response = client.get("/api/progress/stats/by-notebook")
    assert response.status_code == 200
    assert response.json() == []


def test_notebook_with_no_material_reports_zeroes(client, db_session, notebook):
    db_session.commit()

    row = client.get("/api/progress/stats/by-notebook").json()[0]

    assert row["notebook_id"] == notebook.id
    assert row["name"] == "Pharmacology"
    assert row["icon"] == "💊"
    assert row["total_questions"] == 0
    assert row["questions_due"] == 0
    assert row["mastery_rate"] == 0
    assert row["success_rate"] == 0
    assert row["last_studied"] is None


def test_counts_questions_reached_through_their_document(client, db_session, notebook):
    doc = _document(db_session, notebook.id)

    question = _question(db_session, document_id=doc.id)
    _progress(db_session, question.id, seen=4, correct=3)
    db_session.commit()

    row = client.get("/api/progress/stats/by-notebook").json()[0]

    assert row["total_questions"] == 1
    assert row["questions_seen"] == 1
    assert row["total_attempts"] == 4
    assert row["success_rate"] == pytest.approx(0.75)


def test_counts_questions_reached_only_through_a_deck(client, db_session, notebook):
    """A hand-made card has no document, so the deck is its only route."""
    deck = Deck(notebook_id=notebook.id, name="Manual deck")
    db_session.add(deck)
    db_session.flush()

    question = _question(db_session, document_id=None)
    db_session.add(DeckQuestion(deck_id=deck.id, question_id=question.id, order=0))
    _progress(db_session, question.id, seen=2, correct=2)
    db_session.commit()

    row = client.get("/api/progress/stats/by-notebook").json()[0]

    assert row["total_questions"] == 1
    assert row["total_attempts"] == 2


def test_question_in_two_decks_of_one_notebook_counts_once(client, db_session, notebook):
    doc = _document(db_session, notebook.id)

    question = _question(db_session, document_id=doc.id)
    for name in ("Deck A", "Deck B"):
        deck = Deck(notebook_id=notebook.id, name=name)
        db_session.add(deck)
        db_session.flush()
        db_session.add(DeckQuestion(deck_id=deck.id, question_id=question.id, order=0))

    _progress(db_session, question.id, seen=1, correct=1)
    db_session.commit()

    row = client.get("/api/progress/stats/by-notebook").json()[0]

    # Reachable by three routes, counted once.
    assert row["total_questions"] == 1
    assert row["total_attempts"] == 1


def test_unassigned_material_belongs_to_no_notebook(client, db_session, notebook):
    """A document with no notebook must not inflate an unrelated notebook."""
    orphan_doc = _document(db_session, None, name="loose.pdf")

    question = _question(db_session, document_id=orphan_doc.id)
    _progress(db_session, question.id, seen=9, correct=9)
    db_session.commit()

    row = client.get("/api/progress/stats/by-notebook").json()[0]

    assert row["total_questions"] == 0
    assert row["total_attempts"] == 0


def test_mastery_rate_is_measured_against_all_questions_not_just_answered_ones(
    client, db_session, notebook
):
    """Adding new material should lower mastery, not leave it at 100%."""
    doc = _document(db_session, notebook.id)

    mastered = _question(db_session, document_id=doc.id, text="mastered")
    _progress(db_session, mastered.id, seen=5, correct=5, mastered=True)

    # Three more questions in the notebook that have never been answered.
    for i in range(3):
        _question(db_session, document_id=doc.id, text=f"untouched {i}")
    db_session.commit()

    row = client.get("/api/progress/stats/by-notebook").json()[0]

    assert row["total_questions"] == 4
    assert row["questions_seen"] == 1
    assert row["questions_mastered"] == 1
    assert row["mastery_rate"] == pytest.approx(0.25)


def test_reports_due_count_and_last_studied(client, db_session, notebook):
    doc = _document(db_session, notebook.id)

    recent = datetime(2026, 9, 20, 10, 30)
    older = datetime(2026, 9, 12, 8, 0)

    due = _question(db_session, document_id=doc.id, text="due")
    _progress(db_session, due.id, seen=1, correct=0, due_days=-2, last=older)

    not_due = _question(db_session, document_id=doc.id, text="not due")
    _progress(db_session, not_due.id, seen=1, correct=1, due_days=10, last=recent)
    db_session.commit()

    row = client.get("/api/progress/stats/by-notebook").json()[0]

    assert row["questions_due"] == 1
    assert row["last_studied"].startswith("2026-09-20")


def test_two_notebooks_do_not_mix(client, db_session, notebook):
    other = Notebook(name="Anatomy")
    db_session.add(other)
    db_session.flush()

    for nb, attempts in ((notebook, 6), (other, 2)):
        doc = _document(db_session, nb.id, name=f"{nb.name}.pdf")
        question = _question(db_session, document_id=doc.id, text=nb.name)
        _progress(db_session, question.id, seen=attempts, correct=attempts)
    db_session.commit()

    rows = {r["name"]: r for r in client.get("/api/progress/stats/by-notebook").json()}

    assert rows["Pharmacology"]["total_attempts"] == 6
    assert rows["Anatomy"]["total_attempts"] == 2
