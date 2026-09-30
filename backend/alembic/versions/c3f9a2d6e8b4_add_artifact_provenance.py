"""Add artifact provenance and assign notebook-less rows to Unsorted."""

from alembic import op
import sqlalchemy as sa

revision = "c3f9a2d6e8b4"
down_revision = "b7d2e4f8a1c3"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("decks", sa.Column("kind", sa.String(20), nullable=False, server_default="quiz"))
    op.add_column("decks", sa.Column("source_ids", sa.JSON(), nullable=True))
    op.add_column("generation_status", sa.Column("notebook_id", sa.Integer(), nullable=True))
    op.add_column("generation_status", sa.Column("source_ids", sa.JSON(), nullable=True))
    op.add_column("generation_status", sa.Column("kind", sa.String(20), nullable=True))
    op.add_column("generation_status", sa.Column("result_id", sa.Integer(), nullable=True))
    op.create_index("ix_generation_status_notebook_id", "generation_status", ["notebook_id"])
    connection = op.get_bind()
    connection.execute(sa.text(
        "INSERT INTO notebooks (name, created_at, updated_at) "
        "SELECT 'Unsorted', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP "
        "WHERE NOT EXISTS (SELECT 1 FROM notebooks WHERE name = 'Unsorted')"
    ))
    for table in ("decks", "documents"):
        connection.execute(sa.text(
            f"UPDATE {table} SET notebook_id = "
            "(SELECT id FROM notebooks WHERE name = 'Unsorted' ORDER BY id LIMIT 1) "
            "WHERE notebook_id IS NULL"
        ))


def downgrade():
    op.drop_index("ix_generation_status_notebook_id", table_name="generation_status")
    with op.batch_alter_table("generation_status") as batch:
        for column in ("result_id", "kind", "source_ids", "notebook_id"):
            batch.drop_column(column)
    with op.batch_alter_table("decks") as batch:
        batch.drop_column("source_ids")
        batch.drop_column("kind")
