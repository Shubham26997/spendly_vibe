"""seed default cash bank

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-14 00:00:00.000000

"""
import uuid

from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text(
            """
            INSERT INTO banks (id, name)
            SELECT CAST(:id AS uuid), :name
            WHERE NOT EXISTS (SELECT 1 FROM banks WHERE lower(name) = lower(:name))
            """
        ).bindparams(id=str(uuid.uuid4()), name="Cash")
    )


def downgrade() -> None:
    op.execute(sa.text("DELETE FROM banks WHERE lower(name) = lower(:name)").bindparams(name="Cash"))
