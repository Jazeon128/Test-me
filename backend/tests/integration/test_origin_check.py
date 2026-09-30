import pytest

from app.models.question import Question
from app.models.test import Test as Deck


def import_csv(client, headers):
    return client.post('/api/decks/import/csv', headers=headers, files={
        'file': ('fake.csv', b'Front,Back\n', 'text/csv'),
    })


@pytest.mark.parametrize('headers', [
    {'Origin': 'https://attacker.example'},
    {'Origin': 'http://localhost.attacker.example'},
    {'Origin': 'https://127.0.0.1.attacker.example'},
    {'Sec-Fetch-Site': 'cross-site'},
])
def test_cross_site_import_writes_nothing(client, db_session, headers):
    response = import_csv(client, headers)
    assert response.status_code == 403
    assert response.json()['error']['message'] == 'Cross-site requests are not allowed.'
    assert db_session.query(Question).count() == 0
    assert db_session.query(Deck).count() == 0


@pytest.mark.parametrize('origin', [
    'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173',
    'http://[::1]:5173', 'https://app.localhost:8443',
    'null', 'file://renderer', None,
])
def test_allowed_import(client, db_session, origin):
    headers = {'Origin': origin} if origin is not None else {}
    if origin is not None:
        headers['Sec-Fetch-Site'] = 'cross-site'
    assert import_csv(client, headers).status_code == 200
    assert db_session.query(Question).count() == 1


def test_cross_site_delete_keeps_deck(client, db_session, sample_test):
    response = client.delete(f'/api/decks/{sample_test.id}', headers={'Origin': 'https://attacker.example'})
    assert response.status_code == 403
    assert db_session.get(Deck, sample_test.id) is not None


def test_get_is_allowed(client):
    assert client.get('/health', headers={'Origin': 'https://attacker.example', 'Sec-Fetch-Site': 'cross-site'}).status_code == 200


@pytest.mark.parametrize('method', ['POST', 'PUT', 'PATCH', 'DELETE'])
def test_pure_write_decision(method):
    from main import is_cross_site_write

    assert is_cross_site_write(method, 'https://attacker.example', None, ['http://localhost:5173'])
    assert is_cross_site_write(method, None, 'cross-site', [])
    assert not is_cross_site_write(method, None, None, [])
    assert not is_cross_site_write(method, 'null', 'cross-site', [])
