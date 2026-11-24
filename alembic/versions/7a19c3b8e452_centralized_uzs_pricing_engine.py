"""centralized uzs pricing engine and payment snapshots

Revision ID: 7a19c3b8e452
Revises: 5f93c2a7b123
Create Date: 2026-11-23 19:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '7a19c3b8e452'
down_revision: Union[str, Sequence[str], None] = '5f93c2a7b123'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Plans table enhancements
    op.add_column('plans', sa.Column('price_promo_uzs', sa.BigInteger(), nullable=False, server_default='1300000'))
    op.add_column('plans', sa.Column('price_version', sa.Integer(), nullable=False, server_default='1'))

    # 2. PlanPriceHistory table enhancements
    op.add_column('plan_price_history', sa.Column('plan_code', sa.String(length=32), nullable=True))
    op.add_column('plan_price_history', sa.Column('billing_period', sa.String(length=32), nullable=False, server_default='ALL'))
    op.add_column('plan_price_history', sa.Column('previous_price_uzs', sa.BigInteger(), nullable=False, server_default='0'))
    op.add_column('plan_price_history', sa.Column('new_price_uzs', sa.BigInteger(), nullable=False, server_default='0'))
    op.add_column('plan_price_history', sa.Column('price_version', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('plan_price_history', sa.Column('admin_id', sa.Integer(), nullable=True))
    op.add_column('plan_price_history', sa.Column('approval_status', sa.String(length=32), nullable=False, server_default='approved'))
    op.create_foreign_key('fk_plan_price_history_admin', 'plan_price_history', 'users', ['admin_id'], ['id'], ondelete='SET NULL')
    op.create_index(op.f('ix_plan_price_history_plan_code'), 'plan_price_history', ['plan_code'], unique=False)

    # 3. PaymentBills table enhancements for immutable price snapshots
    op.add_column('payment_bills', sa.Column('order_id', sa.String(length=128), nullable=True))
    op.add_column('payment_bills', sa.Column('plan_id', sa.Integer(), nullable=True))
    op.add_column('payment_bills', sa.Column('billing_period', sa.String(length=32), nullable=True))
    op.add_column('payment_bills', sa.Column('price_uzs', sa.BigInteger(), nullable=False, server_default='0'))
    op.add_column('payment_bills', sa.Column('price_version', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('payment_bills', sa.Column('discount_amount_uzs', sa.BigInteger(), nullable=False, server_default='0'))
    op.add_column('payment_bills', sa.Column('final_amount_uzs', sa.BigInteger(), nullable=False, server_default='0'))
    op.add_column('payment_bills', sa.Column('amount_minor', sa.BigInteger(), nullable=False, server_default='0'))
    op.create_foreign_key('fk_payment_bills_plan', 'payment_bills', 'plans', ['plan_id'], ['id'], ondelete='SET NULL')
    op.create_index(op.f('ix_payment_bills_order_id'), 'payment_bills', ['order_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_payment_bills_order_id'), table_name='payment_bills')
    op.drop_constraint('fk_payment_bills_plan', 'payment_bills', type_='foreignkey')
    op.drop_column('payment_bills', 'amount_minor')
    op.drop_column('payment_bills', 'final_amount_uzs')
    op.drop_column('payment_bills', 'discount_amount_uzs')
    op.drop_column('payment_bills', 'price_version')
    op.drop_column('payment_bills', 'price_uzs')
    op.drop_column('payment_bills', 'billing_period')
    op.drop_column('payment_bills', 'plan_id')
    op.drop_column('payment_bills', 'order_id')

    op.drop_index(op.f('ix_plan_price_history_plan_code'), table_name='plan_price_history')
    op.drop_constraint('fk_plan_price_history_admin', 'plan_price_history', type_='foreignkey')
    op.drop_column('plan_price_history', 'approval_status')
    op.drop_column('plan_price_history', 'admin_id')
    op.drop_column('plan_price_history', 'price_version')
    op.drop_column('plan_price_history', 'new_price_uzs')
    op.drop_column('plan_price_history', 'previous_price_uzs')
    op.drop_column('plan_price_history', 'billing_period')
    op.drop_column('plan_price_history', 'plan_code')

    op.drop_column('plans', 'price_version')
    op.drop_column('plans', 'price_promo_uzs')
