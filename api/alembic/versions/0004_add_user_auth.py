"""add user auth and user_id foreign keys

Revision ID: 0004
Revises: 0003
Create Date: 2026-09-23 00:00:00.000000

"""
import uuid
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from passlib.context import CryptContext

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = inspector.get_table_names()

    # 1. Create users table if not exists
    if "users" not in tables:
        op.create_table(
            "users",
            sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
            sa.Column("email", sa.String(255), nullable=False, unique=True),
            sa.Column("hashed_password", sa.String(255), nullable=False),
            sa.Column("full_name", sa.String(255), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=True,
            ),
        )
        op.create_index("ix_users_email", "users", ["email"], unique=True)

    # 2. Insert default demo user: demo@spendly.app / password123
    demo_user_id = uuid.uuid4()
    hashed_pwd = pwd_context.hash("password123")
    
    bind.execute(
        sa.text(
            """
            INSERT INTO users (id, email, hashed_password, full_name)
            VALUES (CAST(:id AS uuid), :email, :password, :name)
            ON CONFLICT (email) DO NOTHING
            """
        ),
        {"id": str(demo_user_id), "email": "demo@spendly.app", "password": hashed_pwd, "name": "Demo User"},
    )

    res = bind.execute(sa.text("SELECT id FROM users WHERE email = 'demo@spendly.app'"))
    actual_user_id = res.scalar() or demo_user_id

    # 3. Add user_id column to banks
    bank_cols = [c["name"] for c in inspector.get_columns("banks")]
    if "user_id" not in bank_cols:
        op.add_column(
            "banks",
            sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        )
        op.create_index("ix_banks_user_id", "banks", ["user_id"])

    # 4. Add user_id column to expenses
    exp_cols = [c["name"] for c in inspector.get_columns("expenses")]
    if "user_id" not in exp_cols:
        op.add_column(
            "expenses",
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
        bind.execute(
            sa.text("UPDATE expenses SET user_id = CAST(:id AS uuid) WHERE user_id IS NULL"),
            {"id": str(actual_user_id)},
        )
        op.alter_column("expenses", "user_id", nullable=False)
        op.create_foreign_key("fk_expenses_user_id", "expenses", "users", ["user_id"], ["id"], ondelete="CASCADE")
        op.create_index("ix_expenses_user_id", "expenses", ["user_id"])

    # 5. Add user_id column to income_events
    inc_cols = [c["name"] for c in inspector.get_columns("income_events")]
    if "user_id" not in inc_cols:
        op.add_column(
            "income_events",
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
        bind.execute(
            sa.text("UPDATE income_events SET user_id = CAST(:id AS uuid) WHERE user_id IS NULL"),
            {"id": str(actual_user_id)},
        )
        op.alter_column("income_events", "user_id", nullable=False)
        op.create_foreign_key("fk_income_events_user_id", "income_events", "users", ["user_id"], ["id"], ondelete="CASCADE")
        op.create_index("ix_income_events_user_id", "income_events", ["user_id"])

    # 6. Add user_id column to savings_plans
    sp_cols = [c["name"] for c in inspector.get_columns("savings_plans")]
    if "user_id" not in sp_cols:
        op.add_column(
            "savings_plans",
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
        bind.execute(
            sa.text("UPDATE savings_plans SET user_id = CAST(:id AS uuid) WHERE user_id IS NULL"),
            {"id": str(actual_user_id)},
        )
        op.alter_column("savings_plans", "user_id", nullable=False)
        op.create_foreign_key("fk_savings_plans_user_id", "savings_plans", "users", ["user_id"], ["id"], ondelete="CASCADE")
        op.create_index("ix_savings_plans_user_id", "savings_plans", ["user_id"])

    # 7. Add user_id column to spend_insights
    si_cols = [c["name"] for c in inspector.get_columns("spend_insights")]
    if "user_id" not in si_cols:
        op.add_column(
            "spend_insights",
            sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=True),
        )
        bind.execute(
            sa.text("UPDATE spend_insights SET user_id = CAST(:id AS uuid) WHERE user_id IS NULL"),
            {"id": str(actual_user_id)},
        )
        op.alter_column("spend_insights", "user_id", nullable=False)
        op.create_foreign_key("fk_spend_insights_user_id", "spend_insights", "users", ["user_id"], ["id"], ondelete="CASCADE")
        op.create_index("ix_spend_insights_user_id", "spend_insights", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_spend_insights_user_id", table_name="spend_insights")
    op.drop_constraint("fk_spend_insights_user_id", "spend_insights", type_="foreignkey")
    op.drop_column("spend_insights", "user_id")

    op.drop_index("ix_savings_plans_user_id", table_name="savings_plans")
    op.drop_constraint("fk_savings_plans_user_id", "savings_plans", type_="foreignkey")
    op.drop_column("savings_plans", "user_id")

    op.drop_index("ix_income_events_user_id", table_name="income_events")
    op.drop_constraint("fk_income_events_user_id", "income_events", type_="foreignkey")
    op.drop_column("income_events", "user_id")

    op.drop_index("ix_expenses_user_id", table_name="expenses")
    op.drop_constraint("fk_expenses_user_id", "expenses", type_="foreignkey")
    op.drop_column("expenses", "user_id")

    op.drop_index("ix_banks_user_id", table_name="banks")
    op.drop_column("banks", "user_id")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
