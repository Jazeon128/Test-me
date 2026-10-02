"""Store the edited graph separately from the generated payload."""
from alembic import op
import sqlalchemy as sa

revision = "d9f2a4c6e8b1"
down_revision = "d7e9f1a3b5c8"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("canvases", sa.Column("edited_json", sa.JSON(), nullable=True))


def downgrade():
    with op.batch_alter_table("canvases") as batch:
        batch.drop_column("edited_json")
