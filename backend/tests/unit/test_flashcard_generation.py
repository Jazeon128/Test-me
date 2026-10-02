import json
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.services import jev
from app.services.ai import verify
from app.services.ai.question_generator import QuestionGenerator
from app.services.parsers.base_parser import ParsedDocument, ParsedSection


def generator(monkeypatch, response):
    instance = object.__new__(QuestionGenerator)
    instance.provider = "openai"
    instance.model = "fixture"
    instance.client = Mock()
    instance.client.chat.completions.create.return_value = SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=json.dumps(response)))],
        usage=SimpleNamespace(prompt_tokens=20, completion_tokens=30),
    )
    monkeypatch.setattr(instance, "_typesafe_key", lambda: "fixture-key")
    return instance


def test_flashcard_prompt_and_parser():
    instance = object.__new__(QuestionGenerator)
    prompt = instance._build_flashcard_prompt("SM-2 schedules reviews.", 3, "Use short prompts")
    for text in ("SM-2 schedules reviews.", "3", "front", "back", "reference", "200", "600",
                 "1 to 3 sentences", "one idea", "no outside facts", "must not contain the answer",
                 "Use short prompts"):
        assert text.lower() in prompt.lower()
    response = json.dumps([
        dict(front=" What does SM-2 schedule? ", back=" Reviews. ", reference="SM-2"),
        dict(front="Missing back"), dict(front="Empty", back="  "),
        dict(front="x" * 201, back="Reviews."), dict(front="SM-2", back="x" * 601),
        dict(front="x" * 200, back="x" * 600), None, dict(front=3, back="Reviews."),
    ])
    cards = instance._parse_flashcard_response(f"```json\n{response}\n```")
    assert len(cards) == 2
    assert cards[0] == dict(card_type="flashcard", question="What does SM-2 schedule?",
                            explanation="Reviews.", reference="SM-2", difficulty="medium")
    assert "options" not in cards[0]
    assert instance._parse_flashcard_response('[invalid]') == []
    assert instance._parse_flashcard_response('no JSON') == []


@pytest.mark.parametrize("flag", ["back_not_supported", "front_gives_away", None])
def test_generation_uses_shared_provider_and_flashcard_verification(monkeypatch, flag):
    instance = generator(monkeypatch, [dict(front="What does SM-2 schedule?", back="Reviews.")])
    states = []

    def ask(state, questions, **kwargs):
        states.append(state)
        assert set(questions) == set(verify.FLASHCARD_CHECKS)
        assert all(check["type"] == "noul" for check in questions.values())
        return jev.Answers({name: {"noul": 0.7 if name == flag else 0.1} for name in questions})

    monkeypatch.setattr(jev, "ask", ask)
    source = "SM-2 schedules reviews."
    generated = instance.generate_questions(
        ParsedDocument(full_text=source, sections=[ParsedSection(text=source)]),
        num_questions=1, card_type="flashcard", difficulty="hard",
    )
    assert states == [dict(section_text=source, card=dict(front="What does SM-2 schedule?", back="Reviews."))]
    instance.client.chat.completions.create.assert_called_once()
    if flag:
        assert generated == []
        assert instance.flagged_questions[0]["flags"] == [verify.FLASHCARD_CHECKS[flag]["description"]]
        assert instance.flagged_questions[0]["card_type"] == "flashcard"
    else:
        assert generated[0]["card_type"] == "flashcard"
        assert generated[0]["difficulty"] == "medium"
        assert generated[0]["reference"]["passage"] == source
        assert instance.flagged_questions == []


def test_flashcard_unavailable_verification_keeps_card(monkeypatch):
    card = dict(card_type="flashcard", question="SM-2?", explanation="Reviews.")
    monkeypatch.setattr(jev, "ask", Mock(side_effect=jev.JevUnavailable("offline")))
    verdicts = verify.verify_batch("SM-2 schedules reviews.", [card], "fixture-key")
    assert not verdicts[0].verdict.checked
    assert verify.partition([card], verdicts) == ([card], [])
