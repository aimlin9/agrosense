"""add token_version to farmers

Revision ID: ef689c87153b
Revises: 0c0e53b41bfc
Create Date: 2026-05-21

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ef689c87153b'
down_revision: Union[str, None] = '0c0e53b41bfc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add token_version column to farmers table.
    
    Default 0 for existing rows. Incremented on every successful login
    to invalidate previously-issued tokens (single-session enforcement).
    """
    op.add_column(
        'farmers',
        sa.Column(
            'token_version',
            sa.Integer(),
            nullable=False,
            server_default='0',
        ),
    )


def downgrade() -> None:
    op.drop_column('farmers', 'token_version')