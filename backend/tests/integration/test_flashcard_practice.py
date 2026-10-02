import pytest

from app.models.question import Question
from app.models.user_progress import UserProgress


@pytest.fixture
def card(db_session):
    question = Question(card_type="flashcard", question_text="Front", explanation="Back")
    db_session.add(question)
    db_session.commit()
    return question


def submit(client, card, **fields):
    return client.post("/api/progress/submit", json={
        "question_id": card.id, "time_taken_seconds": 2, **fields,
    })


def test_requires_rating(client, card, db_session):
    response = submit(client, card)
    assert response.status_code == 422
    assert response.json()["error"]["message"] == "Rate this card."
    assert db_session.query(UserProgress).count() == 0


@pytest.mark.parametrize("fields", [
    {"selected_option": "A"}, {"written_answer": "Back"},
    {"explain": True}, {"retry_allowed": True}, {"after_feedback": True},
])
def test_rejects_other_modes(client, card, db_session, fields):
    assert submit(client, card, manual_quality=3, **fields).status_code == 422
    assert db_session.query(UserProgress).count() == 0


@pytest.mark.parametrize("quality,correct", [(1, False), (3, True)])
def test_rating_drives_correctness(client, card, db_session, quality, correct):
    response = submit(client, card, manual_quality=quality)
    assert response.status_code == 200
    body = response.json()
    assert body["correct"] is correct
    assert body["correct_answer"] is None
    assert body["explanation"] == "Back"
    progress = db_session.query(UserProgress).one()
    assert progress.times_correct == int(correct)
    assert progress.times_incorrect == int(not correct)
    assert progress.streak == int(correct)
    assert progress.last_attempt_correct is correct
    assert progress.attempt_history[-1]["quality"] == quality
    assert (body["gamification"]["points_earned"] > 0) is correct


def test_hard_has_no_time_penalty(client, card, db_session):
    other = Question(card_type="flashcard", question_text="Other", explanation="Back")
    db_session.add(other)
    db_session.commit()
    for question, seconds in ((card, 2), (other, 120)):
        assert submit(client, question, manual_quality=3, time_taken_seconds=seconds).status_code == 200
    first, second = db_session.query(UserProgress).order_by(UserProgress.question_id).all()
    assert first.interval == second.interval
    assert first.easiness_factor == second.easiness_factor
    assert first.repetitions == second.repetitions
    assert abs((first.next_review_date - second.next_review_date).total_seconds()) < 2
    assert second.average_time_seconds == 120


def test_multiple_choice_uses_option_not_rating(client, sample_question):
    correct = submit(client, sample_question, selected_option="A", manual_quality=1).json()
    assert correct["correct"] is True
    assert correct["correct_answer"] == "A"
    wrong = submit(client, sample_question, selected_option="B", manual_quality=5).json()
    assert wrong["correct"] is False


def test_empty_mode_fields_allowed(client, card):
    assert submit(client, card, manual_quality=3, selected_option="",
                  written_answer="", explain=False, retry_allowed=False,
                  after_feedback=False).status_code == 200
