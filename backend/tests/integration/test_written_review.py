"""Written grading must update the same progress and SM-2 record as choice reviews."""

import pytest

from app.api import progress
from app.models.user_progress import UserProgress


@pytest.mark.parametrize("quality", [0, 1, 2, 3, 4, 5])
def test_written_review_uses_server_grade(client, db_session, sample_question, monkeypatch, quality):
    monkeypatch.setattr(progress, "require_typesafe_key", lambda db: "test-key")
    monkeypatch.setattr(progress, "grade_to_response", lambda *args: {
        "quality": quality, "passed": quality >= 3, "expected_answer": "Python"
    })
    response = client.post("/api/progress/submit", json={
        "question_id": sample_question.id, "written_answer": "Python",
        "manual_quality": 5, "time_taken_seconds": 12,
    })
    assert response.status_code == 200
    assert response.json()["correct"] is (quality >= 3)
    row = db_session.query(UserProgress).filter_by(question_id=sample_question.id).one()
    assert row.times_seen == 1
    assert row.times_correct == int(quality >= 3)
    assert row.attempt_history[-1]["quality"] == quality
    assert row.repetitions == int(quality >= 3)


def test_grading_unavailable_does_not_record_attempt(client, db_session, sample_question, monkeypatch):
    from fastapi import HTTPException

    def unavailable(*args):
        raise HTTPException(status_code=503, detail="Grading unavailable")

    monkeypatch.setattr(progress, "require_typesafe_key", lambda db: "test-key")
    monkeypatch.setattr(progress, "grade_to_response", unavailable)
    response = client.post("/api/progress/submit", json={
        "question_id": sample_question.id, "written_answer": "Python", "time_taken_seconds": 12,
    })
    assert response.status_code == 503
    assert db_session.query(UserProgress).filter_by(question_id=sample_question.id).count() == 0


def test_timeout_is_not_option_a(client, sample_question):
    response = client.post("/api/progress/submit", json={
        "question_id": sample_question.id, "selected_option": "", "time_taken_seconds": 30,
        "manual_quality": 0,
    })
    assert response.status_code == 200
    assert response.json()["correct"] is False


def test_written_answer_without_key_is_503_and_records_nothing(client, db_session, sample_question):
    # conftest blanks TYPESAFE_API_KEY, so this is the real no-key path.
    response = client.post("/api/progress/submit", json={
        "question_id": sample_question.id, "written_answer": "Python", "time_taken_seconds": 12,
    })
    assert response.status_code == 503
    assert "TypeSafe" in response.json()["error"]["message"]
    assert db_session.query(UserProgress).filter_by(question_id=sample_question.id).count() == 0
