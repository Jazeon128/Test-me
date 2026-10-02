import csv
import io
import json
import sqlite3
import zipfile

import pytest
from sqlalchemy.orm import Session

from app.models.deck import Deck, DeckQuestion
from app.models.question import Question, QuestionOption
from app.models.tag import Tag
from app.models.user_progress import UserProgress
from app.services.anki_export import BASIC_MODEL_ID, MODEL_ID


def body(card_type):
    data = dict(question_text="New front", explanation="New back", difficulty="hard")
    if card_type == "mcq":
        data["options"] = [dict(text=str(i), is_correct=i == 2) for i in range(4)]
    return data


@pytest.mark.parametrize("card_type", ["mcq", "flashcard", "legacy"])
def test_edit_preserves_identity_and_relationships(client, db_session, sample_test,
                                                  sample_user_progress, card_type):
    question = sample_test.questions[0]
    if card_type == "flashcard":
        question.card_type = "flashcard"
        question.options = []
    elif card_type == "legacy":
        question.options = [QuestionOption(option_text="Flip to see answer",
                                           is_correct=True, order=0)]
    tag = Tag(name="Keep")
    question.tags.append(tag)
    other = Deck(name="Other", questions=[question])
    db_session.add(other)
    sample_user_progress.times_seen = 9
    db_session.commit()
    question_id, tag_id, progress_id = question.id, tag.id, sample_user_progress.id
    deck_ids = [sample_test.id, other.id]
    progress_before = {column.name: getattr(sample_user_progress, column.name)
                       for column in UserProgress.__table__.columns}
    orders_before = {deck_id: db_session.get(DeckQuestion, (deck_id, question_id)).order
                     for deck_id in deck_ids}
    payload = body("flashcard" if card_type == "legacy" else card_type)
    response = client.put(f"/api/questions/{question_id}", json=payload)
    assert response.status_code == 200
    assert response.json()["id"] == question_id
    assert response.json()["source_reference"]["edited"] is True
    assert response.json()["source_reference"]["page"] == 1
    with Session(db_session.get_bind()) as fresh:
        saved = fresh.get(Question, question_id)
        assert saved.question_text == "New front"
        assert saved.explanation == "New back"
        assert saved.difficulty == "hard"
        assert saved.card_type == ("flashcard" if card_type == "flashcard" else "mcq")
        assert [t.id for t in saved.tags] == [tag_id]
        progress_after = fresh.get(UserProgress, progress_id)
        assert {column.name: getattr(progress_after, column.name)
                for column in UserProgress.__table__.columns} == progress_before
        assert progress_after.times_seen == 9
        for deck_id in deck_ids:
            assert fresh.get(DeckQuestion, (deck_id, question_id)).order == orders_before[deck_id]
        if card_type == "mcq":
            assert [o.option_text for o in sorted(saved.options, key=lambda o: o.order)] == ["0", "1", "2", "3"]
            assert sum(o.is_correct for o in saved.options) == 1
        elif card_type == "flashcard":
            assert saved.options == []
        else:
            assert saved.options[0].option_text == "Flip to see answer"


@pytest.mark.parametrize("options", [[], [dict(text="x", is_correct=True)] * 3,
                                    [dict(text="x", is_correct=True)] * 5,
                                    [dict(text="x", is_correct=False)] * 4,
                                    [dict(text="x", is_correct=True)] * 4])
def test_put_rejects_invalid_options(client, sample_question, options):
    data = body("mcq")
    data["options"] = options
    assert client.put(f"/api/questions/{sample_question.id}", json=data).status_code == 422
    assert client.get(f"/api/questions/{sample_question.id}").json()["question_text"] == "What is Python?"


@pytest.mark.parametrize("change", [dict(options=[]), dict(options=None), dict(card_type="mcq"),
                                   dict(question_text=""), dict(question_text=" " * 2),
                                   dict(question_text="x" * 201), dict(explanation=""),
                                   dict(explanation="x" * 601)])
def test_flashcard_validation(client, change):
    data = {**body("flashcard"), "card_type": "flashcard"}
    created = client.post("/api/questions/", json=data)
    assert created.status_code == 200
    question_id = created.json()["id"]
    assert client.put(f"/api/questions/{question_id}", json={**body("flashcard"), **change}).status_code == 422
    if "card_type" not in change:
        assert client.post("/api/questions/", json={**data, **change}).status_code == 422


def test_type_change_and_missing_question(client, sample_question):
    assert client.put(f"/api/questions/{sample_question.id}", json={
        **body("flashcard"), "card_type": "flashcard"}).status_code == 422
    assert client.put("/api/questions/999999", json=body("mcq")).status_code == 404


def test_post_flashcard_and_import(client, db_session, sample_test):
    created = client.post("/api/questions/", json={"card_type": "flashcard",
        "question_text": "f" * 200, "explanation": "b" * 600, "deck_id": sample_test.id})
    assert created.status_code == 200
    assert created.json()["card_type"] == "flashcard"
    assert created.json()["options"] == []
    imported = client.post("/api/decks/import/csv", files={"file": ("cards.csv", b"Front,Back\n", "text/csv")})
    assert imported.status_code == 200
    deck = client.get(f"/api/decks/{imported.json()['id']}").json()
    assert deck["questions"][0]["card_type"] == "flashcard"
    assert deck["questions"][0]["question_text"] == "Front"
    assert deck["questions"][0]["explanation"] == "Back"
    assert deck["questions"][0]["options"] == []


@pytest.mark.parametrize("prefix", ["decks", "tests"])
def test_mixed_exports(client, db_session, sample_test, tmp_path, prefix):
    real = Question(card_type="flashcard", question_text="Real <front>", explanation="Real & back",
                    source_reference={"page": 7})
    legacy = Question(question_text="Legacy front", explanation="Legacy back",
                      options=[QuestionOption(option_text="Flip to see answer", is_correct=True, order=0)])
    db_session.add_all([real, legacy])
    db_session.flush()
    sample_test.questions = [sample_test.questions[0], real, legacy]
    db_session.commit()
    url = f"/api/{prefix}/{sample_test.id}/export"
    response = client.get(f"{url}/csv")
    assert response.status_code == 200
    reader = csv.DictReader(io.StringIO(response.content.decode("utf-8-sig")))
    assert reader.fieldnames[0] == "Type"
    rows = list(reader)
    assert [r["Type"] for r in rows] == ["question", "flashcard", "flashcard"]
    assert rows[0]["CorrectAnswer"] == "A"
    for row, question in zip(rows[1:], [real, legacy]):
        assert row["Question"] == question.question_text
        assert row["Explanation"] == question.explanation
        assert [row[key] for key in ["OptionA", "OptionB", "OptionC", "OptionD", "CorrectAnswer"]] == [""] * 5
    response = client.get(f"{url}/anki-csv")
    assert response.status_code == 200
    rows = list(csv.reader(io.StringIO(response.content.decode("utf-8-sig"))))
    assert rows[2] == ["Real &lt;front&gt;", "Real &amp; back"]
    assert rows[3] == ["Legacy front", "Legacy back"]
    response = client.get(f"{url}/anki")
    assert response.status_code == 200
    with zipfile.ZipFile(io.BytesIO(response.content)) as package:
        database = tmp_path / "collection.anki2"
        database.write_bytes(package.read("collection.anki2"))
    with sqlite3.connect(database) as connection:
        models = json.loads(connection.execute("select models from col").fetchone()[0])
        assert set(models) == {str(MODEL_ID), str(BASIC_MODEL_ID)}
        assert [f["name"] for f in models[str(BASIC_MODEL_ID)]["flds"]] == ["Front", "Back", "Source"]
        notes = connection.execute("select mid, flds from notes order by id").fetchall()
    assert notes[0][0] == MODEL_ID
    assert [note[0] for note in notes[1:]] == [BASIC_MODEL_ID, BASIC_MODEL_ID]
    assert notes[1][1].split("\x1f") == ["Real &lt;front&gt;", "Real &amp; back", "Page 7"]
    assert notes[2][1].split("\x1f") == ["Legacy front", "Legacy back", ""]
