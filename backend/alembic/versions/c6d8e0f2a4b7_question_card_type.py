"""Store real flashcards alongside multiple-choice questions."""

from alembic import op
import sqlalchemy as sa

revision = "c6d8e0f2a4b7"
down_revision = "b4d6e8f0a2c5"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("questions") as batch:
        batch.add_column(sa.Column("card_type", sa.String(20), nullable=False,
                                   server_default="mcq"))


def downgrade():
    with op.batch_alter_table("questions") as batch:
        batch.drop_column("card_type")
