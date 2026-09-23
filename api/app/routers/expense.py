import asyncio
import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_current_user
from app.database import AsyncSessionLocal, get_db
from app.models import Bank, Expense, User
from app.schemas import ExpenseConfirmed, ExpenseCreate, ExpenseOut, ExpensePending, ExpenseUpdate
from app.services import bank_matcher, categoriser, parser
from app.services.zone_calculator import recalculate_zone

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/expense", tags=["expenses"])

DbDep = Annotated[AsyncSession, Depends(get_db)]
UserDep = Annotated[User, Depends(get_current_user)]


async def _recalculate_zone_bg(month: int, year: int, user_id: uuid.UUID) -> None:
    """Background task: fast zone score recalc (no Gemini)."""
    async with AsyncSessionLocal() as db:
        try:
            await recalculate_zone(db, month, year, user_id=user_id, with_ai=False)
        except Exception as exc:
            logger.error("Zone recalculation failed: %s", exc)


@router.post("", response_model=None)
async def create_expense(body: ExpenseCreate, db: DbDep, current_user: UserDep) -> dict:
    from app.schemas import ParsedExpense

    entries = parser.parse_multi(body.raw_text)
    if not entries:
        return {
            "status": "parse_failed",
            "message": "Could not understand. Try: 'spent 350 on auto' or '500 food, 200 auto'",
        }

    banks_result = await db.execute(
        select(Bank).where((Bank.user_id == current_user.id) | (Bank.user_id.is_(None)))
    )
    bank_map = {b.name: b.id for b in banks_result.scalars().all()}

    # ── Single expense: keep pending_confirmation flow ──
    if len(entries) == 1:
        parsed = entries[0]
        category = categoriser.categorise(parsed.description)
        bank_id = bank_matcher.match_bank(parsed.raw_segment, bank_map)
        description = bank_matcher.strip_bank_names(parsed.description, bank_map) or parsed.description
        expense = Expense(
            id=uuid.uuid4(),
            user_id=current_user.id,
            amount=parsed.amount,
            description=description,
            category=category,
            source=body.source,
            expense_date=parsed.entry_date,
            confirmed=False,
            bank_id=bank_id,
        )
        try:
            db.add(expense)
            await db.commit()
            await db.refresh(expense)
        except Exception as exc:
            await db.rollback()
            logger.error("Failed to insert expense: %s", exc)
            raise HTTPException(status_code=500, detail="Database error saving expense.")

        return {
            "status": "pending_confirmation",
            "expense_id": str(expense.id),
            "parsed": ParsedExpense(
                amount=float(expense.amount),
                description=expense.description,
                expense_date=expense.expense_date,
                category=expense.category,
            ).model_dump(),
            "category": category,
        }

    # ── Multi-expense ─────────────────────────────────────────────────────────
    is_telegram = body.source == "telegram"
    items = []
    recalc_month = entries[0].entry_date.month
    recalc_year = entries[0].entry_date.year
    try:
        for parsed in entries:
            category = categoriser.categorise(parsed.description)
            bank_id = bank_matcher.match_bank(parsed.raw_segment, bank_map)
            description = bank_matcher.strip_bank_names(parsed.description, bank_map) or parsed.description
            expense = Expense(
                id=uuid.uuid4(),
                user_id=current_user.id,
                amount=parsed.amount,
                description=description,
                category=category,
                source=body.source,
                expense_date=parsed.entry_date,
                confirmed=not is_telegram,
                bank_id=bank_id,
            )
            db.add(expense)
            items.append({
                "expense_id": str(expense.id),
                "amount": parsed.amount,
                "description": description,
                "category": category,
                "expense_date": parsed.entry_date.isoformat(),
            })
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to insert multi-expenses: %s", exc)
        raise HTTPException(status_code=500, detail="Database error saving expenses.")

    if is_telegram:
        return {
            "status": "multi_pending",
            "count": len(items),
            "items": items,
        }

    asyncio.create_task(_recalculate_zone_bg(recalc_month, recalc_year, current_user.id))

    return {
        "status": "multi_confirmed",
        "count": len(items),
        "items": items,
    }


@router.post("/{expense_id}/confirm", response_model=ExpenseConfirmed)
async def confirm_expense(expense_id: uuid.UUID, db: DbDep, current_user: UserDep) -> ExpenseConfirmed:
    try:
        result = await db.execute(
            select(Expense).where(Expense.id == expense_id, Expense.user_id == current_user.id)
        )
        expense = result.scalar_one_or_none()
    except Exception as exc:
        logger.error("DB error fetching expense: %s", exc)
        raise HTTPException(status_code=500, detail="Database error.")

    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found.")

    expense.confirmed = True
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to confirm expense: %s", exc)
        raise HTTPException(status_code=500, detail="Database error confirming expense.")

    asyncio.create_task(_recalculate_zone_bg(expense.expense_date.month, expense.expense_date.year, current_user.id))

    return ExpenseConfirmed(status="confirmed", expense_id=expense_id)


@router.patch("/{expense_id}", response_model=ExpenseOut)
async def update_expense(
    expense_id: uuid.UUID, body: ExpenseUpdate, db: DbDep, current_user: UserDep
) -> ExpenseOut:
    """Update description and/or category of an existing expense."""
    try:
        result = await db.execute(
            select(Expense).where(Expense.id == expense_id, Expense.user_id == current_user.id)
        )
        expense = result.scalar_one_or_none()
    except Exception as exc:
        logger.error("DB error fetching expense: %s", exc)
        raise HTTPException(status_code=500, detail="Database error.")

    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found.")

    if body.description is not None:
        expense.description = body.description
    if body.category is not None:
        expense.category = body.category
    if "bank_id" in body.model_fields_set:
        if body.bank_id is not None:
            bank_result = await db.execute(
                select(Bank).where(
                    Bank.id == body.bank_id,
                    (Bank.user_id == current_user.id) | (Bank.user_id.is_(None)),
                )
            )
            if bank_result.scalar_one_or_none() is None:
                raise HTTPException(status_code=404, detail="Bank not found.")
        expense.bank_id = body.bank_id

    try:
        await db.commit()
        await db.refresh(expense)
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to update expense: %s", exc)
        raise HTTPException(status_code=500, detail="Database error updating expense.")

    asyncio.create_task(_recalculate_zone_bg(expense.expense_date.month, expense.expense_date.year, current_user.id))

    return ExpenseOut.model_validate(expense)


@router.post("/confirm-bulk")
async def confirm_bulk(expense_ids: list[str], db: DbDep, current_user: UserDep) -> dict:
    """Confirm multiple pending expenses at once."""
    confirmed = []
    try:
        for eid in expense_ids:
            result = await db.execute(
                select(Expense).where(Expense.id == uuid.UUID(eid), Expense.user_id == current_user.id)
            )
            expense = result.scalar_one_or_none()
            if expense:
                expense.confirmed = True
                confirmed.append(eid)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Bulk confirm failed: %s", exc)
        raise HTTPException(status_code=500, detail="Database error.")

    if confirmed:
        from datetime import date as _date
        today = _date.today()
        asyncio.create_task(_recalculate_zone_bg(today.month, today.year, current_user.id))

    return {"status": "confirmed", "count": len(confirmed)}


@router.delete("/bulk")
async def delete_bulk(expense_ids: list[str], db: DbDep, current_user: UserDep) -> dict:
    """Delete multiple unconfirmed expenses."""
    deleted = 0
    try:
        for eid in expense_ids:
            result = await db.execute(
                select(Expense).where(Expense.id == uuid.UUID(eid), Expense.user_id == current_user.id)
            )
            expense = result.scalar_one_or_none()
            if expense:
                await db.delete(expense)
                deleted += 1
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Bulk delete failed: %s", exc)
        raise HTTPException(status_code=500, detail="Database error.")

    return {"status": "deleted", "count": deleted}


@router.delete("/{expense_id}")
async def delete_expense(expense_id: uuid.UUID, db: DbDep, current_user: UserDep) -> dict:
    try:
        result = await db.execute(
            select(Expense).where(Expense.id == expense_id, Expense.user_id == current_user.id)
        )
        expense = result.scalar_one_or_none()
    except Exception as exc:
        logger.error("DB error fetching expense: %s", exc)
        raise HTTPException(status_code=500, detail="Database error.")

    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found.")

    try:
        await db.delete(expense)
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to delete expense: %s", exc)
        raise HTTPException(status_code=500, detail="Database error deleting expense.")

    asyncio.create_task(_recalculate_zone_bg(expense.expense_date.month, expense.expense_date.year, current_user.id))

    return {"status": "deleted", "expense_id": str(expense_id)}


@router.get("s/recent", response_model=list[ExpenseOut])
async def recent_expenses(db: DbDep, current_user: UserDep, limit: int = 5) -> list[ExpenseOut]:
    """Most recent confirmed expenses across all months for current user."""
    try:
        result = await db.execute(
            select(Expense)
            .where(Expense.user_id == current_user.id, Expense.confirmed.is_(True))
            .order_by(Expense.created_at.desc())
            .limit(limit)
        )
        expenses = result.scalars().all()
    except Exception as exc:
        logger.error("DB error listing recent expenses: %s", exc)
        raise HTTPException(status_code=500, detail="Database error.")
    return [ExpenseOut.model_validate(e) for e in expenses]


@router.get("s", response_model=list[ExpenseOut])
async def list_expenses(
    db: DbDep,
    current_user: UserDep,
    month: int | None = None,
    year: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> list[ExpenseOut]:
    from datetime import date as date_type
    from sqlalchemy import extract
    try:
        stmt = select(Expense).where(Expense.user_id == current_user.id, Expense.confirmed.is_(True))
        if date_from:
            try:
                df = date_type.fromisoformat(date_from)
                stmt = stmt.where(Expense.expense_date >= df)
            except ValueError:
                pass
        if date_to:
            try:
                dt = date_type.fromisoformat(date_to)
                stmt = stmt.where(Expense.expense_date <= dt)
            except ValueError:
                pass
        if not date_from and not date_to:
            if month is not None:
                stmt = stmt.where(extract("month", Expense.expense_date) == month)
            if year is not None:
                stmt = stmt.where(extract("year", Expense.expense_date) == year)

        stmt = stmt.order_by(Expense.expense_date.desc(), Expense.created_at.desc())
        result = await db.execute(stmt)
        expenses = result.scalars().all()
    except Exception as exc:
        logger.error("DB error listing expenses: %s", exc)
        raise HTTPException(status_code=500, detail="Database error.")

    return [ExpenseOut.model_validate(e) for e in expenses]
