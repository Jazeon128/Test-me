"""Malformed Jev judgments use the unavailable-grading HTTP path."""

from unittest.mock import Mock

import pytest
import requests

from app.api import progress
from app.models.user_progress import UserProgress
from app.services import jev


@pytest.mark.parametrize("body", [
    {"answers": {}},
    {"answers": {
        "quality": {"score": "NaN"},
        "is_correct": {"noul": 1},
        "missed_key_point": {"noul": 0},
    }},
])
def test_malformed_grading_matches_outage(
    client, db_session, sample_question, monkeypatch, body
):
    monkeypatch.setattr(progress, "require_typesafe_key", lambda db: "test-key")
    monkeypatch.setattr(jev, "record", Mock())
    response = Mock()
    response.json.return_value = body
    post = Mock(return_value=response)
    monkeypatch.setattr(jev.requests, "post", post)
    submission = {
        "question_id": sample_question.id,
        "written_answer": "A programming language",
        "time_taken_seconds": 12,
    }

    malformed = client.post("/api/progress/submit", json=submission)
    assert malformed.status_code == 503
    assert db_session.query(UserProgress).filter_by(question_id=sample_question.id).count() == 0

    post.side_effect = requests.ConnectionError("Jev is down")
    outage = client.post("/api/progress/submit", json=submission)
    assert outage.status_code == 503
    for result in (malformed, outage):
        error = result.json()["error"]
        assert error["code"] == "SERVICE_UNAVAILABLE"
        assert error["message"] == "The grading service is unavailable."
        assert error["request_id"]
    assert db_session.query(UserProgress).filter_by(question_id=sample_question.id).count() == 0
