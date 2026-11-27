"""add click/payme secrets and payment_meta

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-11-26 23:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'store_payment_configs' in tables:
        cols = {c['name'] for c in insp.get_columns('store_payment_configs')}
        if 'click_secret_key' not in cols:
            op.add_column('store_payment_configs', sa.Column('click_secret_key', sa.Text(), nullable=True))
        if 'payme_secret_key' not in cols:
            op.add_column('store_payment_configs', sa.Column('payme_secret_key', sa.Text(), nullable=True))

    if 'store_order_payments' in tables:
        cols = {c['name'] for c in insp.get_columns('store_order_payments')}
        if 'provider_transaction_id' not in cols:
            op.add_column(
                'store_order_payments',
                sa.Column('provider_transaction_id', sa.String(length=128), nullable=True),
            )
            op.create_index(
                'ix_store_order_payments_provider_transaction_id',
                'store_order_payments',
                ['provider_transaction_id'],
            )
        if 'payment_meta' not in cols:
            op.add_column(
                'store_order_payments',
                sa.Column('payment_meta', sa.JSON(), server_default='{}', nullable=False),
            )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = insp.get_table_names()

    if 'store_order_payments' in tables:
        cols = {c['name'] for c in insp.get_columns('store_order_payments')}
        if 'payment_meta' in cols:
            op.drop_column('store_order_payments', 'payment_meta')
        if 'provider_transaction_id' in cols:
            op.drop_index('ix_store_order_payments_provider_transaction_id', table_name='store_order_payments')
            op.drop_column('store_order_payments', 'provider_transaction_id')

    if 'store_payment_configs' in tables:
        cols = {c['name'] for c in insp.get_columns('store_payment_configs')}
        if 'payme_secret_key' in cols:
            op.drop_column('store_payment_configs', 'payme_secret_key')
        if 'click_secret_key' in cols:
            op.drop_column('store_payment_configs', 'click_secret_key')
