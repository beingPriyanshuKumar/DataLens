from app.core.spec import enforce_required_fields
from app.models import SourceStatus
from app.processing.extractor import chunk_text
from app.schemas import FieldSpec, TaskSpec


def test_enforce_required_fields_caps_at_three():
    """Enforce at most 3 key fields are required, even if spec has more marked required."""
    fields = [
        FieldSpec(name="f1", type="str", description="d1", required=True),
        FieldSpec(name="f2", type="str", description="d2", required=True),
        FieldSpec(name="f3", type="str", description="d3", required=True),
        FieldSpec(name="f4", type="str", description="d4", required=True),
        FieldSpec(name="f5", type="str", description="d5", required=True),
    ]
    spec = TaskSpec(
        entity="Item",
        fields=fields,
        key_fields=["f1", "f2", "f3", "f4"],
    )
    enforced = enforce_required_fields(spec)
    required_names = [f.name for f in enforced.fields if f.required]
    assert required_names == ["f1", "f2", "f3"]
    assert len(required_names) <= 3
    # f4 and f5 became optional
    assert enforced.fields[3].required is False
    assert enforced.fields[4].required is False


def test_chunk_text_short():
    """Short text is not chunked."""
    text = "Short text"
    chunks = chunk_text(text, chunk_size=8000, overlap=500)
    assert len(chunks) == 1
    assert chunks[0] == text


def test_chunk_text_long_overlap():
    """Long text is chunked into overlapping windows."""
    # 20,000 characters
    text = "x" * 20000
    chunks = chunk_text(text, chunk_size=8000, overlap=500)
    assert len(chunks) == 3
    assert len(chunks[0]) == 8000
    assert len(chunks[1]) == 8000
    assert len(chunks[2]) <= 8000


def test_source_status_has_via_search_provider():
    """SourceStatus includes VIA_SEARCH_PROVIDER enum value."""
    assert SourceStatus.VIA_SEARCH_PROVIDER == "via_search_provider"
    assert "via_search_provider" in [s.value for s in SourceStatus]
