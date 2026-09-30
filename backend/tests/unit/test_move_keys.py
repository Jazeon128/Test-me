from unittest.mock import Mock

import pytest

from app.models.settings import Settings
from app.services import secrets
from scripts.move_keys_to_keyring import move_keys

KEY = "legacy-private-key-123456"


def seed(db):
    db.add_all([Settings(key="ai_provider", value="openrouter"),
                Settings(key="api_key", value=KEY),
                Settings(key="typesafe_api_key", value=KEY)])
    db.commit()


def test_dry_run_names_lengths_only(db_session, capsys, memory_keyring):
    seed(db_session)
    assert move_keys(db_session) == 0
    output = capsys.readouterr().out
    assert "openrouter: 25 characters" in output
    assert "typesafe: 25 characters" in output
    assert KEY not in output
    assert memory_keyring.values == {}
    assert db_session.query(Settings).filter_by(key="api_key").one().value == KEY


def test_apply_verifies_and_blanks(db_session, capsys, memory_keyring):
    seed(db_session)
    assert move_keys(db_session, apply=True) == 2
    assert KEY not in capsys.readouterr().out
    assert memory_keyring.get_password(secrets.SERVICE, "openrouter") == KEY
    assert memory_keyring.get_password(secrets.SERVICE, "typesafe") == KEY
    assert db_session.query(Settings).filter_by(key="api_key").one().value == ""
    assert db_session.query(Settings).filter_by(key="typesafe_api_key").one().value == ""


def test_readback_failure_retains_value(db_session, memory_keyring, monkeypatch):
    db_session.add_all([Settings(key="ai_provider", value="openrouter"),
                        Settings(key="api_key", value=KEY)])
    db_session.commit()
    monkeypatch.setattr(memory_keyring, "get_password", Mock(return_value="wrong"))
    with pytest.raises(RuntimeError, match="read-back verification failed"):
        move_keys(db_session, apply=True)
    assert db_session.query(Settings).filter_by(key="api_key").one().value == KEY
