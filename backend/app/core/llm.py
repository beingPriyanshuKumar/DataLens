"""Unified LLM interface for structured output.

This is the ONLY module that imports an LLM SDK.
Supports Anthropic and Google Gemini via `LLM_PROVIDER` config.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, TypeVar

from pydantic import BaseModel, ValidationError

from app.config import settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

# Per-call timeout in seconds
LLM_TIMEOUT = 60


class LLMError(Exception):
    """Raised when an LLM call fails after retries."""

    pass


# ---------------------------------------------------------------------------
# Schema simplification: strip fields that some providers reject
# ---------------------------------------------------------------------------


def simplify_schema(schema: dict[str, Any], provider: str) -> dict[str, Any]:
    """Prepare and clean JSON Schema for the target provider.

    Resolves and inlines any $defs / definitions referenced by $ref.
    Removes unsupported keywords for Google Gemini / Anthropic.
    """
    import copy

    defs: dict[str, Any] = {}
    if "$defs" in schema and isinstance(schema["$defs"], dict):
        defs.update(schema["$defs"])
    if "definitions" in schema and isinstance(schema["definitions"], dict):
        defs.update(schema["definitions"])

    def _resolve_refs(obj: Any) -> Any:
        if isinstance(obj, dict):
            if "$ref" in obj and isinstance(obj["$ref"], str):
                ref_key = obj["$ref"].split("/")[-1]
                if ref_key in defs:
                    resolved = copy.deepcopy(defs[ref_key])
                    return _resolve_refs(resolved)
            return {
                k: _resolve_refs(v) for k, v in obj.items() if k not in {"$defs", "definitions"}
            }
        if isinstance(obj, list):
            return [_resolve_refs(item) for item in obj]
        return obj

    inlined = _resolve_refs(copy.deepcopy(schema))

    STRIP_KEYS = {"default", "$defs", "definitions"}
    if provider == "gemini":
        STRIP_KEYS |= {"additionalProperties"}

    def _clean(obj: Any, parent_key: str = "") -> Any:
        if isinstance(obj, dict):
            cleaned: dict[str, Any] = {}
            for k, v in obj.items():
                if k in STRIP_KEYS:
                    continue
                if provider == "gemini" and k in {"title", "format"} and parent_key != "properties":
                    continue
                if k == "anyOf" and isinstance(v, list):
                    non_null = [t for t in v if t != {"type": "null"} and t.get("type") != "null"]
                    if len(non_null) == 1:
                        cleaned.update(_clean(non_null[0], k))
                        continue
                cleaned[k] = _clean(v, k)

            if (
                provider == "gemini"
                and cleaned.get("type") == "object"
                and not cleaned.get("properties")
            ):
                cleaned["type"] = "string"
                cleaned["description"] = "JSON-encoded key-value mapping"

            if (
                "required" in cleaned
                and "properties" in cleaned
                and isinstance(cleaned["required"], list)
            ):
                cleaned["required"] = [r for r in cleaned["required"] if r in cleaned["properties"]]
                if not cleaned["required"]:
                    del cleaned["required"]

            return cleaned
        if isinstance(obj, list):
            return [_clean(item, parent_key) for item in obj]
        return obj

    return _clean(inlined)


# ---------------------------------------------------------------------------
# Anthropic provider
# ---------------------------------------------------------------------------


async def _generate_anthropic(
    system: str,
    user: str,
    output_model: type[T],
    model: str,
) -> T:
    from anthropic import AsyncAnthropic

    if not settings.anthropic_api_key:
        raise LLMError(
            "Anthropic API key is not configured. "
            "Set ANTHROPIC_API_KEY in backend/.env and restart."
        )

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    schema = simplify_schema(output_model.model_json_schema(), "anthropic")
    tool_name = output_model.__name__.lower()

    tool_def = {
        "name": tool_name,
        "description": f"Return structured output as {output_model.__name__}",
        "input_schema": schema,
    }

    messages: list[dict] = [{"role": "user", "content": user}]

    from app.core.rate_limit import llm_limiter

    for attempt in range(2):
        try:
            async with llm_limiter:
                response = await asyncio.wait_for(
                    client.messages.create(
                        model=model,
                        max_tokens=4096,
                        system=system,
                        messages=messages,
                        tools=[tool_def],
                        tool_choice={"type": "tool", "name": tool_name},
                    ),
                    timeout=LLM_TIMEOUT,
                )
        except TimeoutError as exc:
            raise LLMError(f"LLM call timed out after {LLM_TIMEOUT}s") from exc
        except Exception as exc:
            raise LLMError(f"Anthropic API call failed: {exc}") from exc

        # Log token usage
        if hasattr(response, "usage") and response.usage:
            logger.info(
                "Anthropic usage: input=%d output=%d model=%s",
                response.usage.input_tokens,
                response.usage.output_tokens,
                model,
            )

        tool_block = next(
            (b for b in response.content if b.type == "tool_use"),
            None,
        )
        if tool_block is None:
            raise LLMError("Anthropic did not return a tool call")

        try:
            return output_model.model_validate(tool_block.input)
        except ValidationError as exc:
            if attempt == 0:
                logger.warning("Anthropic output validation failed, retrying: %s", exc)
                messages.append({"role": "assistant", "content": response.content})
                messages.append(
                    {
                        "role": "user",
                        "content": (
                            f"Your previous output failed validation:\n{exc}\n"
                            "Please fix the errors and try again."
                        ),
                    }
                )
                continue
            raise LLMError(f"Anthropic output failed validation after retry: {exc}") from exc

    raise LLMError("Exhausted retries (Anthropic)")


# ---------------------------------------------------------------------------
# Gemini provider
# ---------------------------------------------------------------------------


async def _generate_gemini(
    system: str,
    user: str,
    output_model: type[T],
    model: str,
) -> T:
    from google import genai

    if not settings.gemini_api_key:
        raise LLMError(
            "Gemini API key is not configured. Set GEMINI_API_KEY in backend/.env and restart."
        )

    client = genai.Client(api_key=settings.gemini_api_key)
    schema = simplify_schema(output_model.model_json_schema(), "gemini")

    from app.core.rate_limit import extract_retry_delay, llm_limiter

    # Order models starting with the requested one, followed by proven fallback candidates
    fallback_pool = [
        "gemini-3.5-flash-lite",
        "gemini-flash-lite-latest",
        "gemini-3.5-flash",
        "gemini-3.8-flash",
        "gemini-flash-latest",
    ]
    candidate_models = [model] + [m for m in fallback_pool if m != model]

    last_error: Exception | None = None

    for active_model in candidate_models:
        for attempt in range(2):
            try:
                async with llm_limiter:
                    response = await asyncio.wait_for(
                        asyncio.to_thread(
                            client.models.generate_content,
                            model=active_model,
                            contents=f"{system}\n\n{user}",
                            config=genai.types.GenerateContentConfig(
                                response_mime_type="application/json",
                                response_schema=schema,
                                temperature=0.1,
                            ),
                        ),
                        timeout=LLM_TIMEOUT,
                    )
            except TimeoutError:
                last_error = LLMError(f"LLM call timed out after {LLM_TIMEOUT}s on {active_model}")
                if attempt == 0:
                    await asyncio.sleep(0.5)
                    continue
                break
            except Exception as exc:
                err_str = str(exc)
                logger.warning(
                    "Gemini model %s attempt %d failed: %s", active_model, attempt, err_str[:120]
                )
                last_error = exc

                # Handle 429 rate limit
                if "RESOURCE_EXHAUSTED" in err_str or "429" in err_str:
                    # Check if this is a daily quota exhaustion (waiting seconds will NOT help)
                    is_daily = (
                        "free_tier_requests" in err_str or "GenerateRequestsPerDay" in err_str
                    )
                    if is_daily:
                        logger.warning(
                            "Gemini model %s daily quota reached. Switching to next model immediately...",
                            active_model,
                        )
                        break  # Immediately try next candidate model without wasting time sleeping

                    delay = extract_retry_delay(err_str)
                    # If delay is small (<= 5s), do a quick retry; otherwise switch models immediately
                    if attempt == 0 and delay is not None and delay <= 5.0:
                        wait_secs = delay + 0.5
                        logger.info(
                            "Gemini brief rate limit on %s. Waiting %.1fs...",
                            active_model,
                            wait_secs,
                        )
                        await asyncio.sleep(wait_secs)
                        continue
                    # Long delay or second attempt: try next candidate model immediately without waiting
                    break

                # If unavailable (503) or not found (404), break immediately to try fallback model
                if "503" in err_str or "404" in err_str:
                    break
                if attempt == 0:
                    await asyncio.sleep(0.5)
                    continue
                break

            # Log token usage
            if hasattr(response, "usage_metadata") and response.usage_metadata:
                meta = response.usage_metadata
                logger.info(
                    "Gemini usage: input=%s output=%s model=%s",
                    getattr(meta, "prompt_token_count", "?"),
                    getattr(meta, "candidates_token_count", "?"),
                    active_model,
                )

            try:
                raw_text = response.text or ""
                clean_text = raw_text.strip()
                if clean_text.startswith("```"):
                    lines = clean_text.splitlines()
                    if lines and lines[0].startswith("```"):
                        lines = lines[1:]
                    if lines and lines[-1].startswith("```"):
                        lines = lines[:-1]
                    clean_text = "\n".join(lines).strip()

                data = json.loads(clean_text)
                if (
                    isinstance(data, dict)
                    and "filters" in data
                    and isinstance(data["filters"], str)
                ):
                    try:
                        data["filters"] = json.loads(data["filters"])
                    except Exception:
                        data["filters"] = {}

                return output_model.model_validate(data)
            except (json.JSONDecodeError, ValidationError) as exc:
                logger.warning(
                    "Gemini output validation failed on %s (attempt %d): %s",
                    active_model,
                    attempt,
                    exc,
                )
                last_error = exc
                if attempt == 0:
                    continue
                break

    raise LLMError(f"Gemini API call failed across candidates: {last_error}") from last_error


# ---------------------------------------------------------------------------
# Public API (unchanged signature for all callers)
# ---------------------------------------------------------------------------


async def generate_structured(
    system: str,
    user: str,
    output_model: type[T],
    model: str | None = None,
) -> T:
    """Call the LLM with structured output matching output_model.

    Retries once on validation failure.
    Raises LLMError if both attempts fail.
    """
    provider = settings.llm_provider

    if provider == "gemini":
        model_name = model or settings.get_spec_model()
        return await _generate_gemini(system, user, output_model, model_name)
    elif provider == "anthropic":
        model_name = model or settings.get_spec_model()
        return await _generate_anthropic(system, user, output_model, model_name)
    else:
        raise LLMError(f"Unknown LLM provider: {provider}. Use 'anthropic' or 'gemini'.")


async def check_llm_health() -> dict:
    """Verify LLM is configured. Checks API key presence to avoid exhausting user rate limits."""
    key = settings.get_active_llm_key()
    if not key:
        return {
            "provider": settings.llm_provider,
            "ok": False,
            "error": f"No API key configured for provider '{settings.llm_provider}'",
        }
    return {
        "provider": settings.llm_provider,
        "ok": True,
        "error": None,
    }
