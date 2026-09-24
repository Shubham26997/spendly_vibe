import asyncio
import logging
import uuid
from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, extract, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import AsyncSessionLocal, get_db
from app.models import Bank, Expense, IncomeEvent, SavingsPlan, SpendInsight, User
from app.schemas import BankCreate, BankOut, MonthSettings, MonthSettingsOut
from app.services.zone_calculator import recalculate_zone

logger = logging.getLogger(__name__)
router = APIRouter(tags=["settings"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
UserDep = Annotated[User, Depends(get_current_user)]


async def _recalculate_zone_bg(month: int, year: int, user_id: uuid.UUID) -> None:
    async with AsyncSessionLocal() as db:
        try:
            await recalculate_zone(db, month, year, user_id=user_id, with_ai=False)
        except Exception as exc:
            logger.error("Zone recalculation failed: %s", exc)


@router.get("/settings", response_model=MonthSettingsOut)
async def get_settings(month: int, year: int, db: DbDep, current_user: UserDep) -> MonthSettingsOut:
    """Get current month settings for current user."""
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
        logger.error("DB error fetching settings: %s", exc)
        raise HTTPException(status_code=500, detail="Database error.")

    if plan:
        return MonthSettingsOut(
            salary=float(plan.salary_amount),
            save_pct=plan.target_save_pct,
            month=month,
            year=year,
            locked=True,
        )
    return MonthSettingsOut(month=month, year=year, locked=False)


@router.post("/settings", response_model=MonthSettingsOut)
async def save_settings(body: MonthSettings, db: DbDep, current_user: UserDep) -> MonthSettingsOut:
    """Lock salary + save % for a month for current user."""
    try:
        result = await db.execute(
            select(SavingsPlan)
            .where(
                SavingsPlan.user_id == current_user.id,
                SavingsPlan.month == body.month,
                SavingsPlan.year == body.year,
            )
            .limit(1)
        )
        existing = result.scalar_one_or_none()
    except Exception as exc:
        logger.error("DB error checking settings lock: %s", exc)
        raise HTTPException(status_code=500, detail="Database error.")

    if existing:
        raise HTTPException(
            status_code=409,
            detail="Settings are already locked for this month. Restart the month to change.",
        )

    income = IncomeEvent(
        id=uuid.uuid4(),
        user=current_user,
        amount=Decimal(str(body.salary)),
        source_name="salary",
        month=body.month,
        year=body.year,
    )
    db.add(income)

    total_to_save = float(body.salary * body.save_pct / 100)
    allocs = [
        {"instrument": "Liquid MF", "amount": round(total_to_save * 0.4, 2), "rationale": "Emergency buffer"},
        {"instrument": "Index Fund", "amount": round(total_to_save * 0.4, 2), "rationale": "Long-term growth"},
        {"instrument": "PPF", "amount": round(total_to_save * 0.2, 2), "rationale": "Tax saving"},
    ]
    plan = SavingsPlan(
        id=uuid.uuid4(),
        user=current_user,
        month=body.month,
        year=body.year,
        salary_amount=Decimal(str(body.salary)),
        target_save_pct=body.save_pct,
        allocations=allocs,
        total_to_save=Decimal(str(total_to_save)),
    )
    db.add(plan)

    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to save settings: %s", exc)
        raise HTTPException(status_code=500, detail="Database error saving settings.")

    asyncio.create_task(_recalculate_zone_bg(body.month, body.year, current_user.id))

    return MonthSettingsOut(
        salary=body.salary,
        save_pct=body.save_pct,
        month=body.month,
        year=body.year,
        locked=True,
    )


@router.patch("/settings", response_model=MonthSettingsOut)
async def update_settings(body: MonthSettings, db: DbDep, current_user: UserDep) -> MonthSettingsOut:
    """Update salary + save % for a month for current user."""
    try:
        result = await db.execute(
            select(SavingsPlan)
            .where(
                SavingsPlan.user_id == current_user.id,
                SavingsPlan.month == body.month,
                SavingsPlan.year == body.year,
            )
            .limit(1)
        )
        plan = result.scalar_one_or_none()
    except Exception as exc:
        logger.error("DB error checking settings: %s", exc)
        raise HTTPException(status_code=500, detail="Database error.")

    if not plan:
        raise HTTPException(
            status_code=404,
            detail="Settings not initialized for this month yet. Save first.",
        )

    try:
        result_income = await db.execute(
            select(IncomeEvent)
            .where(
                IncomeEvent.user_id == current_user.id,
                IncomeEvent.month == body.month,
                IncomeEvent.year == body.year,
                IncomeEvent.source_name == "salary",
            )
            .limit(1)
        )
        income = result_income.scalar_one_or_none()
    except Exception as exc:
        logger.error("DB error fetching salary income: %s", exc)
        raise HTTPException(status_code=500, detail="Database error.")

    if income:
        income.amount = Decimal(str(body.salary))
    else:
        income = IncomeEvent(
            id=uuid.uuid4(),
            user=current_user,
            amount=Decimal(str(body.salary)),
            source_name="salary",
            month=body.month,
            year=body.year,
        )
        db.add(income)

    total_to_save = float(body.salary * body.save_pct / 100)
    allocs = [
        {"instrument": "Liquid MF", "amount": round(total_to_save * 0.4, 2), "rationale": "Emergency buffer"},
        {"instrument": "Index Fund", "amount": round(total_to_save * 0.4, 2), "rationale": "Long-term growth"},
        {"instrument": "PPF", "amount": round(total_to_save * 0.2, 2), "rationale": "Tax saving"},
    ]
    plan.salary_amount = Decimal(str(body.salary))
    plan.target_save_pct = body.save_pct
    plan.allocations = allocs
    plan.total_to_save = Decimal(str(total_to_save))

    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to update settings: %s", exc)
        raise HTTPException(status_code=500, detail="Database error updating settings.")

    asyncio.create_task(_recalculate_zone_bg(body.month, body.year, current_user.id))

    return MonthSettingsOut(
        salary=body.salary,
        save_pct=body.save_pct,
        month=body.month,
        year=body.year,
        locked=True,
    )


@router.delete("/settings/restart")
async def restart_month(month: int, year: int, db: DbDep, current_user: UserDep) -> dict:
    """Delete ALL data for a month for current user."""
    try:
        await db.execute(
            delete(Expense).where(
                Expense.user_id == current_user.id,
                extract("month", Expense.expense_date) == month,
                extract("year", Expense.expense_date) == year,
            )
        )
        await db.execute(
            delete(IncomeEvent).where(
                IncomeEvent.user_id == current_user.id,
                IncomeEvent.month == month,
                IncomeEvent.year == year,
            )
        )
        await db.execute(
            delete(SavingsPlan).where(
                SavingsPlan.user_id == current_user.id,
                SavingsPlan.month == month,
                SavingsPlan.year == year,
            )
        )
        await db.execute(
            delete(SpendInsight).where(
                SpendInsight.user_id == current_user.id,
                SpendInsight.month == month,
                SpendInsight.year == year,
            )
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to restart month: %s", exc)
        raise HTTPException(status_code=500, detail="Database error during restart.")

    return {"status": "restarted", "month": month, "year": year}


@router.get("/settings/banks", response_model=list[BankOut])
async def list_banks(db: DbDep, current_user: UserDep) -> list[BankOut]:
    try:
        result = await db.execute(
            select(Bank)
            .where((Bank.user_id == current_user.id) | (Bank.user_id.is_(None)))
            .order_by(Bank.name)
        )
        banks = result.scalars().all()
    except Exception as exc:
        logger.error("DB error listing banks: %s", exc)
        raise HTTPException(status_code=500, detail="Database error.")
    return [BankOut.model_validate(b) for b in banks]


@router.post("/settings/banks", response_model=BankOut, status_code=201)
async def create_bank(body: BankCreate, db: DbDep, current_user: UserDep) -> BankOut:
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Bank name cannot be empty.")

    try:
        result = await db.execute(
            select(Bank).where(
                Bank.user_id == current_user.id,
                func.lower(Bank.name) == name.lower(),
            )
        )
        existing = result.scalar_one_or_none()
    except Exception as exc:
        logger.error("DB error checking bank uniqueness: %s", exc)
        raise HTTPException(status_code=500, detail="Database error.")

    if existing:
        raise HTTPException(status_code=409, detail="Bank already exists.")

    bank = Bank(id=uuid.uuid4(), user=current_user, name=name)
    db.add(bank)
    try:
        await db.commit()
        await db.refresh(bank)
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to save bank: %s", exc)
        raise HTTPException(status_code=500, detail="Database error saving bank.")

    return BankOut.model_validate(bank)


@router.delete("/settings/banks/{bank_id}")
async def delete_bank(bank_id: uuid.UUID, db: DbDep, current_user: UserDep) -> dict:
    try:
        result = await db.execute(
            select(Bank).where(Bank.id == bank_id, Bank.user_id == current_user.id)
        )
        bank = result.scalar_one_or_none()
    except Exception as exc:
        logger.error("DB error fetching bank: %s", exc)
        raise HTTPException(status_code=500, detail="Database error.")

    if bank is None:
        raise HTTPException(status_code=404, detail="Bank not found.")

    try:
        await db.delete(bank)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to delete bank: %s", exc)
        raise HTTPException(status_code=500, detail="Database error deleting bank.")

    return {"status": "deleted", "bank_id": str(bank_id)}
