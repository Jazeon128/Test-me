from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.models.llm_call import LLMCall
from app.models.settings import Settings
from app.services.ai import question_generator, ledger, completion, retry
from app.services.parsers.base_parser import ParsedDocument, ParsedSection
from app.services import secrets


@pytest.fixture
def generator(db_session, monkeypatch):
    db_session.add_all([Settings(key="generation_provider", value="openai"),
                        Settings(key="generation_model", value="gpt-4o")])
    db_session.commit()
    secrets.set_secret("openai", "sk-fake-private-key")
    response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content="fake response"))],
        usage=SimpleNamespace(prompt_tokens=1000, completion_tokens=500), model="gpt-4o", id="response-1",
    )
    sdk = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=Mock(return_value=response))))
    monkeypatch.setattr(question_generator, "OpenAI", Mock(return_value=sdk))
    result = question_generator.QuestionGenerator(db=db_session)
    result._parse_batch_response = Mock(return_value=[{"question": "Question?"}])
    result._verify_batch = Mock(side_effect=lambda section, questions: questions)
    return result


def test_one_row_per_generation_call(generator, db_session):
    document = ParsedDocument("text", [ParsedSection("one"), ParsedSection("two")])
    assert len(generator.generate_questions(document, num_questions=2)) == 2
    rows = db_session.query(LLMCall).all()
    assert len(rows) == 2
    for row in rows:
        assert (row.task, row.provider, row.status, row.attempts) == ("generation", "openai", "ok", 1)
        assert row.cost_usd == Decimal("0.007500")
        assert row.cost_source == "estimated"


def test_connection_test_row(client, generator, db_session):
    result = client.post("/api/settings/ai-config/test")
    assert result.status_code == 200
    row = db_session.query(LLMCall).one()
    assert (row.task, row.provider, row.status) == ("connection_test", "openai", "ok")


def test_unknown_model_null_cost(generator, db_session):
    generator.model = "unknown-model"
    assert generator._generate_batch_questions(ParsedSection("source"), 1, "medium")
    row = db_session.query(LLMCall).one()
    assert row.cost_usd is None
    assert row.cost_source == "unknown"


def test_ledger_failure_does_not_fail_generation(generator, db_session, monkeypatch):
    monkeypatch.setattr(ledger, "_write", Mock(side_effect=RuntimeError("database unavailable")))
    assert generator._generate_batch_questions(ParsedSection("source"), 1, "medium")
    assert db_session.query(LLMCall).count() == 0


def test_canvas_completion_row(generator, db_session):
    result = completion.complete(generator.provider, generator.model, generator.client, "draw", db=db_session)
    assert result.text == "fake response"
    assert db_session.query(LLMCall).one().task == "canvas"


def test_failed_connection_one_row(client, generator, db_session, monkeypatch):
    class ProviderError(Exception):
        status_code = 401

    generator.client.chat.completions.create.side_effect = ProviderError("bad key")
    monkeypatch.setattr(retry.time, "sleep", Mock())
    result = client.post("/api/settings/ai-config/test")
    assert result.status_code == 400
    row = db_session.query(LLMCall).one()
    assert (row.task, row.status, row.attempts, row.error_type) == ("connection_test", "error", 1, "ProviderError")


def test_failed_ledger_does_not_rollback_caller(generator, db_session, monkeypatch):
    pending = Settings(key="uncommitted-setting", value="safe-value")
    db_session.add(pending)
    monkeypatch.setattr(ledger, "_write", Mock(side_effect=RuntimeError("failure")))
    assert generator._generate_batch_questions(ParsedSection("source"), 1, "medium")
    db_session.commit()
    assert db_session.query(Settings).filter_by(key="uncommitted-setting").one().value == "safe-value"
