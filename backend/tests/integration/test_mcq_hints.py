import pytest

from app.models.question import Question
from app.models.user_progress import UserProgress


@pytest.mark.parametrize('hinted,selected,quality', [
    (True, 'A', None), (True, 'A', 5), (False, 'A', 5), (True, 'B', 2),
])
def test_hint_recording(client, db_session, sample_question, hinted, selected, quality):
    response = client.post('/api/progress/submit', json={
        'question_id': sample_question.id, 'selected_option': selected,
        'time_taken_seconds': 2, 'manual_quality': quality, 'hint_used': hinted,
    })
    assert response.status_code == 200
    assert response.json()['correct'] is (selected == 'A')
    db_session.expire_all()
    recorded = db_session.query(UserProgress).one().attempt_history[-1]
    if hinted:
        assert recorded['hinted'] is True
        assert recorded['quality'] <= 3
    else:
        assert 'hinted' not in recorded
        assert recorded['quality'] == 5


def test_flashcard_rejects_hint(client, db_session):
    card = Question(card_type='flashcard', question_text='Front', explanation='Back')
    db_session.add(card)
    db_session.commit()
    response = client.post('/api/progress/submit', json={
        'question_id': card.id, 'time_taken_seconds': 2,
        'manual_quality': 5, 'hint_used': True,
    })
    assert response.status_code == 422
    assert db_session.query(UserProgress).count() == 0
