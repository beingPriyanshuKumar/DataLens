from app.processing.scorer import score_record


def test_score_record_perfect():
    record = {
        "title": "Engineer",
        "company": "Acme",
        "salary": 100000,
        "location": "Remote",
        "_source_ids": ["s1", "s2", "s3"],
    }
    score = score_record(record, total_fields=4, flags=[])
    # 0.5 * (4/4) + 0.3 * (3/3) + 0.2 * 1.0 = 1.0
    assert score == 1.0


def test_score_record_partial_and_single_source():
    record = {
        "title": "Engineer",
        "company": "Acme",
        "salary": None,
        "location": None,
        "_source_ids": ["s1"],
    }
    score = score_record(record, total_fields=4, flags=[])
    # completeness = 2/4 = 0.5 -> 0.25
    # corroboration = 1/3 -> 0.1
    # cleanliness = 1.0 -> 0.2
    # total = 0.55
    assert score == 0.55


def test_score_record_with_flags():
    record = {
        "title": "Engineer",
        "company": "Acme",
        "_source_ids": ["s1"],
    }
    score = score_record(
        record, total_fields=2, flags=["invalid_email_contact", "invalid_url_website"]
    )
    # completeness = 2/2 = 1.0 -> 0.5
    # corroboration = 1/3 -> 0.1
    # cleanliness = max(1 - 0.5, 0) = 0.5 -> 0.1
    # total = 0.7
    assert score == 0.7


def test_score_record_many_flags_cleanliness_floor():
    record = {
        "title": "Engineer",
        "_source_ids": [],
    }
    score = score_record(
        record,
        total_fields=1,
        flags=["flag1", "flag2", "flag3", "flag4", "flag5"],
    )
    # cleanliness should not be negative: max(1 - 1.25, 0) = 0.0
    # completeness = 1.0 -> 0.5
    # corroboration = 0 -> 0.0
    # cleanliness = 0.0 -> 0.0
    # total = 0.5
    assert score == 0.5
