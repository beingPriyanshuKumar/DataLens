from __future__ import annotations

from app.api.exports import _sanitize_cell, _sanitize_row


def test_sanitize_cell_formula_injection():
    # Dangerous Excel prefixes: =, +, -, @
    assert _sanitize_cell("=HYPERLINK('http://evil.com')") == "'=HYPERLINK('http://evil.com')"
    assert _sanitize_cell("+1+1") == "'+1+1"
    assert _sanitize_cell("-2+3") == "'-2+3"
    assert _sanitize_cell("@SUM(1,2)") == "'@SUM(1,2)"

    # Normal text should remain untouched
    assert _sanitize_cell("Software Engineer") == "Software Engineer"
    assert _sanitize_cell("12345") == "12345"
    assert _sanitize_cell("") == ""


def test_sanitize_row():
    row = {
        "title": "=cmd|' /C calc'!A0",
        "company": "Normal Corp",
        "salary": 150000,
    }
    sanitized = _sanitize_row(row)
    assert sanitized["title"] == "'=cmd|' /C calc'!A0"
    assert sanitized["company"] == "Normal Corp"
    assert sanitized["salary"] == 150000
