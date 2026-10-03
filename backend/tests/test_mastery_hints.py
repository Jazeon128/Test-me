import pytest

from tests.test_mastery import attempt, notebook, topic  # noqa: F401
from app.services.mastery import notebook_mastery


@pytest.mark.parametrize('hint_position,expected', [(1, 'familiar'), (0, 'proficient')])
def test_hints_exclude_unaided_mastery(db_session, sample_document, notebook, hint_position, expected):
    history = [attempt(), attempt(date='2026-10-02T12:00:00Z')]
    history[hint_position]['hinted'] = True
    topic(db_session, sample_document, [[attempt(), attempt(date='2026-10-02T12:00:00Z')]] * 3 + [history])
    result = notebook_mastery(db_session, notebook.id)
    assert result['topics'][0]['level'] == expected
    assert result['topics'][0]['correct_count'] == (3 if hint_position == 1 else 4)
    assert result['summary']['levels']['mastered'] == 0
