"""Multi-source canvas requests, provenance, and legacy compatibility."""
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from sqlalchemy.orm import sessionmaker

from app.api import canvas as api
from app.models.canvas import Canvas, CanvasRoutingLog
from app.models.document import Document, DocumentType
from app.models.generation_status import GenerationStatus
from app.models.notebook import Notebook
from app.services.viz import generator, templates
from app.services.viz.router import Routing


@pytest.fixture
def sources(db_session):
    notebook = Notebook(name="Sources")
    db_session.add(notebook)
    db_session.flush()
    docs = [Document(filename=f"{i}.md", original_filename=f"{i}.md", title=f"Name {i}",
                     file_type=DocumentType.MARKDOWN, file_path=f"/missing/{i}",
                     file_size=1, status="ready", notebook_id=notebook.id,
                     preflight={"worth_generating": False}) for i in range(3)]
    db_session.add_all(docs)
    db_session.commit()
    return docs


@pytest.mark.parametrize("body", [
    {}, {"source_ids": []}, {"source_ids": list(range(11))},
    {"document_id": 1, "source_ids": [2]},
    {"document_id": 1, "source_ids": [1, 1]},
    {"document_id": 1, "source_ids": [1, 2]},
])
def test_invalid_aliases(client, db_session, body):
    response = client.post("/api/canvas/generate", json={"request_text": "Draw", **body})
    assert response.status_code == 422
    assert db_session.query(GenerationStatus).count() == 0


@pytest.mark.parametrize("body,expected", [
    ({"document_id": 2}, [2]),
    ({"document_id": 2, "source_ids": [2]}, [2]),
    ({"source_ids": [3, 2, 3, 1]}, [3, 2, 1]),
])
def test_valid_aliases(body, expected):
    request = api.GenerateCanvasRequest(request_text="Draw", **body)
    assert request.source_ids == expected
    assert request.document_id == expected[0]


@pytest.mark.parametrize("condition,code", [
    ("mixed", 400), ("processing", 409), ("failed", 400), ("missing", 404),
])
def test_rejects_before_job(client, db_session, sources, condition, code):
    ids = [doc.id for doc in sources]
    if condition == "mixed":
        other = Notebook(name="Other")
        db_session.add(other)
        db_session.flush()
        sources[1].notebook_id = other.id
    elif condition == "missing":
        ids[1] = 999999
    else:
        sources[1].status = condition
    db_session.commit()
    response = client.post("/api/canvas/generate", json={"source_ids": ids, "request_text": "Draw"})
    assert response.status_code == code
    assert response.json()["error"]["message"]
    assert db_session.query(GenerationStatus).count() == 0


@pytest.mark.parametrize("count", [1, 3])
def test_generation_provenance_and_prompt(client, db_session, sources, monkeypatch, count):
    docs = list(reversed(sources))[:count]
    ids = [doc.id for doc in docs]
    monkeypatch.setattr(api, "SessionLocal", sessionmaker(bind=db_session.get_bind()))
    parser = SimpleNamespace(parse=lambda path: SimpleNamespace(sections=[
        SimpleNamespace(text="", section="Empty", page=1),
        SimpleNamespace(text=f"Text from {path}", section="Topic", page=2),
    ]))
    monkeypatch.setattr(api, "get_parser_for_type", lambda file_type: parser)
    route = Mock(return_value=Routing(template_id="flowchart", confidence=0.99))
    monkeypatch.setattr(api.viz_router, "route", route)
    monkeypatch.setattr(api, "_typesafe_key", lambda db: "fixture")
    fill = Mock(side_effect=lambda **kwargs: {"nodes": [
        {"id": f"n{i}", "label": "Topic", "source_section_id": s["id"]}
        for i, s in enumerate(kwargs["sections"])], "edges": []})
    monkeypatch.setattr(api.viz_generator, "generate", fill)
    response = client.post("/api/canvas/generate", json={"source_ids": ids, "request_text": "Draw"})
    assert response.status_code == 200
    db_session.expire_all()
    canvas = db_session.query(Canvas).one()
    job = db_session.query(GenerationStatus).one()
    assert job.status == "completed"
    assert job.source_ids == ids
    assert canvas.source_ids == ids
    assert canvas.document_id == ids[0]
    assert db_session.query(CanvasRoutingLog).one().document_id == ids[0]
    sections = canvas.sources_json
    assert [s["id"] for s in sections] == [f"d{id}-s1" for id in ids]
    assert [s["document_id"] for s in sections] == ids
    names = [f"Name {sources.index(doc)}" for doc in docs]
    assert [s["source_name"] for s in sections] == names
    title = names[0] if count == 1 else "3 sources: " + "; ".join(names)
    assert fill.call_args.kwargs["title"] == title
    assert route.call_args.kwargs["title"] == title
    assert route.call_args.kwargs["sections"] == sections
    prompt = generator._prompt(templates.get("flowchart"), "Draw", title, sections, 4, 10, "horizontal", False)
    assert f"THE SOURCE: {title}" in prompt
    for name in names:
        assert (f"{name} / Topic" in prompt) == (count > 1)
    serialized = client.get(f"/api/canvas/{canvas.id}").json()
    assert serialized["source_ids"] == ids
    assert serialized["sources"] == [{"id": id, "name": name} for id, name in zip(ids, names)]
    last = client.get(f"/api/canvas/{canvas.id}/nodes/n{count - 1}/source").json()["section"]
    assert last == sections[-1]
    questions = Mock(flagged_questions=[])
    questions.generate_questions.return_value = []
    monkeypatch.setattr(api, "QuestionGenerator", lambda db: questions)
    assert client.post(f"/api/canvas/{canvas.id}/nodes/n{count - 1}/questions").status_code == 200
    assert questions.generate_questions.call_args.kwargs["parsed_doc"].full_text == sections[-1]["text"]
    if count == 3:
        assert client.get(f"/api/canvas/document/{ids[1]}").json()[0]["id"] == canvas.id
        assert client.delete(f"/api/documents/{ids[1]}").status_code == 200
        assert db_session.query(Canvas).count() == 0
        assert db_session.query(CanvasRoutingLog).count() == 0


def test_legacy_canvas(client, db_session, sources):
    canvas = Canvas(document_id=sources[0].id, request_text="Legacy", template="flowchart",
                    payload_json={"nodes": [{"id": "n", "label": "Old", "source_section_id": "s0"}]},
                    sources_json=[{"id": "s0", "text": "Old text", "heading": "Old", "page": 1}])
    db_session.add(canvas)
    db_session.commit()
    response = client.get(f"/api/canvas/{canvas.id}")
    assert response.status_code == 200
    assert response.json()["source_ids"] == [sources[0].id]
    assert response.json()["sources"] == [{"id": sources[0].id, "name": "Name 0"}]
    section = client.get(f"/api/canvas/{canvas.id}/nodes/n/source").json()["section"]
    assert section == {**canvas.sources_json[0], "document_id": sources[0].id, "source_name": "Name 0"}


def test_disappeared_source_fails_job(db_session, sources, monkeypatch):
    ids = [sources[0].id, 999999]
    job = GenerationStatus(job_id="vanished", status="pending", source_ids=ids)
    db_session.add(job)
    db_session.commit()
    monkeypatch.setattr(api, "SessionLocal", sessionmaker(bind=db_session.get_bind()))
    fill = Mock()
    monkeypatch.setattr(api.viz_generator, "generate", fill)
    api._run_generation(job.job_id, api.GenerateCanvasRequest(source_ids=ids, request_text="Draw"))
    db_session.refresh(job)
    assert job.status == "failed"
    assert "999999" in job.error_message
    assert db_session.query(Canvas).count() == 0
    fill.assert_not_called()


@pytest.mark.parametrize("count", [1, 3, 10])
def test_round_robin_budget(count):
    groups = [[{"id": f"d{d}-s{i}", "document_id": d, "source_name": str(d),
                "heading": "H" * 100, "text": "x" * 2000} for i in range(100)]
              for d in range(count)]
    picked = generator.pick_sections(groups)
    assert generator.MAX_FILL_CHARS == 90000
    assert len(picked) == 60
    assert sum(min(len(s["text"]), generator.SECTION_EXCERPT_CHARS) + len(s["heading"])
               for s in picked) == 90000
    assert {s["document_id"] for s in picked} == set(range(count))
    assert [s["id"] for s in picked] == [s["id"] for group in groups for s in group[:60 // count]]


def test_budget_stops_at_next_section():
    groups = [[{"id": "a", "text": "x", "heading": "H" * 89999},
               {"id": "c", "text": "x", "heading": ""}],
              [{"id": "b", "text": "x", "heading": ""}]]
    assert [s["id"] for s in generator.pick_sections(groups)] == ["a"]


def test_multisource_heading_when_only_one_source_has_text():
    prompt = generator._prompt(templates.get("flowchart"), "Draw", "2 sources: A; B",
                               [{"id": "d1-s0", "text": "Text", "heading": "Topic",
                                 "document_id": 1, "source_name": "A"}],
                               4, 10, "horizontal", False, source_count=2)
    assert "A / Topic" in prompt


def test_serialization_omits_deleted_sources(client, db_session, sources):
    canvas = Canvas(document_id=sources[0].id, source_ids=[sources[0].id, 999999],
                    request_text="Draw", template="flowchart", payload_json={}, sources_json=[])
    db_session.add(canvas)
    db_session.commit()
    data = client.get(f"/api/canvas/{canvas.id}").json()
    assert data["source_ids"] == [sources[0].id, 999999]
    assert data["sources"] == [{"id": sources[0].id, "name": "Name 0"}]


def test_budget_reaches_later_sources_before_second_sections():
    groups = [[{"id": "a1", "text": "x" * 1400, "heading": "H" * 43000},
               {"id": "a2", "text": "x" * 1400, "heading": "H" * 43000}],
              [{"id": "b1", "text": "x" * 1400, "heading": "H" * 43000}]]
    assert [s["id"] for s in generator.pick_sections(groups)] == ["a1", "b1"]
