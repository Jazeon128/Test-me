"""OpenRouter routing and wall-clock deadlines, using local fake clients."""

import time
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.models.llm_call import LLMCall
from app.services.ai import clients, completion, question_generator, retry
from app.services.parsers.base_parser import ParsedSection


def response():
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content="OK"))],
        usage=SimpleNamespace(prompt_tokens=1, completion_tokens=1),
    )


def sdk(call):
    return SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=call)))


@pytest.mark.parametrize("provider", ["openai", "openrouter"])
@pytest.mark.parametrize("entry", ["generation", "canvas", "chat"])
def test_routing_and_request_deadline(provider, entry, db_session):
    call = Mock(return_value=response())
    if entry == "generation":
        generator = question_generator.QuestionGenerator.__new__(question_generator.QuestionGenerator)
        generator.provider, generator.model = provider, "fake"
        generator.client, generator.db = sdk(call), db_session
        generator._parse_batch_response = Mock(return_value=[{"question": "Question?"}])
        assert generator._generate_batch_questions(ParsedSection("source"), 1, "medium")
    else:
        assert completion.complete(provider, "fake", sdk(call), "prompt",
                                   db=db_session, task=entry).text == "OK"
    kwargs = call.call_args.kwargs
    if provider == "openrouter":
        assert kwargs["extra_body"] == {"provider": {"sort": "throughput"}}
        assert kwargs["timeout"].read == (90.0 if entry == "chat" else 180.0)
        assert kwargs["timeout"].connect == 10.0
        assert kwargs["stream"] is False
    else:
        assert "extra_body" not in kwargs


@pytest.mark.parametrize("entry", ["generation", "canvas", "chat"])
def test_slow_call_is_retried_and_recorded(entry, db_session, monkeypatch):
    monkeypatch.setattr(completion, "OPENROUTER_DEADLINE", 0.02)
    monkeypatch.setattr(completion, "OPENROUTER_CHAT_DEADLINE", 0.02)
    monkeypatch.setattr(question_generator, "OPENROUTER_DEADLINE", 0.02)
    monkeypatch.setattr(retry, "retry_delay", lambda *args: 0)
    calls = []

    def create(**kwargs):
        calls.append(kwargs)
        if len(calls) == 1:
            time.sleep(0.5)
        return response()

    started = time.monotonic()
    if entry == "generation":
        generator = question_generator.QuestionGenerator.__new__(question_generator.QuestionGenerator)
        generator.provider, generator.model = "openrouter", "fake"
        generator.client, generator.db = sdk(create), db_session
        assert generator._generation_call(lambda: create()).choices[0].message.content == "OK"
    else:
        assert completion.complete("openrouter", "fake", sdk(create), "prompt",
                                   db=db_session, task=entry).text == "OK"
    assert time.monotonic() - started < 0.4
    assert len(calls) == 2
    rows = db_session.query(LLMCall).order_by(LLMCall.id).all()
    assert [(row.status, row.error_type, row.attempts) for row in rows] == [
        ("error", "OpenRouterTimeout", 1), ("ok", None, 2),
    ]
    assert all(row.task == entry for row in rows)


@pytest.mark.parametrize("seconds", [90, 180])
def test_timeout_message(seconds):
    error = retry.OpenRouterTimeout(seconds)
    expected = (f"OpenRouter took too long to answer (over {seconds} s). "
                "Try again, or pick another model in Settings.")
    assert str(error) == expected
    assert error.status_code == 504
    assert question_generator.explain_provider_error(str(error), "openrouter") == expected


def test_timeout_is_retried_once_then_raised(db_session, monkeypatch):
    monkeypatch.setattr(completion, "OPENROUTER_DEADLINE", 0.01)
    monkeypatch.setattr(retry, "retry_delay", lambda *args: 0)

    def create(**kwargs):
        time.sleep(0.3)
        return response()

    call = Mock(side_effect=create)
    with pytest.raises(retry.OpenRouterTimeout) as caught:
        completion.complete("openrouter", "fake", sdk(call), "prompt", db=db_session)
    assert caught.value.seconds == 0.01
    # A deadline costs the full wait, so it is retried once, not three times.
    assert call.call_count == 2
    rows = db_session.query(LLMCall).order_by(LLMCall.id).all()
    assert len(rows) == 2
    assert [row.attempts for row in rows] == [1, 2]
    assert all(row.status == "error" and row.error_type == "OpenRouterTimeout" for row in rows)


def test_client_socket_timeout(monkeypatch):
    constructor = Mock()
    monkeypatch.setattr(clients, "OpenAI", constructor)
    clients.build_client("openrouter", "fake-key")
    timeout = constructor.call_args.kwargs["timeout"]
    assert timeout.connect == 10.0
    assert (timeout.read, timeout.write, timeout.pool) == (180.0, 180.0, 180.0)
    assert constructor.call_args.kwargs["max_retries"] == 0
