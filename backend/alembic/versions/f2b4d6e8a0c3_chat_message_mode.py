"""Distinguish typed and spoken chat turns."""
from alembic import op
import sqlalchemy as sa

revision = "f2b4d6e8a0c3"
down_revision = "e1a3c5f7b9d2"
branch_labels = None
depends_on = None


def upgrade():
    column = sa.Column("mode", sa.String(16), nullable=False, server_default="text")
    op.add_column("chat_messages", column)


def downgrade():
    with op.batch_alter_table("chat_messages") as batch:
        batch.drop_column("mode")
