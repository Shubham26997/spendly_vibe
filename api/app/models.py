import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_dark_mode: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false", nullable=False)
    reset_token: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reset_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # ORM Relationships (Enables effortless cascading insertions)
    banks: Mapped[list["Bank"]] = relationship("Bank", back_populates="user", cascade="all, delete-orphan")
    expenses: Mapped[list["Expense"]] = relationship("Expense", back_populates="user", cascade="all, delete-orphan")
    income_events: Mapped[list["IncomeEvent"]] = relationship("IncomeEvent", back_populates="user", cascade="all, delete-orphan")
    savings_plans: Mapped[list["SavingsPlan"]] = relationship("SavingsPlan", back_populates="user", cascade="all, delete-orphan")
    spend_insights: Mapped[list["SpendInsight"]] = relationship("SpendInsight", back_populates="user", cascade="all, delete-orphan")


class Bank(Base):
    __tablename__ = "banks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # ORM Relationships
    user: Mapped["User | None"] = relationship("User", back_populates="banks")
    expenses: Mapped[list["Expense"]] = relationship("Expense", back_populates="bank")


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # Using Decimal with Numeric handles accurate financial values without float rounding errors
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    source: Mapped[str] = mapped_column(String(20), default="telegram")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)
    confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    
    bank_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("banks.id", ondelete="SET NULL"), nullable=True
    )
    
    # ORM Relationships
    bank: Mapped["Bank | None"] = relationship("Bank", back_populates="expenses", lazy="joined")
    user: Mapped["User"] = relationship("User", back_populates="expenses", lazy="selectin")

    @property
    def bank_name(self) -> str | None:
        return self.bank.name if self.bank else None


class IncomeEvent(Base):
    __tablename__ = "income_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    source_name: Mapped[str] = mapped_column(String(100), default="salary")
    credited_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    
    # ORM Relationships
    user: Mapped["User"] = relationship("User", back_populates="income_events", lazy="selectin")


class SavingsPlan(Base):
    __tablename__ = "savings_plans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    salary_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    target_save_pct: Mapped[int] = mapped_column(Integer, nullable=False)
    allocations: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    total_to_save: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    gemini_narrative: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    # ORM Relationships
    user: Mapped["User"] = relationship("User", back_populates="savings_plans", lazy="selectin")


class SpendInsight(Base):
    __tablename__ = "spend_insights"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    zone: Mapped[str] = mapped_column(String(10), nullable=False)
    zone_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    saving_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    spend_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    category_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    action_pills: Mapped[list[Any] | None] = mapped_column(JSONB, nullable=True)
    gemini_narrative: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    
    # ORM Relationships
    user: Mapped["User"] = relationship("User", back_populates="spend_insights", lazy="selectin")
