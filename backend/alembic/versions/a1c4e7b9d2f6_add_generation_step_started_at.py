"""Track when the current generation step began."""
from alembic import op
import sqlalchemy as sa

revision = "a1c4e7b9d2f6"
down_revision = "f6b1d8e3a9c5"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("generation_status", sa.Column("step_started_at", sa.DateTime(timezone=True)))


def downgrade():
    op.drop_column("generation_status", "step_started_at")
