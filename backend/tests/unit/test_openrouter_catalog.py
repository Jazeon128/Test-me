from types import SimpleNamespace
from unittest.mock import Mock

import pytest
import requests

from app.services.ai import openrouter_catalog as catalog
from app.services import secrets


@pytest.fixture(autouse=True)
def empty_cache(monkeypatch):
    monkeypatch.setattr(catalog, "_cache", None)
    monkeypatch.setattr(catalog, "_cached_at", 0)
    monkeypatch.setattr(catalog.time, "monotonic", lambda: 100)
    monkeypatch.setattr(catalog.requests, "get", Mock(side_effect=requests.ConnectionError("offline")))


def response(models):
    return SimpleNamespace(raise_for_status=lambda: None, json=lambda: {"data": models})


def test_decimal_conversion_missing_and_free(client, monkeypatch):
    models = [
        {"id": "paid", "name": "Paid", "pricing": {"prompt": "0.000003", "completion": "0.000015",
                                                  "request": "0.001"},
         "context_length": 100000, "top_provider": {"max_completion_tokens": 8192},
         "supported_parameters": ["temperature"], "architecture": {"input_modalities": ["text"]}},
        {"id": "missing", "pricing": {"completion": "invalid"}},
        {"id": "free", "pricing": {"prompt": "0", "completion": "0.0"}},
        {"id": "half", "pricing": {"prompt": "0"}},
    ]
    monkeypatch.setattr(catalog.requests, "get", Mock(return_value=response(models)))
    result = client.get("/api/settings/openrouter/models")
    assert result.status_code == 200
    paid, missing, free, half = result.json()["models"]
    assert (paid["prompt_per_million"], paid["completion_per_million"], paid["request_price"]) == ("3", "15", "0.001")
    assert (paid["context_length"], paid["max_completion_tokens"], paid["input_modalities"]) == (100000, 8192, ["text"])
    assert paid["supported_parameters"] == ["temperature"]
    assert missing["prompt_per_million"] is None
    assert missing["completion_per_million"] is None
    assert missing["request_price"] is None
    assert [model["free"] for model in (paid, missing, free, half)] == [False, False, True, False]
    assert "fetched_at" in result.json()
    assert "Authorization" not in catalog.requests.get.call_args.kwargs


@pytest.mark.parametrize("value", [None, "bad", "NaN", "Infinity"])
def test_invalid_prices_are_null(value):
    assert catalog.price(value) is None


def test_cache_expiry_refresh_and_stale(client, monkeypatch):
    get = Mock(return_value=response([{"id": "first"}]))
    monkeypatch.setattr(catalog.requests, "get", get)
    first = client.get("/api/settings/openrouter/models").json()
    monkeypatch.setattr(catalog.time, "monotonic", lambda: 3699)
    assert client.get("/api/settings/openrouter/models").json() == first
    assert get.call_count == 1
    get.return_value = response([{"id": "second"}])
    refreshed = client.get("/api/settings/openrouter/models?refresh=true").json()
    assert refreshed["models"][0]["id"] == "second"
    assert get.call_count == 2
    monkeypatch.setattr(catalog.time, "monotonic", lambda: 7299)
    get.side_effect = requests.ConnectionError("offline")
    stale = client.get("/api/settings/openrouter/models")
    assert stale.status_code == 200
    assert stale.json() == {**refreshed, "stale": True}
    assert get.call_count == 3


def test_network_failure_without_cache_is_502(client):
    assert client.get("/api/settings/openrouter/models").status_code == 502


def test_key_proxy_whitelist(client, monkeypatch):
    key = "fake-private-key"
    secrets.set_secret("openrouter", key)
    data = {"limit": 10, "limit_remaining": 7, "usage": 3, "is_free_tier": False,
            "label": key, "key": key}
    get = Mock(return_value=SimpleNamespace(raise_for_status=lambda: None, json=lambda: {"data": data}))
    monkeypatch.setattr(catalog.requests, "get", get)
    result = client.get("/api/settings/openrouter/key")
    assert result.status_code == 200
    assert result.json() == {name: data[name] for name in ("limit", "limit_remaining", "usage", "is_free_tier")}
    assert key not in result.text
    assert get.call_args.kwargs["headers"] == {"Authorization": f"Bearer {key}"}


def test_key_proxy_failure_redacts_upstream_error(client, monkeypatch):
    key = "fake-private-key"
    secrets.set_secret("openrouter", key)
    monkeypatch.setattr(catalog.requests, "get", Mock(side_effect=requests.ConnectionError(key)))
    result = client.get("/api/settings/openrouter/key")
    assert result.status_code == 502
    assert key not in result.text
