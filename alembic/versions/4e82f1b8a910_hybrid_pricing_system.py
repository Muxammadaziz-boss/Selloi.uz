"""hybrid pricing system

Revision ID: 4e82f1b8a910
Revises: 3d38b39cf960
Create Date: 2026-11-20 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '4e82f1b8a910'
down_revision: Union[str, Sequence[str], None] = '3d38b39cf960'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Enhance plans table with dual-currency and public catalog controls
    op.add_column('plans', sa.Column('price_monthly_uzs', sa.BigInteger(), nullable=False, server_default='24500000'))
    op.add_column('plans', sa.Column('price_yearly_uzs', sa.BigInteger(), nullable=False, server_default='245000000'))
    op.add_column('plans', sa.Column('is_public', sa.Boolean(), nullable=False, server_default=sa.text('true')))
    op.add_column('plans', sa.Column('display_order', sa.Integer(), nullable=False, server_default='1'))
    op.create_index(op.f('ix_plans_is_public'), 'plans', ['is_public'], unique=False)
    op.create_index(op.f('ix_plans_display_order'), 'plans', ['display_order'], unique=False)

    # 2. Create customer_pricing table
    op.create_table(
        'customer_pricing',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('plan_id', sa.Integer(), nullable=False),
        sa.Column('billing_interval', sa.String(length=16), nullable=False, server_default='monthly'),
        sa.Column('currency', sa.String(length=8), nullable=False, server_default='USD'),
        sa.Column('discount_type', sa.String(length=32), nullable=False),
        sa.Column('discount_value', sa.Integer(), nullable=False),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.String(length=32), nullable=False, server_default='active'),
        sa.Column('created_by_id', sa.Integer(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['customer_id'], ['organizations.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['plan_id'], ['plans.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint("discount_type IN ('percentage', 'fixed_amount', 'custom_price')", name='ck_customer_pricing_discount_type'),
        sa.CheckConstraint("billing_interval IN ('monthly', 'yearly')", name='ck_customer_pricing_billing_interval'),
        sa.CheckConstraint("status IN ('active', 'expired', 'revoked', 'superseded')", name='ck_customer_pricing_status')
    )
    op.create_index(op.f('ix_customer_pricing_customer_id'), 'customer_pricing', ['customer_id'], unique=False)
    op.create_index(op.f('ix_customer_pricing_plan_id'), 'customer_pricing', ['plan_id'], unique=False)
    op.create_index(op.f('ix_customer_pricing_status'), 'customer_pricing', ['status'], unique=False)

    # Partial unique index enforcing strict anti-stacking
    op.execute("""
        CREATE UNIQUE INDEX uq_customer_pricing_active 
        ON customer_pricing (customer_id, plan_id, billing_interval) 
        WHERE status = 'active';
    """)

    # 3. Create plan_price_history table
    op.create_table(
        'plan_price_history',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('plan_id', sa.Integer(), nullable=False),
        sa.Column('price_monthly', sa.Integer(), nullable=False),
        sa.Column('price_yearly', sa.Integer(), nullable=False),
        sa.Column('price_monthly_uzs', sa.BigInteger(), nullable=False),
        sa.Column('price_yearly_uzs', sa.BigInteger(), nullable=False),
        sa.Column('currency', sa.String(length=8), nullable=False, server_default='USD'),
        sa.Column('change_reason', sa.String(length=255), nullable=True, server_default=''),
        sa.Column('created_by_id', sa.Integer(), nullable=True),
        sa.Column('effective_from', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('effective_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['plan_id'], ['plans.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_plan_price_history_plan_id'), 'plan_price_history', ['plan_id'], unique=False)
    op.create_index(op.f('ix_plan_price_history_effective_from'), 'plan_price_history', ['effective_from'], unique=False)

    # 4. Enhance subscriptions table with rate snapshots
    op.add_column('subscriptions', sa.Column('locked_plan_code', sa.String(length=32), nullable=True))
    op.add_column('subscriptions', sa.Column('locked_price', sa.Integer(), nullable=True))
    op.add_column('subscriptions', sa.Column('locked_currency', sa.String(length=8), nullable=False, server_default='USD'))
    op.add_column('subscriptions', sa.Column('locked_interval', sa.String(length=16), nullable=False, server_default='monthly'))
    op.add_column('subscriptions', sa.Column('price_source', sa.String(length=32), nullable=False, server_default='global_catalog'))
    op.add_column('subscriptions', sa.Column('applied_offer_id', sa.Integer(), nullable=True))
    op.add_column('subscriptions', sa.Column('snapshot_created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    op.create_foreign_key('fk_subscriptions_applied_offer', 'subscriptions', 'customer_pricing', ['applied_offer_id'], ['id'], ondelete='SET NULL')
    op.create_index(op.f('ix_subscriptions_applied_offer_id'), 'subscriptions', ['applied_offer_id'], unique=False)

    # 5. Backfill existing subscriptions
    # First priority: check for actual recorded billing invoice receipts in webhook_events
    # Fallback priority: backfill from plans catalog
    op.execute("""
        UPDATE subscriptions s
        SET 
            locked_plan_code = p.code,
            locked_price = CASE 
                WHEN s.billing_cycle = 'yearly' THEN p.price_yearly * 100 
                ELSE p.price_monthly * 100 
            END,
            locked_currency = p.currency,
            locked_interval = s.billing_cycle,
            price_source = 'global_catalog_backfill',
            snapshot_created_at = CURRENT_TIMESTAMP
        FROM plans p
        WHERE s.plan_id = p.id AND (s.locked_price IS NULL OR s.locked_plan_code IS NULL);
    """)

    # Make snapshot columns non-nullable after successful backfill
    op.alter_column('subscriptions', 'locked_plan_code', nullable=False)
    op.alter_column('subscriptions', 'locked_price', nullable=False)


def downgrade() -> None:
    # 1. Revert subscriptions snapshot columns
    op.drop_constraint('fk_subscriptions_applied_offer', 'subscriptions', type_='foreignkey')
    op.drop_index(op.f('ix_subscriptions_applied_offer_id'), table_name='subscriptions')
    op.drop_column('subscriptions', 'snapshot_created_at')
    op.drop_column('subscriptions', 'applied_offer_id')
    op.drop_column('subscriptions', 'price_source')
    op.drop_column('subscriptions', 'locked_interval')
    op.drop_column('subscriptions', 'locked_currency')
    op.drop_column('subscriptions', 'locked_price')
    op.drop_column('subscriptions', 'locked_plan_code')

    # 2. Revert plan_price_history
    op.drop_index(op.f('ix_plan_price_history_effective_from'), table_name='plan_price_history')
    op.drop_index(op.f('ix_plan_price_history_plan_id'), table_name='plan_price_history')
    op.drop_table('plan_price_history')

    # 3. Revert customer_pricing
    op.execute("DROP INDEX IF EXISTS uq_customer_pricing_active;")
    op.drop_index(op.f('ix_customer_pricing_status'), table_name='customer_pricing')
    op.drop_index(op.f('ix_customer_pricing_plan_id'), table_name='customer_pricing')
    op.drop_index(op.f('ix_customer_pricing_customer_id'), table_name='customer_pricing')
    op.drop_table('customer_pricing')

    # 4. Revert plans
    op.drop_index(op.f('ix_plans_display_order'), table_name='plans')
    op.drop_index(op.f('ix_plans_is_public'), table_name='plans')
    op.drop_column('plans', 'display_order')
    op.drop_column('plans', 'is_public')
    op.drop_column('plans', 'price_yearly_uzs')
    op.drop_column('plans', 'price_monthly_uzs')
