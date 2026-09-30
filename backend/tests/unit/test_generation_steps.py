"""Generation steps and visible Gemini retries, without external calls."""
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from google.genai.errors import APIError

from app.exceptions import AIServiceError
from app.models.generation_status import GenerationStatus
from app.services.ai.question_generator import QuestionGenerator
from app.services.parsers.base_parser import ParsedDocument, ParsedSection


@pytest.fixture
def generator(monkeypatch):
    monkeypatch.setattr("app.services.ai.question_generator.settings.GEMINI_API_KEY", "fake")
    monkeypatch.setattr("app.services.ai.question_generator.settings.AI_PROVIDER", "gemini")
    monkeypatch.setattr("app.services.ai.question_generator.genai.Client", Mock())
    monkeypatch.setattr("app.services.ai.question_generator.time.sleep", Mock())
    instance = QuestionGenerator()
    instance.client = SimpleNamespace(models=SimpleNamespace(generate_content=Mock()))
    instance._parse_batch_response = Mock(return_value=[{"question": "Question?"}])
    instance._verify_batch = Mock(side_effect=lambda section, questions: questions)
    return instance


def test_steps_report_retries_and_section_counts(generator):
    steps = []
    progress = Mock()
    generator.client.models.generate_content.side_effect = [
        APIError(503, {"message": "Busy"}), APIError(503, {"message": "Busy"}),
        SimpleNamespace(text="fake response"), SimpleNamespace(text="fake response"),
    ]
    document = ParsedDocument("text", [ParsedSection("one"), ParsedSection("two")])
    questions = generator.generate_questions(
        document, num_questions=2, step_callback=lambda *args: steps.append(args),
        progress_callback=progress,
    )
    assert len(questions) == 2
    assert steps == [
        ("Asking Gemini", 0, 2),
        ("Gemini is busy, retrying (attempt 2 of 4)", 0, 2),
        ("Gemini is busy, retrying (attempt 3 of 4)", 0, 2),
        ("Checking questions", 0, 2),
        ("Asking Gemini", 1, 2),
        ("Checking questions", 1, 2),
        ("Finishing generation", 2, 2),
    ]
    assert progress.call_args_list[0].args == (1, 2)
    assert progress.call_args_list[1].args == (2, 2)


def test_bad_request_is_not_retried(generator):
    generator.client.models.generate_content.side_effect = APIError(400, {"message": "Bad request"})
    with pytest.raises(AIServiceError):
        generator.generate_questions(ParsedDocument("text", [ParsedSection("text")]))
    assert generator.client.models.generate_content.call_count == 1


@pytest.mark.parametrize("code", [429, 500, 502, 503, 504])
def test_retry_limit(generator, code):
    generator.client.models.generate_content.side_effect = APIError(code, {"message": "Busy"})
    with pytest.raises(APIError):
        generator._gemini_generate("prompt")
    assert generator.client.models.generate_content.call_count == 4


def test_step_timestamp_changes_only_with_text():
    status = GenerationStatus(current_step="Asking Gemini")
    first = status.step_started_at
    status.current_step = "Asking Gemini"
    assert status.step_started_at == first
    status.current_step = "Checking questions"
    assert status.step_started_at >= first
    assert status.to_dict()["step_started_at"] == status.step_started_at.isoformat()


@pytest.mark.parametrize("raw,expected", [
    ("429 RESOURCE_EXHAUSTED. {'error': {'code': 429}}", "quota is used up"),
    ("503 UNAVAILABLE. high demand", "overloaded"),
    ("400 INVALID_ARGUMENT", "400 INVALID_ARGUMENT"),
])
def test_explain_provider_error(raw, expected):
    from app.services.ai.question_generator import explain_provider_error

    assert expected in explain_provider_error(raw)
