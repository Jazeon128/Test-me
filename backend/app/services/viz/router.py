"""Pick the visual template for a canvas request, with Jev.

One request asks every independent question at once, which is how System One is
meant to be used: the questions run in parallel and cannot see one another's
answers, so speculative ones cost a few tokens and save a round trip.

What code keeps:

- The candidate templates, their descriptions and their schemas (templates.py).
- The decision about what to do with a low-confidence answer.
- The sanity check between the chosen template and what the source looks like.

What Jev supplies is the semantic judgment in the middle.
"""

import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import requests

from ...utils.logging import get_logger
from . import templates

logger = get_logger(__name__)

API_URL = "https://api.typesafe.ai/v1/systemone"
MODEL = "jev-latest"

#: Jev takes 64k tokens per request, 32k of it state plus the longest question.
#: The template descriptions are long, so keep the state well under that.
MAX_STATE_CHARS = 48_000

#: Below this, the answer is not used. The canvas asks the person instead.
#: Tune this against canvas_routing_log once there is real usage; it is a
#: starting point, not a measured threshold.
CONFIDENCE_FLOOR = 0.6

#: How many candidates the picker offers when confidence is below the floor.
CANDIDATES_OFFERED = 3


class RoutingUnavailable(RuntimeError):
    """Jev could not be reached or is not configured."""


@dataclass
class Routing:
    """What the router decided, and what it needs the person to decide."""

    template_id: Optional[str]
    confidence: float
    probabilities: Dict[str, float] = field(default_factory=dict)
    granularity_index: int = 1
    orientation: str = "horizontal"
    needs_grouping: bool = False
    shape_signals: Dict[str, float] = field(default_factory=dict)
    duration_ms: int = 0
    input_tokens: int = 0

    @property
    def is_confident(self) -> bool:
        return self.template_id is not None and self.confidence >= CONFIDENCE_FLOOR

    def candidates(self, limit: int = CANDIDATES_OFFERED) -> List[Dict]:
        """The top templates by probability, for the picker."""
        ranked = sorted(self.probabilities.items(), key=lambda kv: kv[1], reverse=True)
        out = []
        for template_id, probability in ranked[:limit]:
            if template_id == templates.NO_MATCH:
                continue
            template = templates.TEMPLATES.get(template_id)
            if template is None:
                continue
            out.append(
                {
                    "id": template.id,
                    "title": template.title,
                    "description": template.description,
                    "probability": round(probability, 3),
                }
            )
        return out


def build_state(request_text: str, title: str, sections: List[Dict]) -> Dict:
    """Named fields, per the guidance to prefer JSON when state has parts.

    Sections are sent as headings plus a bounded excerpt. Sending whole documents
    would blow the state budget on long sources and buys nothing: the router is
    judging the shape of the material, not its detail.
    """
    budget = MAX_STATE_CHARS - len(request_text) - len(title or "")
    per_section = max(120, budget // max(len(sections), 1))

    return {
        "request": request_text,
        "document_title": title or "Untitled",
        "sections": [
            {
                "id": section["id"],
                "heading": section.get("heading") or "",
                "excerpt": section["text"][:per_section],
            }
            for section in sections
        ],
    }


def _questions() -> Dict:
    return {
        "template": {
            "type": "choice",
            "instructions": (
                "Which visual form best answers the request in `request`, given "
                "the material in `sections`? Judge what the material actually "
                "contains, not only the words of the request."
            ),
            "criteria": templates.criteria(),
        },
        "granularity": {
            "type": "score",
            "instructions": (
                "How much detail should the diagram carry to answer `request` "
                "from this material?"
            ),
            "criteria": templates.GRANULARITY_LEVELS,
        },
        # Speculative: only the flow-shaped templates read this.
        "orientation": {
            "type": "choice",
            "instructions": (
                "If this material were drawn as a flow, would it read better "
                "left to right or top to bottom?"
            ),
            "criteria": {
                "horizontal": "Left to right, a long sequence of few parallel branches",
                "vertical": "Top to bottom, a short sequence or many parallel branches",
            },
        },
        "needs_grouping": {
            "type": "noul",
            "instructions": (
                "Do the parts of this material fall into named clusters that "
                "should be drawn inside labelled containers?"
            ),
            "criteria": {
                "true": "The material names groupings such as phases, layers, regions, teams or categories",
                "false": "The parts stand alone with no natural grouping",
            },
        },
        # These three let code check the chosen template against the material
        # rather than trusting a single Choice.
        "is_procedural": {
            "type": "noul",
            "instructions": "Does this material describe steps that happen in a set order?",
            "criteria": {
                "true": "Order matters: one thing follows another",
                "false": "No inherent order",
            },
        },
        "is_causal": {
            "type": "noul",
            "instructions": "Does this material explain why something happens or goes wrong?",
            "criteria": {
                "true": "It gives causes, reasons or contributing factors",
                "false": "It describes what things are, not why",
            },
        },
        "is_comparative": {
            "type": "noul",
            "instructions": "Does this material weigh two or more alternatives against each other?",
            "criteria": {
                "true": "It compares options, or says when to choose one over another",
                "false": "It covers one thing, or several without comparing them",
            },
        },
    }


def route(
    request_text: str,
    title: str,
    sections: List[Dict],
    api_key: str,
    timeout: float = 20.0,
) -> Routing:
    """Ask Jev which template to draw, and how."""
    if not api_key:
        raise RoutingUnavailable("No TypeSafe API key configured")

    payload = {
        "state": build_state(request_text, title, sections),
        "model": MODEL,
        "questions": _questions(),
    }

    started = time.time()
    try:
        response = requests.post(
            API_URL,
            json=payload,
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=timeout,
        )
        response.raise_for_status()
    except requests.RequestException as exc:
        raise RoutingUnavailable(str(exc)) from exc

    body = response.json()
    answers = body.get("answers", {})
    duration_ms = int((time.time() - started) * 1000)

    template_answer = answers.get("template", {})
    chosen = template_answer.get("choice")
    probabilities = template_answer.get("probabilities", {}) or {}

    granularity = answers.get("granularity", {})
    granularity_index = int(round(granularity.get("score", 1)))

    routing = Routing(
        template_id=None if chosen == templates.NO_MATCH else chosen,
        confidence=float(template_answer.get("confidence", 0.0)),
        probabilities={k: float(v) for k, v in probabilities.items()},
        granularity_index=granularity_index,
        orientation=answers.get("orientation", {}).get("choice", "horizontal"),
        needs_grouping=float(answers.get("needs_grouping", {}).get("noul", 0)) >= 0.5,
        shape_signals={
            "procedural": float(answers.get("is_procedural", {}).get("noul", 0)),
            "causal": float(answers.get("is_causal", {}).get("noul", 0)),
            "comparative": float(answers.get("is_comparative", {}).get("noul", 0)),
        },
        duration_ms=duration_ms,
        input_tokens=int(body.get("usage", {}).get("input_tokens", 0)),
    )

    logger.info(
        "canvas_routed",
        template=routing.template_id,
        confidence=round(routing.confidence, 3),
        granularity=routing.granularity_index,
        duration_ms=duration_ms,
        input_tokens=routing.input_tokens,
        confident=routing.is_confident,
    )
    return routing
