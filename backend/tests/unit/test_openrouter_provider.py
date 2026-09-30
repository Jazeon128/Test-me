from decimal import Decimal
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.models.llm_call import LLMCall
from app.models.settings import Settings
from app.services import secrets
from app.services.ai import question_generator, retry
from app.services.ai.question_generator import QuestionGenerator
from app.services.parsers.base_parser import ParsedDocument, ParsedSection
from app.exceptions import AIServiceError


class ProviderError(Exception):
    def __init__(self, status, message="busy", headers=None):
        super().__init__(message)
        self.status_code = status
        self.response = SimpleNamespace(headers=headers or {})


@pytest.fixture
def generator(db_session, monkeypatch):
    db_session.add_all([Settings(key="generation_provider", value="openrouter"),
                        Settings(key="generation_model", value="vendor/requested")])
    db_session.commit()
    secrets.set_secret("openrouter", "fake-private-key")
    response = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content="fake response"))],
        usage=SimpleNamespace(prompt_tokens=100, completion_tokens=50, cost=0.001234),
        model="vendor/actual", provider="upstream", id="response-1",
    )
    call = Mock(return_value=response)
    sdk = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=call)))
    constructor = Mock(return_value=sdk)
    monkeypatch.setattr(question_generator, "OpenAI", constructor)
    monkeypatch.setattr(retry.time, "sleep", Mock())
    result = QuestionGenerator(db=db_session)
    result._parse_batch_response = Mock(return_value=[{"question": "Question?"}])
    result._verify_batch = Mock(side_effect=lambda section, questions: questions)
    result.constructor = constructor
    return result


def test_client_and_reported_cost(generator, db_session):
    kwargs = generator.constructor.call_args.kwargs
    assert kwargs["base_url"] == "https://openrouter.ai/api/v1"
    assert kwargs["max_retries"] == 0
    assert kwargs["timeout"] == 180
    assert kwargs["default_headers"] == {"HTTP-Referer": "https://github.com/Jazeon128/Test-me",
                                         "X-OpenRouter-Title": "Test Me"}
    assert generator._generate_batch_questions(ParsedSection("source"), 1, "medium")
    row = db_session.query(LLMCall).one()
    assert row.cost_usd == Decimal("0.001234")
    assert row.cost_source == "provider_reported"
    assert (row.requested_model, row.actual_model, row.upstream_provider) == (
        "vendor/requested", "vendor/actual", "upstream")
    assert (row.input_tokens, row.output_tokens, row.attempts, row.status) == (100, 50, 1, "ok")
    assert row.response_id == "response-1"


@pytest.mark.parametrize("status,message", [(402, "insufficient credits"),
                                              (429, "key credit limit exhausted")])
def test_quota_stops_later_sections(generator, status, message, db_session):
    call = generator.client.chat.completions.create
    call.side_effect = ProviderError(status, message)
    with pytest.raises(AIServiceError):
        generator.generate_questions(ParsedDocument("source", [ParsedSection("one"), ParsedSection("two")]), 2)
    assert call.call_count == 1
    assert generator.provider_quota_exhausted is True
    retry.time.sleep.assert_not_called()
    row = db_session.query(LLMCall).one()
    assert (row.status, row.attempts, row.error_type) == ("error", 1, "ProviderError")


def test_retry_after_and_provider_step(generator, db_session):
    call = generator.client.chat.completions.create
    call.side_effect = [ProviderError(429, headers={"Retry-After": "7"}), call.return_value]
    steps = []
    generator.step_callback = lambda *args: steps.append(args[0])
    assert generator._generate_batch_questions(ParsedSection("source"), 1, "medium")
    retry.time.sleep.assert_called_once_with(7)
    assert steps == ["OpenRouter rate limit, retrying in 7 s (attempt 2 of 4)"]
    assert db_session.query(LLMCall).one().attempts == 2


def test_busy_step_names_openrouter(generator):
    call = generator.client.chat.completions.create
    call.side_effect = [ProviderError(503), call.return_value]
    steps = []
    generator.step_callback = lambda *args: steps.append(args[0])
    assert generator._generate_batch_questions(ParsedSection("source"), 1, "medium")
    assert steps == ["OpenRouter is busy, retrying (attempt 2 of 4)"]


def test_400_not_retried(generator):
    call = generator.client.chat.completions.create
    call.side_effect = ProviderError(400)
    assert generator._generate_batch_questions(ParsedSection("source"), 1, "medium") == []
    assert call.call_count == 1
    retry.time.sleep.assert_not_called()
