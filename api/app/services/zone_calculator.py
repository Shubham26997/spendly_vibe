"""
zone_calculator.py — orchestrates zone recalculation.

Pulls data from DB, runs deterministic zone.py functions,
calls advisor.py for narrative, upserts SpendInsight row.
"""
import logging
import uuid
from calendar import monthrange
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Expense, IncomeEvent, SpendInsight
from app.services import advisor as advisor_svc
from app.services import zone as zone_svc
from app.services.categoriser import CATEGORIES

logger = logging.getLogger(__name__)

# Gemini cooldown: don't call advisor more than once per 60 seconds per month-year
_last_gemini_call: dict[tuple[int, int], datetime] = {}
GEMINI_COOLDOWN_SECONDS = 60



async def recalculate_zone(
    db: AsyncSession,
    month: int,
    year: int,
    *,
    user_id: Optional[uuid.UUID] = None,
    with_ai: bool = True,
) -> Optional[SpendInsight]:
    """
    Recalculates zone for the given month/year and user_id, and upserts SpendInsight.

    with_ai=True  → also calls Gemini for narrative/action pills (on-demand / daily job).
    with_ai=False → deterministic math only, no Gemini (called on every expense confirm).
    """
    try:
        if user_id is None:
            # Fallback to default user if not passed
            from app.models import User
            res = await db.execute(select(User.id).order_by(User.created_at.asc()).limit(1))
            u_id = res.scalar_one_or_none()
            if u_id is None:
                logger.warning("No user found for zone calculation.")
                return None
            user_id = u_id

        # 1. Fetch confirmed expenses for the month for user
        result = await db.execute(
            select(Expense)
            .where(
                Expense.user_id == user_id,
                Expense.confirmed.is_(True),
                extract("month", Expense.expense_date) == month,
                extract("year", Expense.expense_date) == year,
            )
        )
        expenses = result.scalars().all()

        # 2. Fetch income for the month for user
        income_result = await db.execute(
            select(func.sum(IncomeEvent.amount)).where(
                IncomeEvent.user_id == user_id,
                IncomeEvent.month == month,
                IncomeEvent.year == year,
            )
        )
        salary_val = income_result.scalar()
        salary = float(salary_val) if salary_val is not None else 0.0

        # 3. Aggregate spend by category
        category_totals: dict[str, float] = {cat: 0.0 for cat in CATEGORIES}
        for exp in expenses:
            cat = exp.category if exp.category in CATEGORIES else "Other"
            category_totals[cat] += float(exp.amount)

        # 4. Build category_data (spend only — no per-category budgets)
        category_data = {
            cat: {"spent": category_totals[cat]}
            for cat in CATEGORIES
        }

        # 5. Days elapsed in month
        days_in_month = monthrange(year, month)[1]
        today = date.today()
        if today.month == month and today.year == year:
            days_elapsed = today.day
        else:
            days_elapsed = days_in_month

        # 6. Calculate saving score and spend score
        # Non-saving spending is actual daily expenditure burn
        non_saving_spent = sum(v for cat, v in category_totals.items() if cat != "Saving")
        saving_spent = category_totals.get("Saving", 0.0)

        # "actually saved" = explicit savings logged OR remaining balance (salary - total_spent)
        total_spent = sum(category_totals.values())
        actually_saved = max(saving_spent, max(0.0, salary - total_spent))

        saving_score = zone_svc.calculate_saving_score(
            salary=salary,
            actually_saved=actually_saved,
            target_pct=settings.saving_target_pct,
        )
        spend_score = zone_svc.calculate_spend_score(
            total_spent=non_saving_spent,  # Exclude Saving category transfers from expenditure burn!
            salary=salary,
            target_save_pct=settings.saving_target_pct,
            days_elapsed=days_elapsed,
            days_in_month=days_in_month,
        )
        zone = zone_svc.determine_zone(saving_score, spend_score)
        zone_score = zone_svc.compute_zone_score(saving_score, spend_score)

        # 7. Generate Gemini narrative — only when explicitly requested
        now_utc = datetime.now(tz=timezone.utc)
        if with_ai:
            advice = advisor_svc.generate_advice(
                zone=zone,
                saving_score=saving_score,
                spend_score=spend_score,
                salary=salary,
                target_save_pct=settings.saving_target_pct,
                actually_saved=actually_saved,
                days_elapsed=days_elapsed,
                days_in_month=days_in_month,
                category_totals={cat: v for cat, v in category_totals.items() if v > 0},
            )
        else:
            logger.info("Gemini advisor skipped (with_ai=False)")
            advice = None  # Keep existing narrative in DB

        # 10. Upsert SpendInsight
        si_result = await db.execute(
            select(SpendInsight).where(
                SpendInsight.user_id == user_id,
                SpendInsight.month == month,
                SpendInsight.year == year,
            )
        )
        insight = si_result.scalar_one_or_none()

        if insight is None:
            insight = SpendInsight(id=uuid.uuid4(), user_id=user_id, month=month, year=year)
            db.add(insight)

        insight.zone = zone
        insight.zone_score = zone_score
        insight.saving_score = saving_score
        insight.spend_score = spend_score
        insight.category_data = category_data
        if advice is not None:
            insight.action_pills = advice.action_pills
            insight.gemini_narrative = advice.narrative
        insight.updated_at = now_utc

        await db.commit()
        await db.refresh(insight)
        logger.info("Zone recalculated for user %s, %d/%d → %s (saving=%d, spend=%d)", user_id, month, year, zone, saving_score, spend_score)
        return insight

    except Exception as exc:
        await db.rollback()
        logger.error("Zone recalculation error: %s", exc)
        return None

