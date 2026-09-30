"""Clear notebook icons damaged by non-UTF-8 input.

Revision ID: d4e8b2f6a1c3
Revises: b7f3a1c9d2e4
"""

from alembic import op
import sqlalchemy as sa

revision = "d4e8b2f6a1c3"
down_revision = "b7f3a1c9d2e4"
branch_labels = None
depends_on = None


def is_ascii_icon(icon):
    return icon is not None and not any(ord(character) > 127 for character in icon)


def upgrade():
    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id, icon FROM notebooks")).all()
    for notebook_id, icon in rows:
        if is_ascii_icon(icon):
            connection.execute(
                sa.text("UPDATE notebooks SET icon = NULL WHERE id = :id"),
                {"id": notebook_id},
            )


def downgrade():
    # The original emoji was lost before storage, so cleared icons cannot be restored.
    pass
