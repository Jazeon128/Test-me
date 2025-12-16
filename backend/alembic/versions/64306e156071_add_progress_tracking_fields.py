"""add_progress_tracking_fields

Revision ID: 64306e156071
Revises: 32f25b397e98
Create Date: 2025-12-05 20:49:06.828772

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '64306e156071'
down_revision: Union[str, None] = '32f25b397e98'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add current_question column to generation_status table
    op.add_column('generation_status', sa.Column('current_question', sa.Integer(), nullable=True, server_default='0'))
    
    # Add total_questions column to generation_status table
    op.add_column('generation_status', sa.Column('total_questions', sa.Integer(), nullable=True, server_default='0'))


def downgrade() -> None:
    # Drop the progress tracking columns
    op.drop_column('generation_status', 'total_questions')
    op.drop_column('generation_status', 'current_question')
