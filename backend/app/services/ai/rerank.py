"""Order search results by what they mean, not by whether they contain the word.

The search endpoint finds candidates with `ILIKE '%q%'`, which is the right tool
for finding them: it is fast, it needs no service, and it misses nothing that
contains the string. What it cannot do is order them, and it cannot match a
query against a result that means the same thing in different words.

So code still finds the candidates and Jev only orders them. That is the
select-instead-of-generate shape: a judgment cannot return a result the query
never retrieved, and keeping retrieval in SQL means search still works with no
API key at all.
"""

from dataclasses import dataclass
from typing import Callable, Dict, List, Optional

from ...utils.logging import get_logger
from .. import jev

logger = get_logger(__name__)

#: Results below this are dropped. Level 0 is "not related at all".
MIN_RELEVANCE = 0.5

#: Reranking more than this is not worth the state budget or the latency.
MAX_CANDIDATES = 25

MAX_CANDIDATE_CHARS = 400

#: Score criteria are a list; the answer is the index into it.
RELEVANCE_LEVELS = [
    "Unrelated. The query and this result have nothing to do with each other.",
    "Same broad subject, but this does not address the query.",
    "Touches on the query without answering it.",
    "Relevant. Addresses what the query asks about.",
    "Exactly what the query is looking for.",
]


@dataclass
class Ranked:
    index: int
    relevance: float


def rerank(
    query: str,
    candidates: List[Dict],
    api_key: str,
    text_of: Optional[Callable[[Dict], str]] = None,
    timeout: float = jev.DEFAULT_TIMEOUT,
) -> List[Dict]:
    """Order candidates by relevance to the query, dropping the unrelated ones.

    Returns the candidates unchanged when Jev is unavailable, so search degrades
    to the database ordering rather than failing.
    """
    if len(candidates) < 2:
        return candidates

    capped = candidates[:MAX_CANDIDATES]
    describe = text_of or _default_text

    state = {
        "query": query,
        "candidates": [
            {"index": index, "text": jev.trim(describe(candidate), MAX_CANDIDATE_CHARS)}
            for index, candidate in enumerate(capped)
        ],
    }

    questions = {
        f"relevance_{index}": {
            "type": "score",
            "instructions": (
                f"How well does `candidates[{index}].text` answer what someone searching "
                f"for `query` is looking for?"
            ),
            "criteria": RELEVANCE_LEVELS,
        }
        for index in range(len(capped))
    }

    try:
        answers = jev.ask(state, questions, api_key, timeout, label="rerank_search")
    except jev.JevUnavailable:
        logger.warning("rerank_skipped", candidates=len(capped))
        return candidates

    ranked = [
        Ranked(index=index, relevance=answers.score(f"relevance_{index}"))
        for index in range(len(capped))
    ]
    ranked.sort(key=lambda item: item.relevance, reverse=True)

    kept = [capped[item.index] for item in ranked if item.relevance > MIN_RELEVANCE]

    # Everything scored as unrelated. Show the original results rather than an
    # empty page: a bad ordering beats telling the user there is nothing.
    if not kept:
        logger.info("rerank_dropped_everything", candidates=len(capped))
        return candidates

    # Anything past the cap keeps its database position on the end.
    logger.info("search_reranked", candidates=len(capped), kept=len(kept))
    return kept + candidates[MAX_CANDIDATES:]


def _default_text(candidate: Dict) -> str:
    """Title and subtitle, which is what a SearchResult carries."""
    parts = [candidate.get("title") or "", candidate.get("subtitle") or ""]
    return " ".join(part for part in parts if part)
