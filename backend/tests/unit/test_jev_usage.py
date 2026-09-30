from datetime import datetime, timedelta, timezone
from unittest.mock import Mock

import pytest
import requests
from sqlalchemy.orm import sessionmaker

from app.models.jev_call import JevCall
from app.services import jev, jev_usage


@pytest.fixture(autouse=True)
def recording_db(monkeypatch, db_session):
    monkeypatch.setattr(jev_usage, "SessionLocal", sessionmaker(bind=db_session.get_bind()))
    response = Mock()
    response.json.return_value = {"answers": {"q": {"noul": 1}}, "usage": {"input_tokens": 42}}
    monkeypatch.setattr(jev.requests, "post", Mock(return_value=response))
    return response


def test_success(db_session, monkeypatch):
    monkeypatch.setattr(jev.time, "time", Mock(side_effect=[100, 100.125]))
    result = jev.ask({}, {"q": {}}, "dummy", label="settings_test")
    row = db_session.query(JevCall).one()
    assert result.noul("q") == 1
    assert row.label == "settings_test"
    assert row.questions == 1
    assert row.input_tokens == result.input_tokens == 42
    assert row.duration_ms == result.duration_ms == 125
    assert row.ok is True
    assert row.error is None
    assert row.created_at is not None


def test_http_failure(db_session, recording_db):
    recording_db.raise_for_status.side_effect = requests.HTTPError("unavailable " + "x" * 250)
    with pytest.raises(jev.JevUnavailable, match="unavailable") as caught:
        jev.ask({}, {"q": {}}, "dummy", label="review_explanation")
    assert isinstance(caught.value.__cause__, requests.HTTPError)
    row = db_session.query(JevCall).one()
    assert row.label == "review_explanation"
    assert row.ok is False
    assert row.input_tokens == 0
    assert row.duration_ms >= 0
    assert row.error == str(caught.value)[:200]


def test_missing_key(db_session):
    with pytest.raises(jev.JevUnavailable, match="No TypeSafe API key configured"):
        jev.ask({}, {"q": {}}, "", label="missing_key")
    jev.requests.post.assert_not_called()
    row = db_session.query(JevCall).one()
    assert row.ok is False
    assert row.label == "missing_key"
    assert row.error == "No TypeSafe API key configured"


@pytest.mark.parametrize("body", [[], {"answers": []}, {"usage": None}])
def test_malformed_records_failure(db_session, recording_db, body):
    recording_db.json.return_value = body
    with pytest.raises(jev.JevUnavailable, match="Malformed Jev response"):
        jev.ask({}, {"q": {}}, "dummy")
    row = db_session.query(JevCall).one()
    assert row.ok is False
    assert row.error.startswith("Malformed Jev response")


def test_broken_session_preserves_success(monkeypatch):
    monkeypatch.setattr(jev_usage, "SessionLocal", Mock(side_effect=RuntimeError("database down")))
    assert jev.ask({}, {"q": {}}, "dummy").input_tokens == 42


def test_broken_session_preserves_failure(monkeypatch, recording_db):
    monkeypatch.setattr(jev_usage, "SessionLocal", Mock(side_effect=RuntimeError("database down")))
    recording_db.raise_for_status.side_effect = requests.ConnectionError("offline")
    with pytest.raises(jev.JevUnavailable, match="offline"):
        jev.ask({}, {"q": {}}, "dummy")


def test_error_redacts_key(db_session, recording_db):
    recording_db.raise_for_status.side_effect = requests.HTTPError("rejected dummy")
    with pytest.raises(jev.JevUnavailable):
        jev.ask({}, {"q": {}}, "dummy")
    assert db_session.query(JevCall).one().error == "rejected [redacted]"


def test_summary(db_session):
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    for label, tokens, duration, ok, age in [
        ("a", 10, 101, True, 0), ("a", 20, 104, False, 2),
        ("b", 7, 50, True, 3), ("a", 999, 999, True, 31),
    ]:
        db_session.add(JevCall(label=label, questions=1, input_tokens=tokens,
                               duration_ms=duration, ok=ok, created_at=now - timedelta(days=age)))
    db_session.commit()
    assert jev_usage.summary(db_session) == {
        "features": [
            {"label": "a", "calls": 2, "failures": 1, "input_tokens": 30, "avg_duration_ms": 102},
            {"label": "b", "calls": 1, "failures": 0, "input_tokens": 7, "avg_duration_ms": 50},
        ],
        "totals": {"calls": 3, "failures": 1, "input_tokens": 37},
    }
    assert jev_usage.summary(db_session, days=1)["totals"] == {
        "calls": 1, "failures": 0, "input_tokens": 10,
    }
    assert jev_usage.summary(db_session, days=365)["totals"]["calls"] == 4


def test_empty_summary(db_session):
    assert jev_usage.summary(db_session) == {
        "features": [], "totals": {"calls": 0, "failures": 0, "input_tokens": 0},
    }
