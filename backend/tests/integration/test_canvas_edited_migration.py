"""Run the new migration against an isolated database, never the owner's database."""
import os
from pathlib import Path
import subprocess
import sys


def test_canvas_edited_migration_upgrade_downgrade(tmp_path):
    database = tmp_path / "canvas-migration.db"
    script = '''
from pydantic_settings import DotEnvSettingsSource
DotEnvSettingsSource.__call__ = lambda self: {}
from alembic.config import Config
from alembic import command
from sqlalchemy import create_engine, inspect, text
from app.config import settings
config = Config("alembic.ini")
# The legacy initial revision drops existing tables. Build the preceding
# schema on this fresh database and test this revision in both directions.
from app.models import Base
engine = create_engine(settings.DATABASE_URL)
Base.metadata.create_all(engine)
with engine.begin() as connection:
    connection.execute(text("ALTER TABLE canvases DROP COLUMN edited_json"))
    connection.execute(text("ALTER TABLE chat_messages DROP COLUMN mode"))
    connection.execute(text("ALTER TABLE documents ADD COLUMN preflight JSON"))
engine.dispose()
command.stamp(config, "d7e9f1a3b5c8")
command.upgrade(config, "head")
engine = create_engine(settings.DATABASE_URL)
assert "edited_json" in {c["name"] for c in inspect(engine).get_columns("canvases")}
from sqlalchemy.orm import Session
from app.models.document import Document, DocumentType
from app.models.canvas import Canvas
with Session(engine) as session:
    document = Document(id=1, filename="a", original_filename="a", file_path="a",
                        file_type=DocumentType.PDF, file_size=1)
    session.add(document)
    session.flush()
    session.add(Canvas(id=1, document_id=1, request_text="draw", template="flowchart",
                       payload_json={}, sources_json=[], edited_json={"schema_version": 1}))
    session.commit()
engine.dispose()
command.downgrade(config, "d7e9f1a3b5c8")
engine = create_engine(settings.DATABASE_URL)
assert "edited_json" not in {c["name"] for c in inspect(engine).get_columns("canvases")}
with engine.connect() as connection:
    assert connection.execute(text("SELECT payload_json FROM canvases WHERE id=1")).scalar() == "{}"
engine.dispose()
command.upgrade(config, "head")
command.downgrade(config, "d7e9f1a3b5c8")
print("Fresh database upgrade and downgrade succeeded")
'''
    environment = {**os.environ, "DATABASE_URL": "sqlite:///" + database.as_posix()}
    result = subprocess.run([sys.executable, "-c", script], cwd=Path(__file__).resolve().parents[2],
                            env=environment, capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "Fresh database upgrade and downgrade succeeded" in result.stdout
