from app.processing.verifier import verify_evidence, verify_records


def test_verify_evidence_verbatim():
    page_text = "Acme Corp is hiring a Senior Frontend Engineer in Berlin with a salary of 90k EUR."
    snippet = "hiring a Senior Frontend Engineer in Berlin"
    assert verify_evidence(snippet, page_text) is True


def test_verify_evidence_whitespace_and_case():
    page_text = "Acme Corp is   hiring a\n\tSenior Frontend Engineer   in Berlin."
    snippet = "HIRING A SENIOR FRONTEND ENGINEER IN BERLIN"
    assert verify_evidence(snippet, page_text) is True


def test_verify_evidence_hallucinated():
    page_text = "Acme Corp is hiring a Junior Designer in London."
    snippet = "salary of 150k USD for Vice President of Engineering"
    assert verify_evidence(snippet, page_text) is False


def test_verify_evidence_empty():
    assert verify_evidence("", "some page text") is False
    assert verify_evidence("some snippet", "") is False


def test_verify_records_drops_hallucinations():
    page_text = "Stripe announced $6.5B funding round at $50B valuation."
    records = [
        {
            "company": "Stripe",
            "round": "$6.5B",
            "evidence": "$6.5B funding round at $50B valuation",
        },
        {
            "company": "Fictional Corp",
            "round": "$100M",
            "evidence": "Fictional Corp closed $100M Series B today",
        },
    ]

    verified, hallucinated_count, fields_nulled = verify_records(
        records, page_text, "https://example.com/news"
    )
    assert len(verified) == 1
    assert verified[0]["company"] == "Stripe"
    assert hallucinated_count == 1
    assert fields_nulled == 0


def test_verify_evidence_advanced_normalization():
    """Verify smart quotes, dashes, ellipses, non-breaking spaces, zero-width chars."""
    page_text = "Acme\u00a0Corp announced a “mega-deal” – worth $50M… &amp; more.\u200b"
    snippet = 'Acme Corp announced a "mega-deal" - worth $50M... & more.'
    assert verify_evidence(snippet, page_text) is True


def test_verify_records_field_grounding_india_in_founders():
    """Reproduce P2 'India in founders' case: imputed value not in context becomes null."""
    page_text = (
        "Directory of Tech Companies\n"
        "Region: India\n"
        "--------------------------------------------------\n"
        "Zepto raised $200M Series E in Mumbai in Jan 2025. Contact: founders@zepto.in\n"
    )
    records = [
        {
            "company": "Zepto",
            "amount": 200,
            "founders": "India",  # Imputed from page header outside entity context
            "evidence": "Zepto raised $200M Series E in Mumbai in Jan 2025.",
        }
    ]

    verified, hallucinated, fields_nulled = verify_records(
        records, page_text, "https://example.com/startups"
    )
    assert len(verified) == 1
    rec = verified[0]
    assert rec["company"] == "Zepto"  # Grounded
    assert rec["founders"] is None  # Imputed value was nulled!
    assert "unsupported_value" in rec["_flags"]
    assert "unsupported_value_founders" in rec["_flags"]
    assert fields_nulled == 1


def test_verify_records_valid_fields_preserved():
    """Valid fields present in evidence or surrounding chunk are preserved."""
    page_text = "Aadit Palicha founded Zepto in Mumbai and raised $200M in 2025."
    records = [
        {
            "company": "Zepto",
            "founders": "Aadit Palicha",
            "evidence": "Aadit Palicha founded Zepto in Mumbai and raised $200M in 2025.",
        }
    ]

    verified, hallucinated, fields_nulled = verify_records(
        records, page_text, "https://example.com/startups"
    )
    assert len(verified) == 1
    rec = verified[0]
    assert rec["company"] == "Zepto"
    assert rec["founders"] == "Aadit Palicha"
    assert fields_nulled == 0
