"""Replay the malformed stack without calling a model."""

import json
from types import SimpleNamespace

import pytest

from app.services.viz import generator, templates


RULES = [
    "On a pyramid, every node is one band of the single stack the material describes, "
    "numbered 1 at the top with no repeated level. Do not add nodes about the chart "
    "itself, its origin or its critics. Put that context in the detail of the band "
    "it concerns, or leave it out.",
    "When the stack itself is attributed to someone, say so in each band's detail, "
    'for example "NTL claims lecture gives 5% retention".',
]


def prompt(template):
    return generator._prompt(
        template, "Show the learning pyramid itself", "Learning pyramid",
        [{"id": "s1", "text": "NTL claims lecture gives 5% retention."}],
        10, 25, "horizontal", False,
    )


def test_pyramid_rules_follow_the_timeline_rule():
    text = prompt(templates.get("pyramid"))
    expected = "\n".join(f"- {rule}" for rule in RULES)
    assert expected in text
    assert text.index("- On a timeline") < text.index(expected)
    assert text.index(expected) < text.index("- If the source")


@pytest.mark.parametrize("template", [t for t in templates.TEMPLATES.values() if t.id != "pyramid"])
def test_other_templates_do_not_get_pyramid_rules(template):
    text = prompt(template)
    assert all(rule not in text for rule in RULES)


def malformed_stack():
    bands = [{"id": f"band{i}", "level": i, "label": f"Band {i}",
              "source_section_id": "s1"} for i in range(1, 8)]
    context = [{"id": f"context{i}", "level": i, "label": "Chart origin or criticism",
                "source_section_id": "s1"} for i in range(1, 7)]
    return {"nodes": bands + context, "edges": []}


def test_generation_keeps_first_band_per_level(monkeypatch):
    monkeypatch.setattr(generator, "QuestionGenerator", lambda **kwargs: SimpleNamespace(
        provider="mock", model="mock", client=None,
    ))
    monkeypatch.setattr(generator, "complete", lambda **kwargs: SimpleNamespace(
        text=json.dumps(malformed_stack()), input_tokens=0, output_tokens=0,
    ))
    result = generator.generate(
        None, templates.get("pyramid"), "Show the learning pyramid itself", "Learning pyramid",
        [{"id": "s1", "text": "Source"}],
    )
    assert [node["id"] for node in result["nodes"]] == [f"band{i}" for i in range(1, 8)]


def test_duplicate_levels_are_reported_and_other_templates_keep_them():
    result, problems = generator.validate(malformed_stack(), {"s1"}, template_id="pyramid")
    assert len(result["nodes"]) == 7
    assert problems == ["dropped 6 pyramid nodes with repeated levels"]
    result, problems = generator.validate(malformed_stack(), {"s1"}, template_id="flowchart")
    assert len(result["nodes"]) == 13
    assert problems == []
