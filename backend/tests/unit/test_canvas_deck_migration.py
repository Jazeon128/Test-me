"""Upgrade and downgrade the canvas deck migration on fresh SQLite."""
import importlib.util
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.exc import IntegrityError


def test_upgrade_and_downgrade(tmp_path):
    path = Path(__file__).resolve().parents[2] / "alembic/versions/b4d6e8f0a2c5_canvas_deck.py"
    spec = importlib.util.spec_from_file_location("canvas_deck_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    assert migration.down_revision == "a3b5c7d9e1f2"
    engine = create_engine(f"sqlite:///{tmp_path / 'migration.db'}")
    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE canvases (id INTEGER PRIMARY KEY)"))
            connection.execute(text("CREATE TABLE decks (id INTEGER PRIMARY KEY, name VARCHAR(255) NOT NULL)"))
            connection.execute(text("INSERT INTO canvases VALUES (1)"))
            connection.execute(text("INSERT INTO decks VALUES (1, 'Existing')"))
            with Operations.context(MigrationContext.configure(connection)):
                migration.upgrade()
                schema = inspect(connection)
                assert next(c for c in schema.get_columns("decks") if c["name"] == "canvas_id")["nullable"]
                assert schema.get_indexes("decks") == [{"name": "ix_decks_canvas_id", "column_names": ["canvas_id"],
                                                        "unique": 1, "dialect_options": {}}]
                assert schema.get_foreign_keys("decks")[0]["referred_table"] == "canvases"
                assert connection.execute(text("SELECT canvas_id FROM decks")).scalar() is None
                connection.execute(text("UPDATE decks SET canvas_id = 1"))
                with pytest.raises(IntegrityError):
                    connection.execute(text("INSERT INTO decks VALUES (2, 'Duplicate', 1)"))
                connection.execute(text("INSERT INTO decks VALUES (3, 'Detached', NULL)"))
                migration.downgrade()
            assert "canvas_id" not in {c["name"] for c in inspect(connection).get_columns("decks")}
            assert connection.execute(text("SELECT id, name FROM decks ORDER BY id")).all() == [(1, "Existing"), (3, "Detached")]
    finally:
        engine.dispose()
