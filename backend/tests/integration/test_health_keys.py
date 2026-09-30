"""Root and health report keys from the credential store, not only the environment."""
from app.config import settings as config_settings
from app.models.settings import Settings
from app.services import secrets


def blank_env(monkeypatch):
    for name in ("ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "OPENROUTER_API_KEY"):
        monkeypatch.setattr(config_settings, name, "")


def test_no_key_anywhere(client, monkeypatch):
    blank_env(monkeypatch)
    assert client.get("/health").json()["ai_configured"] is False
    assert client.get("/").json()["ai_configured"] is False


def test_stored_openrouter_key_counts(client, db_session, monkeypatch):
    blank_env(monkeypatch)
    secrets.set_secret("openrouter", "sk-or-stored-private-123456")
    db_session.add(Settings(key="generation_provider", value="openrouter"))
    db_session.commit()
    health = client.get("/health").json()
    assert health["ai_configured"] is True
    assert health["ai_provider"] == "openrouter"
    assert "sk-or" not in str(health)
