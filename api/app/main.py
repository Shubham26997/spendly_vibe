import logging
from contextlib import asynccontextmanager
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

from app.config import settings
from app.database import AsyncSessionLocal, Base, engine
from app.models import User
from app.routers import auth, chat, expense, income, insights, settings_router
from app.services.zone_calculator import recalculate_zone

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)

IST = ZoneInfo("Asia/Kolkata")
scheduler = AsyncIOScheduler(timezone=IST)

ZONE_EMOJI = {"SAFE": "🟢", "WARNING": "🟡", "DANGER": "🔴"}
MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


async def _send_telegram(message: str) -> None:
    token = settings.telegram_token
    chat_id = settings.telegram_chat_id
    if not token or not chat_id:
        logger.warning("Telegram push skipped — TELEGRAM_TOKEN or TELEGRAM_CHAT_ID not set.")
        return
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(url, json={"chat_id": chat_id, "text": message, "parse_mode": "HTML"})
            if r.status_code != 200:
                logger.error("Telegram push failed: %s", r.text)
            else:
                logger.info("Telegram daily insight pushed successfully.")
    except Exception as exc:
        logger.error("Telegram push error: %s", exc)


def _format_insight_message(zone_data: dict, month: int, year: int) -> str:
    zone = zone_data.get("zone", "SAFE")
    emoji = ZONE_EMOJI.get(zone, "⚪")
    saving_score = zone_data.get("saving_score")
    spend_score = zone_data.get("spend_score")
    narrative = zone_data.get("narrative") or ""
    action_pills = zone_data.get("action_pills") or []

    lines = [
        f"📊 <b>Daily Insights — {MONTH_NAMES[month]} {year}</b>",
        "",
        f"Zone: {emoji} <b>{zone}</b>",
    ]
    if saving_score is not None and spend_score is not None:
        lines.append(f"Save score: <b>{saving_score}</b>  ·  Spend score: <b>{spend_score}</b>")
    if narrative:
        lines += ["", narrative[:400]]
    if action_pills:
        lines += ["", "💡 <b>Action items:</b>"]
        for pill in action_pills[:4]:
            lines.append(f"  • {pill}")
    return "\n".join(lines)


async def _daily_ai_insights() -> None:
    now = datetime.now(tz=IST)
    logger.info("Daily AI insights job starting for %d/%d (IST)…", now.month, now.year)

    async with AsyncSessionLocal() as db:
        users_res = await db.execute(select(User))
        users = users_res.scalars().all()
        for user in users:
            zone_data = await recalculate_zone(db, now.month, now.year, user_id=user.id, with_ai=True)
            if zone_data:
                payload = {
                    "zone": zone_data.zone,
                    "saving_score": zone_data.saving_score,
                    "spend_score": zone_data.spend_score,
                    "narrative": zone_data.gemini_narrative,
                    "action_pills": zone_data.action_pills or [],
                }
                msg = _format_insight_message(payload, now.month, now.year)
                await _send_telegram(msg)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Spendly API starting up…")

    # Fast zone calc on boot for all users

    now = datetime.now(tz=IST)
    async with AsyncSessionLocal() as db:
        users_res = await db.execute(select(User))
        users = users_res.scalars().all()
        for user in users:
            await recalculate_zone(db, now.month, now.year, user_id=user.id, with_ai=False)

    scheduler.add_job(_daily_ai_insights, "cron", hour=21, minute=0, id="daily_insights")
    scheduler.start()
    logger.info("APScheduler started — daily insights job scheduled at 21:00 IST.")

    yield

    scheduler.shutdown(wait=False)
    logger.info("Spendly API shutting down.")


app = FastAPI(
    title="Spendly API",
    version="1.0.0",
    description="Personal expense tracker — Spendly",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(expense.router)
app.include_router(income.router)
app.include_router(insights.router)
app.include_router(settings_router.router)
app.include_router(chat.router)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
