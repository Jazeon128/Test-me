"""Tests for the canvas router and fill validation.

These cover the decisions code owns, not the model's judgment: when a routing
answer is acted on, what the picker offers when it is not, and what happens to a
node that cites a section which does not exist.
"""

import json

import pytest

from app.services.viz import generator, router, templates


class TestConfidenceFloor:
    def test_confident_answer_is_used(self):
        routing = router.Routing(template_id="flowchart", confidence=0.82)
        assert routing.is_confident

    def test_answer_below_the_floor_is_not_used(self):
        routing = router.Routing(template_id="flowchart", confidence=0.41)
        assert not routing.is_confident

    def test_answer_exactly_at_the_floor_is_used(self):
        routing = router.Routing(template_id="flowchart", confidence=router.CONFIDENCE_FLOOR)
        assert routing.is_confident

    def test_no_match_is_never_confident(self):
        """Jev answering 'other' means no template fits, whatever the score."""
        routing = router.Routing(template_id=None, confidence=0.99)
        assert not routing.is_confident


class TestCandidates:
    def test_candidates_are_ranked_and_limited(self):
        routing = router.Routing(
            template_id="flowchart",
            confidence=0.4,
            probabilities={
                "flowchart": 0.40,
                "swimlane": 0.30,
                "timeline": 0.20,
                "mindmap": 0.10,
            },
        )
        candidates = routing.candidates()
        assert [c["id"] for c in candidates] == ["flowchart", "swimlane", "timeline"]
        assert candidates[0]["probability"] == 0.4
        assert candidates[0]["title"] == "Flowchart"

    def test_no_match_is_not_offered_as_a_candidate(self):
        """'other' is a real answer to Jev but not something a person can pick."""
        routing = router.Routing(
            template_id=None,
            confidence=0.3,
            probabilities={templates.NO_MATCH: 0.5, "fishbone": 0.3, "mindmap": 0.2},
        )
        assert [c["id"] for c in routing.candidates()] == ["fishbone", "mindmap"]


class TestState:
    def test_state_stays_within_the_character_budget(self):
        """Jev takes 32k tokens of state. A long document must not blow it."""
        sections = [{"id": f"s{i}", "heading": f"H{i}", "text": "x" * 50_000} for i in range(40)]
        state = router.build_state("draw this", "Long Document", sections)

        assert len(json.dumps(state)) < router.MAX_STATE_CHARS * 1.2
        assert len(state["sections"]) == 40, "every section is still represented"

    def test_short_documents_are_not_truncated(self):
        sections = [{"id": "s0", "heading": "Intro", "text": "A short section."}]
        state = router.build_state("draw this", "Doc", sections)
        assert state["sections"][0]["excerpt"] == "A short section."


class TestQuestions:
    def test_every_template_is_offered_plus_a_no_match_option(self):
        criteria = templates.criteria()
        assert templates.NO_MATCH in criteria
        assert len(criteria) == len(templates.TEMPLATES) + 1

    def test_choice_stays_under_the_option_cap(self):
        assert len(templates.criteria()) <= 255

    def test_independent_questions_are_asked_in_one_request(self):
        """They run in parallel, so splitting them would only cost a round trip."""
        questions = router._questions()
        assert set(questions) == {
            "template",
            "granularity",
            "orientation",
            "needs_grouping",
            "is_procedural",
            "is_causal",
            "is_comparative",
        }
        assert questions["template"]["type"] == "choice"
        assert questions["granularity"]["type"] == "score"
        assert questions["needs_grouping"]["type"] == "noul"


class TestGranularityBudgets:
    @pytest.mark.parametrize(
        "index,expected",
        [(0, (4, 9)), (1, (10, 25)), (2, (26, 40))],
    )
    def test_budget_per_level(self, index, expected):
        assert templates.budget_for(index) == expected

    def test_out_of_range_index_is_clamped(self):
        """Jev returns a weighted score, so rounding can land outside the levels."""
        assert templates.budget_for(-1) == (4, 9)
        assert templates.budget_for(99) == (26, 40)


class TestFillValidation:
    def test_node_citing_an_unknown_section_is_flagged_and_cleared(self):
        payload = {
            "nodes": [
                {"id": "n1", "label": "Real", "source_section_id": "s0"},
                {"id": "n2", "label": "Invented", "source_section_id": "s99"},
            ],
            "edges": [],
        }
        payload, problems = generator.validate(payload, {"s0"})

        assert len(problems) == 1
        assert payload["nodes"][0]["source_section_id"] == "s0"
        assert payload["nodes"][1]["source_section_id"] is None

    def test_edges_pointing_at_unknown_nodes_are_dropped(self):
        payload = {
            "nodes": [{"id": "n1", "label": "A", "source_section_id": "s0"}],
            "edges": [
                {"source": "n1", "target": "n1"},
                {"source": "n1", "target": "ghost"},
            ],
        }
        payload, problems = generator.validate(payload, {"s0"})

        assert len(payload["edges"]) == 1
        assert any("dropped 1 edges" in p for p in problems)

    def test_nested_nodes_are_validated_too(self):
        """A fishbone keeps its causes nested inside categories."""
        payload = {
            "effect": "It breaks",
            "categories": [
                {
                    "id": "c1",
                    "label": "Process",
                    "causes": [
                        {"id": "n1", "label": "Slow step", "source_section_id": "s0"},
                        {"id": "n2", "label": "Made up", "source_section_id": "nope"},
                    ],
                }
            ],
        }
        payload, problems = generator.validate(payload, {"s0"})

        assert len(problems) == 1
        assert payload["categories"][0]["causes"][1]["source_section_id"] is None


class TestJsonExtraction:
    def test_plain_json(self):
        assert generator._extract_json('{"nodes": []}') == {"nodes": []}

    def test_fenced_json(self):
        assert generator._extract_json('```json\n{"nodes": []}\n```') == {"nodes": []}

    def test_json_after_a_sentence_of_preamble(self):
        text = 'Here is the diagram:\n{"nodes": [{"id": "n1"}]}'
        assert generator._extract_json(text)["nodes"][0]["id"] == "n1"

    def test_no_json_at_all_raises(self):
        with pytest.raises(generator.CanvasGenerationError):
            generator._extract_json("I could not draw that.")
