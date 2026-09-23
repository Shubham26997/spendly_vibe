"""
Spendly Telegram Bot — long polling mode.
"""
import logging
import os
import re
import secrets

import httpx
from dotenv import load_dotenv
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.error import BadRequest
from telegram.ext import (
    Application,
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters,
)

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-8s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)

TELEGRAM_TOKEN = os.environ["TELEGRAM_TOKEN"]
API_BASE_URL = os.environ.get("API_BASE_URL", "http://api:8000")

INCOME_KEYWORDS = re.compile(r"\b(salary|credited|received|income|credit)\b", re.IGNORECASE)
EXPENSE_KEYWORDS = re.compile(r"\b(spent|paid|bought|purchased|spend)\b|\d+", re.IGNORECASE)

CATEGORIES = ["Food", "Grocery", "Travel", "Family", "EMI", "Saving", "Luxury", "Health", "House", "Other"]

ZONE_EMOJI = {"SAFE": "🟢", "WARNING": "🟡", "DANGER": "🔴"}

# Dedup guard for confirm callbacks
_confirming: set[str] = set()

# State key stored in context.user_data when awaiting a description edit reply
PENDING_EDIT_KEY = "pending_desc_edit"  # value: expense_id

# Stores multi-expense ID lists by short token (avoids Telegram 64-byte callback_data limit)
_multi_pending: dict[str, list[str]] = {}


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _safe_edit(query, text: str, **kwargs) -> None:
    try:
        await query.edit_message_text(text, **kwargs)
    except BadRequest as e:
        if "not modified" not in str(e).lower():
            raise


def _zone_line(zone_data: dict) -> str:
    zone = zone_data.get("zone", "SAFE")
    emoji = ZONE_EMOJI.get(zone, "⚪")
    return f"Zone: {emoji} {zone}"


async def _get_zone() -> dict | None:
    try:
        async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=10) as client:
            r = await client.get("/zone")
            if r.status_code == 200:
                return r.json()
    except Exception as exc:
        logger.error("Failed to fetch zone: %s", exc)
    return None


async def _get_recent_expenses(limit: int = 5) -> list[dict]:
    try:
        async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=10) as client:
            r = await client.get("/expenses/recent", params={"limit": limit})
            if r.status_code == 200:
                return r.json()
    except Exception as exc:
        logger.error("Failed to fetch recent expenses: %s", exc)
    return []


# ── Command handlers ──────────────────────────────────────────────────────────

async def handle_chatid(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    chat_id = update.effective_chat.id
    await update.message.reply_text(
        f"Your Chat ID is: <code>{chat_id}</code>\n\n"
        f"Add to <b>.env</b>:\n<code>TELEGRAM_CHAT_ID={chat_id}</code>",
        parse_mode="HTML",
    )


async def handle_edit_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Show the last 5 confirmed expenses as inline buttons to pick one for editing."""
    expenses = await _get_recent_expenses(5)
    if not expenses:
        await update.message.reply_text("No recent expenses found to edit.")
        return

    buttons = []
    for e in expenses:
        label = f"₹{e['amount']:,.0f} {e['description']} [{e['category']}] {e['expense_date']}"
        buttons.append([InlineKeyboardButton(label, callback_data=f"edit_pick:{e['id']}")])

    await update.message.reply_text(
        "Select an entry to edit:",
        reply_markup=InlineKeyboardMarkup(buttons),
    )


# ── Message handler ───────────────────────────────────────────────────────────

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    text = update.message.text or ""

    # If we're waiting for a description edit reply, handle it here
    pending_id = context.user_data.get(PENDING_EDIT_KEY)
    if pending_id:
        del context.user_data[PENDING_EDIT_KEY]
        await _apply_description_edit(update, pending_id, text.strip())
        return

    if INCOME_KEYWORDS.search(text):
        await _handle_income(update, text)
        return

    if EXPENSE_KEYWORDS.search(text):
        await _handle_expense(update, text)
        return

    await update.message.reply_text(
        "Send me an expense like 'spent 480 swiggy dinner' or 'salary 95000 credited'\n"
        "Use /edit to fix a logged entry."
    )


async def _apply_description_edit(update: Update, expense_id: str, new_desc: str) -> None:
    if not new_desc:
        await update.message.reply_text("Description cannot be empty. Edit cancelled.")
        return
    try:
        async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=10) as client:
            r = await client.patch(f"/expense/{expense_id}", json={"description": new_desc})
        if r.status_code == 200:
            updated = r.json()
            await update.message.reply_text(
                f"✅ Description updated.\n"
                f"₹{updated['amount']:,.0f} · {updated['category']} · {updated['description']}"
            )
        else:
            await update.message.reply_text("Failed to update. Please try again.")
    except Exception as exc:
        logger.error("Description edit error: %s", exc)
        await update.message.reply_text("Server error. Please try again.")


# ── Income ────────────────────────────────────────────────────────────────────

async def _handle_income(update: Update, text: str) -> None:
    try:
        async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=30) as client:
            r = await client.post("/income", json={"raw_text": text})
    except Exception as exc:
        logger.error("Income API error: %s", exc)
        await update.message.reply_text("Could not connect to server. Please try again.")
        return

    if r.status_code not in (200, 201):
        await update.message.reply_text(
            "Couldn't parse that as income. Try: 'salary 95000 credited'"
        )
        return

    data = r.json()
    income = data.get("income", {})
    plan = data.get("savings_plan")

    msg = f"✅ Salary of ₹{income.get('amount', '?'):,.0f} logged."
    if plan:
        msg += f"\n\n💰 Save target: ₹{plan.get('total_to_save', 0):,.0f} ({plan.get('target_save_pct', 0)}%)"
        narrative = plan.get("gemini_narrative", "")
        if narrative:
            msg += f"\n{narrative[:250]}"

    await update.message.reply_text(msg)


# ── Single expense ────────────────────────────────────────────────────────────

async def _handle_expense(update: Update, text: str) -> None:
    try:
        async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=30) as client:
            r = await client.post("/expense", json={"raw_text": text, "source": "telegram"})
    except Exception as exc:
        logger.error("Expense API error: %s", exc)
        await update.message.reply_text("Could not connect to server. Please try again.")
        return

    data = r.json()
    status = data.get("status")

    if status == "parse_failed":
        await update.message.reply_text(
            data.get("message") or "Couldn't parse that. Try: 'spent 350 on auto'"
        )
        return

    # ── Single expense: show confirm keyboard ─────────────────────────────────
    if status == "pending_confirmation":
        expense_id = data.get("expense_id")
        parsed = data.get("parsed", {})
        category = data.get("category", "Other")
        amount = parsed.get("amount", "?")
        description = parsed.get("description", "")

        keyboard = InlineKeyboardMarkup([[
            InlineKeyboardButton("✅ Confirm", callback_data=f"confirm:{expense_id}"),
            InlineKeyboardButton("✏️ Edit category", callback_data=f"edit:{expense_id}"),
            InlineKeyboardButton("❌ Cancel", callback_data=f"cancel:{expense_id}"),
        ]])
        await update.message.reply_text(
            f"₹{amount:,.0f} · <b>{category}</b> · {description}\n\nLogged correctly?",
            parse_mode="HTML",
            reply_markup=keyboard,
        )
        return

    # ── Multi expense: show summary + Confirm All / Cancel All ────────────────
    if status == "multi_pending":
        items = data.get("items", [])
        token = secrets.token_hex(6)  # 12 chars — well within 64-byte limit
        _multi_pending[token] = [i["expense_id"] for i in items]
        lines = [f"<b>{len(items)} expenses detected:</b>"]
        for i in items:
            lines.append(f"  • ₹{i['amount']:,.0f} · {i['category']} · {i['description']}")
        lines.append("\nConfirm all?")

        keyboard = InlineKeyboardMarkup([[
            InlineKeyboardButton("✅ Confirm All", callback_data=f"multi_confirm:{token}"),
            InlineKeyboardButton("❌ Cancel All", callback_data=f"multi_cancel:{token}"),
        ]])
        await update.message.reply_text(
            "\n".join(lines),
            parse_mode="HTML",
            reply_markup=keyboard,
        )


# ── Callback router ───────────────────────────────────────────────────────────

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    await query.answer()
    data = query.data or ""

    if data.startswith("confirm:"):
        await _confirm_expense(query, data[8:])

    elif data.startswith("edit:"):
        await _edit_category_menu(query, data[5:])

    elif data.startswith("cancel:"):
        await _cancel_expense(query, data[7:])

    elif data.startswith("setcat:"):
        # setcat:{expense_id}:{category}
        parts = data[7:].split(":", 1)
        if len(parts) == 2:
            await _set_category_and_confirm(query, parts[0], parts[1])

    elif data.startswith("multi_confirm:"):
        token = data[14:]
        ids = _multi_pending.pop(token, [])
        await _multi_confirm(query, ids)

    elif data.startswith("multi_cancel:"):
        token = data[13:]
        ids = _multi_pending.pop(token, [])
        await _multi_cancel(query, ids)

    elif data.startswith("edit_pick:"):
        await _show_edit_options(query, data[10:])

    elif data.startswith("edit_desc:"):
        await _prompt_description_edit(query, context, data[10:])

    elif data.startswith("edit_cat:"):
        await _edit_existing_category_menu(query, data[9:])

    elif data.startswith("edit_setcat:"):
        # edit_setcat:{expense_id}:{category}
        parts = data[12:].split(":", 1)
        if len(parts) == 2:
            await _apply_category_edit(query, parts[0], parts[1])


# ── Confirm / cancel single expense ──────────────────────────────────────────

async def _confirm_expense(query, expense_id: str) -> None:
    if expense_id in _confirming:
        return
    _confirming.add(expense_id)
    try:
        async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=15) as client:
            r = await client.post(f"/expense/{expense_id}/confirm")
    except Exception as exc:
        logger.error("Confirm API error: %s", exc)
        await _safe_edit(query, "Server error confirming expense.")
        return
    finally:
        _confirming.discard(expense_id)

    if r.status_code != 200:
        await _safe_edit(query, "Could not confirm expense.")
        return

    zone_data = await _get_zone()
    msg = "✅ Expense confirmed!"
    if zone_data:
        msg += f"\n{_zone_line(zone_data)}"
    await _safe_edit(query, msg)


async def _cancel_expense(query, expense_id: str) -> None:
    try:
        async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=15) as client:
            await client.delete(f"/expense/{expense_id}")
    except Exception as exc:
        logger.error("Cancel API error: %s", exc)
        await _safe_edit(query, "Server error cancelling expense.")
        return
    await _safe_edit(query, "❌ Expense cancelled.")


# ── Category edit for new pending expense ─────────────────────────────────────

async def _edit_category_menu(query, expense_id: str) -> None:
    buttons = [
        [InlineKeyboardButton(cat, callback_data=f"setcat:{expense_id}:{cat}")]
        for cat in CATEGORIES
    ]
    await query.edit_message_text("Choose the correct category:", reply_markup=InlineKeyboardMarkup(buttons))


async def _set_category_and_confirm(query, expense_id: str, category: str) -> None:
    if expense_id in _confirming:
        return
    _confirming.add(expense_id)
    try:
        async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=15) as client:
            # 1. Update the category
            await client.patch(f"/expense/{expense_id}", json={"category": category})
            # 2. Confirm the expense
            r = await client.post(f"/expense/{expense_id}/confirm")
    except Exception as exc:
        logger.error("Set category error: %s", exc)
        await _safe_edit(query, "Server error.")
        return
    finally:
        _confirming.discard(expense_id)

    if r.status_code != 200:
        await _safe_edit(query, "Could not confirm expense.")
        return

    zone_data = await _get_zone()
    msg = f"✅ Confirmed as <b>{category}</b>!"
    if zone_data:
        msg += f"\n{_zone_line(zone_data)}"
    await _safe_edit(query, msg, parse_mode="HTML")


# ── Multi-expense confirm / cancel ────────────────────────────────────────────

async def _multi_confirm(query, expense_ids: list[str]) -> None:
    try:
        async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=15) as client:
            r = await client.post("/expense/confirm-bulk", json=expense_ids)
    except Exception as exc:
        logger.error("Multi confirm error: %s", exc)
        await _safe_edit(query, "Server error confirming expenses.")
        return

    if r.status_code != 200:
        await _safe_edit(query, "Could not confirm expenses.")
        return

    count = r.json().get("count", len(expense_ids))
    zone_data = await _get_zone()
    msg = f"✅ {count} expenses confirmed!"
    if zone_data:
        msg += f"\n{_zone_line(zone_data)}"
    await _safe_edit(query, msg)


async def _multi_cancel(query, expense_ids: list[str]) -> None:
    try:
        async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=15) as client:
            await client.request("DELETE", "/expense/bulk", json=expense_ids)
    except Exception as exc:
        logger.error("Multi cancel error: %s", exc)
        await _safe_edit(query, "Server error cancelling expenses.")
        return
    await _safe_edit(query, f"❌ {len(expense_ids)} expenses cancelled.")


# ── Edit existing confirmed entry ─────────────────────────────────────────────

async def _show_edit_options(query, expense_id: str) -> None:
    keyboard = InlineKeyboardMarkup([[
        InlineKeyboardButton("✏️ Edit Description", callback_data=f"edit_desc:{expense_id}"),
        InlineKeyboardButton("🔄 Change Category", callback_data=f"edit_cat:{expense_id}"),
    ]])
    await query.edit_message_text(
        "What would you like to edit? (Amount cannot be changed)",
        reply_markup=keyboard,
    )


async def _prompt_description_edit(query, context: ContextTypes.DEFAULT_TYPE, expense_id: str) -> None:
    context.user_data[PENDING_EDIT_KEY] = expense_id
    await query.edit_message_text(
        "Send the new description as your next message.\n"
        "(Send any other command to cancel)"
    )


async def _edit_existing_category_menu(query, expense_id: str) -> None:
    buttons = [
        [InlineKeyboardButton(cat, callback_data=f"edit_setcat:{expense_id}:{cat}")]
        for cat in CATEGORIES
    ]
    await query.edit_message_text(
        "Choose the new category:",
        reply_markup=InlineKeyboardMarkup(buttons),
    )


async def _apply_category_edit(query, expense_id: str, category: str) -> None:
    try:
        async with httpx.AsyncClient(base_url=API_BASE_URL, timeout=10) as client:
            r = await client.patch(f"/expense/{expense_id}", json={"category": category})
    except Exception as exc:
        logger.error("Category edit error: %s", exc)
        await _safe_edit(query, "Server error. Please try again.")
        return

    if r.status_code == 200:
        updated = r.json()
        await _safe_edit(
            query,
            f"✅ Category updated to <b>{category}</b>\n"
            f"₹{updated['amount']:,.0f} · {updated['description']}",
            parse_mode="HTML",
        )
    else:
        await _safe_edit(query, "Failed to update category.")


# ── Error handler ─────────────────────────────────────────────────────────────

async def handle_error(_update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    logger.error("Unhandled bot error: %s", context.error, exc_info=context.error)


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    application = Application.builder().token(TELEGRAM_TOKEN).build()
    application.add_handler(CommandHandler("chatid", handle_chatid))
    application.add_handler(CommandHandler("edit", handle_edit_command))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    application.add_handler(CallbackQueryHandler(handle_callback))
    application.add_error_handler(handle_error)

    logger.info("Spendly bot starting (long polling)…")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
