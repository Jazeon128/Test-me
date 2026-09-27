"""One text completion, against whichever provider the user configured.

QuestionGenerator already resolves the provider, model and key from the settings
table. This takes the client it built and makes a single call, so a second
feature does not need a second set of credentials or a second client.
"""

from dataclasses import dataclass
from typing import Any, Optional

from ...exceptions import AIServiceError


@dataclass
class Completion:
    text: str
    input_tokens: Optional[int] = None
    output_tokens: Optional[int] = None


def complete(
    provider: str,
    model: str,
    client: Any,
    prompt: str,
    max_tokens: int = 8192,
    temperature: float = 0.2,
    timeout: float = 180.0,
) -> Completion:
    """Send one prompt and return the text.

    The default temperature is lower than question generation uses: this is
    called for structured JSON, where variety is not wanted.

    The timeout matters: without one a provider that cannot complete a TLS
    handshake retries indefinitely, and the job it belongs to sits reporting
    progress forever instead of failing.
    """
    if provider == "anthropic":
        response = client.messages.create(
            model=model,
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        usage = getattr(response, "usage", None)
        return Completion(
            text=response.content[0].text,
            input_tokens=getattr(usage, "input_tokens", None),
            output_tokens=getattr(usage, "output_tokens", None),
        )

    if provider == "openai":
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        usage = getattr(response, "usage", None)
        return Completion(
            text=response.choices[0].message.content,
            input_tokens=getattr(usage, "prompt_tokens", None),
            output_tokens=getattr(usage, "completion_tokens", None),
        )

    if provider == "gemini":
        import google.generativeai as genai

        response = client.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=max_tokens,
                temperature=temperature,
            ),
            request_options={"timeout": timeout},
        )
        usage = getattr(response, "usage_metadata", None)
        return Completion(
            text=response.text,
            input_tokens=getattr(usage, "prompt_token_count", None),
            output_tokens=getattr(usage, "candidates_token_count", None),
        )

    raise AIServiceError(
        message=f"Unknown AI provider: {provider}",
        provider=provider,
        details={"supported_providers": ["anthropic", "openai", "gemini"]},
    )
