import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_access_token, get_current_user, hash_password, verify_password
from app.database import get_db
from app.models import Bank, User
from app.schemas import Token, UserCreate, UserLogin, UserOut

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])
DbDep = Annotated[AsyncSession, Depends(get_db)]


DEFAULT_BANKS = ["HDFC", "SBI", "ICICI", "Axis", "Kotak"]


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(body: UserCreate, db: DbDep) -> Token:
    email_clean = body.email.strip().lower()
    if not email_clean or "@" not in email_clean:
        raise HTTPException(status_code=400, detail="Invalid email address.")

    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    # Check existing user
    result = await db.execute(select(User).where(User.email == email_clean))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    user = User(
        id=uuid.uuid4(),
        email=email_clean,
        hashed_password=hash_password(body.password),
        full_name=body.full_name.strip() if body.full_name else None,
    )

    try:
        db.add(user)
        # Seed default bank options for the user
        for bank_name in DEFAULT_BANKS:
            b_res = await db.execute(
                select(Bank).where(Bank.user_id == user.id, Bank.name == bank_name)
            )
            if not b_res.scalar_one_or_none():
                db.add(Bank(id=uuid.uuid4(), user_id=user.id, name=bank_name))
        await db.commit()
        await db.refresh(user)
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to register user: %s", exc)
        raise HTTPException(status_code=500, detail="Database error during registration.")

    access_token = create_access_token(user.id)
    return Token(access_token=access_token, user=UserOut.model_validate(user))


@router.post("/login", response_model=Token)
async def login(body: UserLogin, db: DbDep) -> Token:
    email_clean = body.email.strip().lower()
    result = await db.execute(select(User).where(User.email == email_clean))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )

    access_token = create_access_token(user.id)
    return Token(access_token=access_token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(current_user)
