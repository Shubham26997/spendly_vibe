"""add banks

Revision ID: 0002
Revises: 0001
Create Date: 2026-07-14 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "banks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("name", sa.String(50), nullable=False, unique=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
    )

    op.add_column(
        "expenses",
        sa.Column(
            "bank_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("banks.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_expenses_bank_id", "expenses", ["bank_id"])


def downgrade() -> None:
    op.drop_index("ix_expenses_bank_id", table_name="expenses")
    op.drop_column("expenses", "bank_id")
    op.drop_table("banks")
