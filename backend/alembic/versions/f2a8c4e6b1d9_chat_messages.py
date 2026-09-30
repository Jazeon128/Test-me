"""Persist notebook chat turns and passage citations."""

from alembic import op
import sqlalchemy as sa

revision = "f2a8c4e6b1d9"
down_revision = "e4c7a9b1d3f5"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("notebook_id", sa.Integer(),
                  sa.ForeignKey("notebooks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("source_ids", sa.JSON(), nullable=True),
        sa.Column("citations", sa.JSON(), nullable=True),
        sa.Column("refused", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("model", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_chat_messages_notebook_id", "chat_messages", ["notebook_id"])


def downgrade():
    op.drop_index("ix_chat_messages_notebook_id", table_name="chat_messages")
    op.drop_table("chat_messages")
