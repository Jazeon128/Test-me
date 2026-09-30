import pytest

from app.api import progress
from app.services import jev
from app.services.ai import curation


@pytest.fixture
def captured_review(monkeypatch):
    captured = {}

    def ask(state, questions, api_key, timeout, label):
        captured.update(state=state, questions=questions, timeout=timeout, label=label)
        return jev.Answers(raw={"quality": {"score": 2}})

    monkeypatch.setattr(jev, "ask", ask)
    return captured


@pytest.mark.parametrize("source", ["The source covers this fact.", "a" * 5000])
def test_review_includes_trimmed_source(source, captured_review):
    curation.review_explanation("Question?", ["A point."], "An explanation.", "", source=source)
    assert captured_review["state"]["source"] == jev.trim(source, 4000)
    assert captured_review["questions"]["wrong_0"]["instructions"] == (
        "Does `explanation[0].text` state something factually wrong? "
        "Where `source` covers the point, judge against `source`."
    )


def test_review_without_source_preserves_state_and_instruction(captured_review):
    curation.review_explanation("Question?", ["A point."], "An explanation.", "")
    assert captured_review["state"] == {
        "question": "Question?",
        "key_points": [{"index": 0, "text": "A point."}],
        "explanation": [{"index": 0, "text": "An explanation."}],
    }
    assert captured_review["questions"]["wrong_0"]["instructions"] == (
        "Does `explanation[0].text` state something factually wrong?"
    )


@pytest.mark.parametrize("use_passage", [True, False])
def test_explain_submission_passes_source(
    client, db_session, sample_question, monkeypatch, captured_review, use_passage
):
    reference = {"text": "Older citation..."}
    if use_passage:
        reference["passage"] = "The full source passage."
    sample_question.source_reference = reference
    db_session.commit()
    monkeypatch.setattr(progress, "require_typesafe_key", lambda db: "")
    response = client.post("/api/progress/submit", json={
        "question_id": sample_question.id,
        "written_answer": "An explanation.",
        "explain": True,
        "retry_allowed": True,
        "time_taken_seconds": 1,
    })
    assert response.status_code == 200
    assert response.json()["retry"] is True
    assert captured_review["state"]["source"] == (
        "The full source passage." if use_passage else "Older citation"
    )
