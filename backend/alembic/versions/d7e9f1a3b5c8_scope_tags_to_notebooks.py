"""Keep existing tags shared and allow notebook vocabularies."""

from alembic import op
import sqlalchemy as sa

revision = "d7e9f1a3b5c8"
down_revision = "c6d8e0f2a4b7"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("tags") as batch:
        batch.drop_index("ix_tags_name")
        batch.add_column(sa.Column("notebook_id", sa.Integer(), nullable=True))
        batch.create_foreign_key("fk_tags_notebook_id", "notebooks", ["notebook_id"], ["id"])
        batch.create_index("ix_tags_notebook_id", ["notebook_id"])
        batch.create_index("ix_tags_notebook_name", ["notebook_id", "name"], unique=True)
        batch.create_index("ix_tags_shared_name", ["name"], unique=True,
                           sqlite_where=sa.text("notebook_id IS NULL"))


def downgrade():
    with op.batch_alter_table("tags") as batch:
        batch.drop_index("ix_tags_shared_name")
        batch.drop_index("ix_tags_notebook_name")
        batch.drop_index("ix_tags_notebook_id")
        batch.drop_constraint("fk_tags_notebook_id", type_="foreignkey")
        batch.drop_column("notebook_id")
        batch.create_index("ix_tags_name", ["name"], unique=True)
