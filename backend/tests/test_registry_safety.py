import pytest
from copy import deepcopy
from app.schemas.registry import (
    register_form,
    get_form,
    _CUSTOM_FORMS,
    MAX_CUSTOM_SCHEMAS,
    MAX_SCHEMA_BYTES,
    MAX_PROPERTIES,
)
from app.services.session_service import SessionStore, patch_field, snapshot
from app.services.errors import APIError


def test_registry_payload_size_limit():
    """Schemas exceeding MAX_SCHEMA_BYTES (64 KB) are rejected with 413."""
    huge_desc = "x" * (MAX_SCHEMA_BYTES + 100)
    schema = {
        "$id": "huge_schema_test_v1",
        "title": "Huge Form",
        "description": huge_desc,
        "properties": {
            "name": {"type": "string"}
        }
    }
    with pytest.raises(APIError) as exc_info:
        register_form(schema)
    assert exc_info.value.status == 413
    assert exc_info.value.code == "SCHEMA_PAYLOAD_TOO_LARGE"


def test_registry_property_count_limit():
    """Schemas with more than 50 properties are rejected with 422 SCHEMA_TOO_LARGE."""
    properties = {f"field_{i}": {"type": "string"} for i in range(MAX_PROPERTIES + 1)}
    schema = {
        "$id": "too_many_fields_test_v1",
        "title": "Too Many Fields",
        "properties": properties
    }
    with pytest.raises(APIError) as exc_info:
        register_form(schema)
    assert exc_info.value.status == 422
    assert exc_info.value.code == "SCHEMA_TOO_LARGE"


def test_builtin_forms_protected_from_overwrite():
    """Attempting to overwrite a builtin form returns the builtin definition without mutating it."""
    malicious_schema = {
        "$id": "student_registration_v1",
        "title": "Malicious Hijack Form",
        "properties": {
            "hacked": {"type": "string"}
        }
    }
    result = register_form(malicious_schema)
    assert result["title"] != "Malicious Hijack Form"
    assert "hacked" not in result["properties"]
    assert "full_name" in result["properties"]


def test_duplicate_registration_refreshes_without_leaking():
    """Re-registering the same form_id updates the schema without increasing count."""
    schema1 = {
        "$id": "duplicate_test_form_v1",
        "title": "Version 1",
        "properties": {"name": {"type": "string"}}
    }
    register_form(schema1)
    count_before = len(_CUSTOM_FORMS)

    schema2 = {
        "$id": "duplicate_test_form_v1",
        "title": "Version 2 Updated",
        "properties": {"name": {"type": "string"}, "age": {"type": "integer"}}
    }
    register_form(schema2)
    count_after = len(_CUSTOM_FORMS)

    assert count_after == count_before
    fetched = get_form("duplicate_test_form_v1")
    assert fetched["title"] == "Version 2 Updated"
    assert "age" in fetched["properties"]


def test_registry_bounded_eviction():
    """Registering > MAX_CUSTOM_SCHEMAS evicts the oldest entries (LRU)."""
    # Fill registry up to MAX_CUSTOM_SCHEMAS
    for i in range(MAX_CUSTOM_SCHEMAS + 10):
        s = {
            "$id": f"bounded_form_{i}_v1",
            "title": f"Bounded Form {i}",
            "properties": {"f": {"type": "string"}}
        }
        register_form(s)

    assert len(_CUSTOM_FORMS) <= MAX_CUSTOM_SCHEMAS
    # First entries should have been evicted
    assert get_form("bounded_form_0_v1") is None
    # Latest entries must be present
    assert get_form(f"bounded_form_{MAX_CUSTOM_SCHEMAS + 9}_v1") is not None


def test_session_to_schema_consistency():
    """Active sessions retain their schema snapshot even if registry evicts the schema."""
    store = SessionStore()
    custom_schema = {
        "$id": "evictable_session_schema_v1",
        "title": "Evictable Schema",
        "properties": {"applicant_name": {"type": "string"}},
        "required": ["applicant_name"]
    }
    session = store.create(
        form_id="evictable_session_schema_v1",
        locale="en-IN",
        custom_schema=custom_schema
    )

    # Force eviction of the schema from _CUSTOM_FORMS
    _CUSTOM_FORMS.pop("evictable_session_schema_v1", None)
    assert get_form("evictable_session_schema_v1") is None

    # Session still functions and validates against its own immutable schema
    patch_field(session, "applicant_name", "Deepak Roy", source="manual")
    snap = snapshot(session)
    assert snap["can_confirm"] is True
    assert snap["values"]["applicant_name"] == "Deepak Roy"
