from app.models.question import Question, QuestionOption
from app.utils.cache import stats_cache


def test_stats_streak_across_questions(client, db_session, sample_question):
    other = Question(question_text="Another question", explanation="Answer", difficulty="medium")
    db_session.add(other)
    db_session.flush()
    db_session.add(QuestionOption(question_id=other.id, option_text="Answer", is_correct=True, order=0))
    db_session.commit()
    stats_cache.invalidate_all()
    empty = client.get("/api/progress/stats").json()
    assert (empty["current_streak"], empty["best_streak"]) == (0, 0)

    for question_id, option, expected in [
        (sample_question.id, "A", (1, 1)),
        (other.id, "A", (2, 2)),
        (sample_question.id, "B", (0, 2)),
        (other.id, "A", (1, 2)),
    ]:
        response = client.post("/api/progress/submit", json={
            "question_id": question_id, "selected_option": option, "time_taken_seconds": 5,
        })
        assert response.status_code == 200
        stats = client.get("/api/progress/stats")
        assert stats.status_code == 200
        assert (stats.json()["current_streak"], stats.json()["best_streak"]) == expected
