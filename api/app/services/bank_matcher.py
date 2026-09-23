import re
import uuid


def match_bank(text: str, bank_names: dict[str, uuid.UUID]) -> uuid.UUID | None:
    """Case-insensitive whole-word match of a configured bank name inside free text.

    Longer names are checked first so a more specific name (e.g. "SBI Card")
    wins over a shorter one (e.g. "SBI") when both are configured.
    """
    text_lower = text.lower()
    for name in sorted(bank_names, key=len, reverse=True):
        if re.search(rf"\b{re.escape(name.lower())}\b", text_lower):
            return bank_names[name]
    return None


def strip_bank_names(description: str, bank_names: dict[str, uuid.UUID]) -> str:
    """Remove any configured bank name from a description, so it doesn't leak in
    alongside the bank_id link (e.g. "blinkit HDFC" -> "blinkit").
    """
    cleaned = description
    for name in sorted(bank_names, key=len, reverse=True):
        cleaned = re.sub(rf"\b{re.escape(name)}\b", "", cleaned, flags=re.IGNORECASE)
    return re.sub(r"\s+", " ", cleaned).strip()
