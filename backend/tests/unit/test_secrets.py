"""Credential precedence, secure writes, and API non-disclosure."""

from unittest.mock import Mock

import keyring
import pytest
from keyring.backends.fail import Keyring as FailKeyring
from keyring.backends.null import Keyring as NullKeyring

from app.models.settings import Settings
from app.services import secrets

KEY = "sk-test-private-value-123456789"


def test_lookup_order(db_session, monkeypatch, memory_keyring):
    db_session.add_all([Settings(key="ai_provider", value="openrouter"),
                        Settings(key="api_key", value="legacy-private-key")])
    db_session.commit()
    monkeypatch.setattr(secrets.settings, "OPENROUTER_API_KEY", "env-private-key")
    secrets.set_secret("openrouter", KEY)
    assert secrets.get_secret("openrouter", db=db_session) == KEY
    assert secrets.secret_status("openrouter", db=db_session) == {
        "configured": True, "source": "keyring"}
    secrets.delete_secret("openrouter")
    assert secrets.get_secret("openrouter", db=db_session) == "env-private-key"
    assert secrets.secret_status("openrouter", db=db_session)["source"] == "env"
    monkeypatch.setattr(secrets.settings, "OPENROUTER_API_KEY", "")
    assert secrets.get_secret("openrouter", db=db_session) == "legacy-private-key"
    assert secrets.secret_status("openrouter", db=db_session)["source"] == "database"
    assert secrets.get_secret("openai", db=db_session) == ""
    assert secrets.secret_status("openai", db=db_session) == {"configured": False, "source": None}


@pytest.mark.parametrize("name", sorted(secrets.NAMES))
def test_set_get_delete(name, db_session):
    secrets.set_secret(name, KEY)
    assert secrets.get_secret(name, db=db_session) == KEY
    secrets.delete_secret(name)
    assert secrets.get_secret(name, db=db_session) == ""
    assert db_session.query(Settings).count() == 0


@pytest.mark.parametrize("backend", [FailKeyring(), NullKeyring()])
def test_no_backend_does_not_write_database(backend, db_session, monkeypatch):
    monkeypatch.setattr(keyring.core, "_keyring_backend", backend)
    with pytest.raises(secrets.SecretStoreError, match="No secure credential store on this machine"):
        secrets.set_secret("openrouter", KEY)
    assert db_session.query(Settings).count() == 0


def test_api_without_backend_is_503(client, db_session, monkeypatch):
    monkeypatch.setattr(keyring.core, "_keyring_backend", FailKeyring())
    response = client.post("/api/settings/ai-config", json={"provider": "openrouter", "api_key": KEY})
    assert response.status_code == 503
    assert secrets.NO_STORE in response.text
    assert KEY not in response.text
    assert db_session.query(Settings).count() == 0


def test_settings_responses_never_disclose_key(client, monkeypatch):
    from app.services.ai import question_generator, openrouter_catalog
    from app.services import jev
    from types import SimpleNamespace

    sdk = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=Mock(
        return_value=SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content="OK"))])
    ))))
    monkeypatch.setattr(question_generator, "OpenAI", Mock(return_value=sdk))
    monkeypatch.setattr(jev, "ask", Mock(return_value={}))
    monkeypatch.setattr(openrouter_catalog.requests, "get", Mock(return_value=SimpleNamespace(
        raise_for_status=lambda: None, json=lambda: {"data": {"limit": 10, "key": KEY}}
    )))
    responses = [
        client.post("/api/settings/ai-config", json={"provider": "openrouter", "api_key": KEY}),
        client.get("/api/settings/ai-config"),
        client.post("/api/settings/ai-config/test"),
        client.get("/api/settings/ai-config/models"),
        client.get("/api/settings/ai-config/models/info"),
        client.post("/api/settings/ai-config/models/refresh"),
        client.get("/api/settings/openrouter/key"),
        client.put("/api/settings/typesafe", json={"api_key": KEY}),
        client.get("/api/settings/typesafe"),
        client.post("/api/settings/typesafe/test"),
        client.get("/api/settings/typesafe/usage"),
        client.delete("/api/settings/typesafe"),
        client.delete("/api/settings/ai-config"),
    ]
    for response in responses:
        assert response.status_code == 200, response.text
        assert KEY not in response.text
        assert '"preview":' not in response.text
        assert '"api_key_preview":' not in response.text
    assert "key" not in responses[6].json()


def test_settings_repr_hides_all_values():
    assert repr(Settings(key="api_key", value=KEY)) == "<Settings api_key>"
