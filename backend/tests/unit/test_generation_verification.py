"""Verify the actual generator output, including its answer key."""

import json
from types import SimpleNamespace
from unittest.mock import Mock

from app.services import jev
from app.services.ai.question_generator import QuestionGenerator
from app.services.parsers.base_parser import ParsedDocument, ParsedSection


def test_generation_sends_question_and_keyed_answer_to_verifier(monkeypatch):
    question = {
        "question": "What does SM-2 schedule?",
        "options": [{"option": "A", "text": "Uploads"}, {"option": "B", "text": "Reviews"}],
        "correct_answer": "B",
        "explanation": "SM-2 schedules reviews.",
    }
    generator = object.__new__(QuestionGenerator)
    generator.provider = "openai"
    generator.model = "fixture"
    generator.client = Mock()
    generator.client.chat.completions.create.return_value = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps([question])))],
        usage=SimpleNamespace(prompt_tokens=20, completion_tokens=30),
    )
    monkeypatch.setattr(generator, "_typesafe_key", lambda: "fixture-key")
    captured = []

    def ask(state, questions, *args, **kwargs):
        captured.append(state)
        return jev.Answers({name: {"noul": 0.1} for name in questions})

    monkeypatch.setattr(jev, "ask", ask)
    source = "SM-2 schedules reviews."
    generated = generator.generate_questions(
        ParsedDocument(full_text=source, sections=[ParsedSection(text=source)]), num_questions=1,
    )
    assert len(generated) == 1
    assert captured[0]["question"]["text"] == question["question"]
    assert captured[0]["question"]["correct_option"] == "Reviews"
