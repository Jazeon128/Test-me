"""Store parsed source passages and ingestion state."""
from alembic import op
import sqlalchemy as sa

revision = "b7d2e4f8a1c3"
down_revision = "a1c4e7b9d2f6"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("documents") as batch:
        batch.add_column(sa.Column("status", sa.String(20), nullable=False, server_default="ready"))
        batch.add_column(sa.Column("error_message", sa.Text(), nullable=True))
        batch.add_column(sa.Column("preflight", sa.JSON(), nullable=True))
        batch.add_column(sa.Column("parsed_at", sa.DateTime(), nullable=True))
    op.create_table(
        "document_passages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("document_id", sa.Integer(), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ordinal", sa.Integer(), nullable=False),
        sa.Column("section_index", sa.Integer(), nullable=False),
        sa.Column("page", sa.Integer(), nullable=True),
        sa.Column("heading", sa.String(512), nullable=True),
        sa.Column("locator", sa.String(255), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("char_start", sa.Integer(), nullable=False),
        sa.Column("char_end", sa.Integer(), nullable=False),
        sa.UniqueConstraint("document_id", "ordinal"),
    )
    op.create_index("ix_document_passages_document_id", "document_passages", ["document_id"])


def downgrade():
    op.drop_table("document_passages")
    with op.batch_alter_table("documents") as batch:
        for column in ("parsed_at", "preflight", "error_message", "status"):
            batch.drop_column(column)
