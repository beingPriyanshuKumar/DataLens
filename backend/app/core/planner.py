from app.config import settings
from app.core.llm import generate_structured
from app.schemas import Plan, TaskSpec

PLANNER_SYSTEM_PROMPT = """You are a search query planner for a web data collection system. Given a TaskSpec, produce a Plan with diverse search queries and a human-readable step list.

Rules for queries (produce 3 to 6):
- CRITICAL DOMAIN PRESERVATION: The primary subject, industry, and qualifying attributes from Task Title, Entity, and Filters (e.g. 'AI', 'Artificial Intelligence', 'Fintech', specific sector/technologies) MUST appear in EVERY generated search query. NEVER generate generic queries that drop the primary domain.
- AVOID BLOCKED PLATFORMS: NEVER include blocked social media, video platforms, or walled garden domains in queries: do NOT mention 'LinkedIn', 'Instagram', 'Facebook', 'Twitter', 'X', 'Reddit', 'Pinterest', 'TikTok', or 'YouTube'.
- TARGET ENUMERATION PAGES: Avoid queries that target generic job board search URLs or aggregators (avoid terms like 'job board' or 'internship portal' which return 403s or login walls). Instead, target pages that list or curate entities: roundups, articles, directories, company lists, incubator/accelerator batches, industry reports, and blogs (e.g. 'list of AI startups in India hiring interns', 'top AI startups India student internships', 'AI startups India paid internships freshers').
- Each query should approach the topic from a different angle: one comprehensive roundup query, one directory/database query, one recency-focused query (include current year 2026), and one long-tail specific query.
- Queries should be realistic web search queries that would find pages enumerating the entities.
- Do NOT use "site:" operator — just mention source types or reputable publishers naturally.

Rules for steps:
- Produce a human-readable list of pipeline steps based on the spec.
- Example: "Search 4 queries across startup directories and tech publications", "Fetch up to 8 pages", "Extract fields: company_name, internship_role, stipend_amount", "Validate required fields", "Deduplicate by company_name + internship_role".
- Steps should reflect the actual spec fields, key_fields, and filters.

Set max_pages based on the target_count (roughly 2x target_count, capped at the system limit)."""


async def build_plan(spec: TaskSpec) -> Plan:
    """Generate a collection plan with search queries and steps from a TaskSpec."""
    from app.regions import get_region

    region = get_region(spec.region)
    if region.code != "GLOBAL":
        region_assumption = f"Region: {region.name}"
        if region_assumption not in spec.assumptions:
            spec.assumptions.append(region_assumption)

    field_lines = [
        f"{f.name} ({f.description})" if f.description else f.name for f in spec.fields
    ]
    spec_summary = (
        f"Task Title: {spec.title}\n"
        f"Entity: {spec.entity}\n"
        f"Region: {region.name} ({region.code})\n"
        f"Fields: {', '.join(field_lines)}\n"
        f"Key fields: {', '.join(spec.key_fields)}\n"
        f"Filters: {spec.filters}\n"
        f"Target count: {spec.target_count}\n"
        f"Assumptions: {', '.join(spec.assumptions)}\n"
        f"Source hints: {', '.join(spec.source_hints)}"
    )
    plan = await generate_structured(
        system=PLANNER_SYSTEM_PROMPT,
        user=f"Create a plan for this task:\n\n{spec_summary}",
        output_model=Plan,
    )
    plan.max_pages = max(1, min(plan.max_pages, settings.max_pages_per_run))
    return plan
