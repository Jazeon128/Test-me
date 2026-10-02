"""Keep one practice deck per canvas."""
from alembic import op
import sqlalchemy as sa

revision = "b4d6e8f0a2c5"
down_revision = "a3b5c7d9e1f2"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("decks") as batch:
        batch.add_column(sa.Column("canvas_id", sa.Integer(), nullable=True))
        batch.create_foreign_key("fk_decks_canvas_id", "canvases", ["canvas_id"], ["id"])
        batch.create_index("ix_decks_canvas_id", ["canvas_id"], unique=True)


def downgrade():
    with op.batch_alter_table("decks") as batch:
        batch.drop_index("ix_decks_canvas_id")
        batch.drop_constraint("fk_decks_canvas_id", type_="foreignkey")
        batch.drop_column("canvas_id")
