"""phase 0.3.1 outbox leases and inbox fencing generation

Revision ID: 8c42b1a9f567
Revises: 6a74d3b8c234
Create Date: 2026-11-23 23:55:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '8c42b1a9f567'
down_revision: Union[str, Sequence[str], None] = '6a74d3b8c234'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    table_names = insp.get_table_names()

    # 1. Add fencing_generation to telegram_inbox
    if 'telegram_inbox' in table_names:
        inbox_cols = [c['name'] for c in insp.get_columns('telegram_inbox')]
        if 'fencing_generation' not in inbox_cols:
            op.add_column(
                'telegram_inbox',
                sa.Column('fencing_generation', sa.Integer(), server_default='1', nullable=False),
            )

    # 2. Add lease columns to telegram_outbox
    if 'telegram_outbox' in table_names:
        outbox_cols = [c['name'] for c in insp.get_columns('telegram_outbox')]
        if 'lease_owner' not in outbox_cols:
            op.add_column(
                'telegram_outbox',
                sa.Column('lease_owner', sa.String(length=64), nullable=True),
            )
        if 'lease_token' not in outbox_cols:
            op.add_column(
                'telegram_outbox',
                sa.Column('lease_token', sa.String(length=64), nullable=True),
            )
        if 'lease_expires_at' not in outbox_cols:
            op.add_column(
                'telegram_outbox',
                sa.Column('lease_expires_at', sa.DateTime(timezone=True), nullable=True),
            )
        outbox_indexes = [i['name'] for i in insp.get_indexes('telegram_outbox')]
        if 'ix_telegram_outbox_lease_expires_at' not in outbox_indexes:
            op.create_index(
                'ix_telegram_outbox_lease_expires_at',
                'telegram_outbox',
                ['lease_expires_at'],
                unique=False,
            )


def downgrade() -> None:
    op.drop_index('ix_telegram_outbox_lease_expires_at', table_name='telegram_outbox')
    op.drop_column('telegram_outbox', 'lease_expires_at')
    op.drop_column('telegram_outbox', 'lease_token')
    op.drop_column('telegram_outbox', 'lease_owner')
    op.drop_column('telegram_inbox', 'fencing_generation')
