"""
Zone calculator — pure Python, no LLM.

Scores are 0-100 integers. Higher = better.
Zone is determined by the combination of saving_score and spend_score.
"""


def calculate_saving_score(salary: float, actually_saved: float, target_pct: float) -> int | None:
    """Returns 0-100. Returns None if salary is 0 (unconfigured)."""
    if salary <= 0:
        return None
    ratio = actually_saved / (salary * target_pct / 100)
    return min(100, int(ratio * 100))


def calculate_spend_score(
    total_spent: float,
    salary: float,
    target_save_pct: float,
    days_elapsed: int,
    days_in_month: int,
) -> int | None:
    """
    Returns 0-100. Returns None if salary is 0 (unconfigured).
    Based on total spending pace vs salary, not per-category thresholds.
    """
    if salary <= 0 or days_elapsed == 0:
        return None

    spendable = salary * (1 - target_save_pct / 100)
    if spendable <= 0:
        return 100

    # In early days of the month (d <= 7), recurring monthly bills are paid upfront.
    # Allow a minimum 25% budget allowance buffer during week 1 to prevent false DANGER scores.
    linear_pro_rata = days_elapsed / days_in_month
    early_month_buffer = 0.25 if days_elapsed <= 7 else 0.0
    effective_pro_rata = min(1.0, max(linear_pro_rata, early_month_buffer))

    expected = spendable * effective_pro_rata
    if expected == 0:
        return 100

    ratio = total_spent / expected
    return max(0, 100 - int((ratio - 1.0) * 100)) if ratio > 1 else 100


def determine_zone(saving_score: int | None, spend_score: int | None, salary: float = 0.0) -> str:
    """
    UNSET:   salary == 0 or scores are None
    SAFE:    saving_score >= 70 AND spend_score >= 70
    DANGER:  saving_score < 40 OR spend_score < 40
    WARNING: everything else
    """
    if salary <= 0 or saving_score is None or spend_score is None:
        return "UNSET"
    if saving_score >= 70 and spend_score >= 70:
        return "SAFE"
    elif saving_score < 40 or spend_score < 40:
        return "DANGER"
    else:
        return "WARNING"


def compute_zone_score(saving_score: int | None, spend_score: int | None) -> int | None:
    """Composite 0-100 score: weighted average (60% saving, 40% spend)."""
    if saving_score is None or spend_score is None:
        return None
    return int(saving_score * 0.6 + spend_score * 0.4)
