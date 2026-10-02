"""Saved matrix cells resolve as canvas nodes without changing the payload."""

from copy import deepcopy
from unittest.mock import Mock

import pytest

from app.api import canvas as canvas_api
from app.models.canvas import Canvas


@pytest.fixture
def matrix(db_session, sample_document):
    record = Canvas(
        document_id=sample_document.id,
        request_text="Compare languages",
        template="comparison_matrix",
        title="Languages",
        payload_json={
            "options": ["Python", "Java"],
            "criteria": ["Readability"],
            "cells": [
                {"option": "Python", "criterion": "Readability", "value": "Concise syntax",
                 "verdict": "good", "source_section_id": "s0"},
                {"option": "Java", "criterion": "Readability", "value": "",
                 "verdict": "mixed", "source_section_id": "s1"},
            ],
        },
        sources_json=[
            {"id": "s0", "heading": "Python", "page": 1, "text": "Python has concise syntax."},
            {"id": "s1", "heading": "Java", "page": 2, "text": "Java has explicit syntax."},
        ],
    )
    db_session.add(record)
    db_session.commit()
    return record


@pytest.mark.parametrize("index,label", [(0, "Concise syntax"), (1, "Java: Readability")])
def test_matrix_cell_source(client, db_session, matrix, index, label):
    original = deepcopy(matrix.payload_json)
    response = client.get(f"/api/canvas/{matrix.id}/nodes/cell-{index}/source")
    assert response.status_code == 200
    assert response.json() == {
        "node_id": f"cell-{index}", "label": label, "section": {**matrix.sources_json[index],
                    "document_id": matrix.document_id, "source_name": "Test Document"},
    }
    db_session.refresh(matrix)
    assert matrix.payload_json == original


def test_missing_matrix_cell(client, matrix):
    assert client.get(f"/api/canvas/{matrix.id}/nodes/cell-9/source").status_code == 404


@pytest.mark.parametrize("index,label", [(0, "Concise syntax"), (1, "Java: Readability")])
def test_matrix_cell_questions(client, matrix, monkeypatch, index, label):
    questions = [{"question": "What syntax does this language use?", "options": [{"option": "A", "text": "Concise"}], "correct_answer": "A", "explanation": "Syntax."}]
    generator = Mock(flagged_questions=[])
    generator.generate_questions.return_value = questions
    factory = Mock(return_value=generator)
    monkeypatch.setattr(canvas_api, "QuestionGenerator", factory)
    response = client.post(f"/api/canvas/{matrix.id}/nodes/cell-{index}/questions")
    assert response.status_code == 200
    data = response.json()
    assert data == {"node_id": f"cell-{index}", "questions": [{**questions[0], "id": data["questions"][0]["id"], "card_type": "mcq"}],
                    "deck_id": data["deck_id"], "notebook_id": None, "held_back": 0, "generated": True}
    assert data["deck_id"] is not None
    assert data["questions"][0]["id"] is not None
    generator.generate_questions.assert_called_once()
    args = generator.generate_questions.call_args.kwargs
    assert args["parsed_doc"].title == label
    assert args["parsed_doc"].full_text == matrix.sources_json[index]["text"]
    assert args["parsed_doc"].sections[0].page == index + 1
    assert args["num_questions"] == 3
    assert args["difficulty"] == "mixed"
