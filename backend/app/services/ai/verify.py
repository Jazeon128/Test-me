"""Check a generated question against the text it came from.

Nothing used to check these. A model that writes a plausible question and keys
the wrong answer produces study material that teaches something false, and the
user has no way to tell: the question reads well, the explanation reads well,
and the answer is wrong. That is the failure this guards against.

Each check is a narrow yes/no over the section text and the question, so they
all go in one request. The four cover the ways a generated multiple-choice
question goes wrong:

- the keyed answer is not the correct one
- the question cannot be answered from the source at all
- more than one option is defensible
- the question tests the wording rather than the understanding

Escalation is any-flag. One confident red flag is enough, because averaging the
four lets a single serious problem sink into the middle of a mean.
"""

from dataclasses import dataclass
from typing import Dict, List

from ...utils.logging import get_logger
from .. import jev

logger = get_logger(__name__)

# 2026-09-30, Gemini 3.8 Flash, AIP-C01: 6 good questions and the same 6
# with wrong keys. Good / wrong-key ranges: answer_is_wrong 0.03-0.10 /
# 0.96-0.97, not_in_source 0.06-0.07 / 0.08-0.15, ambiguous_options
# 0.04-0.07 / 0.08-0.17, tests_wording 0.34-0.66 / 0.42-0.71.
# tests_wording is set high because it drifts across runs on good questions.
THRESHOLDS = {
    "answer_is_wrong": 0.7,
    "not_in_source": 0.7,
    "ambiguous_options": 0.7,
    "tests_wording": 0.85,
}

#: Leave room for the question and its options alongside the section text.
MAX_SECTION_CHARS = 12_000

CHECKS = {
    "answer_is_wrong": {
        "description": "The keyed answer is not supported by the source",
        "instructions": (
            "The option marked correct in `question.correct_option` is claimed to be the "
            "right answer to `question.text`. Judging only by `section_text`, is that "
            "claim wrong?"
        ),
        "criteria": {
            "true": "The source contradicts the keyed answer, or supports a different option better",
            "false": "The source supports the keyed answer",
        },
    },
    "not_in_source": {
        "description": "The question cannot be answered from the source",
        "instructions": (
            "Can `question.text` be answered using `section_text` alone, without outside "
            "knowledge? Answer true if it cannot."
        ),
        "criteria": {
            "true": "The source does not contain what is needed to answer it",
            "false": "The source contains the answer",
        },
    },
    "ambiguous_options": {
        "description": "More than one option is defensible",
        "instructions": (
            "Looking at all of `question.options` against `section_text`, is more than one "
            "option defensible as correct?"
        ),
        "criteria": {
            "true": "Two or more options could reasonably be argued as correct",
            "false": "Exactly one option is correct and the rest are clearly wrong",
        },
    },
    "tests_wording": {
        "description": "It tests recall of phrasing, not understanding",
        "instructions": (
            "Does `question.text` test whether the reader remembers the exact wording of "
            "`section_text`, rather than whether they understood the idea?"
        ),
        "criteria": {
            "true": "It turns on a phrase or label that could be matched without understanding",
            "false": "Answering it requires understanding the idea",
        },
    },
}


@dataclass
class QuestionVerdict:
    """What the checks said about one question."""

    question_index: int
    verdict: jev.Verdict

    @property
    def flagged(self) -> bool:
        return any(flag.probability >= THRESHOLDS.get(flag.name, 0.7) for flag in self.verdict.flags)

    @property
    def reasons(self) -> List[str]:
        return [
            flag.description for flag in self.verdict.flags
            if flag.probability >= THRESHOLDS.get(flag.name, 0.7)
        ]


def build_state(section_text: str, question: Dict) -> Dict:
    """Named fields, so each check can point at the part it judges."""
    options = question.get("options") or []
    correct_answer = question.get("correct_answer")
    correct = next(
        (
            option.get("text")
            for option in options
            if option.get("is_correct")
            or (
                correct_answer is not None
                and str(option.get("option")).strip().upper() == str(correct_answer).strip().upper()
            )
        ),
        None,
    )

    return {
        "section_text": jev.trim(section_text, MAX_SECTION_CHARS),
        "question": {
            "text": (
                question.get("question_text") or question.get("question") or question.get("text") or ""
            ),
            "options": [option.get("text", "") for option in options],
            "correct_option": correct or "",
            "explanation": question.get("explanation") or "",
        },
    }


def _questions() -> Dict:
    return {
        name: {"type": "noul", "instructions": check["instructions"], "criteria": check["criteria"]}
        for name, check in CHECKS.items()
    }


def verify_question(
    section_text: str,
    question: Dict,
    api_key: str,
    index: int = 0,
    timeout: float = jev.DEFAULT_TIMEOUT,
) -> QuestionVerdict:
    """Run every check over one question in a single request."""
    answers = jev.ask(
        state=build_state(section_text, question),
        questions=_questions(),
        api_key=api_key,
        timeout=timeout,
        label="verify_question",
    )

    flags = [
        jev.Flag(
            name=name,
            probability=answers.noul(name),
            description=check["description"],
        )
        for name, check in CHECKS.items()
    ]

    return QuestionVerdict(question_index=index, verdict=jev.Verdict(flags=flags))


def verify_batch(
    section_text: str,
    questions: List[Dict],
    api_key: str,
    timeout: float = jev.DEFAULT_TIMEOUT,
) -> List[QuestionVerdict]:
    """Verify a generated batch, one request per question.

    Questions are not batched into a single request on purpose. Each check names
    `question.text`, so several questions in one state would leave the model
    guessing which one a check refers to. A wrong verdict on a good question is
    worse than an extra request.

    A failure here never fails generation: Jev being unreachable means the batch
    goes through unverified, which is exactly how the app behaved before.
    """
    verdicts: List[QuestionVerdict] = []

    for index, question in enumerate(questions):
        try:
            verdicts.append(verify_question(section_text, question, api_key, index, timeout))
        except jev.JevUnavailable:
            logger.warning("verification_skipped", question_index=index)
            verdicts.append(
                QuestionVerdict(question_index=index, verdict=jev.Verdict(flags=[], checked=False))
            )

    flagged = sum(1 for verdict in verdicts if verdict.flagged)
    if verdicts:
        logger.info("batch_verified", total=len(verdicts), flagged=flagged)

    return verdicts


def partition(
    questions: List[Dict], verdicts: List[QuestionVerdict]
) -> tuple[List[Dict], List[Dict]]:
    """Split a batch into questions that passed and questions that were flagged.

    The flagged ones carry why they were flagged, so the caller can show it, drop
    them, or send them to a reasoning model for a rewrite.
    """
    passed: List[Dict] = []
    flagged: List[Dict] = []

    by_index = {verdict.question_index: verdict for verdict in verdicts}

    for index, question in enumerate(questions):
        verdict = by_index.get(index)
        if verdict is not None and verdict.flagged:
            flagged.append({**question, "flags": verdict.reasons})
        else:
            passed.append(question)

    return passed, flagged
