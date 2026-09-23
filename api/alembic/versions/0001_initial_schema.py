"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-06-29 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "expenses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("source", sa.String(20), nullable=True, server_default="telegram"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("expense_date", sa.Date(), nullable=False),
        sa.Column("confirmed", sa.Boolean(), nullable=True, server_default=sa.text("false")),
    )

    op.create_table(
        "income_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("source_name", sa.String(100), nullable=True, server_default="salary"),
        sa.Column(
            "credited_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
    )

    op.create_table(
        "savings_plans",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("salary_amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("target_save_pct", sa.Integer(), nullable=False),
        sa.Column("allocations", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("total_to_save", sa.Numeric(10, 2), nullable=False),
        sa.Column("gemini_narrative", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
    )

    op.create_table(
        "spend_insights",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("month", sa.Integer(), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("zone", sa.String(10), nullable=False),
        sa.Column("zone_score", sa.Integer(), nullable=True),
        sa.Column("saving_score", sa.Integer(), nullable=True),
        sa.Column("spend_score", sa.Integer(), nullable=True),
        sa.Column("category_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("action_pills", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("gemini_narrative", sa.Text(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    op.drop_table("spend_insights")
    op.drop_table("savings_plans")
    op.drop_table("income_events")
    op.drop_table("expenses")
