"""Add pending_request to generation_status for source pre-flight

A job whose sources fail pre-flight waits for the user. The stored request
is what gets generated if they confirm. status also widens to 30 characters
to hold "awaiting_confirmation".

Revision ID: 9c1e4f2a7b30
Revises: 7b5dca85479c
Create Date: 2026-09-29
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "9c1e4f2a7b30"
down_revision: Union[str, None] = "7b5dca85479c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("generation_status") as batch:
        batch.add_column(sa.Column("pending_request", sa.JSON(), nullable=True))
        batch.alter_column(
            "status", existing_type=sa.String(length=20), type_=sa.String(length=30)
        )


def downgrade() -> None:
    with op.batch_alter_table("generation_status") as batch:
        batch.alter_column(
            "status", existing_type=sa.String(length=30), type_=sa.String(length=20)
        )
        batch.drop_column("pending_request")
