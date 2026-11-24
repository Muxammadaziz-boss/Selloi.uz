"""add token_version for session revocation

Revision ID: 5f93c2a7b123
Revises: 4e82f1b8a910
Create Date: 2026-11-23 18:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '5f93c2a7b123'
down_revision: Union[str, Sequence[str], None] = '4e82f1b8a910'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('token_version', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('admins', sa.Column('token_version', sa.Integer(), nullable=False, server_default='1'))


def downgrade() -> None:
    op.drop_column('admins', 'token_version')
    op.drop_column('users', 'token_version')
