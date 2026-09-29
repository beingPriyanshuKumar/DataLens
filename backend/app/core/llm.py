from __future__ import annotations

import logging
from typing import TypeVar

from anthropic import AsyncAnthropic
from pydantic import BaseModel, ValidationError

from app.config import settings

logger = logging.getLogger(__name__)

T = TypeVar("T", bound=BaseModel)

_client: AsyncAnthropic | None = None


def _get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    return _client


class LLMError(Exception):
    pass


async def generate_structured(
    system: str,
    user: str,
    output_model: type[T],
    model: str | None = None,
) -> T:
    """Call the LLM with tool-use to get structured output matching output_model.

    Retries once on validation failure, feeding the error back to the model.
    Raises LLMError if both attempts fail.
    """
    client = _get_client()
    model_name = model or settings.spec_model
    schema = output_model.model_json_schema()
    tool_name = output_model.__name__.lower()

    tool_def = {
        "name": tool_name,
        "description": f"Return structured output as {output_model.__name__}",
        "input_schema": schema,
    }

    messages: list[dict] = [{"role": "user", "content": user}]

    for attempt in range(2):
        try:
            response = await client.messages.create(
                model=model_name,
                max_tokens=4096,
                system=system,
                messages=messages,
                tools=[tool_def],
                tool_choice={"type": "tool", "name": tool_name},
            )
        except Exception as exc:
            raise LLMError(f"LLM API call failed: {exc}") from exc

        tool_block = next(
            (b for b in response.content if b.type == "tool_use"),
            None,
        )
        if tool_block is None:
            raise LLMError("LLM did not return a tool call")

        try:
            return output_model.model_validate(tool_block.input)
        except ValidationError as exc:
            if attempt == 0:
                logger.warning("LLM output validation failed, retrying: %s", exc)
                messages.append({"role": "assistant", "content": response.content})
                messages.append(
                    {
                        "role": "user",
                        "content": (
                            f"Your previous output failed validation:\n{exc}\n"
                            "Please fix the errors and try again."
                        ),
                    },
                )
                continue
            raise LLMError(f"LLM output failed validation after retry: {exc}") from exc

    raise LLMError("Exhausted retries")
