"""The System One services: what they ask, and what they do with the answers.

Jev itself is never called. Each test fakes the answer payload and checks the
policy around it, which is where the bugs live: thresholds, fallbacks, the
any-flag rule, and never failing the user's request because a judgment service
is down.
"""

import pytest

from app.services import jev
from app.services.ai import curation, rerank, sourcing, verify


def answers(payload):
    return jev.Answers(raw=payload)


def unavailable(*args, **kwargs):
    raise jev.JevUnavailable("offline")


# ---------------------------------------------------------------------------
# The shared client
# ---------------------------------------------------------------------------


class TestAnswers:
    def test_units_are_unwrapped(self):
        result = answers(
            {
                "pick": {"choice": "a", "confidence": 0.9, "probabilities": {"a": 0.9, "b": 0.1}},
                "flag": {"noul": 0.8},
                "level": {"score": 3.2},
            }
        )

        assert result.choice("pick") == "a"
        assert result.confidence("pick") == pytest.approx(0.9)
        assert result.probabilities("pick") == {"a": 0.9, "b": 0.1}
        assert result.noul("flag") == pytest.approx(0.8)
        assert result.score("level") == pytest.approx(3.2)

    def test_missing_question_returns_the_default(self):
        result = answers({})

        assert result.choice("absent", "fallback") == "fallback"
        assert result.noul("absent") == 0.0
        assert result.score("absent", 1) == 1.0

    def test_no_api_key_is_unavailable_not_a_crash(self):
        with pytest.raises(jev.JevUnavailable):
            jev.ask({}, {}, api_key="")


class TestTrim:
    def test_short_text_is_untouched(self):
        assert jev.trim("hello", 100) == "hello"

    def test_long_text_is_cut_to_budget(self):
        assert len(jev.trim("a" * 500, 100)) <= 100

    def test_a_long_unbroken_string_is_still_cut(self):
        """A word boundary near the start must not leave the text over budget."""
        text = "x " + "y" * 500
        assert len(jev.trim(text, 100)) <= 100


class TestVerdict:
    def test_any_flag_escalates_not_the_average(self):
        """One serious flag has to survive three harmless ones."""
        verdict = jev.Verdict(
            flags=[
                jev.Flag("a", 0.95),
                jev.Flag("b", 0.01),
                jev.Flag("c", 0.01),
                jev.Flag("d", 0.01),
            ]
        )

        assert verdict.should_escalate(0.7) is True
        assert [flag.name for flag in verdict.raised(0.7)] == ["a"]

    def test_nothing_above_the_threshold_does_not_escalate(self):
        verdict = jev.Verdict(flags=[jev.Flag("a", 0.6), jev.Flag("b", 0.69)])

        assert verdict.should_escalate(0.7) is False


# ---------------------------------------------------------------------------
# 1. Verifying generated questions
# ---------------------------------------------------------------------------


QUESTION = {
    "question_text": "What does SM-2 schedule?",
    "explanation": "It schedules reviews.",
    "options": [
        {"text": "Reviews", "is_correct": True},
        {"text": "Uploads", "is_correct": False},
    ],
}


class TestVerifyQuestion:
    def test_state_names_the_parts_each_check_judges(self):
        state = verify.build_state("The source text.", QUESTION)

        assert state["section_text"] == "The source text."
        assert state["question"]["correct_option"] == "Reviews"
        assert state["question"]["options"] == ["Reviews", "Uploads"]

    def test_every_failure_mode_is_asked_in_one_request(self, monkeypatch):
        captured = {}

        def fake_ask(state, questions, api_key, timeout=20.0, label=""):
            captured["questions"] = questions
            return answers({name: {"noul": 0.1} for name in questions})

        monkeypatch.setattr(jev, "ask", fake_ask)
        verify.verify_question("text", QUESTION, "key")

        assert set(captured["questions"]) == set(verify.CHECKS)
        assert all(q["type"] == "noul" for q in captured["questions"].values())

    def test_a_wrong_answer_key_is_flagged(self, monkeypatch):
        monkeypatch.setattr(
            jev, "ask", lambda *a, **k: answers({"answer_is_wrong": {"noul": 0.92}})
        )

        verdict = verify.verify_question("text", QUESTION, "key")

        assert verdict.flagged is True
        assert "The keyed answer is not supported by the source" in verdict.reasons

    def test_a_clean_question_is_not_flagged(self, monkeypatch):
        monkeypatch.setattr(
            jev, "ask", lambda *a, **k: answers({name: {"noul": 0.05} for name in verify.CHECKS})
        )

        assert verify.verify_question("text", QUESTION, "key").flagged is False

    def test_jev_being_down_lets_the_batch_through_unverified(self, monkeypatch):
        monkeypatch.setattr(jev, "ask", unavailable)

        verdicts = verify.verify_batch("text", [QUESTION, QUESTION], "key")

        assert [v.verdict.checked for v in verdicts] == [False, False]
        assert all(v.flagged is False for v in verdicts)

    def test_partition_keeps_clean_questions_and_explains_flagged_ones(self):
        verdicts = [
            verify.QuestionVerdict(0, jev.Verdict(flags=[jev.Flag("x", 0.1, "fine")])),
            verify.QuestionVerdict(1, jev.Verdict(flags=[jev.Flag("y", 0.9, "broken")])),
        ]

        passed, flagged = verify.partition([{"id": "a"}, {"id": "b"}], verdicts)

        assert [q["id"] for q in passed] == ["a"]
        assert flagged[0]["flags"] == ["broken"]


# ---------------------------------------------------------------------------
# 2 and 3. Choosing what to generate from
# ---------------------------------------------------------------------------


SECTIONS = [
    {"id": "0", "heading": "Contents", "text": "1. Intro 2. Body"},
    {"id": "1", "heading": "How caching works", "text": "A cache stores results so that..."},
    {"id": "2", "heading": "References", "text": "[1] Someone, 2019."},
]


class TestSectionSelection:
    def test_the_best_scoring_sections_win(self, monkeypatch):
        monkeypatch.setattr(
            jev,
            "ask",
            lambda *a, **k: answers(
                {"value_0": {"score": 0.0}, "value_1": {"score": 4.0}, "value_2": {"score": 0.0}}
            ),
        )

        chosen = sourcing.select_sections(SECTIONS, 1, "key")

        assert [section["heading"] for section in chosen] == ["How caching works"]

    def test_front_matter_is_left_out_even_when_more_are_wanted(self, monkeypatch):
        """Asking for two still returns one when only one is worth examining."""
        monkeypatch.setattr(
            jev,
            "ask",
            lambda *a, **k: answers(
                {"value_0": {"score": 0.0}, "value_1": {"score": 4.0}, "value_2": {"score": 0.2}}
            ),
        )

        chosen = sourcing.select_sections(SECTIONS, 2, "key")

        assert [section["heading"] for section in chosen] == ["How caching works"]

    def test_a_document_with_no_more_sections_than_needed_is_used_whole(self, monkeypatch):
        """Ranking would cost a request and could only remove material that is
        already the minimum, so it is skipped entirely."""

        def fail(*args, **kwargs):
            raise AssertionError("should not have asked Jev")

        monkeypatch.setattr(jev, "ask", fail)

        assert sourcing.select_sections(SECTIONS, 3, "key") == SECTIONS

    def test_falls_back_to_even_spacing_when_jev_is_down(self, monkeypatch):
        monkeypatch.setattr(jev, "ask", unavailable)

        chosen = sourcing.select_sections(SECTIONS, 2, "key")

        assert len(chosen) == 2

    def test_falls_back_when_everything_scores_as_front_matter(self, monkeypatch):
        """Generating slightly worse questions beats generating none."""
        monkeypatch.setattr(
            jev,
            "ask",
            lambda *a, **k: answers({f"value_{i}": {"score": 0.0} for i in range(3)}),
        )

        assert len(sourcing.select_sections(SECTIONS, 2, "key")) == 2

    def test_a_short_document_is_not_ranked_at_all(self, monkeypatch):
        monkeypatch.setattr(jev, "ask", unavailable)

        assert sourcing.select_sections(SECTIONS, 5, "key") == SECTIONS


# ---------------------------------------------------------------------------
# 4. Duplicates
# ---------------------------------------------------------------------------


class TestDuplicates:
    def test_every_pair_is_compared_in_one_request(self, monkeypatch):
        captured = {}

        def fake_ask(state, questions, *a, **k):
            captured["questions"] = questions
            return answers({name: {"noul": 0.0} for name in questions})

        monkeypatch.setattr(jev, "ask", fake_ask)
        curation.find_duplicates([{"question_text": f"q{i}"} for i in range(3)], "key")

        assert set(captured["questions"]) == {"same_0_1", "same_0_2", "same_1_2"}

    def test_the_earlier_question_of_a_pair_is_kept(self, monkeypatch):
        monkeypatch.setattr(jev, "ask", lambda *a, **k: answers({"same_0_1": {"noul": 0.95}}))

        pairs = curation.find_duplicates(
            [{"question_text": "a"}, {"question_text": "a again"}], "key"
        )

        assert pairs[0].kept_index == 0
        assert pairs[0].duplicate_index == 1

    def test_a_dropped_question_is_not_also_reported_against_a_third(self, monkeypatch):
        """Without this, three identical questions produce three pairs, not two."""
        monkeypatch.setattr(
            jev,
            "ask",
            lambda *a, **k: answers(
                {"same_0_1": {"noul": 0.95}, "same_0_2": {"noul": 0.95}, "same_1_2": {"noul": 0.95}}
            ),
        )

        pairs = curation.find_duplicates([{"question_text": "a"}] * 3, "key")

        assert [(p.kept_index, p.duplicate_index) for p in pairs] == [(0, 1), (0, 2)]

    def test_distinct_questions_produce_no_pairs(self, monkeypatch):
        monkeypatch.setattr(jev, "ask", lambda *a, **k: answers({"same_0_1": {"noul": 0.05}}))

        assert curation.find_duplicates([{"question_text": "a"}, {"question_text": "b"}], "key") == []

    @pytest.mark.parametrize("probability,expected", [(0.7, 0), (0.84, 0), (0.85, 1)])
    def test_duplicate_confidence_boundary(self, monkeypatch, probability, expected):
        monkeypatch.setattr(
            jev, "ask", lambda *a, **k: answers({"same_0_1": {"noul": probability}})
        )
        pairs = curation.find_duplicates(
            [{"question_text": "declare score"}, {"question_text": "store a GPA"}], "key"
        )
        assert len(pairs) == expected

    def test_one_question_is_never_a_duplicate(self):
        assert curation.find_duplicates([{"question_text": "a"}], "key") == []


# ---------------------------------------------------------------------------
# 5. Tagging
# ---------------------------------------------------------------------------


class TestTagging:
    def test_several_tags_can_apply_at_once(self, monkeypatch):
        monkeypatch.setattr(
            jev,
            "ask",
            lambda *a, **k: answers(
                {"tag_0": {"noul": 0.9}, "tag_1": {"noul": 0.1}, "tag_2": {"noul": 0.8}}
            ),
        )

        suggested = curation.suggest_tags(
            {"question_text": "q"}, ["caching", "billing", "latency"], "key"
        )

        assert suggested == ["caching", "latency"]

    def test_only_existing_tags_are_offered(self, monkeypatch):
        captured = {}

        def fake_ask(state, questions, *a, **k):
            captured["count"] = len(questions)
            return answers({})

        monkeypatch.setattr(jev, "ask", fake_ask)
        curation.suggest_tags({"question_text": "q"}, ["a", "b"], "key")

        assert captured["count"] == 2

    def test_no_tags_means_no_request(self):
        assert curation.suggest_tags({"question_text": "q"}, [], "key") == []

    def test_jev_being_down_suggests_nothing(self, monkeypatch):
        monkeypatch.setattr(jev, "ask", unavailable)

        assert curation.suggest_tags({"question_text": "q"}, ["a"], "key") == []


# ---------------------------------------------------------------------------
# 7. Grading written answers
# ---------------------------------------------------------------------------


class TestGrading:
    def test_quality_comes_back_in_the_range_sm2_accepts(self, monkeypatch):
        monkeypatch.setattr(
            jev,
            "ask",
            lambda *a, **k: answers(
                {
                    "quality": {"score": 4.4},
                    "is_correct": {"noul": 0.9},
                    "missed_key_point": {"noul": 0.1},
                }
            ),
        )

        grade = curation.grade_answer("q", "expected", "given", "key")

        assert grade.quality == 4
        assert grade.passed is True

    @pytest.mark.parametrize("score,expected", [(-3.0, 0), (9.0, 5), (2.5, 2), (2.4, 2)])
    def test_out_of_range_scores_are_clamped(self, monkeypatch, score, expected):
        monkeypatch.setattr(jev, "ask", lambda *a, **k: answers({"quality": {"score": score}}))

        assert curation.grade_answer("q", "e", "g", "key").quality == expected

    def test_below_three_does_not_pass(self, monkeypatch):
        monkeypatch.setattr(jev, "ask", lambda *a, **k: answers({"quality": {"score": 2.0}}))

        assert curation.grade_answer("q", "e", "g", "key").passed is False

    def test_grading_reports_when_it_could_not_run(self, monkeypatch):
        monkeypatch.setattr(jev, "ask", unavailable)

        grade = curation.grade_answer("q", "e", "g", "key")

        assert grade.checked is False
        assert grade.passed is False


# ---------------------------------------------------------------------------
# 6. Reranking search
# ---------------------------------------------------------------------------


CANDIDATES = [
    {"title": "Billing overview", "subtitle": "how invoices work"},
    {"title": "Cache eviction", "subtitle": "LRU and TTL"},
    {"title": "Cache warming", "subtitle": "preloading"},
]


class TestRerank:
    def test_results_are_ordered_by_relevance(self, monkeypatch):
        monkeypatch.setattr(
            jev,
            "ask",
            lambda *a, **k: answers(
                {
                    "relevance_0": {"score": 0.0},
                    "relevance_1": {"score": 4.0},
                    "relevance_2": {"score": 3.0},
                }
            ),
        )

        ordered = rerank.rerank("cache", CANDIDATES, "key")

        assert [item["title"] for item in ordered] == ["Cache eviction", "Cache warming"]

    def test_unrelated_results_are_dropped(self, monkeypatch):
        monkeypatch.setattr(
            jev,
            "ask",
            lambda *a, **k: answers(
                {
                    "relevance_0": {"score": 0.0},
                    "relevance_1": {"score": 4.0},
                    "relevance_2": {"score": 0.2},
                }
            ),
        )

        assert len(rerank.rerank("cache", CANDIDATES, "key")) == 1

    def test_dropping_everything_shows_the_original_results(self, monkeypatch):
        """A bad ordering beats telling the user there is nothing."""
        monkeypatch.setattr(
            jev,
            "ask",
            lambda *a, **k: answers({f"relevance_{i}": {"score": 0.0} for i in range(3)}),
        )

        assert rerank.rerank("cache", CANDIDATES, "key") == CANDIDATES

    def test_jev_being_down_leaves_the_database_order(self, monkeypatch):
        monkeypatch.setattr(jev, "ask", unavailable)

        assert rerank.rerank("cache", CANDIDATES, "key") == CANDIDATES

    def test_a_single_result_needs_no_judgment(self, monkeypatch):
        monkeypatch.setattr(jev, "ask", unavailable)

        assert rerank.rerank("cache", CANDIDATES[:1], "key") == CANDIDATES[:1]


class TestScoreTags:
    def test_unavailable_is_none_not_empty(self, monkeypatch):
        def down(*args, **kwargs):
            raise jev.JevUnavailable("down")

        monkeypatch.setattr(jev, "ask", down)
        assert curation.score_tags({"question_text": "q"}, ["a"], "key") is None

    def test_no_tags_is_empty_without_a_request(self, monkeypatch):
        monkeypatch.setattr(jev, "ask", lambda *a, **k: pytest.fail("no request expected"))
        assert curation.score_tags({"question_text": "q"}, [], "key") == {}
