def test_csv_import_preserves_row_order(client, db_session):
    from app.models.deck import Deck

    response = client.post(
        "/api/decks/import/csv",
        files={"file": ("cards.csv", b"First,Answer one\nSecond,Answer two\n", "text/csv")},
    )
    assert response.status_code == 200
    assert response.json()["num_questions"] == 2
    deck = db_session.get(Deck, response.json()["id"])
    assert [(q.question_text, q.explanation) for q in deck.questions] == [
        ("First", "Answer one"), ("Second", "Answer two")
    ]
    assert [link.order for link in sorted(deck.deck_questions, key=lambda link: link.order)] == [0, 1]
