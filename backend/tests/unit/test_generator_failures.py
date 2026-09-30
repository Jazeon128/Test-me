import json
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from app.exceptions import AIServiceError
from app.services.ai.question_generator import QuestionGenerator
from app.services.parsers.base_parser import ParsedDocument, ParsedSection


class ServerError(Exception):
    pass


@pytest.fixture
def generator():
    generator = QuestionGenerator.__new__(QuestionGenerator)
    generator.provider = "gemini"
    generator.model = "fake"
    generator.db = None
    generator.flagged_questions = []
    generator._typesafe_key = lambda: None
    generator.client = SimpleNamespace(models=SimpleNamespace(generate_content=Mock()))
    return generator


def response():
    return SimpleNamespace(text=json.dumps([{
        "question": "What is Python?", "options": [{"option": c, "text": c} for c in "ABCD"],
        "correct_answer": "A", "explanation": "A language",
    }]))


def document():
    return ParsedDocument("Python programming", [ParsedSection("Python", page=1), ParsedSection("Programming", page=2)])


def test_partial_failure_is_recorded_and_reset(generator):
    generator.client.models.generate_content.side_effect = [ServerError("503 UNAVAILABLE high demand"), response()]
    assert len(generator.generate_questions(document(), 2)) == 1
    assert generator.failed_batches == [{"section_page": 1, "error_type": "ServerError", "message": "503 UNAVAILABLE high demand"}]
    generator.client.models.generate_content.side_effect = [response(), response()]
    assert len(generator.generate_questions(document(), 2)) == 2
    assert generator.failed_batches == []


def test_all_failures_raise(generator):
    generator.client.models.generate_content.side_effect = ServerError("503 UNAVAILABLE")
    with pytest.raises(AIServiceError, match=r"Gemini failed on 2 of 2 section.*overloaded \(503\)"):
        generator.generate_questions(document(), 2)
    assert len(generator.failed_batches) == 2


def test_bad_json_is_failed_batch(generator):
    generator.client.models.generate_content.side_effect = [SimpleNamespace(text="[bad json]"), response()]
    assert len(generator.generate_questions(document(), 2)) == 1
    assert generator.failed_batches[0]["section_page"] == 1
    assert generator.failed_batches[0]["error_type"] == "ValueError"


def test_failure_message_is_bounded_and_redacts_key(generator):
    generator._api_key = "fake-private-value"
    generator.client.models.generate_content.side_effect = [ServerError("api_key=fake-private-value " + "x" * 300), response()]
    generator.generate_questions(document(), 2)
    message = generator.failed_batches[0]["message"]
    assert len(message) == 200
    assert "fake-private-value" not in message


def test_failed_batch_with_held_back_questions_does_not_raise(generator):
    generator.client.models.generate_content.side_effect = [ServerError("503 UNAVAILABLE"), response()]
    def hold_back(section, questions):
        generator.flagged_questions.extend(questions)
        return []
    generator._verify_batch = hold_back
    assert generator.generate_questions(document(), 2) == []
    assert len(generator.flagged_questions) == 1
    assert len(generator.failed_batches) == 1
