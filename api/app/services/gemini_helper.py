"""
Shared Gemini call helper with automatic fallback model retry.

Primary model → on 503/unavailable → fallback model → on failure → return None.
"""
import logging
import re

from google import genai
from google.genai import types as genai_types

from app.config import settings

logger = logging.getLogger(__name__)

_client = genai.Client(api_key=settings.gemini_api_key)


def _strip_fences(text: str) -> str:
    if text.startswith("```"):
        text = re.sub(r"```[a-z]*\n?", "", text).strip().rstrip("```").strip()
    return text


def generate_chat(
    messages: list[dict[str, str]],
    system_instruction: str,
    *,
    primary_model: str | None = None,
) -> str | None:
    """Multi-turn chat: messages = [{"role": "user"|"model", "content": str}, ...]."""
    import time

    primary = primary_model or settings.gemini_model
    fallback = settings.gemini_fallback_model
    fallback_2 = settings.gemini_fallback_v2_model
    models = [primary]
    if fallback and fallback != primary:
        models.append(fallback)
    if fallback_2 and fallback_2 != fallback:
        models.append(fallback_2)

    contents = [
        genai_types.Content(
            role=msg["role"],
            parts=[genai_types.Part(text=msg["content"])],
        )
        for msg in messages
    ]

    for model in models:
        try:
            start = time.perf_counter()
            response = _client.models.generate_content(
                model=model,
                contents=contents,
                config=genai_types.GenerateContentConfig(
                    system_instruction=system_instruction,
                ),
            )
            latency_ms = int((time.perf_counter() - start) * 1000)
            logger.info("Gemini chat OK | model=%s | latency=%dms", model, latency_ms)
            return _strip_fences(response.text.strip())
        except Exception as exc:
            err = str(exc)
            if "503" in err or "UNAVAILABLE" in err or "429" in err or "RESOURCE_EXHAUSTED" in err:
                logger.warning("Gemini %s unavailable (%s), trying next…", model, err[:80])
                continue
            logger.error("Gemini %s chat error: %s", model, exc)
            return None

    logger.error("All Gemini models failed for chat.")
    return None


def generate(
    contents: str,
    system_instruction: str,
    *,
    primary_model: str | None = None,
) -> str | None:
    """
    Call Gemini with automatic fallback.

    Returns the response text, or None if both models fail.
    Logs which model was used and latency.
    """
    import time

    primary = primary_model or settings.gemini_model
    fallback = settings.gemini_fallback_model
    fallback_2 = settings.gemini_fallback_v2_model
    models = [primary]
    if fallback and fallback != primary:
        models.append(fallback)
    if fallback_2 and fallback_2 != fallback:
        models.append(fallback_2)
    for model in models:
        try:
            start = time.perf_counter()
            response = _client.models.generate_content(
                model=model,
                contents=contents,
                config=genai_types.GenerateContentConfig(
                    system_instruction=system_instruction,
                ),
            )
            latency_ms = int((time.perf_counter() - start) * 1000)
            logger.info("Gemini OK | model=%s | latency=%dms", model, latency_ms)
            return _strip_fences(response.text.strip())
        except Exception as exc:
            err = str(exc)
            if "503" in err or "UNAVAILABLE" in err or "429" in err or "RESOURCE_EXHAUSTED" in err:
                logger.warning("Gemini %s unavailable (%s), trying next model…", model, err[:80])
                continue
            # Non-retriable error — log and stop
            logger.error("Gemini %s error: %s", model, exc)
            return None

    logger.error("All Gemini models failed. Returning None.")
    return None
