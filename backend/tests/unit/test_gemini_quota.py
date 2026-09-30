from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from google.genai.errors import APIError

from app.exceptions import AIServiceError
from app.services.ai import question_generator as module
from app.services.ai.question_generator import QuestionGenerator
from app.services.parsers.base_parser import ParsedDocument, ParsedSection


@pytest.fixture
def generator(monkeypatch):
    instance = QuestionGenerator.__new__(QuestionGenerator)
    instance.provider = "gemini"
    instance.model = "fake"
    instance.db = None
    instance.client = SimpleNamespace(models=SimpleNamespace(generate_content=Mock()))
    instance._typesafe_key = lambda: None
    instance._parse_batch_response = Mock(return_value=[{"question": "Question?"}])
    instance._verify_batch = Mock(side_effect=lambda section, questions: questions)
    monkeypatch.setattr(module.time, "sleep", Mock())
    monkeypatch.setattr("app.services.ai.retry.random.uniform", lambda *args: 0)
    return instance


def test_daily_quota_stops_remaining_sections_and_resets_next_run(generator):
    generator.client.models.generate_content.side_effect = APIError(429, {
        "message": "RESOURCE_EXHAUSTED GenerateRequestsPerDayPerProjectPerModel-FreeTier",
    })
    document = ParsedDocument("text", [ParsedSection("one"), ParsedSection("two"), ParsedSection("three")])
    with pytest.raises(AIServiceError, match="free-tier quota is used up"):
        generator.generate_questions(document, num_questions=3)
    assert generator.client.models.generate_content.call_count == 1
    module.time.sleep.assert_not_called()
    assert generator.provider_quota_exhausted is True
    generator.client.models.generate_content.reset_mock()
    generator.client.models.generate_content.side_effect = None
    generator.client.models.generate_content.return_value = SimpleNamespace(text="fake response")
    assert len(generator.generate_questions(document, num_questions=3)) == 3
    assert generator.client.models.generate_content.call_count == 3
    assert generator.provider_quota_exhausted is False


@pytest.mark.parametrize("delay,expected", [("40s", 40), ("120s", 60), ("0.5s", 0.5)])
@pytest.mark.parametrize("location", ["details", "text"])
def test_rate_limit_uses_retry_delay(generator, delay, expected, location):
    payload = {"message": "RESOURCE_EXHAUSTED per-minute quota"}
    if location == "details":
        payload["details"] = [{"@type": "type.googleapis.com/google.rpc.RetryInfo", "retryDelay": delay}]
    else:
        payload["message"] += f' retryDelay: "{delay}"'
    generator.client.models.generate_content.side_effect = [
        APIError(429, payload), SimpleNamespace(text="done"),
    ]
    steps = []
    generator.step_callback = lambda *args: steps.append(args[0])
    generator._sections_done = 0
    generator._sections_total = 1
    assert generator._gemini_generate("prompt").text == "done"
    module.time.sleep.assert_called_once_with(expected)
    assert steps == [f"Gemini rate limit, retrying in {expected:g} s (attempt 2 of 4)"]


def test_503_keeps_backoff_even_with_retry_delay(generator):
    generator.client.models.generate_content.side_effect = [
        APIError(503, {"message": "UNAVAILABLE retryDelay: '40s'"}), SimpleNamespace(text="done"),
    ]
    steps = []
    generator.step_callback = lambda *args: steps.append(args[0])
    generator._sections_done = 0
    generator._sections_total = 1
    assert generator._gemini_generate("prompt").text == "done"
    module.time.sleep.assert_called_once_with(2)
    assert steps == ["Gemini is busy, retrying (attempt 2 of 4)"]
