"""add telegram inbox outbox and order idempotency

Revision ID: 6a74d3b8c234
Revises: 5f93c2a7b123
Create Date: 2026-11-23 19:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '6a74d3b8c234'
down_revision: Union[str, Sequence[str], None] = '7a19c3b8e452'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    table_names = insp.get_table_names()

    # 1. telegram_inbox table
    if 'telegram_inbox' not in table_names:
        op.create_table(
            'telegram_inbox',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('bot_id', sa.String(length=64), server_default='default', nullable=False),
            sa.Column('organization_id', sa.Integer(), nullable=True),
            sa.Column('update_id', sa.BigInteger(), nullable=False),
            sa.Column('payload', sa.JSON(), nullable=False),
            sa.Column('status', sa.String(length=32), server_default='pending', nullable=False),
            sa.Column('attempts', sa.Integer(), server_default='0', nullable=False),
            sa.Column('max_attempts', sa.Integer(), server_default='5', nullable=False),
            sa.Column('next_attempt_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('lease_owner', sa.String(length=64), nullable=True),
            sa.Column('lease_token', sa.String(length=64), nullable=True),
            sa.Column('lease_expires_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('received_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('last_error', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('bot_id', 'update_id', name='uq_telegram_inbox_bot_update'),
        )
        op.create_index('ix_telegram_inbox_bot_id', 'telegram_inbox', ['bot_id'], unique=False)
        op.create_index('ix_telegram_inbox_organization_id', 'telegram_inbox', ['organization_id'], unique=False)
        op.create_index('ix_telegram_inbox_update_id', 'telegram_inbox', ['update_id'], unique=False)
        op.create_index('ix_telegram_inbox_status', 'telegram_inbox', ['status'], unique=False)
        op.create_index('ix_telegram_inbox_next_attempt_at', 'telegram_inbox', ['next_attempt_at'], unique=False)
        op.create_index('ix_telegram_inbox_lease_expires_at', 'telegram_inbox', ['lease_expires_at'], unique=False)
        op.create_index('ix_telegram_inbox_status_attempt', 'telegram_inbox', ['status', 'next_attempt_at', 'lease_expires_at'], unique=False)

    # 2. telegram_outbox table
    if 'telegram_outbox' not in table_names:
        op.create_table(
            'telegram_outbox',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('organization_id', sa.Integer(), nullable=True),
            sa.Column('idempotency_key', sa.String(length=255), nullable=False),
            sa.Column('event_type', sa.String(length=64), nullable=False),
            sa.Column('payload', sa.JSON(), nullable=False),
            sa.Column('status', sa.String(length=32), server_default='pending', nullable=False),
            sa.Column('attempts', sa.Integer(), server_default='0', nullable=False),
            sa.Column('max_attempts', sa.Integer(), server_default='5', nullable=False),
            sa.Column('next_retry_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('last_error', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
            sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('idempotency_key', name='uq_telegram_outbox_idempotency_key'),
        )
        op.create_index('ix_telegram_outbox_organization_id', 'telegram_outbox', ['organization_id'], unique=False)
        op.create_index('ix_telegram_outbox_idempotency_key', 'telegram_outbox', ['idempotency_key'], unique=True)
        op.create_index('ix_telegram_outbox_event_type', 'telegram_outbox', ['event_type'], unique=False)
        op.create_index('ix_telegram_outbox_status', 'telegram_outbox', ['status'], unique=False)
        op.create_index('ix_telegram_outbox_next_retry_at', 'telegram_outbox', ['next_retry_at'], unique=False)
        op.create_index('ix_telegram_outbox_status_retry', 'telegram_outbox', ['status', 'next_retry_at'], unique=False)

    # 3. orders idempotency_key column
    if 'orders' in table_names:
        order_cols = [c['name'] for c in insp.get_columns('orders')]
        if 'idempotency_key' not in order_cols:
            op.add_column('orders', sa.Column('idempotency_key', sa.String(length=255), nullable=True))
            op.create_index('ix_orders_idempotency_key', 'orders', ['idempotency_key'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_orders_idempotency_key', table_name='orders')
    op.drop_column('orders', 'idempotency_key')
    op.drop_table('telegram_outbox')
    op.drop_table('telegram_inbox')
