"""add is_platform_admin to users

Revision ID: a1b2c3d4e5f6
Revises: 9d53c2b8a789
Create Date: 2026-11-25 19:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '9d53c2b8a789'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'users' in insp.get_table_names():
        user_cols = [c['name'] for c in insp.get_columns('users')]
        if 'is_platform_admin' not in user_cols:
            op.add_column(
                'users',
                sa.Column('is_platform_admin', sa.Boolean(), server_default='false', nullable=False),
            )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'users' in insp.get_table_names():
        user_cols = [c['name'] for c in insp.get_columns('users')]
        if 'is_platform_admin' in user_cols:
            op.drop_column('users', 'is_platform_admin')
