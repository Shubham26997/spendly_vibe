import json
import logging
import re
from dataclasses import dataclass
from datetime import date, timedelta

from app.services.gemini_helper import generate as gemini_generate

logger = logging.getLogger(__name__)

AMOUNT_RE = re.compile(r"(\d+(?:\.\d{1,2})?)")

EXPENSE_KEYWORDS = {"spent", "paid", "bought", "purchased", "spend", "pay"}
INCOME_KEYWORDS = {"salary", "credited", "received", "income", "credit"}

_MONTH_MAP: dict[str, int] = {
    "jan": 1, "january": 1,
    "feb": 2, "february": 2,
    "mar": 3, "march": 3,
    "apr": 4, "april": 4,
    "may": 5,
    "jun": 6, "june": 6,
    "jul": 7, "july": 7,
    "aug": 8, "august": 8,
    "sep": 9, "sept": 9, "september": 9,
    "oct": 10, "october": 10,
    "nov": 11, "november": 11,
    "dec": 12, "december": 12,
}
_MONTH_PAT = "|".join(sorted(_MONTH_MAP.keys(), key=len, reverse=True))
# Matches "10 June", "on 10th June", "June 10", "on June 10th"
_EXPLICIT_DATE_RE = re.compile(
    rf"(?:on\s+)?(\d{{1,2}})(?:st|nd|rd|th)?\s+({_MONTH_PAT})"
    rf"|(?:on\s+)?({_MONTH_PAT})\s+(\d{{1,2}})(?:st|nd|rd|th)?",
    re.IGNORECASE,
)

PARSE_SYSTEM_PROMPT = """You are a parser for a personal expense tracker. Extract structured data from the user's natural language message.
Respond ONLY with a valid JSON object. No markdown, no explanation.

JSON schema:
{
  "type": "expense" | "income" | "unknown",
  "amount": float or null,
  "description": "cleaned description string",
  "date": "YYYY-MM-DD or null (null means today)",
  "source_name": "string (for income only, e.g. Software Company)"
}

Rules:
- If the message mentions salary, credit, received, income → type = income
- If the message mentions spent, bought, paid, purchased → type = expense
- Amount must be a positive number
- description should be a clean 2-5 word summary, not the raw text
- date: only set if user explicitly mentions a date. Otherwise null.
- If you cannot determine type or amount, return type = unknown"""


@dataclass
class ParsedEntry:
    entry_type: str       # "expense" | "income"
    amount: float
    description: str
    entry_date: date
    source_name: str = "salary"
    raw_segment: str = ""  # original text this entry was parsed from, for bank matching


def _parse_relative_date(text: str) -> date | None:
    text_lower = text.lower()
    today = date.today()
    if "yesterday" in text_lower:
        return today - timedelta(days=1)
    if "today" in text_lower:
        return today
    return None


def _parse_explicit_date(text: str) -> date | None:
    """Extract a calendar date from phrases like '10 June', 'on June 10th', '5th March'."""
    m = _EXPLICIT_DATE_RE.search(text)
    if not m:
        return None

    # Two capture groups depending on which alternative matched
    if m.group(1) and m.group(2):           # "DD Month"
        day, month_str = int(m.group(1)), m.group(2).lower()
    elif m.group(3) and m.group(4):         # "Month DD"
        month_str, day = m.group(3).lower(), int(m.group(4))
    else:
        return None

    month = _MONTH_MAP.get(month_str)
    if not month or not (1 <= day <= 31):
        return None

    today = date.today()
    year = today.year
    try:
        d = date(year, month, day)
        # If the resulting date is more than 1 day in the future, use last year
        if d > today + timedelta(days=1):
            d = date(year - 1, month, day)
        return d
    except ValueError:
        return None


def _quick_classify(text: str) -> str | None:
    """Return 'expense', 'income', or None if ambiguous.

    Bare amount with no keywords → implicit expense (e.g. '800 on petrol').
    """
    words = set(text.lower().split())
    if words & INCOME_KEYWORDS:
        return "income"
    if words & EXPENSE_KEYWORDS:
        return "expense"
    if AMOUNT_RE.search(text):
        return "expense"
    return None


def _rule_parse(raw_text: str) -> ParsedEntry | None:
    entry_type = _quick_classify(raw_text)
    if entry_type is None:
        return None

    amounts = AMOUNT_RE.findall(raw_text)
    if not amounts:
        return None

    amount = float(amounts[0])
    entry_date = (
        _parse_relative_date(raw_text)
        or _parse_explicit_date(raw_text)
        or date.today()
    )

    # Strip amount, keywords, and date phrases from description
    desc = re.sub(AMOUNT_RE, "", raw_text)
    desc = re.sub(_EXPLICIT_DATE_RE, "", desc)
    desc = re.sub(r"\b(?:on|today|yesterday)\b", "", desc, flags=re.IGNORECASE)
    desc = " ".join(w for w in desc.split() if w.lower() not in EXPENSE_KEYWORDS | INCOME_KEYWORDS)
    desc = desc.strip() or raw_text[:60]

    return ParsedEntry(
        entry_type=entry_type,
        amount=amount,
        description=desc[:100],
        entry_date=entry_date,
        raw_segment=raw_text,
    )


def _gemini_parse(raw_text: str) -> ParsedEntry | None:
    """Call Gemini with retry/fallback. Returns ParsedEntry or None."""
    text = gemini_generate(raw_text, PARSE_SYSTEM_PROMPT)
    if not text:
        return None

    try:
        data = json.loads(text)
    except Exception as exc:
        logger.error("Gemini parse JSON decode failed: %s | raw: %r", exc, text[:200])
        return None

    if data.get("type") == "unknown" or not data.get("amount"):
        return None

    raw_date = data.get("date")
    if raw_date:
        try:
            entry_date = date.fromisoformat(raw_date)
        except ValueError:
            entry_date = date.today()
    else:
        entry_date = _parse_relative_date(raw_text) or date.today()

    return ParsedEntry(
        entry_type=data["type"],
        amount=float(data["amount"]),
        description=(data.get("description") or raw_text[:60]),
        entry_date=entry_date,
        source_name=data.get("source_name") or "salary",
        raw_segment=raw_text,
    )


def parse(raw_text: str) -> ParsedEntry | None:
    """Parse raw natural language into a ParsedEntry. Returns None if unparseable."""
    result = _rule_parse(raw_text)
    if result is not None:
        logger.info("Rule-based parse succeeded for: %r", raw_text[:50])
        return result

    logger.info("Falling back to Gemini for: %r", raw_text[:50])
    return _gemini_parse(raw_text)


# Splits on ", " or " and " (case-insensitive)
_MULTI_SPLIT_RE = re.compile(r"\s*,\s*|\s+and\s+", re.IGNORECASE)


def parse_multi(raw_text: str) -> list[ParsedEntry]:
    """Parse a potentially multi-expense string like '1042 petrol, 500 food'.

    Each part must contain an amount. If any part fails to parse, falls back
    to treating the whole string as a single expense.
    Returns a list of 1+ ParsedEntry, or empty list if unparseable.
    """
    parts = [p.strip() for p in _MULTI_SPLIT_RE.split(raw_text) if p.strip()]

    if len(parts) <= 1:
        result = parse(raw_text)
        return [result] if result else []

    # All parts must have an amount for multi-parse to apply
    if not all(AMOUNT_RE.search(p) for p in parts):
        result = parse(raw_text)
        return [result] if result else []

    entries: list[ParsedEntry] = []
    for part in parts:
        entry = parse(part)
        if entry is None:
            # Fall back to single parse of the full text
            result = parse(raw_text)
            return [result] if result else []
        entries.append(entry)

    logger.info("Multi-parse: %d entries from %r", len(entries), raw_text[:60])
    return entries
