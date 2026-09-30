from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.services.ai import retry
from app.services.ai.completion import complete
from app.services.ai.question_generator import QuestionGenerator
from app.services.parsers.base_parser import ParsedSection


class Error(Exception):
    def __init__(self, status, message="busy", headers=None):
        super().__init__(message)
        self.status_code = status
        self.response = SimpleNamespace(headers=headers or {})


@pytest.fixture(autouse=True)
def no_sleep(monkeypatch):
    monkeypatch.setattr(retry.time, "sleep", Mock())
    monkeypatch.setattr(retry.random, "uniform", lambda *args: 0)


def fake_client(provider, call):
    return SimpleNamespace(
        messages=SimpleNamespace(create=call),
        chat=SimpleNamespace(completions=SimpleNamespace(create=call)),
        models=SimpleNamespace(generate_content=call),
    )


@pytest.mark.parametrize("provider", ["anthropic", "openai", "gemini"])
@pytest.mark.parametrize("status", [429, 500, 502, 503, 504])
def test_four_attempt_limit(provider, status):
    call = Mock(side_effect=Error(status))
    state = retry.RetryState()
    with pytest.raises(Error):
        retry._call_with_retry(call, retry.LABELS[provider], state=state)
    assert call.call_count == state.attempts == 4
    assert [args.args[0] for args in retry.time.sleep.call_args_list] == [2, 4, 8]


@pytest.mark.parametrize("provider", ["anthropic", "openai", "gemini"])
@pytest.mark.parametrize("status", [400, 401, 403, 404])
@pytest.mark.parametrize("entry", ["generation", "complete"])
def test_nonretryable_makes_one_call(provider, status, entry, db_session):
    call = Mock(side_effect=Error(status))
    sdk = fake_client(provider, call)
    if entry == "complete":
        with pytest.raises(Error):
            complete(provider, "fake", sdk, "prompt", db=db_session)
    else:
        generator = QuestionGenerator.__new__(QuestionGenerator)
        generator.provider, generator.model, generator.client = provider, "fake", sdk
        generator.db = db_session
        assert generator._generate_batch_questions(ParsedSection("text"), 1, "medium") == []
    assert call.call_count == 1
    retry.time.sleep.assert_not_called()


@pytest.mark.parametrize("provider", ["anthropic", "openai", "gemini", "openrouter"])
@pytest.mark.parametrize("delay,expected", [("7", 7), ("120", 60), ("0", 0)])
def test_retry_after_all_providers(provider, delay, expected):
    call = Mock(side_effect=[Error(503, headers={"Retry-After": delay}), "ok"])
    assert retry._call_with_retry(call, retry.LABELS[provider]) == "ok"
    retry.time.sleep.assert_called_once_with(expected)


def test_backoff_cap_and_invalid_header():
    assert retry.retry_delay(Error(503, headers={"Retry-After": "invalid"}), 10) == 20
    assert retry.retry_delay(Error(429, 'retryDelay: "120s"'), 1) == 60


@pytest.mark.parametrize("provider", ["anthropic", "openai", "gemini"])
def test_success_after_retry_through_completion(provider, db_session):
    response = SimpleNamespace(text="OK", content=[SimpleNamespace(text="OK")],
                               choices=[SimpleNamespace(message=SimpleNamespace(content="OK"))])
    call = Mock(side_effect=[Error(503), response])
    steps = []
    result = complete(provider, "fake", fake_client(provider, call), "prompt",
                      db=db_session, on_step=steps.append)
    assert result.text == "OK"
    assert call.call_count == 2
    assert steps == [f"{retry.LABELS[provider]} is busy, retrying (attempt 2 of 4)"]
