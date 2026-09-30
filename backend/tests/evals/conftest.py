"""Every harness test forbids network traffic and credential lookup."""

import pytest
import requests
import httpx

from app.services import secrets


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    def forbidden(*args, **kwargs):
        raise AssertionError('Harness tests must not access network or credentials')
    monkeypatch.setattr(requests.sessions.Session, 'request', forbidden)
    monkeypatch.setattr(httpx.Client, 'send', forbidden)
    monkeypatch.setattr(httpx.AsyncClient, 'send', forbidden)
    monkeypatch.setattr(secrets, 'get_secret', forbidden)
