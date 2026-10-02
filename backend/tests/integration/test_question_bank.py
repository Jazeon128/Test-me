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


def bulk(client, bank, action, indexes=(0, 2), **fields):
    return client.post(f"/api/notebooks/{bank['notebook'].id}/questions/bulk", json={
        'question_ids': [bank['questions'][i].id for i in indexes], 'action': action, **fields,
    })


@pytest.mark.parametrize('action,field', [
    ('add_to_deck', 'deck_id'), ('remove_from_deck', 'deck_id'),
    ('tag', 'tag_id'), ('untag', 'tag_id'),
])
def test_bulk_actions_and_idempotent_repeats(client, bank, db_session, action, field):
    target = bank['decks'][1] if field == 'deck_id' else bank['tags'][0]
    response = bulk(client, bank, action, **{field: target.id})
    assert response.status_code == 200, response.text
    assert response.json()['affected'] == 1 and response.json()['skipped'] == 1
    repeat = bulk(client, bank, action, **{field: target.id})
    assert repeat.json()['affected'] == 0 and repeat.json()['skipped'] == 2
    db_session.expire_all()
    for index in (0, 2):
        question = bank['questions'][index]
        if field == 'deck_id':
            assert any(link.deck_id == target.id for link in question.deck_questions) == (action == 'add_to_deck')
        else:
            assert (target in question.tags) == (action == 'tag')


@pytest.mark.parametrize('action', ['add_to_deck', 'remove_from_deck', 'tag', 'untag', 'delete'])
def test_bulk_outsiders_leave_nothing_written(client, bank, db_session, action):
    before = fetch(client, bank)
    fields = {'deck_id': bank['decks'][0].id} if action.endswith('deck') else {}
    if action in ('tag', 'untag'):
        fields = {'tag_id': bank['tags'][0].id}
    response = bulk(client, bank, action, indexes=(0, 4), **fields)
    assert response.status_code == 400
    assert str(bank['questions'][4].id) in response.json()['error']['message']
    assert fetch(client, bank) == before


@pytest.mark.parametrize('action', ['add_to_deck', 'remove_from_deck', 'tag', 'untag'])
def test_bulk_foreign_targets_rejected(client, bank, db_session, action):
    target = (Deck(name='Foreign', notebook_id=bank['other'].id) if action.endswith('deck')
              else Tag(name='Foreign', notebook_id=bank['other'].id))
    db_session.add(target)
    db_session.commit()
    before = fetch(client, bank)
    field = 'deck_id' if action.endswith('deck') else 'tag_id'
    assert bulk(client, bank, action, **{field: target.id}).status_code == 400
    assert fetch(client, bank) == before


@pytest.mark.parametrize('indexes,kind', [((3,), 'flashcards'), ((0, 3), 'quiz'), ((0,), 'quiz')])
def test_bulk_new_deck_kind_and_bank_order(client, bank, db_session, indexes, kind):
    response = bulk(client, bank, 'add_to_deck', indexes=indexes, new_deck_name='New deck')
    assert response.status_code == 200, response.text
    deck = db_session.get(Deck, response.json()['deck_id'])
    assert deck.name == 'New deck' and deck.kind == kind and deck.notebook_id == bank['notebook'].id
    assert [q.id for q in deck.questions] == [bank['questions'][i].id for i in sorted(indexes, reverse=True)]
    assert [link.order for link in sorted(deck.deck_questions, key=lambda link: link.order)] == list(range(len(indexes)))


def test_bulk_appends_after_maximum(client, bank, db_session):
    from app.models.deck import DeckQuestion
    deck = bank['decks'][1]
    link = db_session.query(DeckQuestion).filter_by(deck_id=deck.id).one()
    link.order = 17
    db_session.commit()
    result = bulk(client, bank, 'add_to_deck', indexes=(0, 1, 2, 3), deck_id=deck.id)
    assert result.json()['affected'] == 3 and result.json()['skipped'] == 1
    links = db_session.query(DeckQuestion).filter_by(deck_id=deck.id).order_by(DeckQuestion.order).all()
    assert [(link.question_id, link.order) for link in links] == [
        (bank['questions'][i].id, order) for i, order in [(2, 17), (3, 18), (1, 19), (0, 20)]
    ]


def test_bulk_shared_tag(client, bank):
    response = bulk(client, bank, 'tag', tag_id=bank['tags'][1].id)
    assert response.status_code == 200 and response.json()['affected'] == 1


def test_bulk_delete_matches_single_cleanup(client, bank, db_session):
    from app.models.deck import DeckQuestion
    from app.models.tag import question_tags
    # Each deleted question has options, progress, tags and links in two decks.
    first, second = bank['questions'][1:3]
    first.tags = list(second.tags)
    first.options.append(QuestionOption(option_text='First', is_correct=True, order=0))
    bank['decks'][1].deck_questions.append(DeckQuestion(question_id=first.id, order=9))
    db_session.commit()
    ids = [first.id, second.id]
    assert client.delete(f'/api/questions/{first.id}').status_code == 200
    response = bulk(client, bank, 'delete', indexes=(2,))
    assert response.json() == {'action': 'delete', 'affected': 1, 'skipped': 0}
    for question_id in ids:
        assert db_session.get(Question, question_id) is None
        assert db_session.query(QuestionOption).filter_by(question_id=question_id).count() == 0
        assert db_session.query(UserProgress).filter_by(question_id=question_id).count() == 0
        assert db_session.query(DeckQuestion).filter_by(question_id=question_id).count() == 0
        assert db_session.execute(question_tags.select().where(question_tags.c.question_id == question_id)).all() == []
    assert db_session.query(Tag).count() == 2
    assert db_session.query(Deck).count() == 2
    assert bulk(client, bank, 'delete', indexes=(2,)).status_code == 400


def test_bulk_atomic_rollback_after_write_failure(client, bank, db_session):
    from app.models.deck import DeckQuestion
    before = fetch(client, bank)
    deck_count = db_session.query(Deck).count()
    def fail(mapper, connection, target):
        raise RuntimeError('Injected link failure')
    event.listen(DeckQuestion, 'before_insert', fail)
    try:
        with pytest.raises(RuntimeError, match='Injected link failure'):
            bulk(client, bank, 'add_to_deck', indexes=(0, 3), new_deck_name='Rolled back')
    finally:
        event.remove(DeckQuestion, 'before_insert', fail)
    assert db_session.query(Deck).count() == deck_count
    assert fetch(client, bank) == before


@pytest.mark.parametrize('fields', [
    {'question_ids': []}, {'question_ids': [1, 1]}, {'question_ids': list(range(501))},
    {'deck_id': None}, {'new_deck_name': ''}, {'new_deck_name': ' '},
    {'new_deck_name': 'x' * 256}, {'new_deck_name': 'Both'}, {'action': 'unknown'},
])
def test_bulk_bounds_and_required_fields(client, bank, fields):
    body = dict(question_ids=[bank['questions'][0].id], action='add_to_deck', deck_id=bank['decks'][0].id)
    body.update(fields)
    if 'new_deck_name' in fields and fields['new_deck_name'] != 'Both':
        body.pop('deck_id')
    response = client.post(f"/api/notebooks/{bank['notebook'].id}/questions/bulk", json=body)
    assert response.status_code == 422


def test_practice_exact_order_includes_not_due_and_flashcards(client, bank):
    ids = [bank['questions'][i].id for i in (2, 0, 3, 1)]
    response = client.post(f"/api/notebooks/{bank['notebook'].id}/questions/practice", json={'question_ids': ids})
    assert response.status_code == 200
    data = response.json()
    assert data['num_questions'] == 4
    assert [q['id'] for q in data['questions']] == ids
    assert data['questions'][0]['correct_option'] == 'A'
    assert data['questions'][0]['options'] == [{'option': 'A', 'text': 'Unique OPTION'}]
    assert data['questions'][2]['card_type'] == 'flashcard'
    assert data['questions'][2]['explanation'] == 'Secret BACK'


@pytest.mark.parametrize('ids,status', [([], 422), ([1, 1], 422), (list(range(201)), 422), ([999999], 400)])
def test_practice_bounds_and_outsiders(client, bank, ids, status):
    response = client.post(f"/api/notebooks/{bank['notebook'].id}/questions/practice", json={'question_ids': ids})
    assert response.status_code == status


def test_practice_and_bulk_upper_bounds(client, bank, db_session):
    extra = [Question(question_text=f'Bound {i}', document_id=bank['source'].id) for i in range(500)]
    db_session.add_all(extra)
    db_session.commit()
    ids = [q.id for q in extra]
    practice = client.post(f"/api/notebooks/{bank['notebook'].id}/questions/practice", json={'question_ids': ids[:200]})
    assert practice.status_code == 200 and practice.json()['num_questions'] == 200
    result = client.post(f"/api/notebooks/{bank['notebook'].id}/questions/bulk", json={
        'question_ids': ids, 'action': 'tag', 'tag_id': bank['tags'][1].id,
    })
    assert result.status_code == 200 and result.json()['affected'] == 500
