import html
import logging
import re
import unicodedata
from typing import Any

from rapidfuzz import fuzz

logger = logging.getLogger(__name__)

FUZZY_THRESHOLD = 90


def normalize_for_verification(text: str) -> str:
    """Normalize text for verification: HTML entities, quotes, dashes, ellipses, zero-width chars."""
    if not text:
        return ""
    # HTML unescape
    text = html.unescape(text)
    # Unicode NFKC
    text = unicodedata.normalize("NFKC", text)
    # Smart quotes & apostrophes
    text = re.sub(r"[“”«»]", '"', text)
    text = re.sub(r"[‘’`´]", "'", text)
    # En/em dashes and minus
    text = re.sub(r"[–—−]", "-", text)
    # Ellipses
    text = text.replace("…", "...")
    # Zero-width spaces & non-breaking spaces
    text = re.sub(r"[\u200b\u200c\u200d\ufeff]", "", text)
    text = re.sub(r"[\u00a0\u2007\u202f]", " ", text)
    # Collapse whitespace and lowercase
    return re.sub(r"\s+", " ", text).strip().lower()


def _normalize_whitespace(text: str) -> str:
    """Collapse all whitespace to single spaces and lowercase."""
    return normalize_for_verification(text)


def verify_evidence(snippet: str, page_text: str) -> bool:
    """Check that the evidence snippet actually appears in the page text.

    First tries exact substring match (after full normalization).
    Falls back to fuzzy partial match with a threshold of 90.
    """
    if not snippet or not page_text:
        return False

    norm_snippet = normalize_for_verification(snippet)
    norm_page = normalize_for_verification(page_text)

    if norm_snippet in norm_page:
        return True

    score = fuzz.partial_ratio(norm_snippet, norm_page)
    return score >= FUZZY_THRESHOLD


def _extract_grounding_context(evidence: str, page_text: str, window: int = 200) -> str:
    """Extract context around the evidence snippet in page text, staying within the entity block."""
    if not evidence or not page_text:
        return normalize_for_verification(evidence or "")

    idx = page_text.find(evidence)
    if idx == -1:
        idx = page_text.lower().find(evidence.lower())

    if idx != -1:
        # Search backward from idx, stopping at section/table header boundaries
        before = page_text[max(0, idx - window) : idx]
        for sep in ("\n\n", "---", "===", "___", "###", "##"):
            if sep in before:
                before = before.split(sep)[-1]

        # Search forward from end of evidence, stopping at section boundaries
        after = page_text[
            idx + len(evidence) : min(len(page_text), idx + len(evidence) + window)
        ]
        for sep in ("\n\n", "---", "===", "___", "###", "##"):
            if sep in after:
                after = after.split(sep)[0]

        block = before + evidence + after
        return normalize_for_verification(block)

    return normalize_for_verification(evidence)


def _is_field_grounded(value: Any, context: str) -> bool:
    """Check if a field value appears in the evidence or surrounding context.

    Case-fold, whitespace and punctuation normalized; numbers compared by digit sequence.
    """
    if value is None:
        return True
    if isinstance(value, bool):
        return True

    norm_context = normalize_for_verification(context)

    # Numeric check
    if isinstance(value, (int, float)):
        int_val = int(value) if isinstance(value, float) and value.is_integer() else value
        val_str = str(int_val)
        val_digits = re.sub(r"\D", "", val_str)
        if len(val_digits) < 3:
            return True  # Skip short numbers
        ctx_digits = re.sub(r"\D", "", norm_context)
        if val_digits in ctx_digits:
            return True
        return val_str in norm_context

    if isinstance(value, str):
        val_clean = value.strip()
        if len(val_clean) < 3:
            return True  # Skip short strings
        norm_val = normalize_for_verification(val_clean)
        if norm_val in norm_context:
            return True
        # Compare without punctuation
        val_nopunct = re.sub(r"[^\w\s]", " ", norm_val)
        val_nopunct = re.sub(r"\s+", " ", val_nopunct).strip()
        ctx_nopunct = re.sub(r"[^\w\s]", " ", norm_context)
        ctx_nopunct = re.sub(r"\s+", " ", ctx_nopunct).strip()
        if val_nopunct in ctx_nopunct:
            return True
        words = [w for w in val_nopunct.split() if len(w) >= 3]
        if words and all(w in ctx_nopunct for w in words):
            return True
        # Fuzzy match with threshold 85
        score = fuzz.partial_ratio(val_nopunct, ctx_nopunct)
        return score >= 85

    return True


def verify_records(
    records: list[dict],
    page_text: str,
    source_url: str,
    field_types: dict[str, str] | None = None,
) -> tuple[list[dict], int, int]:
    """Verify evidence and field-level grounding for a list of records from the same page.

    Returns (verified_records, hallucinated_count, fields_nulled_count).
    """
    verified: list[dict] = []
    hallucinated = 0
    fields_nulled = 0

    for record in records:
        evidence = record.get("evidence", "")
        if not verify_evidence(evidence, page_text):
            hallucinated += 1
            logger.warning(
                "Hallucinated record dropped from %s — evidence not found: %.80s...",
                source_url,
                evidence,
            )
            continue

        context = _extract_grounding_context(evidence, page_text)

        # Field-level grounding check
        for k, v in list(record.items()):
            if k == "evidence" or k.startswith("_") or v is None:
                continue
            if isinstance(v, bool):
                continue
            if field_types:
                ft = field_types.get(k)
                if ft in ("date", "bool", "url"):
                    continue
            else:
                if k in ("date", "posted_date", "created_at", "updated_at"):
                    continue
                if isinstance(v, str) and (
                    re.match(r"^\d{4}-\d{2}-\d{2}", v.strip())
                    or v.startswith(("http://", "https://"))
                ):
                    continue

            if not _is_field_grounded(v, context):
                record[k] = None
                flags = record.setdefault("_flags", [])
                flags.append("unsupported_value")
                flags.append(f"unsupported_value_{k}")
                fields_nulled += 1
                logger.info(
                    "Field '%s' in record from %s failed grounding (nulled): %r",
                    k,
                    source_url,
                    v,
                )

        verified.append(record)

    return verified, hallucinated, fields_nulled
