import logging
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import get_db
from app.models import Expense, SavingsPlan, SpendInsight, User
from app.schemas import MonthlySummary, SavingsPlanOut, ZoneResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["insights"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
UserDep = Annotated[User, Depends(get_current_user)]


@router.post("/insights/refresh", response_model=ZoneResponse)
async def refresh_insights(db: DbDep, current_user: UserDep) -> ZoneResponse:
    """On-demand: recalculate zone + call Gemini for fresh narrative."""
    now = datetime.now(tz=timezone.utc)
    month, year = now.month, now.year

    from app.services.zone_calculator import recalculate_zone
    insight = await recalculate_zone(db, month, year, user_id=current_user.id, with_ai=True)

    if insight is None:
        raise HTTPException(status_code=500, detail="Failed to generate insights.")

    return ZoneResponse(
        zone=insight.zone,
        saving_score=insight.saving_score,
        spend_score=insight.spend_score,
        zone_score=insight.zone_score,
        narrative=insight.gemini_narrative,
        action_pills=insight.action_pills,
        category_data=insight.category_data,
        month=insight.month,
        year=insight.year,
    )


@router.get("/zone", response_model=ZoneResponse)
async def get_zone(db: DbDep, current_user: UserDep) -> ZoneResponse:
    now = datetime.now(tz=timezone.utc)
    month, year = now.month, now.year

    try:
        result = await db.execute(
            select(SpendInsight)
            .where(
                SpendInsight.user_id == current_user.id,
                SpendInsight.month == month,
                SpendInsight.year == year,
            )
            .order_by(SpendInsight.updated_at.desc())
            .limit(1)
        )
        insight = result.scalars().first()
    except Exception as exc:
        logger.error("DB error fetching zone: %s", exc)
        raise HTTPException(status_code=500, detail="Database error.")

    if insight is None:
        from app.services.zone_calculator import recalculate_zone
        insight = await recalculate_zone(db, month, year, user_id=current_user.id, with_ai=False)

    if insight is None:
        return ZoneResponse(
            zone="UNSET",
            saving_score=None,
            spend_score=None,
            zone_score=None,
            narrative="Yet to calculate: please set your monthly salary in Settings and log your expenses. Based on that, AI will check your financial status.",
            action_pills=["Set your salary in Settings", "Log your first expense"],
            category_data=None,
            month=month,
            year=year,
        )

    return ZoneResponse(
        zone=insight.zone,
        saving_score=insight.saving_score,
        spend_score=insight.spend_score,
        zone_score=insight.zone_score,
        narrative=insight.gemini_narrative,
        action_pills=insight.action_pills,
        category_data=insight.category_data,
        month=insight.month,
        year=insight.year,
    )


@router.get("/savings-plan", response_model=SavingsPlanOut | None)
async def get_savings_plan(month: int, year: int, db: DbDep, current_user: UserDep) -> SavingsPlanOut | None:
    try:
        result = await db.execute(
            select(SavingsPlan)
            .where(
                SavingsPlan.user_id == current_user.id,
                SavingsPlan.month == month,
                SavingsPlan.year == year,
            )
            .order_by(SavingsPlan.created_at.desc())
            .limit(1)
        )
        plan = result.scalar_one_or_none()
    except Exception as exc:
        logger.error("DB error fetching savings plan: %s", exc)
        raise HTTPException(status_code=500, detail="Database error.")

    return SavingsPlanOut.model_validate(plan) if plan else None


@router.get("/spend-insight", response_model=ZoneResponse | None)
async def get_spend_insight(month: int, year: int, db: DbDep, current_user: UserDep) -> ZoneResponse | None:
    try:
        result = await db.execute(
            select(SpendInsight)
            .where(
                SpendInsight.user_id == current_user.id,
                SpendInsight.month == month,
                SpendInsight.year == year,
            )
            .order_by(SpendInsight.updated_at.desc())
            .limit(1)
        )
        insight = result.scalars().first()
    except Exception as exc:
        logger.error("DB error fetching spend insight: %s", exc)
        raise HTTPException(status_code=500, detail="Database error.")

    if insight is None:
        return None

    return ZoneResponse(
        zone=insight.zone,
        saving_score=insight.saving_score,
        spend_score=insight.spend_score,
        zone_score=insight.zone_score,
        narrative=insight.gemini_narrative,
        action_pills=insight.action_pills,
        category_data=insight.category_data,
        month=insight.month,
        year=insight.year,
    )


@router.get("/insights/monthly-history", response_model=list[MonthlySummary])
async def get_monthly_history(db: DbDep, current_user: UserDep) -> list[MonthlySummary]:
    """Last 12 months of spending summary for current user."""
    try:
        result = await db.execute(
            select(SpendInsight)
            .where(SpendInsight.user_id == current_user.id)
            .order_by(SpendInsight.year.desc(), SpendInsight.month.desc())
            .limit(12)
        )
        insights = result.scalars().all()
    except Exception as exc:
        logger.error("DB error fetching monthly history: %s", exc)
        raise HTTPException(status_code=500, detail="Database error.")

    summaries = []
    for insight in insights:
        plan_result = await db.execute(
            select(SavingsPlan).where(
                SavingsPlan.user_id == current_user.id,
                SavingsPlan.month == insight.month,
                SavingsPlan.year == insight.year,
            ).limit(1)
        )
        plan = plan_result.scalar_one_or_none()

        spent_result = await db.execute(
            select(func.sum(Expense.amount)).where(
                Expense.user_id == current_user.id,
                Expense.confirmed.is_(True),
                extract("month", Expense.expense_date) == insight.month,
                extract("year", Expense.expense_date) == insight.year,
            )
        )
        total_spent = float(spent_result.scalar() or 0)
        salary = float(plan.salary_amount) if plan else 0

        summaries.append(MonthlySummary(
            month=insight.month,
            year=insight.year,
            month_label=datetime(insight.year, insight.month, 1).strftime("%b '%y"),
            total_spent=total_spent,
            salary=salary,
            total_saved=max(0.0, salary - total_spent),
            zone=insight.zone,
            saving_score=insight.saving_score,
            spend_score=insight.spend_score,
        ))

    return list(reversed(summaries))


INVESTMENT_REVIEW_PROMPT = """You are a personal financial advisor for an Indian salaried professional.
You receive anonymised investment statistics — no names, no raw transaction details, only aggregated numbers.

Respond ONLY with a valid JSON object matching this exact schema:
{
  "assessment": "GOOD" | "MODERATE" | "NEEDS_ATTENTION",
  "summary": "2-3 sentence plain English assessment. Be specific with numbers. Acknowledge month progress.",
  "allocation_review": "1-2 sentences on whether the planned instrument splits are appropriate for a salaried Indian professional.",
  "action_items": ["3-4 specific action strings, max 10 words each"],
  "priority_action": "The single most important action to take right now, max 12 words."
}

Guidelines:
- The KEY metric is explicitly_saved_in_instruments — money the user has ACTUALLY put into saving instruments (PPF, MF, SIP, etc.)
- Compare explicitly_saved_in_instruments vs pro_rata_target (target * days_elapsed / days_in_month)
- GOOD: explicitly_saved >= pro_rata_target
- MODERATE: explicitly_saved >= 70% of pro_rata_target
- NEEDS_ATTENTION: explicitly_saved < 70% of pro_rata_target
- Comment on whether the instrument-wise amounts match the planned_allocations breakdown
- Only suggest Indian instruments: Liquid MF, ELSS, PPF, RD, Index Fund, NPS, Gold ETF
- Be direct and specific, not preachy"""


@router.post("/insights/investment-review")
async def investment_review(month: int, year: int, db: DbDep, current_user: UserDep) -> dict:
    import calendar
    import json as json_mod
    from app.services.gemini_helper import generate as gemini_generate

    try:
        plan_result = await db.execute(
            select(SavingsPlan)
            .where(
                SavingsPlan.user_id == current_user.id,
                SavingsPlan.month == month,
                SavingsPlan.year == year,
            )
            .limit(1)
        )
        plan = plan_result.scalar_one_or_none()
    except Exception as exc:
        logger.error("DB error fetching plan for investment review: %s", exc)
        raise HTTPException(status_code=500, detail="Database error.")

    if not plan:
        raise HTTPException(status_code=404, detail="No savings plan found. Set your salary first.")

    try:
        spent_result = await db.execute(
            select(func.sum(Expense.amount)).where(
                Expense.user_id == current_user.id,
                Expense.confirmed.is_(True),
                extract("month", Expense.expense_date) == month,
                extract("year", Expense.expense_date) == year,
            )
        )
        total_spent = float(spent_result.scalar() or 0)

        saving_result = await db.execute(
            select(func.sum(Expense.amount)).where(
                Expense.user_id == current_user.id,
                Expense.confirmed.is_(True),
                Expense.category == "Saving",
                extract("month", Expense.expense_date) == month,
                extract("year", Expense.expense_date) == year,
            )
        )
        explicitly_saved = float(saving_result.scalar() or 0)
    except Exception as exc:
        logger.error("DB error fetching expenses for investment review: %s", exc)
        raise HTTPException(status_code=500, detail="Database error.")

    now = datetime.now(tz=timezone.utc)
    days_elapsed = now.day if (now.month == month and now.year == year) else calendar.monthrange(year, month)[1]
    days_in_month = calendar.monthrange(year, month)[1]
    salary = float(plan.salary_amount)
    target = float(plan.total_to_save)
    actual_saved = max(0.0, salary - total_spent)
    pro_rata_target = target * days_elapsed / days_in_month

    payload = {
        "month_progress_days": f"{days_elapsed} of {days_in_month}",
        "salary": salary,
        "target_save_pct": plan.target_save_pct,
        "target_save_amount": target,
        "pro_rata_target": round(pro_rata_target, 2),
        "actual_saved_so_far": round(actual_saved, 2),
        "explicitly_saved_in_instruments": round(explicitly_saved, 2),
        "shortfall_vs_prorata": round(max(0.0, pro_rata_target - actual_saved), 2),
        "planned_allocations": plan.allocations,
    }

    response_text = gemini_generate(json_mod.dumps(payload), INVESTMENT_REVIEW_PROMPT)
    if not response_text:
        return {
            "assessment": "MODERATE",
            "summary": "AI insight unavailable right now. Try again later.",
            "allocation_review": "",
            "action_items": [],
            "priority_action": "",
        }

    try:
        return json_mod.loads(response_text)
    except Exception:
        return {
            "assessment": "MODERATE",
            "summary": response_text[:300],
            "allocation_review": "",
            "action_items": [],
            "priority_action": "",
        }
