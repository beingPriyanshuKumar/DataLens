from app.processing.normalizer import (
    normalize_date,
    normalize_email,
    normalize_number,
    normalize_record,
    normalize_string,
    normalize_url,
)


def test_normalize_string():
    assert normalize_string(None) is None
    assert normalize_string("   ") is None
    assert normalize_string("  hello   world  ") == "hello world"
    assert normalize_string("Test\u00a0String\n\tWith   Spaces") == "Test String With Spaces"


def test_normalize_date():
    result, success = normalize_date("2026-03-15")
    assert success is True
    assert result == "2026-03-15"

    result, success = normalize_date("March 15, 2026")
    assert success is True
    assert result == "2026-03-15"

    result, success = normalize_date(None)
    assert success is True
    assert result is None

    result, success = normalize_date("not-a-valid-date-xyz")
    assert success is False
    assert result is None


def test_normalize_url():
    result, valid = normalize_url(None)
    assert result is None
    assert valid is True

    raw = "HTTPS://Example.COM/path?utm_source=twitter&utm_medium=cpc&id=123#section"
    result, valid = normalize_url(raw)
    assert valid is True
    assert "example.com" in result
    assert "utm_source" not in result
    assert "utm_medium" not in result
    assert "id=123" in result
    assert "#section" not in result

    # Relative URL with base_url
    result, valid = normalize_url("/jobs/123", base_url="https://example.com/listings")
    assert valid is True
    assert result == "https://example.com/jobs/123"


def test_normalize_url_rejects_dangerous_schemes():
    """URL-typed fields reject non-http/https schemes (defense in depth)."""
    result, valid = normalize_url("javascript:alert(1)")
    assert result is None
    assert valid is False

    result, valid = normalize_url("data:text/html,<script>alert(1)</script>")
    assert result is None
    assert valid is False

    result, valid = normalize_url("vbscript:msgbox")
    assert result is None
    assert valid is False

    # Valid http/https should still work
    result, valid = normalize_url("https://example.com")
    assert valid is True
    assert result is not None


def test_normalize_email():
    assert normalize_email(None) is None
    assert normalize_email("  User.Name@Example.COM  ") == "user.name@example.com"


def test_normalize_number():
    assert normalize_number(None) is None
    assert normalize_number(42) == 42.0
    assert normalize_number(3.14) == 3.14
    assert normalize_number("$120,000.50") == 120000.50
    assert normalize_number("  15,000  ") == 15000.0
    assert normalize_number("not_a_number") is None


def test_normalize_record():
    record = {
        "title": "  Senior   Software Engineer  ",
        "posted_date": "March 20, 2026",
        "salary": "$150,000",
        "apply_url": "https://Jobs.com/apply?utm_campaign=spring",
        "contact_email": "HR@COMPANY.COM",
        "evidence": "Senior Software Engineer wanted",
    }
    field_types = {
        "title": "str",
        "posted_date": "date",
        "salary": "int",
        "apply_url": "url",
        "contact_email": "email",
    }

    normalized, flags = normalize_record(record, field_types)
    assert normalized["title"] == "Senior Software Engineer"
    assert normalized["posted_date"] == "2026-03-20"
    assert normalized["salary"] == 150000
    assert "utm_campaign" not in normalized["apply_url"]
    assert normalized["contact_email"] == "hr@company.com"
    assert normalized["evidence"] == "Senior Software Engineer wanted"
    assert len(flags) == 0


def test_normalize_record_flags_invalid_inputs():
    record = {
        "posted_date": "invalid_date_format",
        "salary": "invalid_salary",
    }
    field_types = {
        "posted_date": "date",
        "salary": "int",
    }

    normalized, flags = normalize_record(record, field_types)
    assert normalized["posted_date"] is None
    assert "invalid_date_posted_date" in flags
    assert "invalid_number_salary" in flags


def test_normalize_record_currency_mismatch_u1():
    """Reproduce U1 '$499 as price_inr': numeric field with _inr suffix disagrees with $ symbol."""
    record = {
        "title": "Smartphone X",
        "price_inr": "$499",
        "evidence": "Smartphone X is available for $499",
    }
    field_types = {
        "title": "str",
        "price_inr": "float",
    }
    normalized, flags = normalize_record(record, field_types)
    assert normalized["price_inr"] is None
    assert "currency_mismatch" in flags
    assert "currency_mismatch_price_inr" in flags


def test_normalize_record_currency_match():
    """When currency symbol matches field suffix, number is properly normalized."""
    record = {
        "title": "Smartphone X",
        "price_inr": "₹49,999",
        "price_usd": "$499",
    }
    field_types = {
        "title": "str",
        "price_inr": "float",
        "price_usd": "float",
    }
    normalized, flags = normalize_record(record, field_types)
    assert normalized["price_inr"] == 49999.0
    assert normalized["price_usd"] == 499.0
    assert "currency_mismatch" not in flags
