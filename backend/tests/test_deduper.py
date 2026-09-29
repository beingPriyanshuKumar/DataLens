from app.processing.deduper import (
    _merge_records,
    _normalize_key_value,
    deduplicate,
)


def test_normalize_key_value():
    assert _normalize_key_value("Acme, Inc.") == "acme"
    assert _normalize_key_value("Stripe LLC") == "stripe"
    assert _normalize_key_value("Reliance Industries Limited") == "reliance industries"
    assert _normalize_key_value("DeepMind Technologies Corp.") == "deepmind technologies"


def test_merge_records_fills_nulls():
    primary = {"company": "Acme", "title": "Dev", "salary": None, "location": "Remote"}
    secondary = {"company": "Acme", "title": "Dev", "salary": 100000, "location": "NYC"}
    merged = _merge_records(primary, secondary)

    assert merged["company"] == "Acme"
    assert merged["title"] == "Dev"
    assert merged["salary"] == 100000  # Filled from secondary
    assert merged["location"] == "Remote"  # Kept from primary


def test_deduplicate_exact_match():
    records = [
        {
            "company": "Acme Inc",
            "title": "Software Engineer",
            "salary": None,
            "evidence": "Acme Inc hiring Software Engineer",
            "_source_id": "src-1",
        },
        {
            "company": "ACME INC",
            "title": "Software Engineer",
            "salary": 120000,
            "evidence": "Software Engineer at ACME: $120k",
            "_source_id": "src-2",
        },
    ]

    deduped = deduplicate(records, key_fields=["company", "title"])
    assert len(deduped) == 1

    record = deduped[0]
    assert record["salary"] == 120000
    assert len(record["_evidence_list"]) == 2
    assert "src-1" in record["_source_ids"]
    assert "src-2" in record["_source_ids"]


def test_deduplicate_fuzzy_match():
    records = [
        {
            "company": "Anthropic PBC",
            "title": "Research Scientist",
            "location": "San Francisco",
            "evidence": "Anthropic is looking for a Research Scientist",
            "_source_id": "src-1",
        },
        {
            "company": "Anthropic",
            "title": "Research Scientist",
            "location": "San Francisco",
            "evidence": "Research Scientist position at Anthropic in SF",
            "_source_id": "src-2",
        },
    ]

    deduped = deduplicate(records, key_fields=["company", "title", "location"])
    assert len(deduped) == 1
    assert len(deduped[0]["_evidence_list"]) == 2


def test_deduplicate_keeps_distinct_records():
    records = [
        {
            "company": "Google",
            "title": "Product Manager",
            "evidence": "PM role at Google",
            "_source_id": "src-1",
        },
        {
            "company": "Microsoft",
            "title": "Product Manager",
            "evidence": "PM role at Microsoft",
            "_source_id": "src-2",
        },
    ]

    deduped = deduplicate(records, key_fields=["company", "title"])
    assert len(deduped) == 2
