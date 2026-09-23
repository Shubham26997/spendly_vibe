import logging

from app.services.gemini_helper import generate as gemini_generate

logger = logging.getLogger(__name__)

CATEGORIES = [
    "Food",
    "Grocery",
    "Travel",
    "Family",
    "EMI",
    "Saving",
    "Luxury",
    "Health",
    "House",
    "Other",
]

RULES: dict[str, list[str]] = {
    "Food": ["swiggy", "zomato", "restaurant", "dinner", "lunch", "breakfast", "cafe", "pizza", "burger", "chai", "dhaba"],
    "Grocery": ["bigbasket", "zepto", "blinkit", "instamart", "kirana", "vegetables", "fruits", "grocery", "supermarket"],
    "Travel": ["metro", "auto", "ola", "uber", "rapido", "petrol", "diesel", "bus", "train", "flight", "cab"],
    "Family": ["school", "fees", "kids", "child", "gift", "birthday"],
    "EMI": ["emi", "loan", "credit card", "repayment", "mortgage"],
    "Luxury": ["amazon", "flipkart", "myntra", "movie", "netflix", "shopping", "mall", "watch", "shoes"],
    "Saving": ["ppf", "mutual fund", "sip", "fd", "fixed deposit", "invest"],
    "Health": ["medical", "doctor", "hospital", "medicine", "pharmacy", "chemist", "clinic", "health", "gym", "fitness", "yoga"],
    "House": ["rent", "electricity", "water bill", "maintenance", "internet", "wifi", "broadband", "gas", "housekeeping", "maid", "plumber", "repairs"],
}

CATEGORISE_PROMPT = (
    "You are a categoriser for a personal expense tracker. "
    "Given a short expense description, pick exactly one category from this list: "
    + ", ".join(CATEGORIES)
    + ". Reply with the category name only. No explanation."
)


def rule_categorise(description: str) -> str | None:
    """Return category from keyword rules, or None if no match."""
    desc_lower = description.lower()
    for category, keywords in RULES.items():
        if any(kw in desc_lower for kw in keywords):
            return category
    return None


def _gemini_categorise(description: str) -> str:
    """Use Gemini with fallback. Returns 'Other' if all models fail."""
    result = gemini_generate(description, CATEGORISE_PROMPT)
    if result and result.strip() in CATEGORIES:
        return result.strip()
    if result:
        logger.warning("Gemini returned unknown category %r, defaulting to Other", result)
    return "Other"


def categorise(description: str) -> str:
    """Two-stage categorisation: rules first, Gemini fallback."""
    category = rule_categorise(description)
    if category is not None:
        logger.info("Rule categorised %r → %s", description[:40], category)
        return category

    logger.info("Gemini categorising %r", description[:40])
    return _gemini_categorise(description)
