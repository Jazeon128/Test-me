"""Test Connection must contact the provider, and say why it failed.

The provider call is faked, so no test reaches a paid API. What is tested is
that a call is made at all, and that each kind of failure gets a message a
user can act on.
"""

import pytest

from app.services.ai import completion


class FakeStatusError(Exception):
    """Shaped like the provider SDK errors: a status code and a message."""

    def __init__(self, status_code, message="provider said no"):
        super().__init__(message)
        self.status_code = status_code


@pytest.fixture
def configured(client):
    response = client.post(
        "/api/settings/ai-config",
        json={"provider": "gemini", "api_key": "not-a-real-key-123", "model": "gemini-3.5-flash-lite"},
    )
    assert response.status_code == 200
    return client


def _test(client):
    return client.post("/api/settings/ai-config/test")


def test_a_rejected_key_is_reported_not_called_a_success(configured, monkeypatch):
    def rejected(*args, **kwargs):
        raise FakeStatusError(401)

    monkeypatch.setattr(completion, "complete", rejected)
    response = _test(configured)

    assert response.status_code == 400
    assert "rejected the API key" in response.json()["error"]["message"]


def test_success_needs_a_real_reply(configured, monkeypatch):
    calls = []

    def reply(provider, model, client, prompt, **kwargs):
        calls.append((provider, model, kwargs))
        return completion.Completion(text="OK", input_tokens=5, output_tokens=1)

    monkeypatch.setattr(completion, "complete", reply)
    response = _test(configured)

    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["model"] == "gemini-3.5-flash-lite"
    assert isinstance(body["latency_ms"], int)
    # A connection test must be cheap and must not hang.
    assert calls[0][2]["max_tokens"] <= 16 and calls[0][2]["timeout"] <= 30


@pytest.mark.parametrize(
    "status,expected",
    [
        (403, "rejected the API key"),
        (404, "gemini-3.5-flash-lite"),
        (429, "rate limit or quota"),
        (503, "overloaded"),
        (500, "error"),
    ],
)
def test_each_failure_says_what_to_do(configured, monkeypatch, status, expected):
    def fail(*args, **kwargs):
        raise FakeStatusError(status)

    monkeypatch.setattr(completion, "complete", fail)
    message = _test(configured).json()["error"]["message"]
    assert expected in message


def test_google_style_error_code_is_read_too(configured, monkeypatch):
    class GoogleError(Exception):
        code = 401

    def fail(*args, **kwargs):
        raise GoogleError("API key not valid")

    monkeypatch.setattr(completion, "complete", fail)
    assert "rejected the API key" in _test(configured).json()["error"]["message"]


def test_unreachable_provider(configured, monkeypatch):
    def fail(*args, **kwargs):
        raise ConnectionError("TLS handshake failed")

    monkeypatch.setattr(completion, "complete", fail)
    message = _test(configured).json()["error"]["message"]
    assert "Could not reach gemini" in message
    assert "TLS handshake failed" in message


def test_no_configuration_is_400(client):
    response = _test(client)
    assert response.status_code == 400


def test_google_bad_key_is_400_with_a_reason_not_401(configured, monkeypatch):
    """What Google really returns for an invalid key, seen live on 2026-09-29."""
    body = (
        "400 INVALID_ARGUMENT. {'error': {'code': 400, 'message': 'API key not valid. "
        "Please pass a valid API key.', 'status': 'INVALID_ARGUMENT', 'details': "
        "[{'reason': 'API_KEY_INVALID'}]}}"
    )

    def fail(*args, **kwargs):
        raise FakeStatusError(400, body)

    monkeypatch.setattr(completion, "complete", fail)
    message = _test(configured).json()["error"]["message"]
    assert "rejected the API key" in message
    assert "INVALID_ARGUMENT" not in message


def test_unknown_errors_are_truncated(configured, monkeypatch):
    def fail(*args, **kwargs):
        raise FakeStatusError(418, "x" * 5000)

    monkeypatch.setattr(completion, "complete", fail)
    message = _test(configured).json()["error"]["message"]
    assert len(message) < 300
