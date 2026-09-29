"""Hint selection and explanation review: the policy around the judgments.

Jev is never called. Each test fakes the answers and checks what is done with
them: a hint that gives the answer away is never chosen, flags follow their
thresholds, and an unavailable service is reported rather than guessed.
"""

import pytest

from app.services import jev
from app.services.ai import curation


def fake(monkeypatch, payload, seen=None):
    def ask(state, questions, api_key, timeout=None, label=None):
        if seen is not None:
            seen.update(state=state, questions=questions)
        return jev.Answers(raw=payload)

    monkeypatch.setattr(jev, "ask", ask)


def down(monkeypatch):
    def ask(*args, **kwargs):
        raise jev.JevUnavailable("offline")

    monkeypatch.setattr(jev, "ask", ask)


class TestSelectHint:
    CANDIDATES = [
        "Python is dynamically typed.",  # gives the answer away
        "Think about when the type of a variable is decided.",  # helps
        "Python was released in 1991.",  # irrelevant
    ]

    def test_picks_the_most_helpful_sentence_that_does_not_give_it_away(self, monkeypatch):
        fake(monkeypatch, {
            "helps_0": {"noul": 0.99}, "gives_away_0": {"noul": 0.95},
            "helps_1": {"noul": 0.80}, "gives_away_1": {"noul": 0.10},
            "helps_2": {"noul": 0.20}, "gives_away_2": {"noul": 0.05},
        })
        hint = curation.select_hint("q", "dynamic typing", self.CANDIDATES, "key")
        assert hint == self.CANDIDATES[1]

    def test_none_when_every_helpful_sentence_gives_it_away(self, monkeypatch):
        fake(monkeypatch, {
            "helps_0": {"noul": 0.99}, "gives_away_0": {"noul": 0.95},
            "helps_1": {"noul": 0.30}, "gives_away_1": {"noul": 0.10},
        })
        assert curation.select_hint("q", "a", self.CANDIDATES[:2], "key") is None

    def test_no_candidates_makes_no_request(self, monkeypatch):
        monkeypatch.setattr(jev, "ask", lambda *a, **k: pytest.fail("no request expected"))
        assert curation.select_hint("q", "a", ["", ""], "key") is None

    def test_unavailable_is_none(self, monkeypatch):
        down(monkeypatch)
        assert curation.select_hint("q", "a", self.CANDIDATES, "key") is None


class TestReviewExplanation:
    def test_flags_sentences_and_counts_points(self, monkeypatch):
        seen = {}
        fake(monkeypatch, {
            "quality": {"score": 2.6},
            "covered_0": {"noul": 0.9}, "covered_1": {"noul": 0.2},
            "wrong_0": {"noul": 0.1}, "unclear_0": {"noul": 0.1},
            "wrong_1": {"noul": 0.85}, "unclear_1": {"noul": 0.3},
            "unclear_2": {"noul": 0.7},
        }, seen)

        review = curation.review_explanation(
            "Why does ice float?",
            ["Ice is less dense than water.", "Hydrogen bonds hold ice in an open lattice."],
            "Ice floats. It is heavier than water. The lattice thing does stuff.",
            "key",
        )

        assert review.checked and review.quality == 3 and review.passed
        assert [s["text"] for s in review.sentences] == [
            "Ice floats.", "It is heavier than water.", "The lattice thing does stuff.",
        ]
        assert [(s["wrong"], s["unclear"]) for s in review.sentences] == [
            (False, False), (True, False), (False, True),
        ]
        assert [p["covered"] for p in review.points] == [True, False]
        # One request carries every judgment, so they are made over one state.
        assert len(seen["questions"]) == 1 + 2 + 3 * 2

    def test_quality_is_clamped_to_sm2_range(self, monkeypatch):
        fake(monkeypatch, {"quality": {"score": 9}})
        assert curation.review_explanation("q", ["p"], "An answer.", "key").quality == 5

    def test_unavailable_is_unchecked_not_a_fail(self, monkeypatch):
        down(monkeypatch)
        review = curation.review_explanation("q", ["p"], "An answer.", "key")
        assert review.checked is False


def test_split_sentences():
    assert curation.split_sentences("One thing. Two! Three?\nFour words") == [
        "One thing.", "Two!", "Three?", "Four words",
    ]
