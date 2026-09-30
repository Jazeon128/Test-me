"""Local BM25 gates retrieval before optional Jev ranking."""

import math
import re
from collections import Counter

from ...models.document import Document
from ...models.passage import DocumentPassage
from ..ai.rerank import MAX_CANDIDATES, rerank
from ..jev import JevUnavailable
from ..typesafe_key import typesafe_key

# Tune on labelled in-source and out-of-source questions from representative notebooks.
# Raise to reduce false matches, lower to reduce false refusals. Never tune on Jev scores.
MIN_SCORE = 1.0
STOP_WORDS = set("a an and are as at be been but by do does for from had has have how "
                 "i if in is it its me my of on or our that the their them there these "
                 "they this to was we were what when where which who why will with you your".split())
TOKEN = re.compile(r"\b\w{2,}\b")


def tokens(text):
    return [term for term in TOKEN.findall(text.lower()) if term not in STOP_WORDS]


def query_terms(message, previous=""):
    current = set(tokens(message))
    prior = set(tokens(previous))
    return {term: (1.0 if term in current else 0) + (0.5 if term in prior else 0)
            for term in current | prior}


def term_window(text, terms, size=400):
    """Centre a bounded window on the densest cluster of matching word tokens."""
    matches = [match for match in TOKEN.finditer(text.lower()) if match.group() in terms]
    if not matches:
        return text[:size]
    best = (0, 0, 0)
    right = 0
    for left, match in enumerate(matches):
        right = max(right, left)
        while right + 1 < len(matches) and matches[right + 1].end() - match.start() <= size:
            right += 1
        if right - left + 1 > best[0]:
            best = (right - left + 1, match.start(), matches[right].end())
    centre = (best[1] + best[2]) // 2
    start = max(0, min(centre - size // 2, len(text) - size))
    return text[start:start + size]


def bm25(passages, terms):
    counts = [Counter(tokens(p.text)) for p in passages]
    lengths = [sum(count.values()) for count in counts]
    average = sum(lengths) / len(lengths) if lengths else 0
    frequencies = {term: sum(term in count for count in counts) for term in terms}
    scores = []
    for count, length in zip(counts, lengths):
        score = 0.0
        for term, weight in terms.items():
            frequency = count[term]
            if not frequency:
                continue
            idf = math.log(1 + (len(counts) - frequencies[term] + 0.5) /
                           (frequencies[term] + 0.5))
            denominator = frequency + 1.2 * (1 - 0.75 + 0.75 * length / average)
            score += weight * idf * frequency * 2.2 / denominator
        scores.append(score)
    return scores


def retrieve(db, notebook_id, source_ids, message, previous=""):
    passages = (db.query(DocumentPassage).join(Document)
                .filter(Document.notebook_id == notebook_id, Document.status == "ready",
                        Document.id.in_(source_ids))
                .order_by(DocumentPassage.id).all())
    terms = query_terms(message, previous)
    ranked = sorted(zip(passages, bm25(passages, terms)), key=lambda item: -item[1])
    if not ranked or ranked[0][1] < MIN_SCORE or ranked[0][1] == 0:
        return []
    candidates = [passage for passage, score in ranked[:MAX_CANDIDATES]]
    try:
        candidates = rerank(message + "\n" + previous, candidates, typesafe_key(db),
                            text_of=lambda p: term_window(p.text, terms))
    except JevUnavailable:
        pass
    return candidates[:6]
