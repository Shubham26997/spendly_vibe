"""Tests for parser.py — rule-based path only (no Gemini calls)."""
from datetime import date, timedelta
from unittest.mock import patch

import pytest

from app.services.parser import ParsedEntry, _rule_parse, parse


def test_parse_simple_expense():
    result = _rule_parse("spent 480 swiggy")
    assert result is not None
    assert result.amount == 480.0
    assert result.entry_type == "expense"


def test_parse_income():
    result = _rule_parse("salary 95000 credited")
    assert result is not None
    assert result.entry_type == "income"
    assert result.amount == 95000.0


def test_parse_with_date_yesterday():
    result = _rule_parse("spent 350 auto yesterday")
    assert result is not None
    assert result.entry_date == date.today() - timedelta(days=1)


def test_parse_unknown_returns_none_from_rules():
    """Rule parser returns None for unclassifiable input; Gemini path mocked to also return None."""
    with patch("app.services.parser._gemini_parse", return_value=None):
        result = parse("hello bot")
    assert result is None


def test_parse_paid_keyword():
    result = _rule_parse("paid 200 for lunch")
    assert result is not None
    assert result.entry_type == "expense"
    assert result.amount == 200.0


def test_parse_amount_with_decimal():
    result = _rule_parse("spent 49.99 on coffee")
    assert result is not None
    assert result.amount == 49.99
