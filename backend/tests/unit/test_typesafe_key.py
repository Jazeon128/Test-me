from unittest.mock import MagicMock

import pytest

from app.config import settings as config_settings
from app.models.settings import Settings
from app.services.typesafe_key import SETTING_KEY, typesafe_key, typesafe_key_source


@pytest.mark.parametrize(
    "stored,environment,expected,source",
    [
        ("ts-test-key-12345", "ts-env-key-67890", "ts-test-key-12345", "settings"),
        ("  ts-test-key-12345  ", "", "ts-test-key-12345", "settings"),
        ("", "ts-env-key-67890", "ts-env-key-67890", "environment"),
        ("   ", "  ts-env-key-67890  ", "ts-env-key-67890", "environment"),
        (None, "", "", None),
        ("\t\n", "   ", "", None),
        (None, None, "", None),
    ],
)
def test_precedence(db_session, monkeypatch, stored, environment, expected, source):
    monkeypatch.setattr(config_settings, "TYPESAFE_API_KEY", environment)
    if stored is not None:
        db_session.add(Settings(key=SETTING_KEY, value=stored))
        db_session.commit()
    assert typesafe_key(db_session) == expected
    assert typesafe_key_source(db_session) == source


def test_mock_values_are_not_keys(monkeypatch):
    monkeypatch.setattr(config_settings, "TYPESAFE_API_KEY", "")
    assert typesafe_key(MagicMock()) == ""
    assert typesafe_key_source(MagicMock()) is None
