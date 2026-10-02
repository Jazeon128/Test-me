"""Exercise notebook bank endpoints through the real HTTP router."""
from datetime import datetime, timedelta

import pytest
from sqlalchemy import event

from app.models.notebook import Notebook
from app.models.document import Document, DocumentType
from app.models.deck import Deck
from app.models.question import Question, QuestionOption
from app.models.tag import Tag
from app.models.user_progress import UserProgress
from app.models.flagged_question import FlaggedQuestion


@pytest.fixture
def bank(db_session):
    db = db_session
    notebooks = [Notebook(name=name) for name in ('Bank', 'Other')]
    db.add_all(notebooks)
    db.flush()
    source = Document(notebook_id=notebooks[0].id, title='Source.pdf', filename='a.pdf',
                      original_filename='a.pdf', file_path='unused', file_size=1, file_type=DocumentType.PDF)
    other = Document(notebook_id=notebooks[1].id, title='Other', filename='b.pdf',
                     original_filename='b.pdf', file_path='unused', file_size=1, file_type=DocumentType.PDF)
    db.add_all([source, other])
    db.flush()
    decks = [Deck(name=name, notebook_id=notebooks[0].id) for name in ('First', 'Second')]
    tags = [Tag(name='Local', notebook_id=notebooks[0].id), Tag(name='Shared')]
    questions = [
        Question(question_text='Document only', document_id=source.id, difficulty='easy'),
        Question(question_text='Imported', difficulty='hard'),
        Question(question_text='Both', document_id=source.id, difficulty='medium',
                 source_reference={'edited': True}, tags=tags),
        Question(question_text='Front', card_type='flashcard', explanation='Secret BACK',
                 document_id=source.id, difficulty='medium'),
        Question(question_text='Outside', document_id=other.id),
    ]
    db.add_all(decks + questions)
    db.flush()
    decks[0].questions = questions[1:4]
    decks[1].questions = [questions[2]]
    db.add(QuestionOption(question_id=questions[2].id, option_text='Unique OPTION',
                          is_correct=True, order=0))
    now = datetime.now()
    db.add_all([
        UserProgress(question_id=questions[1].id, next_review_date=now - timedelta(days=1)),
        UserProgress(question_id=questions[2].id, next_review_date=now + timedelta(days=1),
                     times_seen=3, times_correct=2),
        UserProgress(question_id=questions[3].id, next_review_date=now + timedelta(days=1),
                     is_mastered=True),
    ])
    # Fixed timestamp tests the id tie breaker.
    for question in questions:
        question.created_at = datetime(2025, 1, 1)
    db.commit()
    return dict(notebook=notebooks[0], other=notebooks[1], source=source,
                decks=decks, tags=tags, questions=questions)


def fetch(client, bank, **params):
    response = client.get(f"/api/notebooks/{bank['notebook'].id}/questions", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def test_union_order_dedup_status_and_serialization(client, bank):
    result = fetch(client, bank)
    assert result['total'] == 4
    assert [item['id'] for item in result['items']] == [q.id for q in bank['questions'][3::-1]]
    assert [item['status'] for item in result['items']] == ['mastered', 'learning', 'due', 'new']
    both = result['items'][1]
    assert both['edited'] is True
    assert both['source'] == {'id': bank['source'].id, 'name': 'Source'}
    assert len(both['decks']) == 2
    assert len(both['tags']) == 2
    assert [tag['shared'] for tag in both['tags']] == [False, True]
    assert both['options'] == [{'option': 'A', 'text': 'Unique OPTION', 'is_correct': True}]
    assert both['times_seen'] == 3 and both['times_correct'] == 2
    assert result['items'][2]['source'] is None
    assert result['items'][3]['next_review_date'] is None


@pytest.mark.parametrize('key,value,indexes', [
    ('difficulty', 'hard', [1]), ('card_type', 'flashcard', [3]),
    ('status', 'new', [0]), ('status', 'due', [1]),
    ('status', 'learning', [2]), ('status', 'mastered', [3]),
    ('search', 'unique option', [2]), ('search', 'secret back', [3]),
    ('search', 'DOCUMENT ONLY', [0]), ('search', '%', []),
])
def test_filters(client, bank, key, value, indexes):
    result = fetch(client, bank, **{key: value})
    assert {item['id'] for item in result['items']} == {bank['questions'][i].id for i in indexes}


def test_ids_and_combined_filters(client, bank):
    assert fetch(client, bank, deck_id=bank['decks'][1].id)['total'] == 1
    assert fetch(client, bank, source_id=bank['source'].id)['total'] == 3
    for tag in bank['tags']:
        assert fetch(client, bank, tag_id=tag.id)['total'] == 1
    filters = dict(deck_id=bank['decks'][0].id, source_id=bank['source'].id,
                   tag_id=bank['tags'][0].id, difficulty='medium', card_type='mcq',
                   status='learning', search='option')
    assert fetch(client, bank, **filters)['total'] == 1
    assert fetch(client, bank, **{**filters, 'status': 'due'})['total'] == 0


def test_pagination_total_and_bounds(client, bank, db_session):
    db_session.add_all([Question(question_text=f'Extra {i}', document_id=bank['source'].id)
                        for i in range(52)])
    db_session.commit()
    first = fetch(client, bank)
    assert first['total'] == 56 and len(first['items']) == 50
    assert first['offset'] == 0 and first['limit'] == 50
    assert first['items'][0]['question_text'] == 'Extra 51'
    second = fetch(client, bank, offset=50)
    assert second['total'] == 56 and len(second['items']) == 6
    assert not {i['id'] for i in first['items']} & {i['id'] for i in second['items']}
    assert fetch(client, bank, offset=100)['items'] == []
    assert len(fetch(client, bank, limit=1)['items']) == 1


@pytest.mark.parametrize('params', [
    {'offset': -1}, {'limit': 0}, {'limit': 51}, {'limit': 'bad'},
    {'deck_id': 0}, {'source_id': -1}, {'tag_id': 'bad'},
    {'difficulty': 'unknown'}, {'card_type': 'quiz'}, {'status': 'unknown'},
])
def test_invalid_values(client, bank, params):
    response = client.get(f"/api/notebooks/{bank['notebook'].id}/questions", params=params)
    assert response.status_code == 422


def test_unknown_notebook(client):
    assert client.get('/api/notebooks/99999/questions').status_code == 404
    assert client.get('/api/notebooks/99999/held-back').status_code == 404


def test_held_back_union_pending_only(client, bank, db_session):
    items = [
        FlaggedQuestion(deck_id=bank['decks'][0].id, payload={'question': 'Stem'}, reasons=['reason']),
        FlaggedQuestion(document_id=bank['source'].id,
                        payload={'card_type': 'flashcard', 'front': 'Front'}, reasons=['check']),
        FlaggedQuestion(document_id=bank['source'].id, payload={'question': 'Discarded'},
                        reasons=[], status='discarded'),
        FlaggedQuestion(payload={'question': 'Unrelated'}, reasons=[]),
    ]
    db_session.add_all(items)
    db_session.commit()
    response = client.get(f"/api/notebooks/{bank['notebook'].id}/held-back")
    assert response.status_code == 200
    result = response.json()
    assert [item['id'] for item in result] == [items[1].id, items[0].id]
    assert result[0]['card_type'] == 'flashcard' and result[0]['question_text'] == 'Front'
    assert result[0]['source']['name'] == 'Source' and result[0]['deck'] is None
    assert result[1]['deck']['name'] == 'First' and result[1]['reasons'] == ['reason']


def test_eager_loading_has_fixed_query_count(client, bank, db_session):
    statements = []
    def record(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)
    event.listen(db_session.bind, 'before_cursor_execute', record)
    try:
        fetch(client, bank)
    finally:
        event.remove(db_session.bind, 'before_cursor_execute', record)
    assert len(statements) <= 7
