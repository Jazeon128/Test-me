"""Record Jev usage per feature.

Revision ID: e5a9c3d7f1b2
Revises: d4e8b2f6a1c3
"""

from alembic import op
import sqlalchemy as sa

revision = "e5a9c3d7f1b2"
down_revision = "d4e8b2f6a1c3"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "jev_calls",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("label", sa.String(64), nullable=False),
        sa.Column("questions", sa.Integer(), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False),
        sa.Column("duration_ms", sa.Integer(), nullable=False),
        sa.Column("ok", sa.Boolean(), nullable=False),
        sa.Column("error", sa.String(200), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_jev_calls_label", "jev_calls", ["label"])
    op.create_index("ix_jev_calls_created_at", "jev_calls", ["created_at"])


def downgrade():
    op.drop_index("ix_jev_calls_created_at", table_name="jev_calls")
    op.drop_index("ix_jev_calls_label", table_name="jev_calls")
    op.drop_table("jev_calls")
