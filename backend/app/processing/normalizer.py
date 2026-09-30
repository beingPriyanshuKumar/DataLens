from __future__ import annotations

import re
import unicodedata
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

import dateparser


def normalize_string(value: str | None) -> str | None:
    """Trim, collapse whitespace, and unicode normalize."""
    if value is None:
        return None
    text = unicodedata.normalize("NFKC", value)
    text = re.sub(r"\s+", " ", text).strip()
    return text if text else None


def normalize_date(value: str | None) -> tuple[str | None, bool]:
    """Parse a date string to ISO YYYY-MM-DD. Returns (result, success)."""
    if not value:
        return None, True
    parsed = dateparser.parse(value)
    if parsed is None:
        return None, False
    return parsed.strftime("%Y-%m-%d"), True


def normalize_url(value: str | None, base_url: str | None = None) -> tuple[str | None, bool]:
    """Normalize a URL: strip tracking params, lowercase host.

    Only http/https schemes are allowed. Returns (result, valid).
    """
    if not value:
        return None, True
    value = value.strip()
    if not value.lower().startswith(("http://", "https://")):
        if base_url:
            from urllib.parse import urljoin

            value = urljoin(base_url, value)
        else:
            # Check if it's a dangerous scheme
            if ":" in value and not value.startswith("/"):
                return None, False
            return value, True
    parsed = urlparse(value)
    if parsed.scheme.lower() not in ("http", "https"):
        return None, False
    params = parse_qs(parsed.query)
    cleaned = {k: v for k, v in params.items() if not k.startswith("utm_")}
    result = urlunparse(
        parsed._replace(
            scheme=parsed.scheme.lower(),
            netloc=parsed.netloc.lower(),
            query=urlencode(cleaned, doseq=True),
            fragment="",
        )
    )
    return result, True


def normalize_email(value: str | None) -> str | None:
    """Lowercase and strip email."""
    if not value:
        return None
    return value.strip().lower()


def normalize_number(value: str | int | float | None) -> float | None:
    """Parse numeric values, stripping currency symbols and commas."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    cleaned = re.sub(r"[^\d.\-]", "", str(value))
    try:
        return float(cleaned)
    except ValueError:
        return None


def normalize_record(
    record: dict,
    field_types: dict[str, str],
    source_url: str | None = None,
) -> tuple[dict, list[str]]:
    """Normalize all fields in a record based on their types.

    Returns (normalized_record, flags) where flags list any normalization issues.
    """
    normalized = {}
    flags: list[str] = []

    for name, value in record.items():
        if name == "evidence":
            normalized[name] = value
            continue

        field_type = field_types.get(name, "str")

        if field_type == "str":
            normalized[name] = normalize_string(value) if isinstance(value, str) else value
        elif field_type == "date":
            result, success = normalize_date(
                value if isinstance(value, str) else str(value) if value else None
            )
            normalized[name] = result
            if not success:
                flags.append(f"invalid_date_{name}")
        elif field_type == "url":
            url_result, url_valid = normalize_url(
                value if isinstance(value, str) else None, source_url
            )
            normalized[name] = url_result
            if not url_valid:
                flags.append(f"invalid_url_{name}")
        elif field_type == "email":
            normalized[name] = normalize_email(value if isinstance(value, str) else None)
        elif field_type in ("int", "float"):
            num = normalize_number(value)
            normalized[name] = int(num) if field_type == "int" and num is not None else num
            if value is not None and num is None:
                flags.append(f"invalid_number_{name}")
        else:
            normalized[name] = value

    return normalized, flags
