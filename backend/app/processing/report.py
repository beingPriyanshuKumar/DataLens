"""Trust Report: pure functions that compute report metrics from run data.

Every number in the report is explainable — no opaque AI grades.
"""

from __future__ import annotations

from dataclasses import dataclass

# ── Thresholds (named constants) ────────────────────────────────────────
VERIFICATION_RATE_PASS = 0.60
CORROBORATION_PASS = 0.25
SOURCE_CONCENTRATION_PASS = 0.60  # upper bound — lower is better
REQUIRED_COMPLETENESS_PASS = 1.00


@dataclass
class TrustSignal:
    name: str
    label: str
    formula: str
    value: float
    threshold: float
    passed: bool


@dataclass
class FieldCompleteness:
    name: str
    non_null_count: int
    total: int
    share: float


@dataclass
class FunnelStep:
    label: str
    count: int
    dropped: int
    drop_reasons: dict[str, int]


@dataclass
class SourcesSummary:
    fetched: int
    blocked_by_policy: int
    blocked_by_robots: int
    failed: int
    total: int


@dataclass
class TrustReport:
    funnel: list[FunnelStep]
    trust_signals: list[TrustSignal]
    field_completeness: list[FieldCompleteness]
    sources_summary: SourcesSummary
    record_count: int
    source_count: int


def build_report(
    stats: dict,
    records: list[dict],
    sources: list[dict],
    fields: list[dict],
) -> TrustReport:
    """Build a trust report from run data.

    Args:
        stats: Run pipeline stats dict.
        records: List of record dicts (with data, confidence, flags).
        sources: List of source dicts (with status, domain, records_found).
        fields: List of field spec dicts (with name, required).

    Returns:
        A TrustReport with funnel, trust signals, field completeness, and sources.
    """
    raw = stats.get("raw_count", 0)
    verified = stats.get("verified_count", 0)
    valid = stats.get("valid_count", 0)
    deduped = stats.get("deduped_count", 0)
    hallucinated = stats.get("hallucinated_count", 0)
    dropped_reasons = stats.get("dropped_reasons", {})

    # ── Funnel ────────────────────────────────────────────────────────
    funnel = [
        FunnelStep(
            label="Raw extracted",
            count=raw,
            dropped=0,
            drop_reasons={},
        ),
        FunnelStep(
            label="Verified",
            count=verified,
            dropped=raw - verified,
            drop_reasons={"evidence_mismatch": hallucinated},
        ),
        FunnelStep(
            label="Valid",
            count=valid,
            dropped=verified - valid,
            drop_reasons={k: v for k, v in dropped_reasons.items() if k == "missing_required"},
        ),
        FunnelStep(
            label="Deduplicated",
            count=deduped,
            dropped=valid - deduped,
            drop_reasons={"duplicate_merged": valid - deduped},
        ),
    ]

    # ── Trust signals ─────────────────────────────────────────────────
    verification_rate = verified / raw if raw > 0 else 0.0

    # Corroboration: records with evidence from ≥ 2 distinct domains
    # (approximated from source data: count records that appear in ≥ 2 sources)
    domain_counts: dict[str, set[str]] = {}  # domain → set of source_ids
    for src in sources:
        if src.get("status") == "fetched":
            domain = src.get("domain", "")
            if domain:
                domain_counts.setdefault(domain, set()).add(src.get("id", ""))

    # Source concentration: share of records from the top domain
    domain_record_counts: dict[str, int] = {}
    for src in sources:
        if src.get("status") == "fetched" and src.get("domain"):
            domain_record_counts[src["domain"]] = domain_record_counts.get(
                src["domain"], 0
            ) + src.get("records_found", 0)

    total_from_sources = sum(domain_record_counts.values())
    top_domain_share = (
        max(domain_record_counts.values()) / total_from_sources if total_from_sources > 0 else 0.0
    )

    # Multi-source corroboration: domain diversity as proxy for records from multiple sources
    distinct_domains = len([d for d, c in domain_record_counts.items() if c > 0])
    corroboration_value = min(1.0, distinct_domains / 4) if deduped > 0 else 0.0

    # Required completeness
    required_fields = [f["name"] for f in fields if f.get("required")]
    if required_fields and records:
        complete_count = 0
        for rec in records:
            data = rec.get("data", {})
            if isinstance(data, str):
                import json

                data = json.loads(data)
            all_present = all(
                data.get(fname) is not None and data.get(fname) != "" for fname in required_fields
            )
            if all_present:
                complete_count += 1
        required_completeness = complete_count / len(records) if records else 0.0
    else:
        required_completeness = 1.0

    trust_signals = [
        TrustSignal(
            name="verification_rate",
            label="Verification rate",
            formula="verified ÷ raw",
            value=round(verification_rate, 3),
            threshold=VERIFICATION_RATE_PASS,
            passed=verification_rate >= VERIFICATION_RATE_PASS,
        ),
        TrustSignal(
            name="corroboration",
            label="Source diversity",
            formula="distinct fetched domains with records ÷ 4",
            value=round(corroboration_value, 3),
            threshold=CORROBORATION_PASS,
            passed=corroboration_value >= CORROBORATION_PASS,
        ),
        TrustSignal(
            name="source_concentration",
            label="Source concentration",
            formula="records from top domain ÷ total sourced",
            value=round(top_domain_share, 3),
            threshold=SOURCE_CONCENTRATION_PASS,
            passed=top_domain_share <= SOURCE_CONCENTRATION_PASS,
        ),
        TrustSignal(
            name="required_completeness",
            label="Required completeness",
            formula="records with all required fields ÷ total",
            value=round(required_completeness, 3),
            threshold=REQUIRED_COMPLETENESS_PASS,
            passed=required_completeness >= REQUIRED_COMPLETENESS_PASS,
        ),
    ]

    # ── Field completeness ────────────────────────────────────────────
    import json as json_mod

    field_comp: list[FieldCompleteness] = []
    total_records = len(records)
    for f in fields:
        fname = f["name"]
        non_null = 0
        for rec in records:
            data = rec.get("data", {})
            if isinstance(data, str):
                data = json_mod.loads(data)
            val = data.get(fname)
            if val is not None and val != "":
                non_null += 1
        field_comp.append(
            FieldCompleteness(
                name=fname,
                non_null_count=non_null,
                total=total_records,
                share=round(non_null / total_records, 3) if total_records > 0 else 0.0,
            )
        )

    # ── Sources summary ───────────────────────────────────────────────
    fetched = sum(1 for s in sources if s.get("status") == "fetched")
    blocked_policy = sum(1 for s in sources if s.get("status") == "blocked_by_policy")
    blocked_robots = sum(1 for s in sources if s.get("status") == "blocked_by_robots")
    failed = sum(1 for s in sources if s.get("status") == "failed")

    sources_summary = SourcesSummary(
        fetched=fetched,
        blocked_by_policy=blocked_policy,
        blocked_by_robots=blocked_robots,
        failed=failed,
        total=len(sources),
    )

    return TrustReport(
        funnel=funnel,
        trust_signals=trust_signals,
        field_completeness=field_comp,
        sources_summary=sources_summary,
        record_count=deduped,
        source_count=len(sources),
    )
