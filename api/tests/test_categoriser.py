"""Tests for categoriser.py — rule-based path only (no Gemini calls)."""
import pytest

from app.services.categoriser import rule_categorise


def test_rule_food():
    assert rule_categorise("swiggy dinner") == "Food"


def test_rule_food_zomato():
    assert rule_categorise("zomato order") == "Food"


def test_rule_grocery():
    assert rule_categorise("zepto vegetables") == "Grocery"


def test_rule_grocery_bigbasket():
    assert rule_categorise("bigbasket order") == "Grocery"


def test_rule_travel():
    assert rule_categorise("metro recharge") == "Travel"


def test_rule_travel_cab():
    assert rule_categorise("uber ride home") == "Travel"


def test_rule_emi():
    assert rule_categorise("home loan emi") == "EMI"


def test_rule_family():
    assert rule_categorise("school fees payment") == "Family"


def test_rule_luxury():
    assert rule_categorise("netflix subscription") == "Luxury"


def test_rule_saving():
    assert rule_categorise("ppf deposit") == "Saving"


def test_rule_no_match_returns_none():
    assert rule_categorise("random gibberish xyz") is None
