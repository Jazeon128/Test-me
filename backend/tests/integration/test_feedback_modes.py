"""Hint before answer, and Explain it: what is recorded, revealed and scored.

Grading is faked. What is tested is the flow: a failed first attempt returns
feedback and records nothing, a retry records, and a pass that needed help is
capped at SM-2 quality 3.
"""

from app.api import progress
from app.models.user_progress import UserProgress


def _key(monkeypatch):
    monkeypatch.setattr(progress, "require_typesafe_key", lambda db: "test-key")


def _grade(monkeypatch, quality):
    monkeypatch.setattr(progress, "grade_to_response", lambda *args: {
        "quality": quality, "passed": quality >= 3, "is_correct": 0.2, "missed_key_point": 0.9,
    })


def _submit(client, question_id, **extra):
    body = {"question_id": question_id, "written_answer": "An answer.", "time_taken_seconds": 5, **extra}
    response = client.post("/api/progress/submit", json=body)
    assert response.status_code == 200, response.text
    return response.json()


def _rows(db_session, question_id):
    return db_session.query(UserProgress).filter_by(question_id=question_id).all()


class TestHintBeforeAnswer:
    def test_failed_first_attempt_gets_a_hint_and_records_nothing(
        self, client, db_session, sample_question, monkeypatch
    ):
        _key(monkeypatch)
        _grade(monkeypatch, 1)
        monkeypatch.setattr(progress, "hint_for", lambda *args: "Think about types.")

        body = _submit(client, sample_question.id, retry_allowed=True)

        assert body == {"retry": True, "feedback": {"hint": "Think about types."}}
        assert "expected_answer" not in str(body)
        assert _rows(db_session, sample_question.id) == []

    def test_passing_first_attempt_records_at_full_quality(
        self, client, db_session, sample_question, monkeypatch
    ):
        _key(monkeypatch)
        _grade(monkeypatch, 5)

        body = _submit(client, sample_question.id, retry_allowed=True)

        assert body["retry"] is False
        assert body["written_grade"]["quality"] == 5
        assert _rows(db_session, sample_question.id)[0].attempt_history[-1]["quality"] == 5

    def test_pass_after_a_hint_is_capped_at_three(
        self, client, db_session, sample_question, monkeypatch
    ):
        _key(monkeypatch)
        _grade(monkeypatch, 5)

        body = _submit(client, sample_question.id, after_feedback=True)

        assert body["written_grade"]["quality"] == 3
        assert body["correct"] is True
        assert _rows(db_session, sample_question.id)[0].attempt_history[-1]["quality"] == 3

    def test_failed_retry_records_and_reveals(self, client, db_session, sample_question, monkeypatch):
        _key(monkeypatch)
        _grade(monkeypatch, 1)

        body = _submit(client, sample_question.id, after_feedback=True)

        assert body["correct"] is False
        assert body["written_grade"]["expected_answer"]
        assert _rows(db_session, sample_question.id)[0].times_incorrect == 1

    def test_hint_falls_back_when_no_sentence_qualifies(
        self, client, sample_question, monkeypatch
    ):
        _key(monkeypatch)
        _grade(monkeypatch, 1)
        monkeypatch.setattr(progress.hint_for.__globals__["curation"], "select_hint", lambda *a, **k: None)

        body = _submit(client, sample_question.id, retry_allowed=True)

        assert "main point" in body["feedback"]["hint"]


class TestExplainIt:
    REVIEW = {
        "quality": 2, "passed": False,
        "sentences": [{"index": 0, "text": "An answer.", "wrong": True, "unclear": False}],
        "points": [{"text": "Secret key point", "covered": False}],
        "points_covered": 0, "points_total": 1,
    }

    def test_first_attempt_flags_sentences_without_naming_missed_points(
        self, client, db_session, sample_question, monkeypatch
    ):
        _key(monkeypatch)
        monkeypatch.setattr(progress, "explanation_to_response", lambda *args: dict(self.REVIEW))

        body = _submit(client, sample_question.id, explain=True, retry_allowed=True)

        assert body["retry"] is True
        assert body["feedback"]["sentences"][0]["wrong"] is True
        assert body["feedback"]["points_total"] == 1
        assert "Secret key point" not in str(body)
        assert _rows(db_session, sample_question.id) == []

    def test_final_attempt_records_and_shows_the_points(
        self, client, db_session, sample_question, monkeypatch
    ):
        _key(monkeypatch)
        monkeypatch.setattr(progress, "explanation_to_response", lambda *args: dict(self.REVIEW))

        body = _submit(client, sample_question.id, explain=True, after_feedback=True)

        assert body["retry"] is False
        assert body["written_grade"]["points"][0]["text"] == "Secret key point"
        assert _rows(db_session, sample_question.id)[0].attempt_history[-1]["quality"] == 2

    def test_explain_uses_answer_and_explanation_as_key_points(
        self, client, sample_question, monkeypatch
    ):
        _key(monkeypatch)
        seen = {}

        def review(question_text, points, explanation, api_key, source=""):
            assert source
            seen["points"] = points
            return dict(self.REVIEW, passed=True, quality=4)

        monkeypatch.setattr(progress, "explanation_to_response", review)
        _submit(client, sample_question.id, explain=True)

        correct = next(o.option_text for o in sample_question.options if o.is_correct)
        assert seen["points"][0] == correct
