"""Pyramid registry and citation validation require no model calls."""

from app.services.viz import generator, templates


DESCRIPTION = (
    "Ranked layers stacked from a narrow top to a wide base, where a layer's "
    "position in the stack is the point. Use for pyramids, tiers, layered models "
    "such as Maslow's hierarchy or the testing pyramid, and any chart the "
    "material describes as a pyramid or cone."
)


def test_templates_endpoint_includes_pyramid(client):
    response = client.get("/api/canvas/templates")
    assert response.status_code == 200
    items = response.json()
    assert len(items) == 15
    pyramid = next(item for item in items if item["id"] == "pyramid")
    assert pyramid["description"] == DESCRIPTION
    assert pyramid["title"] == "Pyramid"


def test_pyramid_schema():
    pyramid = templates.get("pyramid")
    assert pyramid.layout == "box"
    assert pyramid.node_kinds == ["PyramidBand"]
    assert templates.criteria()["pyramid"] == DESCRIPTION
    schema = pyramid.schema_for_prompt()
    assert schema["nodes"][0]["level"] == "integer, 1 is the top band, counting down"
    assert schema["nodes"][0]["value"] == (
        "string or null, a figure the material attaches to this layer, "
        "such as a percentage, at most 12 characters"
    )
    assert "edges" in schema


def test_pyramid_unknown_section_id_is_cleared():
    payload = {"nodes": [
        {"id": "top", "level": 1, "source_section_id": "real"},
        {"id": "base", "level": 2, "source_section_id": "unknown"},
    ], "edges": []}
    result, problems = generator.validate(payload, {"real"})
    assert result["nodes"][0]["source_section_id"] == "real"
    assert result["nodes"][1]["source_section_id"] is None
    assert problems == ["node base cites unknown section 'unknown'"]
