"""Track all canvas sources in selection order."""
from alembic import op
import sqlalchemy as sa

revision = "a3b5c7d9e1f2"
down_revision = "f2a8c4e6b1d9"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("canvases", sa.Column("source_ids", sa.JSON(), nullable=True))


def downgrade():
    op.drop_column("canvases", "source_ids")
