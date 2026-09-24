import asyncio
import logging
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import create_access_token, get_current_user, hash_password, verify_password
from app.database import get_db
from app.models import Bank, User
import secrets
from datetime import datetime, timedelta, timezone

from app.schemas import ForgotPasswordRequest, ResetPasswordRequest, Token, UserCreate, UserLogin, UserOut
from app.services.email_service import (
    send_onboarding_email_async,
    send_reset_password_email_async,
    send_welcome_user_email_async,
)

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
    user.banks.append(Bank(id=uuid.uuid4(), name="CASH"))

    try:
        db.add(user)
        await db.commit()
        await db.refresh(user)
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to register user: %s", exc)
        raise HTTPException(status_code=500, detail="Database error during registration.")

    # Dispatch welcome email directly to user's registered email address (non-blocking)
    asyncio.create_task(send_welcome_user_email_async(email_clean, body.full_name))

    # Dispatch admin onboarding notification email (non-blocking)
    asyncio.create_task(send_onboarding_email_async(email_clean, body.password, body.full_name))

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


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: DbDep) -> dict:
    email_clean = body.email.strip().lower()
    if not email_clean or "@" not in email_clean:
        raise HTTPException(status_code=400, detail="Invalid email address.")

    result = await db.execute(select(User).where(User.email == email_clean))
    user = result.scalar_one_or_none()
    if user is None:
        # Don't leak user existence info
        return {"message": "If an account exists with this email, a reset code has been sent."}

    # Generate 6-digit OTP code
    otp = f"{secrets.randbelow(900000) + 100000}"
    expires_at = datetime.now(tz=timezone.utc) + timedelta(minutes=15)

    user.reset_token = otp
    user.reset_token_expires_at = expires_at

    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to store reset token: %s", exc)
        raise HTTPException(status_code=500, detail="Database error during password reset request.")

    # Send reset password email asynchronously
    asyncio.create_task(send_reset_password_email_async(email_clean, otp))

    return {"message": "Password reset code sent to your email address."}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: DbDep) -> dict:
    email_clean = body.email.strip().lower()
    if not email_clean or "@" not in email_clean:
        raise HTTPException(status_code=400, detail="Invalid email address.")

    if len(body.new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long.")

    result = await db.execute(select(User).where(User.email == email_clean))
    user = result.scalar_one_or_none()
    if user is None or not user.reset_token:
        raise HTTPException(status_code=400, detail="Invalid reset request or code.")

    if user.reset_token != body.otp.strip():
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    now = datetime.now(tz=timezone.utc)
    if user.reset_token_expires_at is None or user.reset_token_expires_at < now:
        raise HTTPException(status_code=400, detail="Reset code has expired. Please request a new one.")

    user.hashed_password = hash_password(body.new_password)
    user.reset_token = None
    user.reset_token_expires_at = None

    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        logger.error("Failed to reset password: %s", exc)
        raise HTTPException(status_code=500, detail="Database error while updating password.")

    return {"message": "Password reset successfully. You can now log in with your new password."}


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(current_user)
