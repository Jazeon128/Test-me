"""Remove source judgment storage."""
from alembic import op
import sqlalchemy as sa

revision = "e1a3c5f7b9d2"
down_revision = "d9f2a4c6e8b1"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("documents") as batch:
        batch.drop_column("preflight")


def downgrade():
    with op.batch_alter_table("documents") as batch:
        batch.add_column(sa.Column("preflight", sa.JSON(), nullable=True))
