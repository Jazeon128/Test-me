from unittest.mock import Mock

import pytest

from app.services import jev


@pytest.mark.parametrize("body,json_error", [
    (None, ValueError("not JSON")),
    ([], None),
    ({"answers": []}, None),
    ({"answers": None}, None),
    ({"answers": {}, "usage": {"input_tokens": "bad"}}, None),
    ({"answers": {}, "usage": None}, None),
])
def test_malformed_response_is_unavailable(monkeypatch, body, json_error):
    response = Mock()
    response.json.return_value = body
    response.json.side_effect = json_error
    post = Mock(return_value=response)
    monkeypatch.setattr(jev.requests, "post", post)

    with pytest.raises(jev.JevUnavailable, match="Malformed Jev response:") as caught:
        jev.ask({}, {"q": {}}, api_key="test-key")

    assert isinstance(caught.value.__cause__, (ValueError, TypeError, KeyError, AttributeError))
    post.assert_called_once()


def test_good_response_returns_answers(monkeypatch):
    response = Mock()
    response.json.return_value = {
        "answers": {"q": {"choice": "yes", "confidence": "0.9"}},
        "usage": {"input_tokens": "12"},
    }
    monkeypatch.setattr(jev.requests, "post", Mock(return_value=response))

    answers = jev.ask({}, {"q": {}}, api_key="test-key")

    assert isinstance(answers, jev.Answers)
    assert answers.choice("q") == "yes"
    assert answers.confidence("q") == 0.9
    assert answers.input_tokens == 12


@pytest.mark.parametrize("unit", [None, "bad", [], 42])
def test_non_dict_units_return_defaults(unit):
    answers = jev.Answers({"q": unit})

    assert answers.choice("q", "fallback") == "fallback"
    assert answers.probabilities("q") == {}
    assert answers.confidence("q") == 0.0
    assert answers.noul("q") == 0.0
    assert answers.score("q") == 0.0
    assert answers.noul("q", 0.25) == 0.25
    assert answers.score("q", 0.75) == 0.75


@pytest.mark.parametrize("value", [None, "bad", [], {}])
def test_bad_values_return_defaults(value):
    answers = jev.Answers({"q": {
        "choice": None,
        "probabilities": value,
        "confidence": value,
        "noul": value,
        "score": value,
    }})

    assert answers.choice("q", "fallback") == "fallback"
    assert answers.probabilities("q") == {}
    assert answers.confidence("q") == 0.0
    assert answers.noul("q", 0.25) == 0.25
    assert answers.score("q", 0.75) == 0.75


def test_probabilities_drop_only_bad_entries():
    answers = jev.Answers({"q": {"probabilities": {
        "yes": "0.8", "no": 0.2, "null": None, "text": "bad", "list": [],
    }}})

    assert answers.probabilities("q") == {"yes": 0.8, "no": 0.2}
