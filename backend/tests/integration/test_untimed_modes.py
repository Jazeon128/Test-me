import pytest

from app.api import progress
from app.models.user_progress import UserProgress


@pytest.mark.parametrize("explain", [False, True])
@pytest.mark.parametrize("quality,expected_ef", [(3, 2.36), (5, 2.6)])
def test_untimed_pass_keeps_quality(
    client, db_session, sample_question, monkeypatch, explain, quality, expected_ef
):
    monkeypatch.setattr(progress, "require_typesafe_key", lambda db: "fake")

    def grade(*args):
        return {"passed": True, "quality": quality}

    monkeypatch.setattr(progress, "grade_to_response", grade)
    monkeypatch.setattr(progress, "explanation_to_response", grade)
    response = client.post("/api/progress/submit", json={
        "question_id": sample_question.id, "written_answer": "Python",
        "explain": explain, "time_taken_seconds": 90,
    })
    assert response.status_code == 200
    row = db_session.query(UserProgress).filter_by(question_id=sample_question.id).one()
    assert row.repetitions == 1
    assert row.easiness_factor == pytest.approx(expected_ef)
    assert row.attempt_history[-1]["quality"] == quality
    assert row.attempt_history[-1]["time_seconds"] == 90
    assert row.average_time_seconds == row.last_attempt_time_seconds == 90


def test_multiple_choice_still_has_time_penalty(client, db_session, sample_question):
    response = client.post("/api/progress/submit", json={
        "question_id": sample_question.id, "selected_option": "A", "time_taken_seconds": 90,
    })
    assert response.status_code == 200
    assert response.json()["correct"] is True
    row = db_session.query(UserProgress).filter_by(question_id=sample_question.id).one()
    assert row.repetitions == 0
    assert row.easiness_factor == pytest.approx(2.18)
