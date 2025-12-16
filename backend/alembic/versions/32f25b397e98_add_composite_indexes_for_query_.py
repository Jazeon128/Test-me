"""add_composite_indexes_for_query_optimization

Revision ID: 32f25b397e98
Revises: 96bad6a9040d
Create Date: 2025-12-04 17:16:17.111869

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '32f25b397e98'
down_revision: Union[str, None] = '96bad6a9040d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add composite index on user_progress for review session queries
    # This optimizes queries that filter by question_id and next_review_date
    op.create_index(
        'idx_user_progress_question_review',
        'user_progress',
        ['question_id', 'next_review_date'],
        unique=False
    )
    
    # Add composite index on questions for filtered queries
    # This optimizes queries that filter by document_id and difficulty
    op.create_index(
        'idx_questions_document_difficulty',
        'questions',
        ['document_id', 'difficulty'],
        unique=False
    )


def downgrade() -> None:
    # Drop the composite indexes
    op.drop_index('idx_user_progress_question_review', table_name='user_progress')
    op.drop_index('idx_questions_document_difficulty', table_name='questions')
