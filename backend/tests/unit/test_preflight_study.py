import pytest

from app.services import jev
from app.services.ai import sourcing


FLOOR = sourcing.STUDY_CONTENT_FLOOR


# Boundaries are relative to the floors, which calibration may move.
@pytest.mark.parametrize("teachable,study,reason,passes", [
    (.4, FLOOR, "ok", True), (.3999, FLOOR, "low_teachability", False),
    (.4, FLOOR - .0001, "study_process", False), (.1, FLOOR / 2, "study_process", False),
    (.99, FLOOR / 2, "study_process", False),
])
def test_floors(teachable, study, reason, passes):
    score = sourcing.SourceAssessment(teachable, 0, has_study_content=study)
    assert score.reason == reason
    assert score.worth_generating is passes


def test_three_questions_state_and_pin(monkeypatch):
    calls = []

    def fake(state, questions, key, timeout, **kwargs):
        calls.append(state)
        assert state == {"notebook": {"name": "Tools", "description": "Learn tools"},
                         "source": {"title": "Notes", "text": "Lesson"}}
        assert set(questions) == {"is_teachable", "is_transcript", "has_study_content"}
        assert all(q["type"] == "noul" for q in questions.values())
        assert kwargs["model"] == "jev-1.13.0"
        assert "source.text" in questions["has_study_content"]["instructions"]
        return jev.Answers({q: {"noul": .9} for q in questions})

    monkeypatch.setattr(jev, "ask", fake)
    assert sourcing.assess_source("Notes", "Lesson", "fake", notebook_name="Tools",
                                  notebook_description="Learn tools").worth_generating
    assert len(calls) == 1


@pytest.mark.parametrize("text", ["", " \n\t"])
def test_empty_never_calls_jev(monkeypatch, text):
    def forbidden(*args, **kwargs):
        pytest.fail("Empty extraction must not call Jev")
    monkeypatch.setattr(jev, "ask", forbidden)
    score = sourcing.assess_source("Empty", text, "")
    assert score.reason == "empty"
    assert score.checked
    assert not score.worth_generating


def test_unchecked_fail_open(monkeypatch):
    def unavailable(*args, **kwargs):
        raise jev.JevUnavailable("offline")
    monkeypatch.setattr(jev, "ask", unavailable)
    score = sourcing.assess_source("Notes", "text", "")
    assert score.reason == "unchecked"
    assert not score.checked
    assert score.worth_generating


def test_legacy_context_is_empty(monkeypatch):
    def fake(state, questions, *args, **kwargs):
        assert state["notebook"] == {"name": "", "description": ""}
        return jev.Answers({q: {"noul": .9} for q in questions})
    monkeypatch.setattr(jev, "ask", fake)
    assert sourcing.assess_source("Notes", "text", "fake").reason == "ok"


@pytest.mark.parametrize("model,expected", [(None, "jev-latest"), ("jev-1.13.0", "jev-1.13.0")])
def test_transport_model(monkeypatch, model, expected):
    from unittest.mock import Mock
    response = Mock()
    response.json.return_value = {"answers": {"q": {"noul": .9}}}
    post = Mock(return_value=response)
    monkeypatch.setattr(jev.requests, "post", post)
    monkeypatch.setattr(jev, "record", Mock())
    jev.ask({}, {"q": {"type": "noul"}}, "fake", model=model)
    assert post.call_args.kwargs["json"]["model"] == expected
