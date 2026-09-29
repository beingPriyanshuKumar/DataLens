from __future__ import annotations

import re

from app.schemas import FieldSpec

EMAIL_REGEX = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
URL_REGEX = re.compile(r"^https?://\S+$")


def validate_record(
    record: dict,
    fields: list[FieldSpec],
    existing_flags: list[str] | None = None,
) -> tuple[bool, list[str]]:
    """Validate a record against field specs.

    Returns (is_valid, flags).
    is_valid is False only if a required field is missing.
    Flags capture optional field problems without rejecting the record.
    """
    flags = list(existing_flags) if existing_flags else []

    for field in fields:
        value = record.get(field.name)
        is_empty = value is None or (isinstance(value, str) and not value.strip())

        if field.required and is_empty:
            return False, [f"missing_required_{field.name}"]

        if is_empty:
            continue

        if field.type == "email" and isinstance(value, str) and not EMAIL_REGEX.match(value):
            flags.append(f"invalid_email_{field.name}")

        if field.type == "url" and isinstance(value, str) and not URL_REGEX.match(value):
            flags.append(f"invalid_url_{field.name}")

        if field.type == "int":
            try:
                int(value)
            except (ValueError, TypeError):
                flags.append(f"invalid_int_{field.name}")

        if field.type == "float":
            try:
                float(value)
            except (ValueError, TypeError):
                flags.append(f"invalid_float_{field.name}")

    return True, flags
