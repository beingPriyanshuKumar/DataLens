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

    verified, hallucinated_count = verify_records(records, page_text, "https://example.com/news")
    assert len(verified) == 1
    assert verified[0]["company"] == "Stripe"
    assert hallucinated_count == 1
