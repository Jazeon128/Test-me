"""Decide what is worth generating questions from, before generating any.

Two judgments, both made before a single generation token is spent.

`rank_sections` replaces picking sections by index arithmetic. Even spacing
through a document reliably selects a table of contents, a copyright page and a
reference list, and the generator then writes questions about a bibliography.

`assess_source` looks at the whole document once. A three hour vlog transcript
with no teachable content should not consume a user's quota before anyone
notices it produced nothing.

Both fail open. If Jev cannot be reached the caller keeps its old behaviour,
because a study app that refuses to generate because a judgment service is down
is worse than one that generates slightly worse questions.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional

from ...utils.logging import get_logger
from .. import jev

logger = get_logger(__name__)

#: Sections scoring at or below this carry nothing worth examining.
#: Level 0 is front matter and reference lists.
MIN_USEFUL_SCORE = 0.5

#: Below this a source is not worth generating from at all.
TEACHABLE_FLOOR = 0.4

MAX_SECTION_CHARS = 2_000
MAX_SOURCE_CHARS = 20_000

#: Concrete situations, so each level stands on its own. Score criteria are a
#: list: the answer comes back as the index into it.
TEACHING_VALUE_LEVELS = [
    "Front matter, contents, references, acknowledgements or page furniture. Nothing to learn.",
    "Passing mention or administrative text. A fact or two, none of it worth examining.",
    "Some substance, but thin: definitions without explanation, or a list with no reasoning.",
    "Solid teachable content: explains a concept, a process or a relationship.",
    "Dense teachable content: several connected ideas, worked detail, or explained causes.",
]


@dataclass
class SectionRanking:
    section_id: str
    score: float
    heading: str = ""

    @property
    def useful(self) -> bool:
        return self.score > MIN_USEFUL_SCORE


@dataclass
class SourceAssessment:
    """Whether a document is worth generating from at all."""

    is_teachable: float
    is_transcript: float
    subject: Optional[str] = None
    checked: bool = True

    @property
    def worth_generating(self) -> bool:
        # An unchecked source always passes: never block on a missing judgment.
        return not self.checked or self.is_teachable >= TEACHABLE_FLOOR


def rank_sections(
    sections: List[Dict],
    api_key: str,
    timeout: float = jev.DEFAULT_TIMEOUT,
) -> List[SectionRanking]:
    """Score each section on how much it could teach.

    One Score per section in a single request. Scores over the same state are
    comparable, which is what makes them rankable; separate requests would not
    be.
    """
    if not sections:
        return []

    budget = jev.share_budget([s.get("text", "") for s in sections], jev.MAX_STATE_CHARS)
    per_section = min(budget, MAX_SECTION_CHARS)

    state = {
        "sections": [
            {
                "id": str(section.get("id", index)),
                "heading": section.get("heading") or "",
                "excerpt": jev.trim(section.get("text", ""), per_section),
            }
            for index, section in enumerate(sections)
        ]
    }

    questions = {
        f"value_{index}": {
            "type": "score",
            "instructions": (
                f"How much could a learner be examined on from the section at "
                f"`sections[{index}]`? Judge the content of its excerpt, not its heading."
            ),
            "criteria": TEACHING_VALUE_LEVELS,
        }
        for index in range(len(sections))
    }

    answers = jev.ask(state, questions, api_key, timeout, label="rank_sections")

    rankings = [
        SectionRanking(
            section_id=str(section.get("id", index)),
            score=answers.score(f"value_{index}"),
            heading=section.get("heading") or "",
        )
        for index, section in enumerate(sections)
    ]

    rankings.sort(key=lambda ranking: ranking.score, reverse=True)
    logger.info(
        "sections_ranked",
        total=len(rankings),
        useful=sum(1 for r in rankings if r.useful),
    )
    return rankings


def select_sections(
    sections: List[Dict],
    num_needed: int,
    api_key: str,
    timeout: float = jev.DEFAULT_TIMEOUT,
) -> List[Dict]:
    """The best sections to generate from, best first.

    Falls back to the caller's even-spacing behaviour when Jev is unavailable, so
    generation never stops because ranking did.
    """
    if len(sections) <= num_needed:
        return sections

    try:
        rankings = rank_sections(sections, api_key, timeout)
    except jev.JevUnavailable:
        logger.warning("section_ranking_skipped", total=len(sections))
        return _evenly_spaced(sections, num_needed)

    by_id = {str(section.get("id", index)): section for index, section in enumerate(sections)}

    chosen = [
        by_id[ranking.section_id]
        for ranking in rankings
        if ranking.useful and ranking.section_id in by_id
    ][:num_needed]

    # Everything scored as front matter. Rather than generate nothing, fall back
    # and let the generator do what it always did.
    if not chosen:
        logger.warning("no_useful_sections", total=len(sections))
        return _evenly_spaced(sections, num_needed)

    return chosen


def _evenly_spaced(sections: List[Dict], num_needed: int) -> List[Dict]:
    """The original selection: evenly distributed by index."""
    step = len(sections) / num_needed
    return [sections[int(index * step)] for index in range(num_needed)]


def assess_source(
    title: str,
    text: str,
    api_key: str,
    timeout: float = jev.DEFAULT_TIMEOUT,
) -> SourceAssessment:
    """Judge a whole document before generating from it."""
    state = {
        "title": title or "Untitled",
        "text": jev.trim(text, MAX_SOURCE_CHARS),
    }

    questions = {
        "is_teachable": {
            "type": "noul",
            "instructions": (
                "Does `text` contain factual material a learner could be examined on?"
            ),
            "criteria": {
                "true": "It explains concepts, processes, facts or relationships",
                "false": "It is chatter, narrative, opinion or admin with nothing examinable",
            },
        },
        # Speculative: only read when the caller wants to warn about transcripts,
        # which need different chunking than prose.
        "is_transcript": {
            "type": "noul",
            "instructions": "Is `text` a transcript of speech rather than written prose?",
            "criteria": {
                "true": "It reads as spoken language, with filler, repetition or speaker turns",
                "false": "It reads as written, edited prose",
            },
        },
    }

    try:
        answers = jev.ask(state, questions, api_key, timeout, label="assess_source")
    except jev.JevUnavailable:
        logger.warning("source_assessment_skipped", title=title)
        return SourceAssessment(is_teachable=1.0, is_transcript=0.0, checked=False)

    assessment = SourceAssessment(
        is_teachable=answers.noul("is_teachable"),
        is_transcript=answers.noul("is_transcript"),
    )

    logger.info(
        "source_assessed",
        teachable=round(assessment.is_teachable, 3),
        transcript=round(assessment.is_transcript, 3),
        worth_generating=assessment.worth_generating,
    )
    return assessment
