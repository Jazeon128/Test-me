"""Judgments about questions once they exist: duplicates, tags, and grading.

Three features that share a shape. Each is a decision over text the app already
holds, none of them writes anything, and all three are useless to an LLM call
that costs a hundred times as much.

- `find_duplicates` catches the same fact asked twice, which happens whenever a
  document repeats itself across sections and each section is generated from
  separately.
- `suggest_tags` picks from the tags that exist rather than inventing new ones,
  so the tag list stays a controlled vocabulary instead of drifting.
- `grade_answer` judges a written answer. This is the one that unlocks something
  the app cannot do at all today, because free-text study needs a grader and a
  grader is a judgment, not a generation.

All three fail open and return nothing rather than raising.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from ...utils.logging import get_logger
from .. import jev

logger = get_logger(__name__)

#: Two questions at or above this test the same thing.
DUPLICATE_THRESHOLD = 0.85

#: A tag is suggested at or above this.
TAG_THRESHOLD = 0.6

MAX_QUESTIONS_COMPARED = 40
MAX_ANSWER_CHARS = 4_000

#: SM-2 wants 0 to 5. Score criteria are a list and the answer is the index
#: into it, which is exactly the quality the scheduler receives.
ANSWER_QUALITY_LEVELS = [
    "Nothing correct. The answer misses the question or contradicts it outright.",
    "Mostly wrong, with a fragment of something relevant.",
    "Partly right but missing the main point, or right for the wrong reason.",
    "The main point is there, with gaps or imprecision.",
    "Correct and clear, missing only minor detail.",
    "Correct, complete and precise.",
]


@dataclass
class DuplicatePair:
    """Two questions that test the same thing."""

    kept_index: int
    duplicate_index: int
    probability: float


@dataclass
class Grade:
    """What the grader made of a written answer."""

    quality: int
    is_correct: float
    missed_key_point: float
    checked: bool = True

    @property
    def passed(self) -> bool:
        # SM-2 treats 3 and above as recalled.
        return self.quality >= 3


def find_duplicates(
    questions: List[Dict],
    api_key: str,
    timeout: float = jev.DEFAULT_TIMEOUT,
) -> List[DuplicatePair]:
    """Find questions that test the same fact as an earlier one.

    Every pair is judged in one request. The comparison is quadratic, so the
    list is capped: beyond a few dozen questions the pair count stops being
    worth a single request and the caller should compare within sections.
    """
    if len(questions) < 2:
        return []

    capped = questions[:MAX_QUESTIONS_COMPARED]
    budget = jev.share_budget([q.get("question_text", "") for q in capped], jev.MAX_STATE_CHARS)

    state = {
        "questions": [
            {
                "index": index,
                "text": jev.trim(question.get("question_text") or question.get("text") or "", budget),
            }
            for index, question in enumerate(capped)
        ]
    }

    pairs: List[Tuple[int, int]] = [
        (earlier, later)
        for later in range(len(capped))
        for earlier in range(later)
    ]

    if not pairs:
        return []

    questions_payload = {
        f"same_{earlier}_{later}": {
            "type": "noul",
            "instructions": (
                f"Do `questions[{earlier}].text` and `questions[{later}].text` test the same "
                f"piece of knowledge? Wording may differ."
            ),
            "criteria": {
                "true": "A learner who can answer one can answer the other for the same reason",
                "false": "They test different knowledge, even if the topic is shared",
            },
        }
        for earlier, later in pairs
    }

    try:
        answers = jev.ask(state, questions_payload, api_key, timeout, label="find_duplicates")
    except jev.JevUnavailable:
        logger.warning("duplicate_check_skipped", total=len(capped))
        return []

    duplicates: List[DuplicatePair] = []
    already_removed: set = set()

    for earlier, later in pairs:
        # Keep the earlier of a pair, and never chain: if the later one is
        # already dropped it cannot also be the duplicate of a third.
        if later in already_removed or earlier in already_removed:
            continue
        probability = answers.noul(f"same_{earlier}_{later}")
        if probability >= DUPLICATE_THRESHOLD:
            duplicates.append(DuplicatePair(earlier, later, probability))
            already_removed.add(later)

    logger.info("duplicates_found", total=len(capped), duplicates=len(duplicates))
    return duplicates


def suggest_tags(
    question: Dict,
    available_tags: List[str],
    api_key: str,
    timeout: float = jev.DEFAULT_TIMEOUT,
) -> List[str]:
    """Pick which of the existing tags apply to a question.

    One Noul per tag rather than one Choice over all of them, because several
    tags can apply at once and a Choice would force a single winner.
    """
    if not available_tags:
        return []

    state = {
        "question": {
            "text": question.get("question_text") or question.get("text") or "",
            "explanation": question.get("explanation") or "",
        }
    }

    questions_payload = {
        f"tag_{index}": {
            "type": "noul",
            "instructions": (
                f'Does the tag "{tag}" describe what `question.text` is about?'
            ),
            "criteria": {
                "true": f'The question is about "{tag}"',
                "false": f'The question is not about "{tag}"',
            },
        }
        for index, tag in enumerate(available_tags)
    }

    try:
        answers = jev.ask(state, questions_payload, api_key, timeout, label="suggest_tags")
    except jev.JevUnavailable:
        return []

    suggested = [
        tag
        for index, tag in enumerate(available_tags)
        if answers.noul(f"tag_{index}") >= TAG_THRESHOLD
    ]

    logger.info("tags_suggested", available=len(available_tags), suggested=len(suggested))
    return suggested


def grade_answer(
    question_text: str,
    expected_answer: str,
    given_answer: str,
    api_key: str,
    timeout: float = jev.DEFAULT_TIMEOUT,
) -> Grade:
    """Grade a written answer and return a quality SM-2 can use.

    The quality comes from a Score rather than from a yes/no, because the
    scheduler wants degree: an answer that is right but vague should not be
    treated the same as one that is right and precise.
    """
    state = {
        "question": question_text,
        "expected_answer": expected_answer,
        "given_answer": jev.trim(given_answer, MAX_ANSWER_CHARS),
    }

    questions_payload = {
        "quality": {
            "type": "score",
            "instructions": (
                "How well does `given_answer` answer `question`, measured against "
                "`expected_answer`? Judge the understanding shown, not the wording, "
                "the length or the spelling."
            ),
            "criteria": ANSWER_QUALITY_LEVELS,
        },
        "is_correct": {
            "type": "noul",
            "instructions": "Is `given_answer` correct?",
            "criteria": {
                "true": "It gives the right answer, whatever its phrasing",
                "false": "It is wrong, or does not answer the question",
            },
        },
        # Separate from correctness: an answer can be correct as far as it goes
        # and still leave out the thing the question was asking about.
        "missed_key_point": {
            "type": "noul",
            "instructions": (
                "Does `given_answer` leave out the main point that `expected_answer` makes?"
            ),
            "criteria": {
                "true": "The central point is missing",
                "false": "The central point is present",
            },
        },
    }

    try:
        answers = jev.ask(state, questions_payload, api_key, timeout, label="grade_answer")
    except jev.JevUnavailable:
        logger.warning("grading_unavailable")
        return Grade(quality=0, is_correct=0.0, missed_key_point=0.0, checked=False)

    quality = int(round(answers.score("quality")))
    grade = Grade(
        # Clamp: SM-2 rejects anything outside 0 to 5.
        quality=max(0, min(5, quality)),
        is_correct=answers.noul("is_correct"),
        missed_key_point=answers.noul("missed_key_point"),
    )

    logger.info(
        "answer_graded",
        quality=grade.quality,
        correct=round(grade.is_correct, 3),
        passed=grade.passed,
    )
    return grade
