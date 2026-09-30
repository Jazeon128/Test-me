"""Keep questions held back by the quality check.

Revision ID: b7f3a1c9d2e4
Revises: 9c1e4f2a7b30
Create Date: 2026-09-30
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b7f3a1c9d2e4"
down_revision: Union[str, None] = "9c1e4f2a7b30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "flagged_questions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("deck_id", sa.Integer(), sa.ForeignKey("decks.id"), nullable=True),
        sa.Column("document_id", sa.Integer(), sa.ForeignKey("documents.id"), nullable=True),
        sa.Column("job_id", sa.String(100), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("reasons", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(20), server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_flagged_questions_deck_id", "flagged_questions", ["deck_id"])
    with op.batch_alter_table("generation_status") as batch:
        batch.add_column(sa.Column("total_questions_flagged", sa.Integer(), server_default="0"))


def downgrade() -> None:
    with op.batch_alter_table("generation_status") as batch:
        batch.drop_column("total_questions_flagged")
    op.drop_index("ix_flagged_questions_deck_id", table_name="flagged_questions")
    op.drop_table("flagged_questions")
