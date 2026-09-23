import logging
from calendar import month_name, monthrange
from datetime import date, datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.config import settings
from app.database import get_db
from app.models import Expense, IncomeEvent, SpendInsight, User
from app.schemas import ChatRequest, ChatResponse
from app.services.categoriser import CATEGORIES
from app.services.gemini_helper import generate_chat

logger = logging.getLogger(__name__)

router = APIRouter(tags=["chat"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
UserDep = Annotated[User, Depends(get_current_user)]

_SYSTEM_PROMPT = """\
You are Spendly's personal financial assistant for an Indian salaried professional.
You have access to their real financial data below. Use it to answer questions accurately.

Critical context for all insight calls: House, Family, and Grocery are mandatory essentials. They are baseline necessary expenses and must not be treated as discretionary waste.
Only flag unusually large increases in these categories when they rise sharply versus the previous month or a sensible baseline; otherwise keep them in context as essential spending.

=== FINANCIAL SNAPSHOT ({month_label} {year}) ===
Salary:        ₹{salary:,.0f}
Days elapsed:  {days_elapsed} of {days_in_month}

Total Spent:   ₹{total_spent:,.0f}  ({spend_pct:.1f}% of salary)
Total Saved:   ₹{actually_saved:,.0f}  (target ₹{target_save_amount:,.0f} = {target_save_pct}% of salary)

Zone:          {zone}
Save Score:    {saving_score}/100
Spend Score:   {spend_score}/100

SPENDING BY CATEGORY:
{category_breakdown}
=== END SNAPSHOT ===

RULES:
- Be conversational, direct, and cite exact numbers from the snapshot.
- Answer questions about spending, savings, categories, pace, and advice.
- Treat House, Family, and Grocery as mandatory essentials in every insight.
- Only raise a warning on them if the jump from previous month is unusually large.
- When asked which category is highest, use the data above.
- For forward-looking advice, base it on current pace, shortfall, or surplus.
- Keep replies concise (2-4 sentences) unless detail is explicitly asked for.
- Use ₹ for amounts. Never make up data outside the snapshot.
- If the salary in the snapshot is 0 (or unset), state: "Since no salary has been set yet for the month, please add your monthly salary in the Settings page. Once configured, a suggested saving target of 30% is recommended."
"""


def _build_system_prompt(
    *,
    month: int,
    year: int,
    salary: float,
    total_spent: float,
    actually_saved: float,
    target_save_pct: int,
    days_elapsed: int,
    days_in_month: int,
    zone: str,
    saving_score: int | None,
    spend_score: int | None,
    category_totals: dict[str, float],
) -> str:
    target_save_amount = salary * target_save_pct / 100
    spend_pct = (total_spent / salary * 100) if salary else 0.0

    lines: list[str] = []
    for cat in CATEGORIES:
        amt = category_totals.get(cat, 0.0)
        if amt > 0:
            share = (amt / total_spent * 100) if total_spent else 0
            lines.append(f"  {cat:<12} ₹{amt:>10,.0f}   ({share:.1f}%)")
    category_breakdown = "\n".join(lines) if lines else "  No expenses recorded yet."

    return _SYSTEM_PROMPT.format(
        month_label=month_name[month],
        year=year,
        salary=salary,
        days_elapsed=days_elapsed,
        days_in_month=days_in_month,
        total_spent=total_spent,
        spend_pct=spend_pct,
        actually_saved=actually_saved,
        target_save_amount=target_save_amount,
        target_save_pct=target_save_pct,
        zone=zone,
        saving_score=saving_score if saving_score is not None else "N/A",
        spend_score=spend_score if spend_score is not None else "N/A",
        category_breakdown=category_breakdown,
    )


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, db: DbDep, current_user: UserDep) -> ChatResponse:
    now = datetime.now(tz=timezone.utc)
    month = req.month or now.month
    year = req.year or now.year

    exp_result = await db.execute(
        select(Expense).where(
            Expense.user_id == current_user.id,
            Expense.confirmed.is_(True),
            extract("month", Expense.expense_date) == month,
            extract("year", Expense.expense_date) == year,
        )
    )
    expenses = exp_result.scalars().all()

    category_totals: dict[str, float] = {cat: 0.0 for cat in CATEGORIES}
    for exp in expenses:
        cat = exp.category if exp.category in CATEGORIES else "Other"
        category_totals[cat] += float(exp.amount)
    total_spent = sum(category_totals.values())

    inc_result = await db.execute(
        select(func.sum(IncomeEvent.amount)).where(
            IncomeEvent.user_id == current_user.id,
            IncomeEvent.month == month,
            IncomeEvent.year == year,
        )
    )
    salary_val = inc_result.scalar()
    salary = float(salary_val) if salary_val is not None else 0.0
    actually_saved = max(0.0, salary - total_spent) if salary > 0.0 else 0.0

    zone_result = await db.execute(
        select(SpendInsight).where(
            SpendInsight.user_id == current_user.id,
            SpendInsight.month == month,
            SpendInsight.year == year,
        )
    )
    insight = zone_result.scalar_one_or_none()
    zone = insight.zone if insight else "SAFE"
    saving_score = insight.saving_score if insight else None
    spend_score = insight.spend_score if insight else None

    days_in_month = monthrange(year, month)[1]
    today = date.today()
    days_elapsed = today.day if (today.month == month and today.year == year) else days_in_month

    system_prompt = _build_system_prompt(
        month=month,
        year=year,
        salary=salary,
        total_spent=total_spent,
        actually_saved=actually_saved,
        target_save_pct=settings.saving_target_pct,
        days_elapsed=days_elapsed,
        days_in_month=days_in_month,
        zone=zone,
        saving_score=saving_score,
        spend_score=spend_score,
        category_totals=category_totals,
    )

    messages: list[dict[str, str]] = []
    for msg in req.history[-10:]:
        role = "model" if msg.role == "assistant" else "user"
        messages.append({"role": role, "content": msg.content})
    messages.append({"role": "user", "content": req.message})

    reply = generate_chat(messages, system_prompt)
    if not reply:
        reply = "I'm having trouble connecting right now. Please try again in a moment."

    return ChatResponse(reply=reply)
