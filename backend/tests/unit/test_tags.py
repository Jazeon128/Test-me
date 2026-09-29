from fastapi.testclient import TestClient


def test_get_tags_empty(client: TestClient):
    response = client.get("/api/tags/")
    assert response.status_code == 200
    assert response.json() == []


def test_create_tag(client: TestClient):
    response = client.post("/api/tags/", json={"name": "new-tag", "color": "red"})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "new-tag"
    assert data["color"] == "red"
    assert "id" in data


def test_create_duplicate_tag(client: TestClient):
    client.post("/api/tags/", json={"name": "dup-tag"})
    response = client.post("/api/tags/", json={"name": "dup-tag"})
    assert response.status_code == 400


def test_delete_tag(client: TestClient):
    # Create tag
    create_res = client.post("/api/tags/", json={"name": "del-tag"})
    tag_id = create_res.json()["id"]

    # Delete tag
    response = client.delete(f"/api/tags/{tag_id}")
    assert response.status_code == 200

    # Verify deleted
    get_res = client.get("/api/tags/")
    assert len(get_res.json()) == 0


def test_add_tag_to_question(client: TestClient, sample_question):
    # Create tag
    tag_res = client.post("/api/tags/", json={"name": "q-tag"})
    tag_id = tag_res.json()["id"]

    # Add to question
    response = client.post(f"/api/tags/questions/{sample_question.id}/tags/{tag_id}")
    assert response.status_code == 200


def test_remove_tag_from_question(client: TestClient, sample_question):
    # Create tag
    tag_res = client.post("/api/tags/", json={"name": "rm-tag"})
    tag_id = tag_res.json()["id"]

    # Add first
    client.post(f"/api/tags/questions/{sample_question.id}/tags/{tag_id}")

    # Remove
    response = client.delete(f"/api/tags/questions/{sample_question.id}/tags/{tag_id}")
    assert response.status_code == 200
