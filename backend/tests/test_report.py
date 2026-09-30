from __future__ import annotations

from app.processing.report import (
    SOURCE_CONCENTRATION_PASS,
    VERIFICATION_RATE_PASS,
    build_report,
)


def test_build_report_normal_flow():
    stats = {
        "raw_count": 20,
        "verified_count": 15,
        "valid_count": 12,
        "deduped_count": 10,
        "hallucinated_count": 5,
        "dropped_reasons": {
            "missing_required": 3,
            "duplicate_merged": 2,
        },
    }
    records = [
        {"data": {"title": f"Job {i}", "company": f"Co {i}"}, "confidence": 0.9, "flags": []}
        for i in range(10)
    ]
    sources = [
        {"id": "s1", "status": "fetched", "domain": "example1.com", "records_found": 6},
        {"id": "s2", "status": "fetched", "domain": "example2.com", "records_found": 4},
        {"id": "s3", "status": "blocked_by_robots", "domain": "example3.com", "records_found": 0},
    ]
    fields = [
        {"name": "title", "required": True},
        {"name": "company", "required": False},
    ]

    report = build_report(stats, records, sources, fields)

    assert report.record_count == 10
    assert report.source_count == 3

    # Funnel
    assert len(report.funnel) == 4
    assert report.funnel[0].count == 20  # raw
    assert report.funnel[1].count == 15  # verified
    assert report.funnel[1].dropped == 5  # raw - verified
    assert report.funnel[2].count == 12  # valid
    assert report.funnel[2].dropped == 3  # verified - valid
    assert report.funnel[3].count == 10  # deduped
    assert report.funnel[3].dropped == 2  # valid - deduped

    # Signals
    signals = {s.name: s for s in report.trust_signals}
    # Verification rate: 15 / 20 = 0.75 >= 0.60 -> True
    assert signals["verification_rate"].value == 0.75
    assert signals["verification_rate"].passed is True
    assert signals["verification_rate"].threshold == VERIFICATION_RATE_PASS

    # Source concentration: 6 / 10 = 0.60 <= 0.60 -> True
    assert signals["source_concentration"].value == 0.60
    assert signals["source_concentration"].passed is True
    assert signals["source_concentration"].threshold == SOURCE_CONCENTRATION_PASS

    # Required completeness: 10 / 10 = 1.00 -> True
    assert signals["required_completeness"].value == 1.00
    assert signals["required_completeness"].passed is True

    # Field completeness
    fc = {f.name: f for f in report.field_completeness}
    assert fc["title"].non_null_count == 10
    assert fc["title"].share == 1.0
    assert fc["company"].non_null_count == 10

    # Sources summary
    assert report.sources_summary.fetched == 2
    assert report.sources_summary.blocked_by_robots == 1
    assert report.sources_summary.blocked_by_policy == 0
    assert report.sources_summary.failed == 0
    assert report.sources_summary.total == 3


def test_build_report_empty_data():
    stats = {}
    report = build_report(stats, [], [], [])
    assert report.record_count == 0
    assert report.source_count == 0
    assert len(report.funnel) == 4
    for step in report.funnel:
        assert step.count == 0


def test_build_report_low_trust_signals():
    stats = {
        "raw_count": 100,
        "verified_count": 20,  # 20% verification rate -> fail
        "valid_count": 20,
        "deduped_count": 10,
        "hallucinated_count": 80,
    }
    # Only 1 source domain -> high concentration 100% -> fail
    records = [{"data": {"title": None}, "confidence": 0.5, "flags": []}]
    sources = [{"id": "s1", "status": "fetched", "domain": "monopoly.com", "records_found": 10}]
    fields = [{"name": "title", "required": True}]

    report = build_report(stats, records, sources, fields)
    signals = {s.name: s for s in report.trust_signals}

    assert signals["verification_rate"].passed is False
    assert signals["source_concentration"].passed is False
    assert signals["required_completeness"].passed is False
