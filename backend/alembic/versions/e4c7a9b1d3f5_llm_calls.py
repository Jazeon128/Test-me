"""Record model call usage and cost."""

from alembic import op
import sqlalchemy as sa

revision = "e4c7a9b1d3f5"
down_revision = "d8a1b5c7e2f9"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "llm_calls",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("task", sa.String(32), nullable=False),
        sa.Column("provider", sa.String(32), nullable=False),
        sa.Column("requested_model", sa.String(255), nullable=False),
        sa.Column("actual_model", sa.String(255), nullable=False),
        sa.Column("upstream_provider", sa.String(255), nullable=True),
        sa.Column("input_tokens", sa.Integer(), nullable=False),
        sa.Column("output_tokens", sa.Integer(), nullable=False),
        sa.Column("cost_usd", sa.Numeric(12, 6), nullable=True),
        sa.Column("cost_source", sa.String(32), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("error_type", sa.String(255), nullable=True),
        sa.Column("job_id", sa.String(255), nullable=True),
        sa.Column("response_id", sa.String(255), nullable=True),
    )


def downgrade():
    op.drop_table("llm_calls")
