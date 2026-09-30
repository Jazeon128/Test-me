"""Remove configured secrets and credential query values from error text."""

import re
from typing import Iterable


_QUERY_SECRET = re.compile(
    r"([?&](?:key|api_key|apikey|token|access_token)=)[^\s&#\"'<>]*",
    re.IGNORECASE,
)


def redact_secrets(text: str, secrets: Iterable[str]) -> str:
    """Preserve text while replacing secrets with a visible placeholder."""
    for secret in sorted({secret for secret in secrets if secret}, key=len, reverse=True):
        text = text.replace(secret, "[redacted]")
    return _QUERY_SECRET.sub(r"\1[redacted]", text)
