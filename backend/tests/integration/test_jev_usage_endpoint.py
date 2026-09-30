from datetime import datetime, timedelta, timezone

import pytest

from app.models.jev_call import JevCall

URL = "/api/settings/typesafe/usage"


def test_usage_shape_and_totals(client, db_session):
    db_session.add_all([
        JevCall(label="settings_test", questions=1, input_tokens=12, duration_ms=100, ok=True),
        JevCall(label="settings_test", questions=1, input_tokens=0, duration_ms=200, ok=False),
        JevCall(label="review_explanation", questions=2, input_tokens=30, duration_ms=50, ok=True),
        JevCall(label="old", questions=1, ok=True,
                created_at=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=31)),
    ])
    db_session.commit()
    response = client.get(URL)
    assert response.status_code == 200
    assert response.json() == {
        "days": 30,
        "features": [
            {"label": "settings_test", "calls": 2, "failures": 1, "input_tokens": 12, "avg_duration_ms": 150},
            {"label": "review_explanation", "calls": 1, "failures": 0, "input_tokens": 30, "avg_duration_ms": 50},
        ],
        "totals": {"calls": 3, "failures": 1, "input_tokens": 42},
    }
    assert client.get(URL, params={"days": 365}).json()["totals"]["calls"] == 4


@pytest.mark.parametrize("days", [1, 365])
def test_empty_usage(client, days):
    response = client.get(URL, params={"days": days})
    assert response.status_code == 200
    assert response.json() == {
        "days": days, "features": [], "totals": {"calls": 0, "failures": 0, "input_tokens": 0},
    }


@pytest.mark.parametrize("days", [0, 366])
def test_invalid_days(client, days):
    assert client.get(URL, params={"days": days}).status_code == 400
