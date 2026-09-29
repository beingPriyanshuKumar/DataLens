from app.processing.validator import validate_record
from app.schemas import FieldSpec


def test_validator_required_field_missing():
    fields = [
        FieldSpec(name="title", type="str", required=True, description="Job title"),
        FieldSpec(name="company", type="str", required=True, description="Company name"),
        FieldSpec(name="salary", type="str", required=False, description="Salary"),
    ]

    record = {"title": "Engineer", "company": None}
    valid, flags = validate_record(record, fields)
    assert valid is False
    assert "missing_required_company" in flags


def test_validator_required_empty_string():
    fields = [
        FieldSpec(name="title", type="str", required=True, description="Job title"),
    ]

    record = {"title": "   "}
    valid, flags = validate_record(record, fields)
    assert valid is False
    assert "missing_required_title" in flags


def test_validator_optional_missing_is_valid():
    fields = [
        FieldSpec(name="title", type="str", required=True, description="Job title"),
        FieldSpec(name="salary", type="str", required=False, description="Salary"),
    ]

    record = {"title": "Engineer", "salary": None}
    valid, flags = validate_record(record, fields)
    assert valid is True
    assert len(flags) == 0


def test_validator_type_formats_flagged():
    fields = [
        FieldSpec(name="email", type="email", required=False, description="Contact email"),
        FieldSpec(name="url", type="url", required=False, description="Website"),
        FieldSpec(name="age", type="int", required=False, description="Age"),
        FieldSpec(name="rating", type="float", required=False, description="Rating"),
    ]

    # Invalid formats
    bad_record = {
        "email": "not_an_email",
        "url": "not_a_valid_url",
        "age": "twenty",
        "rating": "high",
    }
    valid, flags = validate_record(bad_record, fields)
    assert valid is True  # Optional bad format is flagged, not dropped
    assert "invalid_email_email" in flags
    assert "invalid_url_url" in flags
    assert "invalid_int_age" in flags
    assert "invalid_float_rating" in flags

    # Valid formats
    good_record = {
        "email": "test@example.com",
        "url": "https://example.com/page",
        "age": 25,
        "rating": 4.8,
    }
    valid, flags = validate_record(good_record, fields)
    assert valid is True
    assert len(flags) == 0
