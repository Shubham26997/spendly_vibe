"""
Advisor service — calls Gemini to generate a financial narrative,
action pills, and investment suggestions for the current zone.

Input to Gemini: anonymised numeric aggregates only.
Raw expense descriptions are never sent here.
"""
import json
import logging
from dataclasses import dataclass, field

from app.services.gemini_helper import generate as gemini_generate

logger = logging.getLogger(__name__)

ADVISOR_SYSTEM_PROMPT = """You are a personal financial advisor for an Indian salaried professional.
You receive anonymised spending statistics. No personal names or transaction details.

Critical rule for this user: House, Family, and Grocery expenses are mandatory essentials and must be treated as baseline needs, not discretionary spending.
Only flag these categories if they increase materially versus the previous month or a reasonable baseline, and even then call it out carefully as a risk rather than as waste.

Respond ONLY with a JSON object matching this exact schema:

{
  "narrative": "2-3 sentence plain English assessment. Be direct, not preachy. Mention specific numbers.",
  "action_pills": ["3-4 short action strings, max 8 words each"],
  "investment_suggestions": [
    {"instrument": "Liquid Mutual Fund", "amount": 5000, "reason": "short string", "liquidity": "T+1"},
    {"instrument": "ELSS SIP", "amount": 2000, "reason": "short string", "liquidity": "3yr lock-in"}
  ]
}

For DANGER zone: be firm. Focus on total overspending vs salary and saving shortfall. Suggest redirecting surplus to an investment.
For WARNING zone: be cautionary. Suggest increasing saving rate by a specific percentage.
For SAFE zone: be encouraging. Suggest a growth instrument for the surplus.
House, Family, and Grocery are necessary expenses. Treat them as mandatory and only raise them when the jump from previous month is unusually high.
Only suggest Indian investment instruments: Liquid MF, ELSS, PPF, RD, Index Fund, NPS."""


@dataclass
class AdvisorResult:
    narrative: str
    action_pills: list[str]
    investment_suggestions: list[dict] = field(default_factory=list)


_DEFAULT_RESULT = AdvisorResult(
    narrative="Expense saved. AI insights unavailable right now — tap 'Get AI Insights' to retry.",
    action_pills=["Review your expenses", "Track your savings"],
)


def _parse_result(text: str | None) -> AdvisorResult:
    if not text:
        return _DEFAULT_RESULT
    try:
        data = json.loads(text)
        return AdvisorResult(
            narrative=data.get("narrative", _DEFAULT_RESULT.narrative),
            action_pills=data.get("action_pills", _DEFAULT_RESULT.action_pills),
            investment_suggestions=data.get("investment_suggestions", []),
        )
    except Exception:
        return _DEFAULT_RESULT


def generate_advice(
    zone: str,
    saving_score: int,
    spend_score: int,
    salary: float,
    target_save_pct: int,
    actually_saved: float,
    days_elapsed: int,
    days_in_month: int,
    category_totals: dict[str, float],
) -> AdvisorResult:
    """Generate narrative + action pills via Gemini with fallback."""
    if salary == 0:
        return AdvisorResult(
            narrative="Since no salary has been set yet for the month, please add your monthly salary in the Settings page. Once configured, a suggested saving target of 30% is recommended.",
            action_pills=["Add monthly salary", "Set 30% saving target"],
        )
    target_save_amount = salary * target_save_pct / 100
    shortfall = max(0.0, target_save_amount - actually_saved)

    payload = {
        "zone": zone,
        "saving_score": saving_score,
        "spend_score": spend_score,
        "saving_context": {
            "salary": salary,
            "target_save_pct": target_save_pct,
            "target_save_amount": target_save_amount,
            "actually_saved": actually_saved,
            "shortfall": shortfall,
        },
        "spend_context": {
            "days_elapsed": days_elapsed,
            "days_in_month": days_in_month,
            "category_totals": category_totals,
        },
    }

    text = gemini_generate(json.dumps(payload), ADVISOR_SYSTEM_PROMPT)
    return _parse_result(text)


def generate_savings_plan(
    salary: float,
    target_save_pct: int,
    month: int,
    year: int,
) -> AdvisorResult:
    """Generate a savings plan narrative when income is logged."""
    total_to_save = salary * target_save_pct / 100

    payload = {
        "zone": "PLAN",
        "saving_context": {
            "salary": salary,
            "target_save_pct": target_save_pct,
            "target_save_amount": total_to_save,
            "month": month,
            "year": year,
        },
        "request": "Generate a monthly savings allocation plan with specific instrument amounts.",
    }

    text = gemini_generate(json.dumps(payload), ADVISOR_SYSTEM_PROMPT)
    return _parse_result(text)
