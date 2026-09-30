"""Every requested Jev answer must be usable before a call succeeds."""

from unittest.mock import Mock

import pytest

from app.services import jev, jev_usage


@pytest.fixture
def fake_reply(monkeypatch):
    response = Mock()
    monkeypatch.setattr(jev.requests, "post", Mock(return_value=response))
    captured = []
    monkeypatch.setattr(jev_usage, "record", lambda *args: captured.append(args))
    monkeypatch.setattr(jev, "record", jev_usage.record)

    def reply(answers):
        response.json.return_value = {"answers": answers, "usage": {"input_tokens": 12}}
        return captured

    return reply


@pytest.mark.parametrize("kind,raw", [
    ("noul", {}),
    ("noul", {"other": {"noul": 0.5}}),
    ("noul", {"q": None}),
    ("noul", {"q": {}}),
    ("noul", {"q": {"noul": 1.5}}),
    ("noul", {"q": {"noul": -0.1}}),
    ("noul", {"q": {"noul": "NaN"}}),
    ("noul", {"q": {"noul": True}}),
    ("score", {"q": {"score": "Infinity"}}),
    ("score", {"q": {"score": "NaN"}}),
    ("score", {"q": {"score": "bad"}}),
    ("choice", {"q": {"choice": ""}}),
    ("choice", {"q": {"choice": "  "}}),
    ("choice", {"q": {"choice": 3}}),
])
def test_invalid_requested_answer_is_unavailable(fake_reply, kind, raw):
    captured = fake_reply(raw)
    with pytest.raises(jev.JevUnavailable, match="Malformed Jev response: q "):
        jev.ask({}, {"q": {"type": kind}}, "test-key", label="validation")
    assert len(captured) == 1
    label, count, tokens, duration, success, error = captured[0]
    assert (label, count, tokens, success) == ("validation", 1, 12, False)
    assert duration >= 0
    assert error.startswith("Malformed Jev response: q ")


@pytest.mark.parametrize("noul,score", [(0, -3), (1.0, 2.5), ("0.5", "4")])
def test_valid_answers_and_unrequested_units(fake_reply, noul, score):
    raw = {
        "yes": {"noul": noul},
        "quality": {"score": score},
        "pick": {"choice": "B"},
        "extra": None,
    }
    captured = fake_reply(raw)
    answers = jev.ask({}, {
        "yes": {"type": "noul"},
        "quality": {"type": "score"},
        "pick": {"type": "choice"},
    }, "test-key")
    assert answers.raw == raw
    assert answers.noul("yes") == float(noul)
    assert answers.score("quality") == float(score)
    assert answers.choice("pick") == "B"
    assert captured[0][4] is True


@pytest.mark.parametrize("value", ["NaN", "Infinity", "-Infinity", float("nan"), float("inf")])
def test_number_accessor_rejects_non_finite(value):
    answers = jev.Answers({"q": {"score": value, "noul": value, "confidence": value}})
    assert answers.score("q", 0.75) == 0.75
    assert answers.noul("q", 0.25) == 0.25
    assert answers.confidence("q") == 0.0
