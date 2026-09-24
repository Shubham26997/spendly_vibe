"""add reset password columns to users table

Revision ID: 0005
Revises: 53876b7f5453
Create Date: 2026-09-25 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0005"
down_revision: Union[str, None] = "53876b7f5453"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    user_cols = [c["name"] for c in inspector.get_columns("users")]

    if "reset_token" not in user_cols:
        op.add_column("users", sa.Column("reset_token", sa.String(100), nullable=True))
    if "reset_token_expires_at" not in user_cols:
        op.add_column("users", sa.Column("reset_token_expires_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "reset_token_expires_at")
    op.drop_column("users", "reset_token")
