"""add organization_invites table

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-11-26 23:55:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'organization_invites' not in insp.get_table_names():
        op.create_table(
            'organization_invites',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('organization_id', sa.Integer(), nullable=False),
            sa.Column('email', sa.String(length=255), nullable=False),
            sa.Column('role', sa.String(length=32), nullable=False, server_default='operator'),
            sa.Column('permissions', sa.JSON(), nullable=False),
            sa.Column('token_hash', sa.String(length=64), nullable=False),
            sa.Column('invited_by_user_id', sa.Integer(), nullable=True),
            sa.Column('status', sa.String(length=32), nullable=False, server_default='pending'),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['invited_by_user_id'], ['users.id'], ondelete='SET NULL'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_organization_invites_organization_id', 'organization_invites', ['organization_id'])
        op.create_index('ix_organization_invites_email', 'organization_invites', ['email'])
        op.create_index('ix_organization_invites_token_hash', 'organization_invites', ['token_hash'], unique=True)
        op.create_index('ix_organization_invites_status', 'organization_invites', ['status'])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'organization_invites' in insp.get_table_names():
        op.drop_table('organization_invites')
