import requests
import pytest

from app.config import settings as config_settings
from app.services import jev
from app.services.typesafe_key import typesafe_key

URL = "/api/settings/typesafe"
KEY = "ts-test-key-12345"
ENV_KEY = "ts-env-key-67890"


@pytest.fixture(autouse=True)
def no_external_calls(monkeypatch):
    monkeypatch.setattr(config_settings, "TYPESAFE_API_KEY", "")

    def forbidden(*args, **kwargs):
        pytest.fail("No real TypeSafe requests are allowed")

    monkeypatch.setattr(jev.requests, "post", forbidden)


def assert_safe(response):
    assert KEY not in response.text
    assert ENV_KEY not in response.text
    return response.json()


def test_unconfigured(client):
    response = client.get(URL)
    assert response.status_code == 200
    assert assert_safe(response) == {"configured": False, "source": None, "preview": None}


def test_save_and_lookup(client, db_session):
    response = client.put(URL, json={"api_key": f"  {KEY}  "})
    assert response.status_code == 200
    assert assert_safe(response) == {
        "configured": True, "source": "settings", "preview": "…2345",
        "message": "TypeSafe key saved",
    }
    data = assert_safe(client.get(URL))
    assert data == {"configured": True, "source": "settings", "preview": "…2345"}
    assert KEY[:-4] not in data["preview"]
    assert typesafe_key(db_session) == KEY


def test_short_key(client):
    response = client.put(URL, json={"api_key": "  short  "})
    assert response.status_code == 400
    assert assert_safe(response)["error"]["message"] == (
        "Invalid TypeSafe API key. Key must be at least 10 characters"
    )


def test_environment_fallback_and_delete(client, monkeypatch):
    monkeypatch.setattr(config_settings, "TYPESAFE_API_KEY", ENV_KEY)
    expected = {"configured": True, "source": "environment", "preview": "…7890"}
    assert assert_safe(client.get(URL)) == expected
    assert_safe(client.put(URL, json={"api_key": KEY}))
    response = client.delete(URL)
    assert response.status_code == 200
    assert assert_safe(response) == {**expected, "message": "TypeSafe key removed"}
    assert assert_safe(client.get(URL)) == expected


def test_delete_without_environment(client):
    assert_safe(client.put(URL, json={"api_key": KEY}))
    data = assert_safe(client.delete(URL))
    assert data["configured"] is False
    assert data["source"] is None
    assert data["preview"] is None


def test_connection_without_key(client):
    response = client.post(URL + "/test")
    assert response.status_code == 400
    assert assert_safe(response)["error"]["message"] == "No TypeSafe API key is configured."


class FakeResponse:
    def __init__(self, status_code=200):
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.HTTPError("Fake HTTP error", response=self)

    def json(self):
        return {"answers": {"connection_check": {"noul": 1.0}}}


def test_connection_success(client, monkeypatch):
    calls = []

    def post(url, **kwargs):
        calls.append((url, kwargs))
        return FakeResponse()

    monkeypatch.setattr(jev.requests, "post", post)
    assert_safe(client.put(URL, json={"api_key": KEY}))
    response = client.post(URL + "/test")
    assert response.status_code == 200
    data = assert_safe(response)
    assert data["success"] is True
    assert isinstance(data["latency_ms"], int)
    assert data["latency_ms"] >= 0
    assert data["message"] == f"Connected to TypeSafe ({data['latency_ms']} ms)."
    assert len(calls) == 1
    url, kwargs = calls[0]
    assert url == jev.API_URL
    assert kwargs["headers"] == {"Authorization": f"Bearer {KEY}"}
    assert kwargs["timeout"] == 20.0
    assert kwargs["json"]["state"] == {"text": "The sky is blue."}
    questions = kwargs["json"]["questions"]
    assert list(questions) == ["connection_check"]
    assert questions["connection_check"]["type"] == "noul"
    assert set(questions["connection_check"]["criteria"]) == {"true", "false"}


@pytest.mark.parametrize("status,message", [
    (401, "TypeSafe rejected the API key. Check it was copied in full and is still active."),
    (403, "TypeSafe rejected the API key. Check it was copied in full and is still active."),
    (429, "The key works, but TypeSafe refused the call: rate limit or quota reached."),
    (503, "TypeSafe returned HTTP 503."),
])
def test_connection_http_errors(client, monkeypatch, status, message):
    monkeypatch.setattr(jev.requests, "post", lambda *args, **kwargs: FakeResponse(status))
    assert_safe(client.put(URL, json={"api_key": KEY}))
    response = client.post(URL + "/test")
    assert response.status_code == 400
    assert assert_safe(response)["error"]["message"] == message


def test_connection_error(client, monkeypatch):
    def post(*args, **kwargs):
        raise requests.ConnectionError("Offline " + "x" * 250)

    monkeypatch.setattr(jev.requests, "post", post)
    assert_safe(client.put(URL, json={"api_key": KEY}))
    response = client.post(URL + "/test")
    assert response.status_code == 400
    assert assert_safe(response)["error"]["message"] == "Could not reach TypeSafe: " + (
        "Offline " + "x" * 250
    )[:200]
