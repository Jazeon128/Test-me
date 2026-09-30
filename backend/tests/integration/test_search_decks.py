def test_search_deck_question_count(client, sample_test, monkeypatch):
    from app.api import search

    monkeypatch.setattr(search, "_typesafe_key", lambda db: None)
    response = client.get("/api/search/", params={"q": sample_test.name})
    assert response.status_code == 200
    assert response.json()["results"] == [{
        "type": "deck", "id": sample_test.id, "title": sample_test.name,
        "subtitle": "1 cards • Test covering Python fundamentals",
        "url": f"/decks/{sample_test.id}",
    }]
