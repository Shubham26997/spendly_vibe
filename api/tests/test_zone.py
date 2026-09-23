"""Tests for zone.py — pure Python, no external dependencies."""
import pytest

from app.services.zone import (
    calculate_saving_score,
    calculate_spend_score,
    determine_zone,
)


# ── determine_zone ────────────────────────────────────────────────────────────

def test_safe_zone():
    assert determine_zone(saving_score=80, spend_score=85) == "SAFE"


def test_warning_zone():
    assert determine_zone(saving_score=55, spend_score=60) == "WARNING"


def test_danger_saving():
    assert determine_zone(saving_score=30, spend_score=80) == "DANGER"


def test_danger_spend():
    assert determine_zone(saving_score=80, spend_score=25) == "DANGER"


def test_score_boundary():
    """Exactly 70/70 should be SAFE."""
    assert determine_zone(saving_score=70, spend_score=70) == "SAFE"


def test_boundary_warning_low():
    """69/69 — neither >= 70 both, neither < 40 → WARNING."""
    assert determine_zone(saving_score=69, spend_score=69) == "WARNING"


# ── calculate_saving_score ────────────────────────────────────────────────────

def test_saving_score_full():
    """Saved exactly the target → 100."""
    assert calculate_saving_score(salary=100_000, actually_saved=30_000, target_pct=30) == 100


def test_saving_score_zero_salary():
    assert calculate_saving_score(salary=0, actually_saved=5000, target_pct=30) == 0


def test_saving_score_over_target():
    """Saved more than target → capped at 100."""
    assert calculate_saving_score(salary=100_000, actually_saved=40_000, target_pct=30) == 100


def test_saving_score_half_target():
    assert calculate_saving_score(salary=100_000, actually_saved=15_000, target_pct=30) == 50


# ── calculate_spend_score ─────────────────────────────────────────────────────

def test_spend_score_no_data():
    assert calculate_spend_score(total_spent=0, salary=100000, target_save_pct=30, days_elapsed=10, days_in_month=30) == 100


def test_spend_score_zero_days():
    assert calculate_spend_score(total_spent=5000, salary=100000, target_save_pct=30, days_elapsed=0, days_in_month=30) == 100


def test_spend_score_on_budget():
    """Spent exactly pro-rata → score 100."""
    score = calculate_spend_score(total_spent=20000, salary=90000, target_save_pct=33.333, days_elapsed=10, days_in_month=30)
    assert score == 100


def test_spend_score_over_budget():
    """Double the expected spend → score 0."""
    # spendable budget = 90,000 * (1 - 30/100) = 63,000
    # expected for 10 days = 63,000 * 10 / 30 = 21,000
    # spent = 42,000 (ratio = 2.0)
    score = calculate_spend_score(total_spent=42000, salary=90000, target_save_pct=30, days_elapsed=10, days_in_month=30)
    assert score == 0
