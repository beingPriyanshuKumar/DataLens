import logging
import re

from rapidfuzz import fuzz

logger = logging.getLogger(__name__)

FUZZY_THRESHOLD = 90


def _normalize_whitespace(text: str) -> str:
    """Collapse all whitespace to single spaces and lowercase."""
    return re.sub(r"\s+", " ", text).strip().lower()


def verify_evidence(snippet: str, page_text: str) -> bool:
    """Check that the evidence snippet actually appears in the page text.

    First tries exact substring match (after whitespace normalization).
    Falls back to fuzzy partial match with a threshold of 90.
    """
    if not snippet or not page_text:
        return False

    norm_snippet = _normalize_whitespace(snippet)
    norm_page = _normalize_whitespace(page_text)

    if norm_snippet in norm_page:
        return True

    score = fuzz.partial_ratio(norm_snippet, norm_page)
    return score >= FUZZY_THRESHOLD


def verify_records(
    records: list[dict],
    page_text: str,
    source_url: str,
) -> tuple[list[dict], int]:
    """Verify evidence for a list of records from the same page.

    Returns (verified_records, hallucinated_count).
    """
    verified: list[dict] = []
    hallucinated = 0

    for record in records:
        evidence = record.get("evidence", "")
        if verify_evidence(evidence, page_text):
            verified.append(record)
        else:
            hallucinated += 1
            logger.warning(
                "Hallucinated record dropped from %s — evidence not found: %.80s...",
                source_url,
                evidence,
            )

    return verified, hallucinated
