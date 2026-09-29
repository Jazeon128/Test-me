"""One way to ask Jev a question.

Every System One feature in the app goes through `ask`. Before this existed the
canvas router carried its own HTTP call, its own timeout and its own error type;
a second feature would have copied all three.

What belongs here: the transport, the shared limits, and turning a response into
plain typed values. What does not: the questions themselves, the thresholds, and
what to do with an uncertain answer. Those are the caller's policy and they read
better next to the feature they serve.

The model answers every question in one request and the questions cannot see one
another, so a caller that needs a follow-up judgment makes a second call only
when the first answer changes the state or the options.
"""

import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import requests

from ..utils.logging import get_logger

logger = get_logger(__name__)

API_URL = "https://api.typesafe.ai/v1/systemone"
MODEL = "jev-latest"

#: Jev takes 64k tokens per request, 32k of it state plus the longest question.
#: Callers trim their own state to fit; this is the ceiling they trim to.
MAX_STATE_CHARS = 48_000

DEFAULT_TIMEOUT = 20.0


class JevUnavailable(RuntimeError):
    """Jev could not be reached, or no API key is configured.

    Every caller is expected to carry on without the judgment rather than fail
    the user's request. A study app that stops working because a judgment
    service is down would be worse than one that skips the judgment.
    """


@dataclass
class Answers:
    """The answers to one request, with the units already unwrapped."""

    raw: Dict
    duration_ms: int = 0
    input_tokens: int = 0

    def choice(self, question_id: str, default: Optional[str] = None) -> Optional[str]:
        return self.raw.get(question_id, {}).get("choice", default)

    def probabilities(self, question_id: str) -> Dict[str, float]:
        raw = self.raw.get(question_id, {}).get("probabilities") or {}
        return {key: float(value) for key, value in raw.items()}

    def confidence(self, question_id: str) -> float:
        return float(self.raw.get(question_id, {}).get("confidence", 0.0))

    def noul(self, question_id: str, default: float = 0.0) -> float:
        """The probability of yes. Not a confidence: 0.5 means genuinely torn."""
        return float(self.raw.get(question_id, {}).get("noul", default))

    def score(self, question_id: str, default: float = 0.0) -> float:
        return float(self.raw.get(question_id, {}).get("score", default))


def ask(
    state: Dict,
    questions: Dict,
    api_key: str,
    timeout: float = DEFAULT_TIMEOUT,
    label: str = "jev",
) -> Answers:
    """Put one set of questions to Jev over one piece of state.

    `label` only names the call in the logs, so a slow or failing feature can be
    told apart from the others.
    """
    if not api_key:
        raise JevUnavailable("No TypeSafe API key configured")

    payload = {"state": state, "model": MODEL, "questions": questions}

    started = time.time()
    try:
        response = requests.post(
            API_URL,
            json=payload,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=timeout,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        logger.warning("jev_unavailable", label=label, error=str(exc))
        raise JevUnavailable(str(exc)) from exc

    body = response.json()
    duration_ms = int((time.time() - started) * 1000)
    input_tokens = int(body.get("usage", {}).get("input_tokens", 0))

    logger.info(
        "jev_answered",
        label=label,
        questions=len(questions),
        duration_ms=duration_ms,
        input_tokens=input_tokens,
    )

    return Answers(
        raw=body.get("answers", {}) or {},
        duration_ms=duration_ms,
        input_tokens=input_tokens,
    )


def trim(text: str, limit: int) -> str:
    """Cut text to a character budget on a word boundary where one is near."""
    if text is None:
        return ""
    if len(text) <= limit:
        return text
    cut = text[:limit]
    space = cut.rfind(" ")
    # Only honour the boundary if it is close to the end, so a long unbroken
    # string is still trimmed to the budget rather than returned whole.
    return cut[:space] if space > limit * 0.8 else cut


def share_budget(parts: List[str], total: int, minimum: int = 120) -> int:
    """Characters each part may use when several share one state budget."""
    if not parts:
        return total
    return max(minimum, total // len(parts))


@dataclass
class Flag:
    """One named failure signal and the probability that it applies."""

    name: str
    probability: float
    description: str = ""

    @property
    def raised(self) -> bool:
        return self.probability >= 0.5


@dataclass
class Verdict:
    """The outcome of a set of failure checks over one item.

    Escalation uses any-flag rather than an average: one confident red flag has
    to survive, and averaging several signals lets it disappear into the middle.
    """

    flags: List[Flag] = field(default_factory=list)
    checked: bool = True

    def worst(self) -> Optional[Flag]:
        return max(self.flags, key=lambda f: f.probability, default=None)

    def raised(self, threshold: float) -> List[Flag]:
        return [flag for flag in self.flags if flag.probability >= threshold]

    def should_escalate(self, threshold: float) -> bool:
        return bool(self.raised(threshold))
