"""Fill a chosen template's schema from the source material.

The router decides the shape. This fills it. Splitting the two means the
expensive model never picks the form, and the cheap judgment never writes the
content.

Every node must carry a ``source_section_id`` that resolves to a real section,
which is what makes a node clickable back to the passage it came from. A node
that cites nothing is dropped rather than shown, because an uncitable node on a
canvas that promises citations is worse than a smaller canvas.
"""

import json
import re
from typing import Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from ...exceptions import QuestionGenerationError
from ...utils.logging import get_logger
from ..ai.completion import complete
from ..ai.question_generator import QuestionGenerator
from . import templates

logger = get_logger(__name__)

#: How much of each section the fill model sees. Whole documents blow the
#: context on long sources; the router has already decided the shape, so this
#: pass needs enough text to name things accurately, not everything.
SECTION_EXCERPT_CHARS = 1_400
MAX_FILL_CHARS = 90_000


def pick_sections(source_sections):
    """Spend the fill budget fairly, then restore source and section order."""
    picked = set()
    used = 0
    rounds = max((len(sections) for sections in source_sections), default=0)
    for index in range(rounds):
        for source_index, sections in enumerate(source_sections):
            if index >= len(sections):
                continue
            section = sections[index]
            cost = min(len(section["text"]), SECTION_EXCERPT_CHARS) + len(section.get("heading") or "")
            if used + cost > MAX_FILL_CHARS:
                return _ordered_sections(source_sections, picked)
            picked.add((source_index, index))
            used += cost
    return _ordered_sections(source_sections, picked)


def _ordered_sections(source_sections, picked):
    return [section for source_index, sections in enumerate(source_sections)
            for index, section in enumerate(sections) if (source_index, index) in picked]


def _heading(section, multiple_sources):
    heading = section.get("heading") or "Section"
    if multiple_sources:
        return f"{section['source_name']} / {heading}"
    return heading


class CanvasGenerationError(QuestionGenerationError):
    """The model did not return usable content for this template."""


def _prompt(
    template: templates.Template,
    request_text: str,
    title: str,
    sections: List[Dict],
    min_nodes: int,
    max_nodes: int,
    orientation: str,
    needs_grouping: bool,
    source_count: Optional[int] = None,
) -> str:
    multiple_sources = (source_count or len({s.get("document_id") for s in sections})) > 1
    source = "\n\n".join(
        f"[{s['id']}] {_heading(s, multiple_sources)}\n{s['text'][:SECTION_EXCERPT_CHARS]}"
        for s in sections
    )
    schema = json.dumps(template.schema_for_prompt(), indent=2)
    valid_ids = ", ".join(s["id"] for s in sections)

    grouping_line = (
        "Group related nodes into labelled containers."
        if needs_grouping
        else "Do not add groups unless the material clearly calls for them."
    )

    return f"""You are turning source material into a {template.title.lower()} for a study canvas.

THE REQUEST
{request_text}

THE SOURCE: {title}
{source}

WHAT TO DRAW
{template.description}

RULES
- Return between {min_nodes} and {max_nodes} nodes. Fewer, clearer nodes beat more.
- Every node's source_section_id must be one of these exact ids: {valid_ids}
- Pick the section the node's content actually came from. Do not guess.
- Labels are short. A label longer than 6 words belongs in detail instead.
- Use the words the source uses. Do not invent terminology it does not contain.
- If the source does not support part of the request, leave it out rather than filling it in.
- Lay the diagram out {orientation}ly.
- {grouping_line}

RETURN ONLY valid JSON matching this shape. No prose, no code fence.
{schema}

JSON:"""


def _extract_json(text: str) -> Dict:
    """Pull the JSON object out of a model response.

    Mirrors what _parse_batch_response does for questions: models add fences or
    a sentence of preamble often enough that this is not worth failing over.
    """
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1).strip()

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise CanvasGenerationError(
            message="The model did not return a JSON object",
            details={"response_preview": text[:300]},
        )
    return json.loads(text[start : end + 1])


def _walk_nodes(payload: Dict):
    """Yield every dict in the payload that carries a source_section_id."""
    if isinstance(payload, dict):
        if "source_section_id" in payload:
            yield payload
        for value in payload.values():
            yield from _walk_nodes(value)
    elif isinstance(payload, list):
        for item in payload:
            yield from _walk_nodes(item)


def validate(payload: Dict, valid_section_ids: set) -> Tuple[Dict, List[str]]:
    """Drop nodes whose citation does not resolve, and report what was dropped.

    Returns the payload and the list of problems, so the caller can decide
    whether to retry. An empty problem list means every node cites a real
    section.
    """
    problems = []
    for node in list(_walk_nodes(payload)):
        section_id = node.get("source_section_id")
        if section_id not in valid_section_ids:
            problems.append(
                f"node {node.get('id') or node.get('label', '?')} cites unknown section {section_id!r}"
            )
            node["source_section_id"] = None

    nodes = payload.get("nodes")
    if isinstance(nodes, list):
        known = {n.get("id") for n in nodes}
        edges = payload.get("edges")
        if isinstance(edges, list):
            kept = [e for e in edges if e.get("source") in known and e.get("target") in known]
            if len(kept) != len(edges):
                problems.append(f"dropped {len(edges) - len(kept)} edges pointing at unknown nodes")
            payload["edges"] = kept

    return payload, problems


def generate(
    db: Session,
    template: templates.Template,
    request_text: str,
    title: str,
    sections: List[Dict],
    granularity_index: int = 1,
    orientation: str = "horizontal",
    needs_grouping: bool = False,
    progress_callback=None,
    source_count: Optional[int] = None,
) -> Dict:
    """Produce the payload for one canvas, retrying once on invalid output."""
    generator = QuestionGenerator(db=db)
    min_nodes, max_nodes = templates.budget_for(granularity_index)
    valid_ids = {s["id"] for s in sections}

    prompt = _prompt(
        template,
        request_text,
        title,
        sections,
        min_nodes,
        max_nodes,
        orientation,
        needs_grouping,
        source_count,
    )

    last_error: Optional[str] = None
    for attempt in (1, 2):
        if progress_callback:
            progress_callback(f"Drawing the {template.title.lower()}", attempt)

        result = complete(
            provider=generator.provider,
            model=generator.model,
            client=generator.client,
            prompt=prompt
            if attempt == 1
            else f"{prompt}\n\nYour last answer was rejected: {last_error}\nReturn corrected JSON only.",
            max_tokens=8192,
        )

        try:
            payload = _extract_json(result.text)
        except (CanvasGenerationError, json.JSONDecodeError) as exc:
            last_error = str(exc)
            logger.warning("canvas_fill_unparseable", attempt=attempt, error=last_error)
            continue

        payload, problems = validate(payload, valid_ids)
        if problems:
            logger.warning("canvas_fill_problems", attempt=attempt, problems=problems[:5])

        logger.info(
            "canvas_filled",
            template=template.id,
            attempt=attempt,
            input_tokens=result.input_tokens,
            output_tokens=result.output_tokens,
            problems=len(problems),
        )
        return payload

    raise CanvasGenerationError(
        message="The model did not return a usable diagram after two attempts",
        details={"template": template.id, "last_error": last_error},
    )
