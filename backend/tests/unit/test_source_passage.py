import pytest

from app.api.questions import hint_candidates, source_passage
from app.models.question import Question
from app.services.ai.question_generator import PASSAGE_CHARS, passage_from


@pytest.mark.parametrize("end", [". ", "? ", "! ", "\n"])
def test_passage_cuts_at_last_nearby_sentence_end(end):
    text = "a" * 1700 + ". " + "b" * 190 + end + "c" * 300
    passage = passage_from(text)
    assert passage == text[:1893]
    assert len(passage) < PASSAGE_CHARS


@pytest.mark.parametrize("text", ["a" * 2100, "Earlier. " + "a" * 2100])
def test_passage_hard_cuts_without_nearby_end(text):
    assert passage_from(text) == text[:2000]


@pytest.mark.parametrize("text", ["", "A short passage.", "a" * 2000])
def test_passage_leaves_short_text_whole(text):
    assert passage_from(text) == text


@pytest.mark.parametrize(
    "reference, expected",
    [
        ({"passage": "Full passage.", "text": "Citation..."}, "Full passage."),
        ({"text": "Citation..."}, "Citation"),
        ({"text": "Citation."}, "Citation."),
        ({"text": "Inside... still here..."}, "Inside... still here"),
        ({"passage": "", "text": "Citation..."}, "Citation"),
        ({}, ""),
        (None, ""),
    ],
)
def test_source_passage(reference, expected):
    assert source_passage(Question(source_reference=reference)) == expected


def test_hint_candidates_include_sentence_after_character_200():
    passage = "a" * 220 + ". A later fact helps the learner."
    question = Question(
        explanation="An explanation sentence.",
        source_reference={"text": passage[:200] + "...", "passage": passage},
    )
    assert hint_candidates(question) == [
        "An explanation sentence.", "a" * 220 + ".", "A later fact helps the learner."
    ]
