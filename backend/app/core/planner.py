from app.config import settings
from app.core.llm import generate_structured
from app.schemas import Plan, TaskSpec

PLANNER_SYSTEM_PROMPT = """You are a search query planner for a web data collection system. Given a TaskSpec, produce a Plan with diverse search queries and a human-readable step list.

Rules for queries (produce 3 to 6):
- Each query should approach the topic from a different angle.
- One broad query, one with site-specific hints (e.g. mentioning specific well-known sites), one recency-focused (include the current year 2026 if time-sensitive), one long-tail specific query.
- Queries should be realistic web search queries that would find the data described in the spec.
- Do NOT use "site:" operator — just mention the site name naturally.

Rules for steps:
- Produce a human-readable list of pipeline steps based on the spec.
- Example: "Search 5 queries across job boards", "Fetch up to 40 pages", "Extract fields: title, company, location, salary", "Validate required fields", "Deduplicate by company + title + location".
- Steps should reflect the actual spec fields, key_fields, and filters.

Set max_pages based on the target_count (roughly 2x target_count, capped at the system limit)."""


async def build_plan(spec: TaskSpec) -> Plan:
    """Generate a collection plan with search queries and steps from a TaskSpec."""
    spec_summary = (
        f"Entity: {spec.entity}\n"
        f"Fields: {', '.join(f.name for f in spec.fields)}\n"
        f"Key fields: {', '.join(spec.key_fields)}\n"
        f"Filters: {spec.filters}\n"
        f"Target count: {spec.target_count}\n"
        f"Source hints: {', '.join(spec.source_hints)}"
    )
    plan = await generate_structured(
        system=PLANNER_SYSTEM_PROMPT,
        user=f"Create a plan for this task:\n\n{spec_summary}",
        output_model=Plan,
    )
    plan.max_pages = max(1, min(plan.max_pages, settings.max_pages_per_run))
    return plan
