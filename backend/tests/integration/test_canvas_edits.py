"""Edited graphs remain separate and preserve node provenance."""
from copy import deepcopy
from unittest.mock import Mock

import pytest

from app.api import canvas as api
from app.models.canvas import Canvas


def graph():
    return {"schema_version": 1, "nodes": [{"id": "edited", "type": "StepNode",
            "position": {"x": 12, "y": 24},
            "data": {"label": "Correction", "source_section_id": "s", "edited": True}}],
            "edges": []}


@pytest.fixture
def canvas(db_session, sample_document):
    record = Canvas(document_id=sample_document.id, template="flowchart", request_text="Draw",
                    payload_json={"nodes": [{"id": "original", "label": "Original", "source_section_id": "s"}]},
                    sources_json=[{"id": "s", "text": "Source passage"}])
    db_session.add(record)
    db_session.commit()
    return record


def test_patch_omitted_null_restore_and_serialize(client, db_session, canvas):
    url = f"/api/canvas/{canvas.id}"
    original = deepcopy(canvas.payload_json)
    initial = client.get(url).json()
    assert initial["edited"] is None and initial["has_edits"] is False
    saved = client.patch(url, json={"edited": graph(), "layout": {"original": {"x": 1, "y": 2}}}).json()
    assert saved["edited"] == graph() and saved["has_edits"] is True
    omitted = client.patch(url, json={"title": "Renamed"}).json()
    assert omitted["edited"] == graph() and omitted["layout"] == saved["layout"]
    cleared = client.patch(url, json={"edited": None}).json()
    assert cleared["edited"] is None and cleared["has_edits"] is False
    assert cleared["layout"] == saved["layout"]
    client.patch(url, json={"edited": graph()})
    restored = client.patch(url, json={"edited": None, "layout": None}).json()
    assert restored["edited"] is None and restored["layout"] is None
    assert restored["has_edits"] is False
    db_session.refresh(canvas)
    assert canvas.payload_json == original


@pytest.mark.parametrize("invalid", [
    {"schema_version": 2}, {"schema_version": True}, {"nodes": None},
    {"nodes": [graph()["nodes"][0]] * 401},
    {"edges": [{"id": str(i), "source": "edited", "target": "edited"} for i in range(801)]},
    {"nodes": [graph()["nodes"][0]] * 2},
    {"edges": [{"id": "e", "source": "edited", "target": "edited"}] * 2},
    {"edges": [{"id": "e", "source": "missing", "target": "edited"}]},
    {"edges": [{"id": "e", "source": "edited", "target": "missing"}]},
    {"edges": [{"id": "e", "source": [], "target": "edited"}]},
    {"extra": "x" * 2001},
    {"extra": {str(i): "é" * 2000 for i in range(251)}},
])
def test_invalid_graph_422(client, canvas, invalid):
    response = client.patch(f"/api/canvas/{canvas.id}", json={"edited": {**graph(), **invalid}})
    assert response.status_code == 422
    assert client.get(f"/api/canvas/{canvas.id}").json()["edited"] is None


@pytest.mark.parametrize("node_id,label", [("edited", "Correction"), ("original", "Original")])
def test_edited_and_payload_source_and_questions(client, canvas, monkeypatch, node_id, label):
    client.patch(f"/api/canvas/{canvas.id}", json={"edited": graph()})
    url = f"/api/canvas/{canvas.id}/nodes/{node_id}"
    source = client.get(url + "/source").json()
    assert source["label"] == label and source["section"]["text"] == "Source passage"
    generator = Mock(flagged_questions=[])
    generator.generate_questions.return_value = [{"question": "Topic?", "options": [{"option": "A", "text": "Topic"}],
                                                  "correct_answer": "A", "explanation": "Passage"}]
    monkeypatch.setattr(api, "QuestionGenerator", Mock(return_value=generator))
    assert client.get(url + "/questions").status_code == 200
    response = client.post(url + "/questions")
    assert response.status_code == 200 and len(response.json()["questions"]) == 1
    assert generator.generate_questions.call_args.kwargs["parsed_doc"].title == label
    assert client.get(url + "/questions").json()["questions"] == response.json()["questions"]


def test_edited_without_source_409(client, canvas, monkeypatch):
    edited = graph()
    edited["nodes"][0]["data"].pop("source_section_id")
    client.patch(f"/api/canvas/{canvas.id}", json={"edited": edited})
    factory = Mock()
    monkeypatch.setattr(api, "QuestionGenerator", factory)
    assert client.post(f"/api/canvas/{canvas.id}/nodes/edited/questions").status_code == 409
    factory.assert_not_called()
