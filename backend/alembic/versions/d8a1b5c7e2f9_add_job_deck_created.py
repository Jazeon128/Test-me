"""Record whether a generation job created its deck."""

from alembic import op
import sqlalchemy as sa

revision = "d8a1b5c7e2f9"
down_revision = "c3f9a2d6e8b4"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("generation_status", sa.Column(
        "deck_created", sa.Boolean(), nullable=False, server_default=sa.false(),
    ))


def downgrade():
    with op.batch_alter_table("generation_status") as batch:
        batch.drop_column("deck_created")
