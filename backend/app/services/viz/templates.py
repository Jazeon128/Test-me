"""The visual templates a canvas can be rendered as.

Each template declares four things:

- ``description``: the text Jev sees as a Choice option. It has to read as a
  self-contained description of when this form is the right answer, because the
  model never sees the template id.
- ``payload_schema``: the JSON the fill model must produce.
- ``layout``: which elk algorithm the frontend lays the graph out with.
- ``node_kinds``: the node types this template uses, which map to the React
  components in frontend/src/canvas/nodes/.

The registry is the single source of truth. The frontend mirrors the ids and the
layout hints in frontend/src/canvas/templates.js.
"""

from dataclasses import dataclass, field
from typing import Dict, List


#: Every node carries these, whatever the template.
_BASE_NODE_FIELDS = {
    "id": "string, unique within the canvas, short (n1, n2, ...)",
    "label": "string, at most 6 words, what the node is",
    "detail": "string or null, one short sentence of elaboration",
    "source_section_id": "string, the id of the source section this came from",
}


@dataclass(frozen=True)
class Template:
    id: str
    title: str
    description: str
    layout: str
    node_kinds: List[str]
    payload_schema: Dict = field(default_factory=dict)

    def schema_for_prompt(self) -> Dict:
        """The shape the fill model is asked to return."""
        return self.payload_schema


def _graph_schema(
    node_extra: Dict = None,
    edge_extra: Dict = None,
    groups: bool = False,
) -> Dict:
    """Most templates are a node/edge graph. This builds that schema."""
    node = dict(_BASE_NODE_FIELDS)
    if node_extra:
        node.update(node_extra)

    edge = {
        "source": "string, an existing node id",
        "target": "string, an existing node id",
        "label": "string or null, at most 3 words",
    }
    if edge_extra:
        edge.update(edge_extra)

    schema = {"nodes": [node], "edges": [edge]}
    if groups:
        schema["groups"] = [
            {
                "id": "string, unique (g1, g2, ...)",
                "label": "string, at most 4 words",
                "kind": "one of: group, boundary",
                "node_ids": ["string, ids of the nodes inside this group"],
            }
        ]
    return schema


#: Colour families come from the design canvas: blue, teal, amber, violet, rose,
#: slate. The fill model picks one per node so related nodes read as a set.
_COLOR = {
    "color": "one of: blue, teal, amber, violet, rose, slate",
}

_SHAPE = {
    "shape": "one of: rect, pill, hex",
}


TEMPLATES: Dict[str, Template] = {
    "flowchart": Template(
        id="flowchart",
        title="Flowchart",
        description=(
            "A step-by-step process or procedure, where one thing happens after "
            "another and the order matters. Use for how-to material, request "
            "flows, pipelines, and anything with decision points."
        ),
        layout="layered",
        node_kinds=["StepNode", "GroupNode"],
        payload_schema=_graph_schema(
            node_extra={**_SHAPE, "kind": "one of: step, decision, start, end"},
            edge_extra={"condition": "string or null, for edges leaving a decision"},
            groups=True,
        ),
    ),
    "architecture": Template(
        id="architecture",
        title="Architecture diagram",
        description=(
            "The components of a system and how data moves between them. Use for "
            "cloud and software architecture, services talking to services, and "
            "material that names infrastructure pieces inside regions, networks "
            "or other boundaries."
        ),
        layout="layered",
        node_kinds=["ServiceNode", "GroupNode"],
        payload_schema=_graph_schema(
            node_extra={
                **_COLOR,
                "category": "short string, the kind of component (compute, storage, network, ai, data, security, client)",
            },
            edge_extra={"protocol": "string or null, how the two components talk"},
            groups=True,
        ),
    ),
    "fishbone": Template(
        id="fishbone",
        title="Fishbone",
        description=(
            "The causes behind one problem or effect, grouped into categories. "
            "Use when the material explains why something fails, breaks, or goes "
            "wrong, and the answer has several contributing factors."
        ),
        layout="fishbone",
        node_kinds=["BoneNode"],
        payload_schema={
            "effect": "string, the problem or outcome the causes lead to",
            "categories": [
                {
                    "id": "string, unique (c1, c2, ...)",
                    "label": "string, at most 4 words, the cause category",
                    **_COLOR,
                    "causes": [
                        {
                            "id": "string, unique (n1, n2, ...)",
                            "label": "string, at most 8 words, one specific cause",
                            "source_section_id": "string, the id of the source section",
                        }
                    ],
                }
            ],
        },
    ),
    "mindmap": Template(
        id="mindmap",
        title="Mind map",
        description=(
            "One central idea with branches radiating out into sub-ideas. Use for "
            "exploring a topic broadly, brainstorm-shaped material, and content "
            "with no inherent order or direction."
        ),
        layout="mrtree",
        node_kinds=["StepNode"],
        payload_schema=_graph_schema(node_extra=_COLOR),
    ),
    "swimlane": Template(
        id="swimlane",
        title="Swimlane",
        description=(
            "A process where different actors, roles, teams or systems each own "
            "part of the work. Use when the material says who does what, and "
            "handoffs between them matter."
        ),
        layout="layered",
        node_kinds=["StepNode", "GroupNode"],
        payload_schema=_graph_schema(
            node_extra={"lane": "string, the actor or role that owns this step"},
            groups=True,
        ),
    ),
    "timeline": Template(
        id="timeline",
        title="Timeline",
        description=(
            "Events in time order, with dates, periods or phases. Use for history, "
            "release sequences, project phases, and anything where when something "
            "happened is the point."
        ),
        layout="layered",
        node_kinds=["MilestoneNode"],
        payload_schema=_graph_schema(
            node_extra={"when": "string, the date, period or phase label"},
        ),
    ),
    "comparison_matrix": Template(
        id="comparison_matrix",
        title="Comparison matrix",
        description=(
            "Several options or things compared across the same set of criteria. "
            "Use when the material weighs alternatives, lists trade-offs, or "
            "describes when to pick one thing over another."
        ),
        layout="box",
        node_kinds=["MatrixCell"],
        payload_schema={
            "options": ["string, the things being compared, at most 8 words each"],
            "criteria": ["string, the dimensions they are compared on"],
            "cells": [
                {
                    "option": "string, must match one of options",
                    "criterion": "string, must match one of criteria",
                    "value": "string, at most 10 words",
                    "verdict": "one of: good, mixed, poor, neutral",
                    "source_section_id": "string, the id of the source section",
                }
            ],
        },
    ),
    "hierarchy": Template(
        id="hierarchy",
        title="Hierarchy",
        description=(
            "Things that contain or report to other things, in levels. Use for "
            "taxonomies, org structures, category breakdowns, and material that "
            "divides a subject into parts and sub-parts."
        ),
        layout="mrtree",
        node_kinds=["StepNode", "GroupNode"],
        payload_schema=_graph_schema(node_extra=_COLOR),
    ),
    "state_machine": Template(
        id="state_machine",
        title="State machine",
        description=(
            "The states a thing can be in and what moves it between them. Use when "
            "the material describes statuses, lifecycles, or transitions triggered "
            "by events, and a thing can return to a state it was in before."
        ),
        layout="layered",
        node_kinds=["StepNode"],
        payload_schema=_graph_schema(
            node_extra={"kind": "one of: state, initial, terminal"},
            edge_extra={"trigger": "string, the event that causes this transition"},
        ),
    ),
    "c4_context": Template(
        id="c4_context",
        title="System context",
        description=(
            "One system in the middle, and the people and external systems around "
            "it that it talks to. Use for material that sets a system's boundary "
            "and names who and what is outside it."
        ),
        layout="layered",
        node_kinds=["ServiceNode", "GroupNode"],
        payload_schema=_graph_schema(
            node_extra={
                **_COLOR,
                "kind": "one of: person, system, external_system",
            },
            edge_extra={"protocol": "string or null, how they interact"},
            groups=True,
        ),
    ),
    "concept_map": Template(
        id="concept_map",
        title="Concept map",
        description=(
            "Ideas connected by named relationships, where the label on each link "
            "carries the meaning. Use for conceptual or theoretical material where "
            "how ideas relate matters more than any order or hierarchy."
        ),
        layout="force",
        node_kinds=["StepNode"],
        payload_schema=_graph_schema(
            node_extra=_COLOR,
            edge_extra={"label": "string, required, the relationship, at most 4 words"},
        ),
    ),
    "decision_tree": Template(
        id="decision_tree",
        title="Decision tree",
        description=(
            "A question, its possible answers, and where each answer leads, "
            "ending in a recommendation. Use when the material is about "
            "choosing between options according to criteria: which service to "
            "use when, which approach fits which situation. The branches are "
            "conditions, not sequential steps."
        ),
        layout="layered",
        node_kinds=["StepNode"],
        payload_schema=_graph_schema(
            node_extra={
                **_COLOR,
                "kind": "one of: question, outcome",
            },
            edge_extra={
                "label": "string, required, the answer that takes you down this branch",
            },
        ),
    ),
    "sequence": Template(
        id="sequence",
        title="Sequence diagram",
        description=(
            "Messages passed between named participants, in order over time. "
            "Use when the material says who calls whom and in what order, such "
            "as an API exchange, a protocol, or a handshake. Different from a "
            "flowchart because the same participant appears repeatedly and who "
            "is acting matters as much as what happens."
        ),
        layout="sequence",
        node_kinds=["MessageNode", "ActorNode"],
        payload_schema={
            "participants": [
                {
                    "id": "string, unique (p1, p2, ...)",
                    "label": "string, at most 4 words, the participant's name",
                    **_COLOR,
                }
            ],
            "messages": [
                {
                    "id": "string, unique (m1, m2, ...)",
                    "from": "string, a participant id",
                    "to": "string, a participant id",
                    "label": "string, at most 8 words, what is sent",
                    "kind": "one of: call, return, async",
                    "source_section_id": "string, the id of the source section",
                }
            ],
        },
    ),
    "causal_loop": Template(
        id="causal_loop",
        title="Causal loop",
        description=(
            "Factors that influence each other in feedback loops, where an effect "
            "circles back to its own cause. Use for system dynamics, vicious or "
            "virtuous cycles, and reinforcing or balancing behaviour over time."
        ),
        layout="force",
        node_kinds=["StepNode"],
        payload_schema=_graph_schema(
            node_extra=_COLOR,
            edge_extra={
                "polarity": "one of: reinforcing, balancing",
                "label": "string or null, at most 3 words",
            },
        ),
    ),
}


#: Jev needs an escape hatch when nothing fits, per the Choice guidance.
NO_MATCH = "other"

#: Granularity levels, in order. Jev returns a Score over these.
GRANULARITY_LEVELS = [
    "Overview: fewer than 10 nodes, only the main points",
    "Detailed: 10 to 25 nodes, the main points with their parts",
    "Exhaustive: more than 25 nodes, everything the source covers",
]

#: Node-count budget per granularity level, by index.
GRANULARITY_BUDGETS = [(4, 9), (10, 25), (26, 40)]


def criteria() -> Dict[str, str]:
    """The Choice criteria Jev picks from, plus the no-match option."""
    options = {t.id: t.description for t in TEMPLATES.values()}
    options[NO_MATCH] = "None of these forms fits the request or the source material well."
    return options


def get(template_id: str) -> Template:
    if template_id not in TEMPLATES:
        raise ValueError(f"Unknown template: {template_id}")
    return TEMPLATES[template_id]


def budget_for(granularity_index: int) -> tuple:
    """Node-count range for a granularity level, clamped to the known levels."""
    index = max(0, min(granularity_index, len(GRANULARITY_BUDGETS) - 1))
    return GRANULARITY_BUDGETS[index]
