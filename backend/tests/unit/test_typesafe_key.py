from unittest.mock import MagicMock

import pytest

from app.config import settings as config_settings
from app.models.settings import Settings
from app.services.typesafe_key import SETTING_KEY, typesafe_key, typesafe_key_source


@pytest.mark.parametrize(
    "stored,environment,expected,source",
    [
        ("ts-test-key-12345", "ts-env-key-67890", "ts-env-key-67890", "env"),
        ("  ts-test-key-12345  ", "", "ts-test-key-12345", "database"),
        ("", "ts-env-key-67890", "ts-env-key-67890", "env"),
        ("   ", "  ts-env-key-67890  ", "ts-env-key-67890", "env"),
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


def test_keyring_precedes_environment_and_database(db_session, monkeypatch, memory_keyring):
    from app.services.secrets import SERVICE

    memory_keyring.set_password(SERVICE, "typesafe", "ts-keyring-12345")
    monkeypatch.setattr(config_settings, "TYPESAFE_API_KEY", "ts-env-key-67890")
    db_session.add(Settings(key=SETTING_KEY, value="ts-test-key-12345"))
    db_session.commit()
    assert typesafe_key(db_session) == "ts-keyring-12345"
    assert typesafe_key_source(db_session) == "keyring"
