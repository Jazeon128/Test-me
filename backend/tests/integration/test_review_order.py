from datetime import datetime, timedelta, timezone

from app.models.question import Question, QuestionOption
from app.models.user_progress import UserProgress


def test_due_questions_precede_new_in_due_order(client, db_session):
    for question_id in (1, 2, 3):
        question = Question(id=question_id, question_text=f"Question {question_id}")
        question.options = [QuestionOption(option_text="Answer", is_correct=True, order=0)]
        db_session.add(question)
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    for question_id, days in ((2, 1), (3, 3)):
        db_session.add(UserProgress(
            question_id=question_id, times_seen=1,
            next_review_date=now - timedelta(days=days),
        ))
    db_session.commit()

    response = client.post("/api/progress/review-session", json={"num_questions": 3})
    assert response.status_code == 200
    questions = response.json()["questions"]
    assert [q["id"] for q in questions] == [3, 2, 1]
    assert all(q["options"] == [{"option": "A", "text": "Answer"}] for q in questions)
