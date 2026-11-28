"""multi-tenant system_settings surrogate primary key

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-11-28 12:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, Sequence[str], None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'system_settings' not in insp.get_table_names():
        return

    cols = {c['name'] for c in insp.get_columns('system_settings')}
    if 'id' not in cols:
        pk = insp.get_pk_constraint('system_settings') or {}
        pk_name = pk.get('name')
        if pk_name:
            op.drop_constraint(pk_name, 'system_settings', type_='primary')
        op.execute(sa.text("ALTER TABLE system_settings ADD COLUMN id SERIAL PRIMARY KEY"))

    existing_indexes = {idx['name'] for idx in insp.get_indexes('system_settings')}
    existing_uqs = {uq['name'] for uq in insp.get_unique_constraints('system_settings')}

    if 'ix_system_settings_key' not in existing_indexes:
        op.create_index('ix_system_settings_key', 'system_settings', ['key'])

    if 'uq_system_settings_org_key' not in existing_uqs and 'uq_system_settings_org_key' not in existing_indexes:
        op.create_unique_constraint('uq_system_settings_org_key', 'system_settings', ['organization_id', 'key'])

    if 'uq_system_settings_global_key' not in existing_indexes:
        op.create_index(
            'uq_system_settings_global_key',
            'system_settings',
            ['key'],
            unique=True,
            postgresql_where=sa.text('organization_id IS NULL'),
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if 'system_settings' not in insp.get_table_names():
        return

    existing_indexes = {idx['name'] for idx in insp.get_indexes('system_settings')}
    existing_uqs = {uq['name'] for uq in insp.get_unique_constraints('system_settings')}

    if 'uq_system_settings_global_key' in existing_indexes:
        op.drop_index('uq_system_settings_global_key', table_name='system_settings')
    if 'uq_system_settings_org_key' in existing_uqs:
        op.drop_constraint('uq_system_settings_org_key', 'system_settings', type_='unique')
    elif 'uq_system_settings_org_key' in existing_indexes:
        op.drop_index('uq_system_settings_org_key', table_name='system_settings')
    if 'ix_system_settings_key' in existing_indexes:
        op.drop_index('ix_system_settings_key', table_name='system_settings')

    cols = {c['name'] for c in insp.get_columns('system_settings')}
    if 'id' in cols:
        pk = insp.get_pk_constraint('system_settings') or {}
        if pk.get('name'):
            op.drop_constraint(pk['name'], 'system_settings', type_='primary')
        op.drop_column('system_settings', 'id')
        op.create_primary_key('system_settings_pkey', 'system_settings', ['key'])
