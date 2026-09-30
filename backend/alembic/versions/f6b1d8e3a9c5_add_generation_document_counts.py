"""Count completed and failed documents in generation jobs.

Revision ID: f6b1d8e3a9c5
Revises: e5a9c3d7f1b2
"""
from alembic import op
import sqlalchemy as sa

revision = "f6b1d8e3a9c5"
down_revision = "e5a9c3d7f1b2"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("generation_status", sa.Column("documents_completed", sa.Integer(), server_default="0"))
    op.add_column("generation_status", sa.Column("documents_failed", sa.Integer(), server_default="0"))


def downgrade():
    op.drop_column("generation_status", "documents_failed")
    op.drop_column("generation_status", "documents_completed")
