"""Run Alembic from the previous head on empty and populated files under tmp."""

from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config
from sqlalchemy.exc import IntegrityError

from app.config import settings
from app.models import Base


@pytest.mark.parametrize("populated", [False, True])
def test_upgrade_and_downgrade(tmp_path, monkeypatch, populated):
    url = f"sqlite:///{tmp_path / 'tags-migration.db'}"
    monkeypatch.setattr(settings, "DATABASE_URL", url)
    backend = Path(__file__).resolve().parents[2]
    config = Config(str(backend / "alembic.ini"))
    config.set_main_option("script_location", str(backend / "alembic"))
    engine = sa.create_engine(url)
    # Historical migrations start from a pre-created schema. Reconstruct the
    # exact previous-head Tag schema, rather than creating the new Tag model.
    previous = sa.MetaData()
    for table in Base.metadata.sorted_tables:
        table.to_metadata(previous)
    previous.tables["canvases"]._columns.remove(previous.tables["canvases"].c.edited_json)
    previous.tables["chat_messages"]._columns.remove(previous.tables["chat_messages"].c.mode)
    previous.remove(previous.tables["tags"])
    sa.Table("tags", previous,
             sa.Column("id", sa.Integer, primary_key=True, index=True),
             sa.Column("name", sa.String, unique=True, index=True, nullable=False),
             sa.Column("color", sa.String))
    previous.tables["documents"].append_column(sa.Column("preflight", sa.JSON, nullable=True))
    previous.create_all(engine)
    command.stamp(config, "c6d8e0f2a4b7")
    try:
        if populated:
            with engine.begin() as connection:
                connection.execute(sa.text("INSERT INTO tags VALUES (1, 'Existing', 'red')"))
                connection.execute(sa.text("INSERT INTO questions (id, question_text, created_at, updated_at) VALUES (1, 'Existing question', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"))
                connection.execute(sa.text("INSERT INTO question_tags VALUES (1, 1)"))
        command.upgrade(config, "head")
        with engine.begin() as connection:
            schema = sa.inspect(connection)
            assert next(c for c in schema.get_columns("tags") if c["name"] == "notebook_id")["nullable"]
            assert schema.get_foreign_keys("tags")[0]["referred_table"] == "notebooks"
            indexes = {index["name"]: index for index in schema.get_indexes("tags")}
            assert indexes["ix_tags_notebook_name"]["unique"]
            assert indexes["ix_tags_shared_name"]["unique"]
            assert str(indexes["ix_tags_shared_name"]["dialect_options"]["sqlite_where"]) == "notebook_id IS NULL"
            if populated:
                assert connection.execute(sa.text("SELECT id, name, color, notebook_id FROM tags")).all() == [(1, "Existing", "red", None)]
                assert connection.execute(sa.text("SELECT * FROM question_tags")).all() == [(1, 1)]
                with pytest.raises(IntegrityError):
                    connection.execute(sa.text("INSERT INTO tags (name) VALUES ('Existing')"))
            connection.execute(sa.text("INSERT INTO tags (name) VALUES ('New shared')"))
        command.downgrade(config, "c6d8e0f2a4b7")
        with engine.begin() as connection:
            assert "notebook_id" not in {c["name"] for c in sa.inspect(connection).get_columns("tags")}
            names = connection.execute(sa.text("SELECT name FROM tags ORDER BY id")).scalars().all()
            assert names == (["Existing", "New shared"] if populated else ["New shared"])
            with pytest.raises(IntegrityError):
                connection.execute(sa.text("INSERT INTO tags (name) VALUES ('New shared')"))
            if populated:
                assert connection.execute(sa.text("SELECT * FROM question_tags")).all() == [(1, 1)]
    finally:
        engine.dispose()
