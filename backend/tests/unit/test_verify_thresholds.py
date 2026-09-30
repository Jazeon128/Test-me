"""Measured check thresholds and normalized answer letters."""

import pytest

from app.services import jev
from app.services.ai import verify


@pytest.mark.parametrize("name,probability,flagged", [
    ("tests_wording", 0.71, False),
    ("tests_wording", 0.86, True),
    ("answer_is_wrong", 0.71, True),
    ("not_in_source", 0.71, True),
    ("ambiguous_options", 0.71, True),
    ("tests_wording", 0.85, True),
    ("answer_is_wrong", 0.7, True),
])
def test_each_flag_uses_its_threshold(name, probability, flagged):
    verdict = verify.QuestionVerdict(0, jev.Verdict(flags=[
        jev.Flag(name, probability, "reason"),
    ]))
    assert verdict.flagged is flagged
    assert verdict.reasons == (["reason"] if flagged else [])


def test_mixed_flags_only_report_reasons_above_their_threshold():
    verdict = verify.QuestionVerdict(0, jev.Verdict(flags=[
        jev.Flag("tests_wording", 0.71, "wording"),
        jev.Flag("answer_is_wrong", 0.71, "wrong answer"),
    ]))
    assert verdict.flagged
    assert verdict.reasons == ["wrong answer"]


@pytest.mark.parametrize("key", ["b", " B ", "B"])
@pytest.mark.parametrize("option_letter", ["B", " b "])
def test_build_state_normalizes_key_and_option(key, option_letter):
    state = verify.build_state("source", {
        "question_text": "question",
        "correct_answer": key,
        "options": [
            {"option": "A", "text": "wrong"},
            {"option": option_letter, "text": "keyed answer"},
        ],
    })
    assert state["question"]["correct_option"] == "keyed answer"
