"""add google auth fields to farmers

Revision ID: 88e5dcccd12f
Revises: 1ba3337a5793
Create Date: 2026-05-05 15:17:42.028049

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '88e5dcccd12f'
down_revision: Union[str, None] = '1ba3337a5793'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add as nullable first
    op.add_column('farmers', sa.Column('auth_provider', sa.String(length=20), nullable=True))
    op.add_column('farmers', sa.Column('google_sub', sa.String(length=255), nullable=True))
    op.add_column('farmers', sa.Column('profile_picture_url', sa.String(length=500), nullable=True))
    op.add_column('farmers', sa.Column('profile_complete', sa.Boolean(), nullable=True))

    # Backfill existing rows: all current farmers signed up via phone, profile is complete
    op.execute("UPDATE farmers SET auth_provider = 'phone' WHERE auth_provider IS NULL")
    op.execute("UPDATE farmers SET profile_complete = TRUE WHERE profile_complete IS NULL")

    # Now enforce NOT NULL
    op.alter_column('farmers', 'auth_provider', nullable=False)
    op.alter_column('farmers', 'profile_complete', nullable=False)

    # Make password_hash nullable (already detected by autogenerate)
    op.alter_column('farmers', 'password_hash',
                    existing_type=sa.VARCHAR(length=255),
                    nullable=True)

    # Email index changes (already detected by autogenerate)
    op.drop_constraint('farmers_email_key', 'farmers', type_='unique')
    op.create_index(op.f('ix_farmers_email'), 'farmers', ['email'], unique=True)
    op.create_index(op.f('ix_farmers_google_sub'), 'farmers', ['google_sub'], unique=True)

def downgrade() -> None:
    op.drop_index(op.f('ix_farmers_google_sub'), table_name='farmers')
    op.drop_index(op.f('ix_farmers_email'), table_name='farmers')
    op.create_unique_constraint('farmers_email_key', 'farmers', ['email'])
    op.alter_column('farmers', 'password_hash',
                    existing_type=sa.VARCHAR(length=255),
                    nullable=False)
    op.drop_column('farmers', 'profile_complete')
    op.drop_column('farmers', 'profile_picture_url')
    op.drop_column('farmers', 'google_sub')
    op.drop_column('farmers', 'auth_provider')