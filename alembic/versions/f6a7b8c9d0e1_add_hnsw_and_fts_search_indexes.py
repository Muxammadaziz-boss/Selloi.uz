"""add pgvector HNSW and PostgreSQL GIN FTS search indexes

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-11-28 15:20:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, Sequence[str], None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute(sa.text("CREATE EXTENSION IF NOT EXISTS vector"))

    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())

    if "products" in tables:
        prod_cols = {c["name"] for c in insp.get_columns("products")}
        if "embedding" not in prod_cols:
            op.execute(sa.text("ALTER TABLE products ADD COLUMN embedding vector(1536)"))
        op.execute(
            sa.text(
                "CREATE INDEX IF NOT EXISTS ix_products_embedding_hnsw "
                "ON products USING hnsw (embedding vector_cosine_ops) "
                "WITH (m = 16, ef_construction = 64)"
            )
        )
        op.execute(
            sa.text(
                "CREATE INDEX IF NOT EXISTS ix_products_fts ON products USING gin ("
                "to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(category, '') || ' ' "
                "|| coalesce(specs, '') || ' ' || coalesce(code, ''))"
                ")"
            )
        )

    if "channel_posts" in tables:
        op.execute(
            sa.text(
                "CREATE INDEX IF NOT EXISTS ix_channel_posts_embedding_hnsw "
                "ON channel_posts USING hnsw (embedding vector_cosine_ops) "
                "WITH (m = 16, ef_construction = 64)"
            )
        )
        op.execute(
            sa.text(
                "CREATE INDEX IF NOT EXISTS ix_channel_posts_fts ON channel_posts USING gin ("
                "to_tsvector('simple', coalesce(text, '') || ' ' || coalesce(image_description, ''))"
                ")"
            )
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    op.execute(sa.text("DROP INDEX IF EXISTS ix_channel_posts_fts"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_channel_posts_embedding_hnsw"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_products_fts"))
    op.execute(sa.text("DROP INDEX IF EXISTS ix_products_embedding_hnsw"))
    insp = sa.inspect(bind)
    if "products" in insp.get_table_names():
        prod_cols = {c["name"] for c in insp.get_columns("products")}
        if "embedding" in prod_cols:
            op.drop_column("products", "embedding")
