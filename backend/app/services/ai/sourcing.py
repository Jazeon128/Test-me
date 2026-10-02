"""Rank passages within a chosen source for question presentation.

Section ranking skips front matter and references. If Jev is unavailable,
selection falls back to evenly spaced sections.
"""

from dataclasses import dataclass
from typing import Dict, List

from ...utils.logging import get_logger
from .. import jev

logger = get_logger(__name__)

#: Sections scoring at or below this carry nothing worth examining.
#: Level 0 is front matter and reference lists.
MIN_USEFUL_SCORE = 0.5

MAX_SECTION_CHARS = 2_000

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
