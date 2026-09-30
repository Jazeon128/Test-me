"""Connection-test timeouts reach each provider SDK."""

from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.services.ai.completion import complete


@pytest.mark.parametrize("provider", ["anthropic", "openai"])
def test_timeout_reaches_provider(provider):
    client = Mock()
    if provider == "anthropic":
        call = client.messages.create
        call.return_value = SimpleNamespace(content=[SimpleNamespace(text="OK")], usage=None)
    else:
        call = client.chat.completions.create
        call.return_value = SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="OK"))], usage=None,
        )

    assert complete(provider, "fixture", client, "prompt", timeout=20.0).text == "OK"
    assert call.call_args.kwargs["timeout"] == 20.0
