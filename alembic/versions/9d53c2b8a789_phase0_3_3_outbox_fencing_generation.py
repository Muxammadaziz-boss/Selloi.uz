"""phase 0.3.3 outbox fencing generation

Revision ID: 9d53c2b8a789
Revises: 8c42b1a9f567
Create Date: 2026-11-24 20:05:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '9d53c2b8a789'
down_revision: Union[str, Sequence[str], None] = '8c42b1a9f567'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    table_names = insp.get_table_names()

    # 1. Add fencing_generation to telegram_outbox
    if 'telegram_outbox' in table_names:
        outbox_cols = [c['name'] for c in insp.get_columns('telegram_outbox')]
        if 'fencing_generation' not in outbox_cols:
            op.add_column(
                'telegram_outbox',
                sa.Column('fencing_generation', sa.Integer(), server_default='1', nullable=False),
            )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    table_names = insp.get_table_names()

    if 'telegram_outbox' in table_names:
        outbox_cols = [c['name'] for c in insp.get_columns('telegram_outbox')]
        if 'fencing_generation' in outbox_cols:
            op.drop_column('telegram_outbox', 'fencing_generation')
