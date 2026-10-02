"""Exercise the column migration only on a temporary SQLite file."""
import importlib.util
from pathlib import Path

from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text


def test_upgrade_and_downgrade(tmp_path):
    path = Path(__file__).resolve().parents[2] / "alembic/versions/e1a3c5f7b9d2_remove_source_gate.py"
    spec = importlib.util.spec_from_file_location("remove_source_gate", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    assert migration.down_revision == "d9f2a4c6e8b1"
    engine = create_engine(f"sqlite:///{tmp_path / 'migration.db'}")
    try:
        with engine.begin() as connection:
            connection.execute(text("CREATE TABLE documents (id INTEGER PRIMARY KEY, content TEXT, preflight JSON)"))
            connection.execute(text("INSERT INTO documents VALUES (1, 'Source text', '{}')"))
            with Operations.context(MigrationContext.configure(connection)):
                migration.upgrade()
                assert "preflight" not in {c["name"] for c in inspect(connection).get_columns("documents")}
                assert connection.execute(text("SELECT content FROM documents")).scalar_one() == "Source text"
                migration.downgrade()
                column = next(c for c in inspect(connection).get_columns("documents") if c["name"] == "preflight")
                assert column["nullable"] is True
                assert str(column["type"]) == "JSON"
                assert connection.execute(text("SELECT preflight FROM documents")).scalar_one() is None
                migration.upgrade()
    finally:
        engine.dispose()
