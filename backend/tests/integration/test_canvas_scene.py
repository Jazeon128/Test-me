"""Whiteboard persistence validates scenes and keeps generated provenance."""
from unittest.mock import Mock

import pytest

from app.api import canvas as api
from app.models.canvas import Canvas


@pytest.fixture
def canvas(db_session, sample_document):
    record = Canvas(
        document_id=sample_document.id, template="flowchart", request_text="Draw",
        payload_json={"nodes": [{"id": "a", "label": "Original", "detail": "Detail",
                                "source_section_id": "s"}]},
        sources_json=[{"id": "s", "text": "Source passage"}],
    )
    db_session.add(record)
    db_session.commit()
    return record


def scene():
    return {"schema_version": 2, "elements": [
        {"id": "shape", "type": "rectangle", "customData": {"nodeId": "a", "label": "Edited"}}
    ]}


def test_scene_accepted_and_restored(client, canvas):
    url = f"/api/canvas/{canvas.id}"
    response = client.patch(url, json={"edited": scene()})
    assert response.status_code == 200
    assert client.get(url).json()["edited"] == scene()
    assert client.patch(url, json={"edited": None, "layout": None}).json()["edited"] is None


@pytest.mark.parametrize("elements", [
    [{"id": "i", "type": "image"}],
    [{"id": "i", "type": "embeddable"}],
    [{"id": "i", "type": "iframe"}],
    [{"id": "i", "type": "rectangle"}] * 2,
    [{"id": str(i), "type": "rectangle"} for i in range(5001)],
    [{"id": str(i), "type": "text", "text": "x" * 2000} for i in range(1000)],
    [{"id": "i", "type": "text", "text": "x" * 2001}],
    [{"id": "i", "type": "text", "customData": None}],
    [{"id": 1, "type": "line"}],
    [None], None,
])
def test_invalid_scene_422(client, canvas, elements):
    url = f"/api/canvas/{canvas.id}"
    response = client.patch(url, json={"edited": {"schema_version": 2, "elements": elements}})
    assert response.status_code == 422
    assert client.get(url).json()["edited"] is None


def test_version_one_accepted(client, canvas):
    graph = {"schema_version": 1, "nodes": [
        {"id": "a", "type": "StepNode", "data": {"label": "Old"}, "position": {"x": 1, "y": 2}}
    ], "edges": []}
    response = client.patch(f"/api/canvas/{canvas.id}", json={"edited": graph})
    assert response.status_code == 200
    assert response.json()["edited"] == graph


def test_scene_node_questions_use_edited_label(client, canvas, monkeypatch):
    assert client.patch(f"/api/canvas/{canvas.id}", json={"edited": scene()}).status_code == 200
    generator = Mock(flagged_questions=[])
    generator.generate_questions.return_value = [{
        "question": "Topic?", "options": [{"option": "A", "text": "Topic"}],
        "correct_answer": "A", "explanation": "Passage",
    }]
    monkeypatch.setattr(api, "QuestionGenerator", Mock(return_value=generator))
    url = f"/api/canvas/{canvas.id}/nodes/a"
    source = client.get(url + "/source").json()
    assert source["label"] == "Edited"
    assert source["section"]["text"] == "Source passage"
    assert client.post(url + "/questions").status_code == 200
    assert generator.generate_questions.call_args.kwargs["parsed_doc"].title == "Edited"


def test_scene_node_falls_back_and_preserves_payload(canvas):
    canvas.edited_json = scene()
    assert api._find_canvas_node(canvas, "a")["detail"] == "Detail"
    assert canvas.payload_json["nodes"][0]["label"] == "Original"
    canvas.edited_json = {"schema_version": 2, "elements": []}
    assert api._find_canvas_node(canvas, "a")["label"] == "Original"
