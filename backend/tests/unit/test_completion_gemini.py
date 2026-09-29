"""completion.complete on the google-genai client."""

from types import SimpleNamespace
from unittest.mock import Mock

from app.services.ai.completion import complete


def test_gemini_call_uses_models_api_and_millisecond_timeout():
    client = Mock()
    client.models.generate_content.return_value = SimpleNamespace(
        text='{"ok": true}',
        usage_metadata=SimpleNamespace(prompt_token_count=12, candidates_token_count=3),
    )

    result = complete("gemini", "gemini-3.8-flash", client, "prompt", max_tokens=100, timeout=45.0)

    kwargs = client.models.generate_content.call_args.kwargs
    assert kwargs["model"] == "gemini-3.8-flash"
    assert kwargs["contents"] == "prompt"
    assert kwargs["config"].max_output_tokens == 100
    # google-genai takes milliseconds. 45 seconds must not become 45 ms.
    assert kwargs["config"].http_options.timeout == 45_000
    assert (result.text, result.input_tokens, result.output_tokens) == ('{"ok": true}', 12, 3)


def test_gemini_missing_usage_is_tolerated():
    client = Mock()
    client.models.generate_content.return_value = SimpleNamespace(text="x", usage_metadata=None)

    result = complete("gemini", "m", client, "p")

    assert result.input_tokens is None and result.output_tokens is None
