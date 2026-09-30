import importlib.util
from pathlib import Path
from unittest.mock import patch

from sqlalchemy import create_engine, text


migration_path = Path(__file__).resolve().parents[2] / "alembic/versions/d4e8b2f6a1c3_clear_broken_notebook_icons.py"
spec = importlib.util.spec_from_file_location("clear_icon_migration", migration_path)
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


def test_upgrade_clears_only_ascii_icons(tmp_path):
    engine = create_engine(f"sqlite:///{tmp_path / 'icons.db'}")
    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE notebooks (id INTEGER PRIMARY KEY, icon TEXT)"))
            connection.execute(
                text("INSERT INTO notebooks (id, icon) VALUES (:id, :icon)"),
                [{"id": 1, "icon": "??"}, {"id": 2, "icon": "\U0001f4c1"}, {"id": 3, "icon": None}],
            )
            with patch.object(migration.op, "get_bind", return_value=connection):
                migration.upgrade()
                migration.upgrade()
                migration.downgrade()
            assert connection.execute(text("SELECT id, icon FROM notebooks ORDER BY id")).all() == [
                (1, None), (2, "\U0001f4c1"), (3, None)
            ]
    finally:
        engine.dispose()


def test_ascii_icon_check():
    assert migration.is_ascii_icon("??")
    assert migration.is_ascii_icon("ab")
    assert migration.is_ascii_icon("")
    assert not migration.is_ascii_icon("\U0001f4c1")
    assert not migration.is_ascii_icon(None)
