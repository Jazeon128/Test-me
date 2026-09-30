import pytest


@pytest.mark.parametrize("named", [False, True])
def test_deck_get_and_list_include_notebook_id(client, named):
    notebook_id = None
    if named:
        notebook = client.post("/api/notebooks/", json={"name": "Biology"})
        assert notebook.status_code == 200
        notebook_id = notebook.json()["id"]
    created = client.post("/api/decks/", json={"name": "Cells", "notebook_id": notebook_id})
    assert created.status_code == 200
    deck_id = created.json()["id"]
    detail = client.get(f"/api/decks/{deck_id}")
    assert detail.status_code == 200
    membership = detail.json()["notebook_id"]
    assert isinstance(membership, int)
    if named:
        assert membership == notebook_id
    else:
        notebooks = client.get("/api/notebooks/")
        assert notebooks.status_code == 200
        assert next(row for row in notebooks.json() if row["id"] == membership)["name"] == "Unsorted"
    listed = client.get("/api/decks/")
    assert listed.status_code == 200
    assert next(deck for deck in listed.json() if deck["id"] == deck_id)["notebook_id"] == membership
