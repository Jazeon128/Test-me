"""Run the new Alembic revision on a fresh SQLite database under tmp."""
import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text


def test_upgrade_and_downgrade(tmp_path):
    path = Path(__file__).resolve().parents[2] / "alembic/versions/a3b5c7d9e1f2_canvas_source_ids.py"
    spec = importlib.util.spec_from_file_location("canvas_sources_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    assert migration.down_revision == "f2a8c4e6b1d9"
    engine = create_engine(f"sqlite:///{tmp_path / 'migration.db'}")
    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE canvases (id INTEGER PRIMARY KEY, document_id INTEGER NOT NULL)"))
            connection.execute(text("INSERT INTO canvases VALUES (1, 42)"))
            with Operations.context(MigrationContext.configure(connection)):
                migration.upgrade()
                columns = {c["name"]: c for c in inspect(connection).get_columns("canvases")}
                assert columns["source_ids"]["nullable"]
                assert connection.execute(text("SELECT source_ids FROM canvases")).scalar() is None
                connection.execute(text("UPDATE canvases SET source_ids = '[42, 43]'"))
                migration.downgrade()
            assert "source_ids" not in {c["name"] for c in inspect(connection).get_columns("canvases")}
            assert connection.execute(text("SELECT id, document_id FROM canvases")).all() == [(1, 42)]
    finally:
        engine.dispose()
