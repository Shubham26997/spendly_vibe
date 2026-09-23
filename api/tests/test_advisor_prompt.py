import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://user:pass@localhost:5432/testdb")
os.environ.setdefault("GEMINI_API_KEY", "test-key")

from app.services import advisor


def test_prompt_mentions_mandatory_expense_categories():
    prompt = advisor.ADVISOR_SYSTEM_PROMPT.lower()

    assert "house" in prompt
    assert "family" in prompt
    assert "grocery" in prompt
    assert "mandatory" in prompt
    assert "flag" in prompt
