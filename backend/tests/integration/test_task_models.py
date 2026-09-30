from unittest.mock import Mock

from app.models.settings import Settings
from app.services import secrets
from app.services.ai import question_generator

URL = "/api/settings/ai-config"


def test_task_pairs_and_old_body(client, db_session, monkeypatch):
    key = "sk-fake-private-123456789"
    result = client.post(URL, json={"provider": "openrouter", "model": "vendor/generation", "api_key": key})
    assert result.status_code == 200
    result = client.post(URL, json={"task": "chat", "provider": "openai", "model": "gpt-4o", "api_key": key})
    assert result.status_code == 200
    config = client.get(URL).json()
    assert (config["generation_provider"], config["generation_model"]) == ("openrouter", "vendor/generation")
    assert (config["chat_provider"], config["chat_model"]) == ("openai", "gpt-4o")
    assert (config["provider"], config["model"]) == ("openrouter", "vendor/generation")
    assert config["key_configured"] is True
    assert config["key_source"] == "keyring"
    rows = {row.key: row.value for row in db_session.query(Settings).all()}
    assert rows["generation_model"] == "vendor/generation"
    assert rows["chat_model"] == "gpt-4o"
    assert key not in rows.values()
    assert "api_key" not in rows
    monkeypatch.setattr(question_generator, "OpenAI", Mock())
    generator = question_generator.QuestionGenerator(db=db_session)
    assert (generator.provider, generator.model) == ("openrouter", "vendor/generation")


def test_legacy_fallback(client, db_session, monkeypatch):
    db_session.add_all([Settings(key="ai_provider", value="openai"),
                        Settings(key="ai_model", value="gpt-4o-mini"),
                        Settings(key="api_key", value="sk-legacy-private-key")])
    db_session.commit()
    config = client.get(URL).json()
    assert (config["generation_provider"], config["generation_model"]) == ("openai", "gpt-4o-mini")
    assert (config["chat_provider"], config["chat_model"]) == ("openai", "gpt-4o-mini")
    assert config["key_source"] == "database"
    monkeypatch.setattr(question_generator, "OpenAI", Mock())
    generator = question_generator.QuestionGenerator(db=db_session)
    assert (generator.provider, generator.model) == ("openai", "gpt-4o-mini")


def test_model_change_keeps_key_out_of_database(client, db_session):
    secrets.set_secret("openrouter", "fake-private-key")
    result = client.post(URL, json={"provider": "openrouter", "model": "vendor/new-model",
                                    "api_key": "fake-private-key"})
    assert result.status_code == 200
    assert result.json()["key_configured"] is True
    assert secrets.get_secret("openrouter", db=db_session) == "fake-private-key"
    assert db_session.query(Settings).filter_by(key="api_key").first() is None


def test_bad_task_is_rejected(client):
    result = client.post(URL, json={"task": "invalid", "provider": "openrouter",
                                    "api_key": "fake-private-key"})
    assert result.status_code == 422


def test_switching_provider_reuses_a_stored_key(client, db_session):
    secrets.set_secret("openrouter", "sk-or-stored-private-123456")
    result = client.post(URL, json={"provider": "openrouter", "model": "google/gemini-3.8-flash"})
    assert result.status_code == 200
    config = client.get(URL).json()
    assert (config["generation_provider"], config["generation_model"]) == (
        "openrouter", "google/gemini-3.8-flash")
    assert secrets.get_secret("openrouter", db=db_session) == "sk-or-stored-private-123456"


def test_switching_provider_without_any_key_is_refused(client):
    result = client.post(URL, json={"provider": "anthropic", "model": "claude-sonnet-5"})
    assert result.status_code == 400
    assert "No anthropic API key" in result.json()["error"]["message"]
