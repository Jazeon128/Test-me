from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import Column, Integer, MetaData, String, Table, create_engine, inspect, text

from app.config import settings
from app.models import Base


def test_full_upgrade_and_downgrade(tmp_path, monkeypatch):
    url = f"sqlite:///{tmp_path / 'flashcard-migration.db'}"
    monkeypatch.setattr(settings, "DATABASE_URL", url)
    backend = Path(__file__).resolve().parents[2]
    config = Config(str(backend / "alembic.ini"))
    config.set_main_option("script_location", str(backend / "alembic"))
    engine = create_engine(url)
    # The historical initial migration expects an already-created schema.
    # Build the previous-head schema on a fresh file, then run real Alembic commands.
    previous = MetaData()
    for table in Base.metadata.sorted_tables:
        table.to_metadata(previous)
    previous.tables["questions"]._columns.remove(previous.tables["questions"].c.card_type)
    previous.remove(previous.tables["tags"])
    Table("tags", previous,
          Column("id", Integer, primary_key=True, index=True),
          Column("name", String, unique=True, index=True, nullable=False),
          Column("color", String))
    previous.create_all(engine)
    command.stamp(config, "b4d6e8f0a2c5")
    try:
        with engine.begin() as connection:
            connection.execute(text("INSERT INTO questions (id, question_text, created_at, updated_at) VALUES (1, 'Existing', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"))
        command.upgrade(config, "head")
        with engine.begin() as connection:
            assert connection.execute(text("SELECT card_type FROM questions WHERE id = 1")).scalar() == "mcq"
            column = next(c for c in inspect(connection).get_columns("questions") if c["name"] == "card_type")
            assert not column["nullable"]
            assert column["default"] == "'mcq'"
            connection.execute(text("INSERT INTO questions (id, question_text, created_at, updated_at) VALUES (2, 'New', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"))
            assert connection.execute(text("SELECT card_type FROM questions WHERE id = 2")).scalar() == "mcq"
        command.downgrade(config, "b4d6e8f0a2c5")
        with engine.connect() as connection:
            assert "card_type" not in {c["name"] for c in inspect(connection).get_columns("questions")}
            assert connection.execute(text("SELECT question_text FROM questions ORDER BY id")).scalars().all() == ["Existing", "New"]
    finally:
        engine.dispose()
