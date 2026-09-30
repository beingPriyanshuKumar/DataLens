from __future__ import annotations

from pydantic import BaseModel


class Region(BaseModel):
    code: str
    name: str
    search_region: str | None = None
    language_hint: str | None = None
    currency_hint: str | None = None


SUPPORTED_REGIONS: list[Region] = [
    Region(code="GLOBAL", name="Worldwide", search_region=None, language_hint=None, currency_hint=None),
    Region(code="IN", name="India", search_region="in", language_hint="en", currency_hint="INR"),
    Region(code="US", name="United States", search_region="us", language_hint="en", currency_hint="USD"),
    Region(code="GB", name="United Kingdom", search_region="gb", language_hint="en", currency_hint="GBP"),
    Region(code="CA", name="Canada", search_region="ca", language_hint="en", currency_hint="CAD"),
    Region(code="AU", name="Australia", search_region="au", language_hint="en", currency_hint="AUD"),
    Region(code="SG", name="Singapore", search_region="sg", language_hint="en", currency_hint="SGD"),
    Region(code="AE", name="United Arab Emirates", search_region="ae", language_hint="en", currency_hint="AED"),
    Region(code="DE", name="Germany", search_region="de", language_hint="de", currency_hint="EUR"),
    Region(code="FR", name="France", search_region="fr", language_hint="fr", currency_hint="EUR"),
    Region(code="NL", name="Netherlands", search_region="nl", language_hint="nl", currency_hint="EUR"),
    Region(code="JP", name="Japan", search_region="jp", language_hint="ja", currency_hint="JPY"),
]

REGION_MAP: dict[str, Region] = {r.code.upper(): r for r in SUPPORTED_REGIONS}


def get_region(code: str | None) -> Region:
    """Get region by code, defaulting to GLOBAL for unknown or empty codes."""
    if not code:
        return REGION_MAP["GLOBAL"]
    return REGION_MAP.get(code.upper().strip(), REGION_MAP["GLOBAL"])


def validate_region_code(code: str | None) -> str:
    """Validate and return normalized region code, defaulting to GLOBAL if valid or fallback."""
    if not code:
        return "GLOBAL"
    normalized = code.upper().strip()
    if normalized in REGION_MAP:
        return normalized
    return "GLOBAL"
