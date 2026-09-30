"""Zero-result diagnostics: pure functions that explain low-yield runs.

Each rule produces a human-readable message and an optional action hint.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class Diagnostic:
    rule: str
    severity: str  # "warning" | "info"
    message: str
    action: str | None  # suggested next step, or None


def diagnose(stats: dict, sources: list[dict], target_count: int) -> list[Diagnostic]:
    """Analyze run stats and sources to explain low or zero results.

    Args:
        stats: Pipeline stats dict from the run.
        sources: List of source dicts with 'status' and 'reason' keys.
        target_count: The spec's target_count.

    Returns:
        List of diagnostics, most severe first.
    """
    raw = stats.get("raw_count", 0)
    verified = stats.get("verified_count", 0)
    valid = stats.get("valid_count", 0)
    deduped = stats.get("deduped_count", 0)
    pages_fetched = stats.get("pages_fetched", 0)

    total_sources = len(sources)
    blocked = [s for s in sources if s.get("status") in ("blocked_by_policy", "blocked_by_robots")]
    failed = [s for s in sources if s.get("status") == "failed"]

    results: list[Diagnostic] = []

    # Rule 1: All sources blocked
    if total_sources > 0 and len(blocked) == total_sources:
        results.append(
            Diagnostic(
                rule="all_blocked",
                severity="warning",
                message=f"All {total_sources} pages were blocked by robots.txt or policy.",
                action="Try adding your own pages as seed URLs.",
            )
        )
        return results  # Nothing else can be diagnosed

    # Rule 2: Pages fetched but almost no text
    no_text_failures = sum(
        1 for s in failed if s.get("reason") and "insufficient text" in s.get("reason", "").lower()
    )
    if pages_fetched == 0 and no_text_failures > 0:
        results.append(
            Diagnostic(
                rule="no_text",
                severity="warning",
                message="These pages probably need JavaScript to load. "
                "No usable text was extracted.",
                action=None,
            )
        )

    # Rule 3: 0 extracted candidates
    if pages_fetched > 0 and raw == 0:
        filters_str = ", ".join(f"{k}: {v}" for k, v in stats.get("filters", {}).items()) or "none"
        results.append(
            Diagnostic(
                rule="no_extracted",
                severity="warning",
                message=f"No page contained matching records. "
                f"Your filters may be too strict: {filters_str}.",
                action="Edit filters in the plan.",
            )
        )

    # Rule 4: Extracted > 0, verified = 0
    if raw > 0 and verified == 0:
        results.append(
            Diagnostic(
                rule="all_hallucinated",
                severity="warning",
                message=f"{raw} records were dropped because their proof was not on the page.",
                action="View the Report for details.",
            )
        )

    # Rule 5: Verified > 0, valid = 0
    if verified > 0 and valid == 0:
        dropped_reasons = stats.get("dropped_reasons", {})
        missing_fields = dropped_reasons.get("missing_required", 0)
        results.append(
            Diagnostic(
                rule="all_invalid",
                severity="warning",
                message=f"Required fields were missing from all {verified} verified records."
                + (
                    f" ({missing_fields} dropped for missing required fields.)"
                    if missing_fields
                    else ""
                ),
                action="Edit the required fields in the plan.",
            )
        )

    # Rule 6: Fewer than target
    if 0 < deduped < target_count:
        results.append(
            Diagnostic(
                rule="below_target",
                severity="info",
                message=f"Found {deduped} of {target_count} requested records. Sources ran out.",
                action="Try finding more records.",
            )
        )

    # Additional: many blocked sources
    if len(blocked) > 0 and len(blocked) < total_sources:
        pct = round(len(blocked) / total_sources * 100)
        results.append(
            Diagnostic(
                rule="some_blocked",
                severity="info",
                message=f"{len(blocked)} of {total_sources} pages ({pct}%) were blocked.",
                action=None,
            )
        )

    # Additional: many failed fetches
    if len(failed) > 2:
        results.append(
            Diagnostic(
                rule="many_failures",
                severity="info",
                message=f"{len(failed)} pages failed to load.",
                action=None,
            )
        )

    return results
