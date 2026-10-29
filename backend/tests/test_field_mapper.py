import pytest

from app.models.contracts import Candidate, Issue
from app.schemas.registry import get_form
from app.services.field_mapper import map_candidates
from app.services.validators import check_field
from datetime import date

REG_FORM_ID = "student_registration_v1"
ASSIST_FORM_ID = "student_assistance_v1"

ALLOWED_REG_FIELDS = set(get_form(REG_FORM_ID)["properties"].keys())
ALLOWED_ASSIST_FIELDS = set(get_form(ASSIST_FORM_ID)["properties"].keys())


def test_correctly_grounded_english_candidate():
    transcript = "My name is John Doe and I live in Guwahati"
    candidates = [
        {
            "field_id": "full_name",
            "value": "John Doe",
            "evidence_text": "John Doe",
            "uncertain": False,
            "ambiguity_reason": None,
        },
        {
            "field_id": "city",
            "value": "Guwahati",
            "evidence_text": "live in Guwahati",
            "uncertain": False,
            "ambiguity_reason": None,
        },
    ]
    result = map_candidates(REG_FORM_ID, transcript, candidates, ALLOWED_REG_FIELDS)
    assert len(result["accepted"]) == 2
    assert len(result["issues"]) == 0
    assert len(result["conflicts"]) == 0

    # Ensure CONTRACT compatibility
    for c in result["accepted"]:
        Candidate.model_validate(c)


def test_correctly_grounded_hindi_unicode_candidate():
    transcript = "मेरा नाम पूजा दास है और मैं असम से हूँ"
    candidates = [
        {
            "field_id": "full_name",
            "value": "पूजा दास",
            "evidence_text": "पूजा दास",
            "uncertain": False,
            "ambiguity_reason": None,
        },
        {
            "field_id": "state",
            "value": "Assam",
            "evidence_text": "असम",
            "uncertain": False,
            "ambiguity_reason": None,
        },
    ]
    result = map_candidates(REG_FORM_ID, transcript, candidates, ALLOWED_REG_FIELDS)
    assert len(result["accepted"]) == 2
    assert result["accepted"][0]["value"] == "पूजा दास"
    assert result["accepted"][0]["field_id"] == "full_name"
    assert len(result["issues"]) == 0


def test_unknown_field_id():
    transcript = "I am 20 years old and male"
    candidates = [
        {
            "field_id": "gender",
            "value": "Male",
            "evidence_text": "male",
            "uncertain": False,
            "ambiguity_reason": None,
        }
    ]
    result = map_candidates(REG_FORM_ID, transcript, candidates, ALLOWED_REG_FIELDS)
    assert len(result["accepted"]) == 0
    assert len(result["issues"]) == 1
    issue = result["issues"][0]
    assert issue["field_id"] == "gender"
    assert issue["type"] == "UNKNOWN_FIELD"
    Issue.model_validate(issue)


def test_missing_evidence():
    transcript = "My mobile is 9876543210"
    candidates = [
        {
            "field_id": "mobile",
            "value": "9876543210",
            "evidence_text": "   ",
            "uncertain": False,
            "ambiguity_reason": None,
        }
    ]
    result = map_candidates(REG_FORM_ID, transcript, candidates, ALLOWED_REG_FIELDS)
    assert len(result["accepted"]) == 0
    assert len(result["issues"]) == 1
    assert result["issues"][0]["type"] == "MISSING_EVIDENCE"
    Issue.model_validate(result["issues"][0])


def test_evidence_not_present_in_transcript():
    transcript = "I want to apply for BCA in Assam"
    candidates = [
        {
            "field_id": "city",
            "value": "Shillong",
            "evidence_text": "living in Shillong",
            "uncertain": False,
            "ambiguity_reason": None,
        }
    ]
    result = map_candidates(REG_FORM_ID, transcript, candidates, ALLOWED_REG_FIELDS)
    assert len(result["accepted"]) == 0
    assert len(result["issues"]) == 1
    assert result["issues"][0]["type"] == "UNGROUNDED"
    Issue.model_validate(result["issues"][0])


def test_null_candidate_value():
    transcript = "I do not have an email address"
    candidates = [
        {
            "field_id": "email",
            "value": None,
            "evidence_text": "do not have an email",
            "uncertain": False,
            "ambiguity_reason": None,
        }
    ]
    result = map_candidates(REG_FORM_ID, transcript, candidates, ALLOWED_REG_FIELDS)
    assert len(result["accepted"]) == 0
    assert len(result["issues"]) == 1
    assert result["issues"][0]["type"] == "NULL_VALUE"
    assert result["issues"][0]["field_id"] == "email"
    Issue.model_validate(result["issues"][0])


def test_two_conflicting_proposals_for_one_field():
    transcript = "My phone is 9876543210 or maybe 9123456780"
    candidates = [
        {
            "field_id": "mobile",
            "value": "9876543210",
            "evidence_text": "9876543210",
            "uncertain": False,
            "ambiguity_reason": None,
        },
        {
            "field_id": "mobile",
            "value": "9123456780",
            "evidence_text": "9123456780",
            "uncertain": True,
            "ambiguity_reason": "Alternative number mentioned",
        },
    ]
    result = map_candidates(REG_FORM_ID, transcript, candidates, ALLOWED_REG_FIELDS)
    assert len(result["accepted"]) == 0
    assert "mobile" in result["conflicts"]
    assert len(result["issues"]) == 1
    issue = result["issues"][0]
    assert issue["type"] == "CONFLICT"
    assert issue["field_id"] == "mobile"
    assert set(issue["candidates"]) == {"9876543210", "9123456780"}
    Issue.model_validate(issue)


def test_uncertain_name():
    transcript = "I think my guardian name is spelled Debabrata or Devbrata"
    candidates = [
        {
            "field_id": "guardian_name",
            "value": "Debabrata",
            "evidence_text": "Debabrata",
            "uncertain": True,
            "ambiguity_reason": "Audio pronunciation ambiguous between Debabrata and Devbrata",
        }
    ]
    result = map_candidates(REG_FORM_ID, transcript, candidates, ALLOWED_REG_FIELDS)
    assert len(result["accepted"]) == 1
    candidate = result["accepted"][0]
    assert candidate["uncertain"] is True
    assert candidate["ambiguity_reason"] == "Audio pronunciation ambiguous between Debabrata and Devbrata"
    Candidate.model_validate(candidate)


def test_unsupported_enum_candidate_passed_to_validation():
    # The mapper accepts grounded candidates for allowed fields, leaving deterministic enum validation to validators.py
    transcript = "I am taking Aeronautical Engineering"
    candidates = [
        {
            "field_id": "programme",
            "value": "Aeronautical Engineering",
            "evidence_text": "Aeronautical Engineering",
            "uncertain": False,
            "ambiguity_reason": None,
        }
    ]
    result = map_candidates(REG_FORM_ID, transcript, candidates, ALLOWED_REG_FIELDS)
    assert len(result["accepted"]) == 1
    assert result["accepted"][0]["field_id"] == "programme"

    # Verify that validators.check_field rejects this unsupported enum
    schema = get_form(REG_FORM_ID)
    spec = schema["properties"]["programme"]
    val, status, msg = check_field("programme", result["accepted"][0]["value"], spec, True, date(2026, 10, 29))
    assert status == "invalid"
    assert "Choose one of the listed options." in msg


def test_attempted_overwrite_of_manual_correction():
    transcript = "My name is Aditi Roy"
    candidates = [
        {
            "field_id": "full_name",
            "value": "Aditi Roy",
            "evidence_text": "Aditi Roy",
            "uncertain": False,
            "ambiguity_reason": None,
        }
    ]
    # full_name was manually corrected by the user previously
    manual_fields = {"full_name"}
    result = map_candidates(REG_FORM_ID, transcript, candidates, ALLOWED_REG_FIELDS, manual_fields=manual_fields)
    assert len(result["accepted"]) == 0
    assert len(result["issues"]) == 1
    issue = result["issues"][0]
    assert issue["type"] == "MANUAL_OVERRIDE_PROTECTED"
    assert issue["field_id"] == "full_name"
    Issue.model_validate(issue)


def test_transcript_containing_no_facts_for_proposed_field():
    transcript = "Hello I would like some information about fees and scholarships"
    candidates = [
        {
            "field_id": "date_of_birth",
            "value": "2005-08-15",
            "evidence_text": "15th August 2005",
            "uncertain": False,
            "ambiguity_reason": None,
        }
    ]
    result = map_candidates(ASSIST_FORM_ID, transcript, candidates, ALLOWED_ASSIST_FIELDS)
    assert len(result["accepted"]) == 0
    assert len(result["issues"]) == 1
    assert result["issues"][0]["type"] == "UNGROUNDED"
    Issue.model_validate(result["issues"][0])


def test_unknown_form_id():
    transcript = "My name is Aditi Roy"
    candidates = [
        {
            "field_id": "full_name",
            "value": "Aditi Roy",
            "evidence_text": "Aditi Roy",
            "uncertain": False,
            "ambiguity_reason": None,
        }
    ]
    result = map_candidates("unregistered_form_v99", transcript, candidates)
    assert len(result["accepted"]) == 0
    assert len(result["issues"]) == 1
    issue = result["issues"][0]
    assert issue["type"] == "UNKNOWN_FORM"
    assert issue["field_id"] is None
    Issue.model_validate(issue)


def test_mismatched_allowed_fields_from_different_form():
    transcript = "I need books for my study"
    candidates = [
        {
            "field_id": "assistance_type",
            "value": "books",
            "evidence_text": "books",
            "uncertain": False,
            "ambiguity_reason": None,
        }
    ]
    # Attempting to supply student_assistance_v1 fields to student_registration_v1
    result = map_candidates(REG_FORM_ID, transcript, candidates, allowed_fields=ALLOWED_ASSIST_FIELDS)
    assert len(result["accepted"]) == 0
    assert len(result["issues"]) == 1
    issue = result["issues"][0]
    assert issue["type"] == "INVALID_ALLOWLIST"
    assert issue["field_id"] is None
    Issue.model_validate(issue)


def test_default_allowed_fields_from_schema():
    transcript = "My name is Aditi Roy"
    candidates = [
        {
            "field_id": "full_name",
            "value": "Aditi Roy",
            "evidence_text": "Aditi Roy",
            "uncertain": False,
            "ambiguity_reason": None,
        }
    ]
    # allowed_fields omitted -> defaults to the registered schema's properties
    result = map_candidates(REG_FORM_ID, transcript, candidates)
    assert len(result["accepted"]) == 1
    assert result["accepted"][0]["field_id"] == "full_name"
    assert len(result["issues"]) == 0
