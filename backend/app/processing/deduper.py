from __future__ import annotations

import hashlib
import re

from rapidfuzz import fuzz

LEGAL_SUFFIXES = re.compile(
    r"\b(inc|incorporated|llc|ltd|limited|pvt|private|corp|corporation|co|company)\b",
    re.IGNORECASE,
)
FUZZY_MERGE_THRESHOLD = 90


def _normalize_key_value(value: str) -> str:
    """Normalize a key field value for deduplication."""
    text = value.lower().strip()
    text = LEGAL_SUFFIXES.sub("", text)
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _build_dedupe_key(record: dict, key_fields: list[str]) -> str:
    """Hash normalized key field values into a dedupe key."""
    parts = []
    for kf in sorted(key_fields):
        val = record.get(kf, "")
        parts.append(_normalize_key_value(str(val) if val else ""))
    joined = "|".join(parts)
    return hashlib.sha256(joined.encode()).hexdigest()[:16]


def _key_string(record: dict, key_fields: list[str]) -> str:
    """Readable normalized key string for fuzzy comparison."""
    parts = []
    for kf in sorted(key_fields):
        val = record.get(kf, "")
        parts.append(_normalize_key_value(str(val) if val else ""))
    return " ".join(parts)


def _merge_records(primary: dict, secondary: dict) -> dict:
    """Merge secondary into primary, filling nulls from secondary."""
    merged = dict(primary)
    for k, v in secondary.items():
        if k == "evidence" or k == "_evidence_list" or k == "_source_ids":
            continue
        if merged.get(k) is None and v is not None:
            merged[k] = v
    return merged


def _count_filled(record: dict) -> int:
    """Count non-null, non-evidence fields."""
    return sum(
        1
        for k, v in record.items()
        if v is not None and k not in ("evidence", "_evidence_list", "_source_ids", "_dedupe_key")
    )


def deduplicate(
    records: list[dict],
    key_fields: list[str],
) -> list[dict]:
    """Deduplicate records using exact key hash then fuzzy matching.

    Each returned record has:
    - _dedupe_key: the hash key
    - _evidence_list: list of all evidence snippets (from merged duplicates)
    - _source_ids: list of all source IDs (from merged duplicates)
    """
    if not records:
        return []

    # Guard: if key_fields is empty, derive from all non-metadata record keys
    effective_keys = list(key_fields)
    if not effective_keys:
        effective_keys = [k for k in records[0] if not k.startswith("_") and k != "evidence"]

    # If still no keys, assign individual unique keys and return without collapsing
    if not effective_keys:
        for idx, r in enumerate(records):
            r["_dedupe_key"] = f"record_{idx}"
            r.setdefault("_evidence_list", [r.get("evidence", "")])
            r.setdefault("_source_ids", [r.get("_source_id", "")])
        return list(records)

    for r in records:
        r["_dedupe_key"] = _build_dedupe_key(r, effective_keys)
        r.setdefault("_evidence_list", [r.get("evidence", "")])
        r.setdefault("_source_ids", [r.get("_source_id", "")])

    # Exact pass: group by dedupe_key
    groups: dict[str, list[dict]] = {}
    for r in records:
        groups.setdefault(r["_dedupe_key"], []).append(r)

    exact_deduped: list[dict] = []
    for group in groups.values():
        group.sort(key=_count_filled, reverse=True)
        primary = group[0]
        for secondary in group[1:]:
            primary = _merge_records(primary, secondary)
            primary["_evidence_list"].extend(secondary.get("_evidence_list", []))
            primary["_source_ids"].extend(secondary.get("_source_ids", []))
        exact_deduped.append(primary)

    # Fuzzy pass
    merged_indices: set[int] = set()
    result: list[dict] = []

    for i, r1 in enumerate(exact_deduped):
        if i in merged_indices:
            continue
        key1 = _key_string(r1, effective_keys)
        # Only perform fuzzy comparison if key1 contains actual text
        if key1.strip():
            for j in range(i + 1, len(exact_deduped)):
                if j in merged_indices:
                    continue
                key2 = _key_string(exact_deduped[j], effective_keys)
                if key2.strip() and fuzz.token_sort_ratio(key1, key2) >= FUZZY_MERGE_THRESHOLD:
                    r1 = _merge_records(r1, exact_deduped[j])
                    r1["_evidence_list"].extend(exact_deduped[j].get("_evidence_list", []))
                    r1["_source_ids"].extend(exact_deduped[j].get("_source_ids", []))
                    merged_indices.add(j)
        result.append(r1)

    return result
