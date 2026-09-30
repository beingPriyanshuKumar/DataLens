from app.core.llm import generate_structured
from app.schemas import TaskSpec

SPEC_SYSTEM_PROMPT = """You are a data collection task designer. Given a user's natural-language prompt, produce a structured TaskSpec that defines what data to collect.

Rules:
- Infer the entity type and 3 to 12 fields that capture the user's intent.
- Field names must be snake_case.
- Choose key_fields: the minimal set of fields that uniquely identify a record (e.g. company + title + location for jobs).
- Set target_count from the prompt if mentioned (e.g. "50 leads" → 50), otherwise default to 30. Maximum 200.
- List every assumption you made in the assumptions field.
- source_hints should list the types of websites where this data is likely found (e.g. "job boards", "company career pages").
- If the prompt is too vague, nonsensical, or asks for something illegal or impossible to collect from public web pages, set clarification to a helpful message explaining what you need, and provide minimal fields.
- Do NOT include a source URL field — provenance is tracked separately.
- Prefer fewer, higher-quality fields over many speculative ones.
- Field types: str, int, float, bool, date, url, email.
- Never bake a currency into a field name unless the user asked for that currency; use a numeric price-style field plus a currency field (e.g. price and currency, not price_usd).
- Always mark truly identifying fields as required=true."""


def enforce_required_fields(spec: TaskSpec) -> TaskSpec:
    """Enforce that at most key fields (maximum 3) are required; others remain optional."""
    key_set = set(spec.key_fields[:3])
    for f in spec.fields:
        if f.name not in key_set:
            f.required = False
    return spec


async def parse_prompt(prompt: str, region_code: str = "GLOBAL") -> TaskSpec:
    """Convert a natural-language prompt into a structured TaskSpec."""
    from app.regions import get_region

    region = get_region(region_code)
    user_prompt = prompt
    if region.code != "GLOBAL":
        user_prompt += (
            f"\n\nContext Hint: Target search region is '{region.name}'. "
            f"Prefer currency hint '{region.currency_hint}' and language hint '{region.language_hint}' "
            "when not explicitly specified by user."
        )

    spec = await generate_structured(
        system=SPEC_SYSTEM_PROMPT,
        user=user_prompt,
        output_model=TaskSpec,
    )
    spec.region = region.code
    return enforce_required_fields(spec)
