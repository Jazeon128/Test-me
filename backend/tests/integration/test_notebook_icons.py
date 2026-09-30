import pytest


@pytest.mark.parametrize("icon", ["\U0001f4d8", "\u00e9", "\U0001f4d8" * 16])
def test_create_accepts_valid_icon(client, icon):
    response = client.post("/api/notebooks/", json={"name": "Icons", "icon": icon})
    assert response.status_code == 200
    assert response.json()["icon"] == icon


@pytest.mark.parametrize("icon", ["??", "ab", "", "\U0001f4d8" * 17])
def test_create_rejects_invalid_icon(client, icon):
    response = client.post("/api/notebooks/", json={"name": "Icons", "icon": icon})
    assert response.status_code == 400
    assert response.json()["error"]["message"] == "Icon must be an emoji."
    assert client.get("/api/notebooks/").json() == []


@pytest.mark.parametrize("icon", ["\U0001f4d8", "\u00e9", "\U0001f4d8" * 16])
def test_update_accepts_valid_icon(client, icon):
    notebook = client.post("/api/notebooks/", json={"name": "Icons"}).json()
    response = client.patch(f"/api/notebooks/{notebook['id']}", json={"name": "Icons", "icon": icon})
    assert response.status_code == 200
    assert response.json()["icon"] == icon
    assert client.get(f"/api/notebooks/{notebook['id']}").json()["icon"] == icon


@pytest.mark.parametrize("icon", ["??", "ab", "\U0001f4d8" * 17])
def test_update_rejects_invalid_icon(client, icon):
    notebook = client.post("/api/notebooks/", json={"name": "Icons", "icon": "\U0001f4d8"}).json()
    response = client.patch(f"/api/notebooks/{notebook['id']}", json={"name": "Changed", "icon": icon})
    assert response.status_code == 400
    assert response.json()["error"]["message"] == "Icon must be an emoji."
    saved = client.get(f"/api/notebooks/{notebook['id']}").json()
    assert saved["icon"] == "\U0001f4d8"
    assert saved["name"] == "Icons"


def test_update_empty_icon_clears_it(client):
    notebook = client.post("/api/notebooks/", json={"name": "Icons", "icon": "\U0001f4d8"}).json()
    response = client.patch(f"/api/notebooks/{notebook['id']}", json={"name": "Icons", "icon": ""})
    assert response.status_code == 200
    assert response.json()["icon"] is None
    assert client.get(f"/api/notebooks/{notebook['id']}").json()["icon"] is None
