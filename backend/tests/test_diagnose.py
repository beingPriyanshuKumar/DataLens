from __future__ import annotations

from app.core.diagnose import diagnose


def test_diagnose_all_blocked():
    sources = [
        {"status": "blocked_by_robots", "reason": "Disallowed by robots.txt"},
        {"status": "blocked_by_policy", "reason": "Blocked domain"},
    ]
    diags = diagnose(stats={}, sources=sources, target_count=30)
    assert len(diags) == 1
    assert diags[0].rule == "all_blocked"
    assert "blocked" in diags[0].message.lower()
    assert diags[0].action is not None


def test_diagnose_pages_need_js():
    sources = [
        {"status": "failed", "reason": "Insufficient text on page (client-side rendered?)"},
        {"status": "failed", "reason": "insufficient text found"},
    ]
    stats = {"pages_fetched": 0}
    diags = diagnose(stats=stats, sources=sources, target_count=30)
    assert any(d.rule == "no_text" for d in diags)


def test_diagnose_zero_candidates():
    sources = [
        {"status": "fetched", "reason": None, "records_found": 0},
    ]
    stats = {
        "pages_fetched": 3,
        "raw_count": 0,
    }
    diags = diagnose(stats=stats, sources=sources, target_count=30)
    assert any(d.rule == "no_extracted" for d in diags)


def test_diagnose_all_unsupported_evidence():
    sources = [
        {"status": "fetched", "reason": None, "records_found": 5},
    ]
    stats = {
        "pages_fetched": 2,
        "raw_count": 10,
        "verified_count": 0,
        "hallucinated_count": 10,
    }
    diags = diagnose(stats=stats, sources=sources, target_count=30)
    assert any(d.rule == "all_hallucinated" for d in diags)


def test_diagnose_missing_required():
    sources = [
        {"status": "fetched", "reason": None, "records_found": 5},
    ]
    stats = {
        "pages_fetched": 2,
        "raw_count": 5,
        "verified_count": 5,
        "valid_count": 0,
        "dropped_reasons": {"missing_required:salary": 5},
    }
    diags = diagnose(stats=stats, sources=sources, target_count=30)
    assert any(d.rule == "all_invalid" for d in diags)


def test_diagnose_fewer_than_target():
    sources = [
        {"status": "fetched", "reason": None, "records_found": 5},
    ]
    stats = {
        "pages_fetched": 3,
        "raw_count": 5,
        "verified_count": 5,
        "valid_count": 5,
        "deduped_count": 5,
    }
    # target was 30, only 5 found (< 50%)
    diags = diagnose(stats=stats, sources=sources, target_count=30)
    assert any(d.rule == "below_target" for d in diags)


def test_diagnose_healthy_run():
    sources = [
        {"status": "fetched", "reason": None, "records_found": 25},
    ]
    stats = {
        "pages_fetched": 5,
        "raw_count": 25,
        "verified_count": 24,
        "valid_count": 24,
        "deduped_count": 23,
    }
    diags = diagnose(stats=stats, sources=sources, target_count=20)
    assert len(diags) == 0
