"""Tag suggestions offer existing tags only, and say why when they offer none."""

from app.api import questions
from app.models.tag import Tag


def _tags(db_session, *names):
    tags = [Tag(name=name, color="blue") for name in names]
    db_session.add_all(tags)
    db_session.commit()
    return tags


def _suggest(client, question_id):
    response = client.get(f"/api/questions/{question_id}/suggested-tags")
    assert response.status_code == 200
    return response.json()


def test_no_tags_asks_the_user_to_create_one(client, sample_question):
    assert _suggest(client, sample_question.id) == {"suggested": [], "reason": "Create a tag first."}


def test_every_tag_applied_says_so(client, db_session, sample_question):
    (tag,) = _tags(db_session, "Python")
    sample_question.tags.append(tag)
    db_session.commit()
    assert _suggest(client, sample_question.id)["reason"] == "Every tag is already on this card."


def test_no_key_says_so(client, db_session, sample_question):
    # conftest blanks TYPESAFE_API_KEY, so this is the real no-key path.
    _tags(db_session, "Python")
    assert "TypeSafe" in _suggest(client, sample_question.id)["reason"]


def test_service_down_is_not_reported_as_no_match(client, db_session, sample_question, monkeypatch):
    _tags(db_session, "Python")
    monkeypatch.setattr(questions, "_typesafe_key", lambda db: "test-key")
    monkeypatch.setattr(questions.curation, "score_tags", lambda *a, **k: None)
    assert _suggest(client, sample_question.id)["reason"] == "The suggestion service is unavailable."


def test_returns_tags_above_threshold_best_first_skipping_applied(
    client, db_session, sample_question, monkeypatch
):
    python, loops, cooking, typing_ = _tags(db_session, "Python", "Loops", "Cooking", "Typing")
    sample_question.tags.append(typing_)
    db_session.commit()

    judged = {}

    def fake_scores(question, available_tags, api_key, **kwargs):
        judged["tags"] = list(available_tags)
        return {"Python": 0.72, "Loops": 0.95, "Cooking": 0.05}

    monkeypatch.setattr(questions, "_typesafe_key", lambda db: "test-key")
    monkeypatch.setattr(questions.curation, "score_tags", fake_scores)

    result = _suggest(client, sample_question.id)

    assert "Typing" not in judged["tags"], "applied tags must not be judged"
    assert [tag["name"] for tag in result["suggested"]] == ["Loops", "Python"]
    assert result["suggested"][0] == {"id": loops.id, "name": "Loops", "color": "blue", "probability": 0.95}
    assert "reason" not in result


def test_unknown_question_is_404(client):
    assert client.get("/api/questions/999999/suggested-tags").status_code == 404


def test_deck_details_include_question_tags(client, db_session, sample_question):
    """The deck page filters and edits by tag, so a reload must not drop them."""
    from app.models.deck import Deck, DeckQuestion

    (tag,) = _tags(db_session, "Python")
    sample_question.tags.append(tag)
    deck = Deck(name="Deck")
    db_session.add(deck)
    db_session.flush()
    db_session.add(DeckQuestion(deck_id=deck.id, question_id=sample_question.id, order=0))
    db_session.commit()

    questions_out = client.get(f"/api/decks/{deck.id}").json()["questions"]
    assert questions_out[0]["tags"] == [{"id": tag.id, "name": "Python", "color": "blue"}]
