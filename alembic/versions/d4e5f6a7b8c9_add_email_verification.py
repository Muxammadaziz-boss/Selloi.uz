"""add email verification fields and token table

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-11-27 18:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'users' in tables:
        cols = {c['name'] for c in insp.get_columns('users')}
        if 'email_verified' not in cols:
            op.add_column(
                'users',
                sa.Column('email_verified', sa.Boolean(), server_default='false', nullable=False),
            )
            # Mark pre-existing users as verified so existing live accounts are not disrupted
            op.execute(sa.text("UPDATE users SET email_verified = true WHERE email_verified = false"))
        if 'email_verified_at' not in cols:
            op.add_column(
                'users',
                sa.Column('email_verified_at', sa.DateTime(timezone=True), nullable=True),
            )
            op.execute(sa.text("UPDATE users SET email_verified_at = NOW() WHERE email_verified = true AND email_verified_at IS NULL"))

    if 'email_verification_tokens' not in tables:
        op.create_table(
            'email_verification_tokens',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('email', sa.String(length=255), nullable=False),
            sa.Column('code_hash', sa.String(length=128), nullable=False),
            sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('max_attempts', sa.Integer(), nullable=False, server_default='5'),
            sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
            sa.Column('used_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_email_verification_tokens_user_id', 'email_verification_tokens', ['user_id'])
        op.create_index('ix_email_verification_tokens_email', 'email_verification_tokens', ['email'])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'email_verification_tokens' in tables:
        op.drop_table('email_verification_tokens')

    if 'users' in tables:
        cols = {c['name'] for c in insp.get_columns('users')}
        if 'email_verified_at' in cols:
            op.drop_column('users', 'email_verified_at')
        if 'email_verified' in cols:
            op.drop_column('users', 'email_verified')
