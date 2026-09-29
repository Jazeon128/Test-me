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

import re
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


def score_tags(
    question: Dict,
    available_tags: List[str],
    api_key: str,
    timeout: float = jev.DEFAULT_TIMEOUT,
) -> Optional[Dict[str, float]]:
    """The probability that each existing tag describes a question.

    One Noul per tag rather than one Choice over all of them, because several
    tags can apply at once and a Choice would force a single winner.

    Returns None when Jev is unavailable, so a caller can tell "no tag fits"
    apart from "nothing was checked".
    """
    if not available_tags:
        return {}

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
        return None

    return {tag: answers.noul(f"tag_{index}") for index, tag in enumerate(available_tags)}


def suggest_tags(
    question: Dict,
    available_tags: List[str],
    api_key: str,
    timeout: float = jev.DEFAULT_TIMEOUT,
) -> List[str]:
    """The existing tags that apply to a question, best first."""
    scores = score_tags(question, available_tags, api_key, timeout)
    if not scores:
        return []

    suggested = sorted(
        (tag for tag, probability in scores.items() if probability >= TAG_THRESHOLD),
        key=lambda tag: scores[tag],
        reverse=True,
    )
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


# ---------------------------------------------------------------------------
# Feedback that makes the learner do the work: a hint instead of the answer,
# and the gaps in their own explanation instead of a corrected one.
# ---------------------------------------------------------------------------

MAX_HINT_CANDIDATES = 12
MAX_KEY_POINTS = 6
MAX_EXPLANATION_SENTENCES = 12
HINT_MIN_HELP = 0.5
HINT_MAX_GIVEAWAY = 0.5
#: A sentence is flagged at or above this.
SENTENCE_FLAG_THRESHOLD = 0.6
#: A key point counts as covered at or above this.
POINT_COVERED_THRESHOLD = 0.6

#: Depth of understanding an explanation shows, as the SM-2 quality it earns.
EXPLANATION_LEVELS = [
    "Shows no understanding. Off topic, or wrong about the core idea.",
    "Mostly wrong or empty, with a fragment of the right idea.",
    "Names the right idea but cannot say why or how it works.",
    "Explains the core idea correctly, with gaps or some fuzziness.",
    "Explains the idea clearly and correctly, missing only minor points.",
    "Explains it completely, correctly and simply enough for a 12-year-old.",
]


def split_sentences(text: str) -> List[str]:
    """Sentences, for judging one at a time. Code does the splitting, not the model."""
    parts = re.split(r"(?<=[.!?])\s+|\n+", text or "")
    return [part.strip() for part in parts if len(part.strip()) > 3]


def select_hint(
    question_text: str,
    expected_answer: str,
    candidates: List[str],
    api_key: str,
    timeout: float = jev.DEFAULT_TIMEOUT,
) -> Optional[str]:
    """Pick the sentence that helps most without giving the answer away.

    Select instead of generate: the hint is copied from the question's own
    explanation and source, so it cannot invent anything. Returns None when no
    candidate helps, every helpful one gives the answer away, or Jev is down.
    """
    candidates = [c for c in candidates if c][:MAX_HINT_CANDIDATES]
    if not candidates:
        return None

    state = {
        "question": question_text,
        "expected_answer": expected_answer,
        "candidates": [{"index": i, "text": jev.trim(c, 400)} for i, c in enumerate(candidates)],
    }
    questions_payload = {}
    for i in range(len(candidates)):
        questions_payload[f"helps_{i}"] = {
            "type": "noul",
            "instructions": (
                f"A learner answered `question` wrongly. Would reading `candidates[{i}].text` "
                f"move them toward `expected_answer`?"
            ),
            "criteria": {
                "true": "It points at the idea the answer depends on",
                "false": "It is unrelated, or too general to help",
            },
        }
        questions_payload[f"gives_away_{i}"] = {
            "type": "noul",
            "instructions": (
                f"Does `candidates[{i}].text` state `expected_answer` outright, so reading it "
                f"would hand the learner the answer without any thinking?"
            ),
            "criteria": {
                "true": "The answer can be read straight off it",
                "false": "The learner still has to work the answer out",
            },
        }

    try:
        answers = jev.ask(state, questions_payload, api_key, timeout, label="select_hint")
    except jev.JevUnavailable:
        return None

    usable = [
        (answers.noul(f"helps_{i}"), candidates[i])
        for i in range(len(candidates))
        if answers.noul(f"gives_away_{i}") < HINT_MAX_GIVEAWAY
        and answers.noul(f"helps_{i}") >= HINT_MIN_HELP
    ]
    logger.info("hint_selected", candidates=len(candidates), usable=len(usable))
    if not usable:
        return None
    return max(usable, key=lambda item: item[0])[1]


@dataclass
class ExplanationReview:
    """What the reviewer made of a learner's own explanation."""

    quality: int
    #: One entry per sentence of the learner's explanation.
    sentences: List[Dict]
    #: One entry per key point the explanation should convey.
    points: List[Dict]
    checked: bool = True

    @property
    def passed(self) -> bool:
        return self.quality >= 3


def review_explanation(
    question_text: str,
    key_points: List[str],
    explanation: str,
    api_key: str,
    timeout: float = jev.DEFAULT_TIMEOUT,
) -> ExplanationReview:
    """Judge an explanation: its depth, its wrong and unclear sentences, and its gaps.

    Everything is asked in one request over one state, so the sentence flags,
    the point coverage and the overall quality are judged together.
    """
    sentences = split_sentences(explanation)[:MAX_EXPLANATION_SENTENCES] or [explanation.strip()]
    points = [p for p in key_points if p][:MAX_KEY_POINTS]

    state = {
        "question": question_text,
        "key_points": [{"index": i, "text": p} for i, p in enumerate(points)],
        "explanation": [{"index": i, "text": jev.trim(s, 600)} for i, s in enumerate(sentences)],
    }
    questions_payload = {
        "quality": {
            "type": "score",
            "instructions": (
                "How well does the learner's `explanation`, read as a whole, show they "
                "understand the idea behind `question`, measured against `key_points`?"
            ),
            "criteria": EXPLANATION_LEVELS,
        }
    }
    for i in range(len(points)):
        questions_payload[f"covered_{i}"] = {
            "type": "noul",
            "instructions": (
                f"Does the learner's `explanation`, taken as a whole, convey "
                f"`key_points[{i}].text`, in any wording?"
            ),
            "criteria": {"true": "The point is there", "false": "The point is missing"},
        }
    for i in range(len(sentences)):
        questions_payload[f"wrong_{i}"] = {
            "type": "noul",
            "instructions": f"Does `explanation[{i}].text` state something factually wrong?",
            "criteria": {"true": "It contains an error", "false": "It is correct or harmless"},
        }
        questions_payload[f"unclear_{i}"] = {
            "type": "noul",
            "instructions": (
                f"Is `explanation[{i}].text` vague, or does it lean on jargon it does not "
                f"explain, so a curious 12-year-old could not follow it?"
            ),
            "criteria": {"true": "It is unclear", "false": "It is plain and clear"},
        }

    try:
        answers = jev.ask(state, questions_payload, api_key, timeout, label="review_explanation")
    except jev.JevUnavailable:
        logger.warning("explanation_review_unavailable")
        return ExplanationReview(quality=0, sentences=[], points=[], checked=False)

    review = ExplanationReview(
        quality=max(0, min(5, int(round(answers.score("quality"))))),
        sentences=[
            {
                "index": i,
                "text": s,
                "wrong": answers.noul(f"wrong_{i}") >= SENTENCE_FLAG_THRESHOLD,
                "unclear": answers.noul(f"unclear_{i}") >= SENTENCE_FLAG_THRESHOLD,
            }
            for i, s in enumerate(sentences)
        ],
        points=[
            {"text": p, "covered": answers.noul(f"covered_{i}") >= POINT_COVERED_THRESHOLD}
            for i, p in enumerate(points)
        ],
    )
    logger.info(
        "explanation_reviewed",
        quality=review.quality,
        covered=sum(p["covered"] for p in review.points),
        points=len(review.points),
        flagged=sum(s["wrong"] or s["unclear"] for s in review.sentences),
    )
    return review
