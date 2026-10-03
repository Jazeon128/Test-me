"""Topic mastery boundaries through the notebook API and fixture database."""
import pytest

from app.models.deck import Deck
from app.models.notebook import Notebook
from app.models.question import Question
from app.models.user_progress import UserProgress
from app.services.mastery import notebook_mastery


def attempt(correct=True, date='2026-10-01T12:00:00Z'):
    return dict(date=date, correct=correct, time_seconds=3, quality=4)


def topic(db, document, histories, section=' Topic '):
    questions = []
    for history in histories:
        question = Question(document_id=document.id, question_text='Question',
                            source_reference={'section': section})
        db.add(question)
        db.flush()
        questions.append(question)
        if history is not None:
            db.add(UserProgress(question_id=question.id, attempt_history=history, is_mastered=True))
    db.commit()
    return questions


@pytest.fixture
def notebook(db_session, sample_document):
    notebook = Notebook(name='Notebook')
    db_session.add(notebook)
    db_session.flush()
    sample_document.notebook_id = notebook.id
    db_session.commit()
    return notebook


@pytest.mark.parametrize('histories,expected', [
    ([None, []], 'not_started'),
    ([[attempt(False)], [attempt()]], 'attempted'),
    ([[attempt()]] * 7 + [[attempt(False)]] * 3, 'familiar'),
    ([[attempt()]] * 3 + [None] * 2, 'familiar'),
    ([[attempt()], None], 'familiar'),
    ([[attempt()]] * 4 + [None], 'proficient'),
    ([[attempt()]] * 2, 'proficient'),
    ([[attempt(), attempt(date='2026-10-01T20:00:00Z')]] * 4, 'proficient'),
    ([[attempt(), attempt(date='2026-10-02T12:00:00Z')]] * 4 + [None], 'mastered'),
    ([[attempt(), attempt(date='2026-10-02T12:00:00Z')]] * 3 + [[attempt()]], 'proficient'),
    ([[attempt(date='2026-10-02T00:30:00+02:00'),
       attempt(date='2026-10-01T23:30:00Z')]], 'proficient'),
    ([[attempt(date='2026-10-01T23:30:00Z'),
       attempt(date='2026-10-02T00:30:00Z')]], 'mastered'),
    ([[attempt(False, '2026-10-02T12:00:00Z'), attempt()]], 'attempted'),
    ([[attempt(False)], [attempt()]] * 3 + [[attempt()]], 'attempted'),
])
def test_levels(client, db_session, sample_document, notebook, histories, expected):
    questions = topic(db_session, sample_document, histories)
    response = client.get(f'/api/notebooks/{notebook.id}/mastery')
    assert response.status_code == 200
    result = response.json()
    item = result['topics'][0]
    assert item['level'] == expected
    assert item['section'] == 'Topic'
    assert item['key'] == f'{sample_document.id}:Topic'
    assert item['question_count'] == len(histories)
    assert item['attempted_count'] == sum(bool(history) for history in histories)
    assert item['question_ids'] == [q.id for q in questions]
    assert sum(result['summary']['levels'].values()) == 1
    assert result['summary']['levels'][expected] == 1
    assert result['summary']['proficient_or_above'] == int(expected in ('proficient', 'mastered'))


@pytest.mark.parametrize('reference', [None, {}, {'section': None}, {'section': '  '}])
def test_general(db_session, sample_document, notebook, reference):
    questions = topic(db_session, sample_document, [None])
    questions[0].source_reference = reference
    db_session.commit()
    assert notebook_mastery(db_session, notebook.id)['topics'][0]['section'] == 'General'


def test_membership_and_source_order(db_session, sample_document, notebook):
    first = topic(db_session, sample_document, [None], section='Z section')[0]
    second = topic(db_session, sample_document, [None], section='A section')[0]
    orphan = Question(question_text='Orphan', card_type='flashcard')
    outsider = Question(question_text='Outside')
    db_session.add_all([orphan, outsider])
    db_session.flush()
    deck = Deck(name='Deck', notebook_id=notebook.id)
    db_session.add(deck)
    deck.questions = [first, orphan]
    db_session.commit()
    result = notebook_mastery(db_session, notebook.id)
    assert result['summary']['topic_count'] == 3
    assert [item['document_name'] for item in result['topics']] == ['Other questions', 'Test Document', 'Test Document']
    assert [item['question_ids'] for item in result['topics']] == [[orphan.id], [first.id], [second.id]]
    assert result['topics'][0]['document_id'] is None


def test_empty_and_unknown_notebook(client, db_session):
    notebook = Notebook(name='Empty')
    db_session.add(notebook)
    db_session.commit()
    assert client.get(f'/api/notebooks/{notebook.id}/mastery').json() == {
        'topics': [], 'summary': {'topic_count': 0, 'proficient_or_above': 0,
            'levels': {'not_started': 0, 'attempted': 0, 'familiar': 0, 'proficient': 0, 'mastered': 0}},
    }
    assert client.get('/api/notebooks/999999/mastery').status_code == 404
