import uuid
from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


# ── Expense schemas ──────────────────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    raw_text: str
    source: str = "telegram"


class ParsedExpense(BaseModel):
    amount: float
    description: str
    expense_date: date
    category: str


class ExpensePending(BaseModel):
    status: str  # "pending_confirmation" | "parse_failed"
    expense_id: uuid.UUID | None = None
    parsed: ParsedExpense | None = None
    category: str | None = None
    message: str | None = None


class ExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    amount: float
    description: str
    category: str
    source: str
    created_at: datetime
    expense_date: date
    confirmed: bool
    bank_id: uuid.UUID | None = None
    bank_name: str | None = None


class ExpenseConfirmed(BaseModel):
    status: str
    expense_id: uuid.UUID


class ExpenseUpdate(BaseModel):
    description: str | None = None
    category: str | None = None
    bank_id: uuid.UUID | None = None


# ── Bank schemas ─────────────────────────────────────────────────────────────

class BankCreate(BaseModel):
    name: str


class BankOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str


# ── Income schemas ───────────────────────────────────────────────────────────

class IncomeCreate(BaseModel):
    raw_text: str


class IncomeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    amount: float
    source_name: str
    credited_at: datetime
    month: int
    year: int


class IncomeResponse(BaseModel):
    status: str
    income: IncomeOut
    savings_plan: "SavingsPlanOut | None" = None


# ── SavingsPlan schemas ──────────────────────────────────────────────────────

class AllocationItem(BaseModel):
    instrument: str
    amount: float
    rationale: str


class SavingsPlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    month: int
    year: int
    salary_amount: float
    target_save_pct: int
    allocations: list[Any]
    total_to_save: float
    gemini_narrative: str | None
    created_at: datetime


# ── SpendInsight schemas ─────────────────────────────────────────────────────

class SpendInsightOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    month: int
    year: int
    zone: str
    zone_score: int | None
    saving_score: int | None
    spend_score: int | None
    category_data: dict[str, Any] | None
    action_pills: list[str] | None
    gemini_narrative: str | None
    updated_at: datetime


# ── Zone response ────────────────────────────────────────────────────────────

class ZoneResponse(BaseModel):
    zone: str
    saving_score: int | None
    spend_score: int | None
    zone_score: int | None
    narrative: str | None
    action_pills: list[str] | None
    category_data: dict[str, Any] | None
    month: int
    year: int


# ── Chat schemas ─────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []
    month: int | None = None
    year: int | None = None


class ChatResponse(BaseModel):
    reply: str


# ── Settings schemas ─────────────────────────────────────────────────────────

class MonthSettings(BaseModel):
    salary: float
    save_pct: int
    month: int
    year: int


class MonthSettingsOut(BaseModel):
    salary: float | None = None
    save_pct: int | None = None
    month: int
    year: int
    locked: bool


# ── Monthly history for comparison chart ─────────────────────────────────────

class MonthlySummary(BaseModel):
    month: int
    year: int
    month_label: str
    total_spent: float
    salary: float
    total_saved: float
    zone: str | None = None
    saving_score: int | None = None
    spend_score: int | None = None


# ── User & Auth schemas ──────────────────────────────────────────────────────

class UserCreate(BaseModel):
    email: str
    password: str
    full_name: str | None = None


class UserLogin(BaseModel):
    email: str
    password: str


class UserThemeUpdate(BaseModel):
    is_dark_mode: bool


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str | None = None
    is_dark_mode: bool = False
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str

