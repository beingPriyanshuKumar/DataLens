def score_record(
    record: dict,
    total_fields: int,
    flags: list[str],
) -> float:
    """Compute confidence in [0, 1] from three explainable components.

    Formula:
        confidence = 0.5 × completeness + 0.3 × corroboration + 0.2 × cleanliness

    Where:
        - completeness = (number of non-null fields) / total_fields
        - corroboration = min(distinct source domains, 3) / 3
        - cleanliness = max(1 − 0.25 × number_of_flags, 0)
    """
    non_null = sum(
        1
        for k, v in record.items()
        if v is not None and k not in ("evidence", "_evidence_list", "_source_ids", "_dedupe_key")
    )
    completeness = non_null / max(total_fields, 1)

    source_ids = record.get("_source_ids", [])
    distinct_sources = len(set(s for s in source_ids if s))
    corroboration = min(distinct_sources, 3) / 3

    cleanliness = max(1 - 0.25 * len(flags), 0)

    return round(0.5 * completeness + 0.3 * corroboration + 0.2 * cleanliness, 3)
