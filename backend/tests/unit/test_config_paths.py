from pathlib import Path

import pytest

from app.config import BACKEND_DIR, Settings


@pytest.mark.parametrize("database_url", ["sqlite:///./x.db", "sqlite:///x.db"])
def test_relative_paths_resolve_against_backend(monkeypatch, tmp_path, database_url):
    monkeypatch.chdir(tmp_path)
    settings = Settings(_env_file=None, DATABASE_URL=database_url, UPLOAD_DIR="./uploads")

    assert settings.DATABASE_URL == "sqlite:///" + (BACKEND_DIR / "x.db").as_posix()
    assert Path(settings.UPLOAD_DIR) == BACKEND_DIR / "uploads"
    assert Path(Settings.Config.env_file) == BACKEND_DIR / ".env"


@pytest.mark.parametrize("database_url", [
    "sqlite:///:memory:",
    "postgresql://user:password@localhost/testme",
    "sqlite:////absolute/test.db",
])
def test_other_database_urls_stay_unchanged(monkeypatch, tmp_path, database_url):
    monkeypatch.chdir(tmp_path)
    settings = Settings(_env_file=None, DATABASE_URL=database_url, UPLOAD_DIR=str(tmp_path))

    assert settings.DATABASE_URL == database_url
    assert settings.UPLOAD_DIR == str(tmp_path)


def test_absolute_sqlite_path_stays_unchanged(tmp_path):
    database_url = "sqlite:///" + str(tmp_path / "test.db")
    settings = Settings(_env_file=None, DATABASE_URL=database_url, UPLOAD_DIR=str(tmp_path))

    assert settings.DATABASE_URL == database_url


def test_host_defaults_to_loopback(monkeypatch):
    monkeypatch.delenv("HOST", raising=False)
    monkeypatch.delenv("PORT", raising=False)
    settings = Settings(_env_file=None, DATABASE_URL="sqlite:///:memory:", UPLOAD_DIR="uploads")

    assert settings.HOST == "127.0.0.1"
    assert settings.PORT == 8000
