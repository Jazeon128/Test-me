"""Desktop preflights must work without allowing opaque origins in web mode."""

import importlib

import pytest
from fastapi.testclient import TestClient


@pytest.mark.parametrize("desktop_mode", [None, "false", "true"])
def test_desktop_preflight(monkeypatch, desktop_mode):
    import main

    if desktop_mode is None:
        monkeypatch.delenv("DESKTOP_MODE", raising=False)
    else:
        monkeypatch.setenv("DESKTOP_MODE", desktop_mode)
    original_app = main.app
    try:
        application = importlib.reload(main).app
        # No lifespan is needed for a preflight and no database is touched.
        response = TestClient(application).options(
            "/api/documents/",
            headers={
                "Origin": "null",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        if desktop_mode == "true":
            assert response.status_code == 200
            assert response.headers["access-control-allow-origin"] == "null"
        else:
            assert response.status_code == 400
            assert "access-control-allow-origin" not in response.headers
    finally:
        main.app = original_app
