"""Exercise scoped tags through the same HTTP routes as the deck UI."""

import pytest
from sqlalchemy.exc import IntegrityError

from app.api import questions
from app.models import Notebook, Tag, Question
from app.models.deck import Deck


@pytest.fixture
def notebooks(db_session):
    rows = [Notebook(name=name) for name in ("AWS", "Kubernetes", "Other")]
    db_session.add_all(rows)
    db_session.commit()
    return rows


def create(client, name, notebook_id=None):
    response = client.post("/api/tags/", json={"name": name, "notebook_id": notebook_id})
    assert response.status_code == 200
    return response.json()


def test_names_and_list_scope(client, notebooks):
    first, second, _ = notebooks
    shared = create(client, "A shared")
    z = create(client, "Z local", first.id)
    a = create(client, "B local", first.id)
    create(client, "B local", second.id)
    assert client.post("/api/tags/", json={"name": "B local", "notebook_id": first.id}).status_code == 400
    assert client.post("/api/tags/", json={"name": "A shared"}).status_code == 400
    response = client.post("/api/tags/", json={"name": "A shared", "notebook_id": second.id})
    assert response.status_code == 400
    assert response.json()["error"]["message"] == "A shared tag has this name."
    assert client.post("/api/tags/", json={"name": "Missing", "notebook_id": 99999}).status_code == 404
    assert client.get("/api/tags/").json() == [shared]
    assert client.get(f"/api/tags/?notebook_id={first.id}").json() == [a, z, shared]
    assert shared["shared"] and shared["notebook_id"] is None
    assert not a["shared"] and a["notebook_id"] == first.id
    # A shared name may match an existing local name. Comparison is case sensitive.
    create(client, "B local")
    create(client, "b local", first.id)


def test_database_uniqueness(db_session, notebooks):
    first, second, _ = notebooks
    db_session.add_all([Tag(name="same", notebook_id=first.id),
                        Tag(name="same", notebook_id=second.id), Tag(name="shared")])
    db_session.commit()
    db_session.add(Tag(name="shared"))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
    db_session.add(Tag(name="same", notebook_id=first.id))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_membership_attach_suggest_and_delete(client, db_session, notebooks, sample_question, monkeypatch):
    first, second, third = notebooks
    sample_question.document.notebook_id = first.id
    deck = Deck(name="Second notebook", notebook_id=second.id)
    deck.questions = [sample_question]
    manual = Question(question_text="Manual")
    db_session.add_all([deck, manual])
    db_session.commit()
    tags = [create(client, name, notebook.id) for name, notebook in
            [("AWS", first), ("Kube", second), ("Other", third)]]
    shared = create(client, "Shared")
    route = f"/api/tags/questions/{sample_question.id}/tags/"
    response = client.post(route + str(tags[2]["id"]))
    assert response.status_code == 400
    assert response.json()["error"]["message"] == "This tag belongs to another notebook."

    judged = []

    def scores(question, available_tags, api_key):
        judged.extend(available_tags)
        return dict.fromkeys(available_tags, 0.99)

    monkeypatch.setattr(questions, "_typesafe_key", lambda db: "test-only")
    monkeypatch.setattr(questions.curation, "score_tags", scores)
    response = client.get(f"/api/questions/{sample_question.id}/suggested-tags")
    assert response.status_code == 200
    assert judged == ["AWS", "Kube", "Shared"]
    assert {tag["id"] for tag in response.json()["suggested"]} == {tag["id"] for tag in tags[:2] + [shared]}
    judged.clear()
    response = client.get(f"/api/questions/{manual.id}/suggested-tags")
    assert response.status_code == 200
    assert judged == ["Shared"]
    for tag in tags[:2] + [shared]:
        assert client.post(route + str(tag["id"])).status_code == 200
    manual_route = f"/api/tags/questions/{manual.id}/tags/"
    assert client.post(manual_route + str(tags[0]["id"])).status_code == 400
    assert client.post(manual_route + str(shared["id"])).status_code == 200
    judged.clear()
    client.get(f"/api/questions/{manual.id}/suggested-tags")
    assert judged == []  # The only candidate, Shared, is already attached.
    assert client.get(f"/api/tags/{shared['id']}").json()["question_count"] == 2
    response = client.delete(f"/api/tags/{shared['id']}")
    assert response.json() == {"success": True, "affected_questions": 2}
    db_session.expire_all()
    assert shared["id"] not in {tag.id for tag in sample_question.tags}
    assert manual.tags == []
    assert client.get(f"/api/tags/{shared['id']}").status_code == 404


def test_question_without_document_uses_deck_membership(client, db_session, notebooks):
    first, _, _ = notebooks
    question = Question(question_text="Imported or manual", document_id=None)
    db_session.add(question)
    db_session.flush()
    deck = Deck(name="Imported", notebook_id=first.id)
    deck.questions = [question]
    db_session.add(deck)
    db_session.commit()
    tag = create(client, "Local", first.id)
    assert client.post(f"/api/tags/questions/{question.id}/tags/{tag['id']}").status_code == 200
