"""CSV flashcards use their back text when grading written practice."""

from app.api import progress, questions
from app.models.question import Question, QuestionOption
from app.models.user_progress import UserProgress


def test_legacy_flashcard_written_answer(client, db_session, monkeypatch):
    question = Question(question_text="What is the capital of France?", explanation="Paris",
                        options=[QuestionOption(option_text="Flip to see answer",
                                                is_correct=True, order=0)])
    db_session.add(question)
    db_session.commit()
    captured = {}

    def grade(question_text, expected, answer, api_key):
        captured["expected"] = expected
        captured["answer"] = answer
        return {"quality": 5, "passed": True, "expected_answer": expected}

    monkeypatch.setattr(progress, "require_typesafe_key", lambda db: "test-key")
    monkeypatch.setattr(progress, "grade_to_response", grade)
    response = client.post("/api/progress/submit", json={
        "question_id": question.id, "written_answer": "Paris", "time_taken_seconds": 5,
    })
    assert response.status_code == 200
    assert captured == {"expected": "Paris", "answer": "Paris"}
    assert response.json()["correct"] is True
    row = db_session.query(UserProgress).filter_by(question_id=question.id).one()
    assert row.times_correct == 1
    assert questions.expected_answer(question) == "Paris"
    assert questions.key_points(question) == ["Paris"]
    assert len(question.options) == 1
    assert question.options[0].option_text == "Flip to see answer"
    assert question.options[0].is_correct is True


def test_normal_four_option_question_is_unaffected(sample_question):
    assert len(sample_question.options) == 4
    assert questions.expected_answer(sample_question) == "A programming language"
    assert questions.key_points(sample_question) == [
        "A programming language", "Python is a high-level programming language.",
    ]
