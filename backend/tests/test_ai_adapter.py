import pytest
from unittest.mock import AsyncMock

from app.ai import ai_service
from app.models.contracts import Candidate, ExtractionResponse, Issue
from app.services.ai_adapter import apply_field_mapping

REG_FORM = "student_registration_v1"


def test_apply_field_mapping_grounded():
    transcript = "My name is Priya Sharma and I live in Guwahati"
    raw_response = ExtractionResponse(
        candidates=[
            Candidate(
                field_id="full_name",
                value="Priya Sharma",
                evidence_text="Priya Sharma",
                uncertain=False,
                ambiguity_reason=None,
            ),
            Candidate(
                field_id="city",
                value="Guwahati",
                evidence_text="live in Guwahati",
                uncertain=False,
                ambiguity_reason=None,
            ),
        ],
        issues=[],
    )

    result = apply_field_mapping(REG_FORM, transcript, raw_response)
    assert len(result.candidates) == 2
    assert result.candidates[0].field_id == "full_name"
    assert result.candidates[0].value == "Priya Sharma"
    assert result.candidates[1].field_id == "city"
    assert result.candidates[1].value == "Guwahati"
    assert len(result.issues) == 0


def test_apply_field_mapping_ungrounded():
    transcript = "I want to apply for BCA in Guwahati"
    raw_response = ExtractionResponse(
        candidates=[
            Candidate(
                field_id="full_name",
                value="Rohit Sen",
                evidence_text="Rohit Sen",
                uncertain=False,
                ambiguity_reason=None,
            )
        ],
        issues=[],
    )

    result = apply_field_mapping(REG_FORM, transcript, raw_response)
    assert len(result.candidates) == 0
    assert len(result.issues) == 1
    assert result.issues[0].field_id == "full_name"
    assert result.issues[0].type == "UNGROUNDED"


def test_apply_field_mapping_unknown_field():
    transcript = "I am male and 20 years old"
    raw_response = ExtractionResponse(
        candidates=[
            Candidate(
                field_id="gender",
                value="male",
                evidence_text="male",
                uncertain=False,
                ambiguity_reason=None,
            )
        ],
        issues=[],
    )

    result = apply_field_mapping(REG_FORM, transcript, raw_response)
    assert len(result.candidates) == 0
    assert len(result.issues) == 1
    assert result.issues[0].field_id == "gender"
    assert result.issues[0].type == "UNKNOWN_FIELD"


def test_apply_field_mapping_null_value():
    transcript = "I do not have an email"
    raw_response = ExtractionResponse(
        candidates=[
            Candidate(
                field_id="email",
                value=None,
                evidence_text="do not have an email",
                uncertain=False,
                ambiguity_reason=None,
            )
        ],
        issues=[],
    )

    result = apply_field_mapping(REG_FORM, transcript, raw_response)
    assert len(result.candidates) == 0
    assert len(result.issues) == 1
    assert result.issues[0].field_id == "email"
    assert result.issues[0].type == "NULL_VALUE"


def test_apply_field_mapping_conflicts():
    transcript = "Call me on 9876543210 or alternatively on 9123456780"
    raw_response = ExtractionResponse(
        candidates=[
            Candidate(
                field_id="mobile",
                value="9876543210",
                evidence_text="9876543210",
                uncertain=False,
                ambiguity_reason=None,
            ),
            Candidate(
                field_id="mobile",
                value="9123456780",
                evidence_text="9123456780",
                uncertain=True,
                ambiguity_reason="Secondary number",
            ),
        ],
        issues=[],
    )

    result = apply_field_mapping(REG_FORM, transcript, raw_response)
    assert len(result.candidates) == 0
    assert len(result.issues) == 1
    assert result.issues[0].field_id == "mobile"
    assert result.issues[0].type == "CONFLICT"
    assert set(result.issues[0].candidates) == {"9876543210", "9123456780"}


def test_apply_field_mapping_manual_field_protection():
    transcript = "My name is Pooja Das"
    raw_response = ExtractionResponse(
        candidates=[
            Candidate(
                field_id="full_name",
                value="Pooja Das",
                evidence_text="Pooja Das",
                uncertain=False,
                ambiguity_reason=None,
            )
        ],
        issues=[],
    )

    manual_fields = {"full_name"}
    result = apply_field_mapping(REG_FORM, transcript, raw_response, manual_fields=manual_fields)
    assert len(result.candidates) == 0
    assert len(result.issues) == 1
    assert result.issues[0].field_id == "full_name"
    assert result.issues[0].type == "MANUAL_OVERRIDE_PROTECTED"


def test_apply_field_mapping_issue_deduplication():
    transcript = "I want to study Robotics Engineering"
    raw_response = ExtractionResponse(
        candidates=[
            Candidate(
                field_id="programme",
                value="Robotics Engineering",
                evidence_text="Robotics Engineering",
                uncertain=True,
                ambiguity_reason="Not in enum",
            )
        ],
        issues=[
            Issue(
                field_id="programme",
                type="UNLISTED_OPTION",
                message="'Robotics Engineering' is not available in dropdown options",
                candidates=["BSc Physics", "BCA", "BA English", "Other"],
            )
        ],
    )

    result = apply_field_mapping(REG_FORM, transcript, raw_response)
    assert len(result.candidates) == 1
    assert result.candidates[0].field_id == "programme"
    # Existing issue should be preserved
    assert any(i.type == "UNLISTED_OPTION" for i in result.issues)


def test_apply_field_mapping_uncertainty_preserved():
    transcript = "My guardian name might be Debabrata"
    raw_response = ExtractionResponse(
        candidates=[
            Candidate(
                field_id="guardian_name",
                value="Debabrata",
                evidence_text="Debabrata",
                uncertain=True,
                ambiguity_reason="Audio pronunciation ambiguous",
            )
        ],
        issues=[],
    )

    result = apply_field_mapping(REG_FORM, transcript, raw_response)
    assert len(result.candidates) == 1
    assert result.candidates[0].uncertain is True
    assert result.candidates[0].ambiguity_reason == "Audio pronunciation ambiguous"


# --- Route Integration Tests with Mocked Provider ---


def test_extract_route_with_grounded_candidates(client, monkeypatch):
    monkeypatch.setattr(ai_service.groq, "api_key", "mock_key")

    mock_extract = AsyncMock(
        return_value=ExtractionResponse(
            candidates=[
                Candidate(
                    field_id="full_name",
                    value="Aditi Sen",
                    evidence_text="Aditi Sen",
                    uncertain=False,
                    ambiguity_reason=None,
                )
            ],
            issues=[],
        )
    )
    monkeypatch.setattr(ai_service, "extract_from_transcript", mock_extract)

    res = client.post("/api/sessions", json={"form_id": REG_FORM, "locale": "en-IN"})
    assert res.status_code == 201
    sid = res.json()["session_id"]

    response = client.post(
        f"/api/sessions/{sid}/extract",
        json={"transcript": "My name is Aditi Sen", "language_code": "en-IN"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["candidates"]) == 1
    assert data["candidates"][0]["field_id"] == "full_name"
    assert data["candidates"][0]["value"] == "Aditi Sen"
    assert len(data["issues"]) == 0


def test_extract_route_filters_ungrounded_candidates(client, monkeypatch):
    monkeypatch.setattr(ai_service.groq, "api_key", "mock_key")

    mock_extract = AsyncMock(
        return_value=ExtractionResponse(
            candidates=[
                Candidate(
                    field_id="city",
                    value="Shillong",
                    evidence_text="living in Shillong",
                    uncertain=False,
                    ambiguity_reason=None,
                )
            ],
            issues=[],
        )
    )
    monkeypatch.setattr(ai_service, "extract_from_transcript", mock_extract)

    res = client.post("/api/sessions", json={"form_id": REG_FORM, "locale": "en-IN"})
    assert res.status_code == 201
    sid = res.json()["session_id"]

    response = client.post(
        f"/api/sessions/{sid}/extract",
        json={"transcript": "I am in Assam studying BCA", "language_code": "en-IN"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["candidates"]) == 0
    assert len(data["issues"]) == 1
    assert data["issues"][0]["field_id"] == "city"
    assert data["issues"][0]["type"] == "UNGROUNDED"


def test_extract_route_preserves_manual_corrections(client, monkeypatch):
    monkeypatch.setattr(ai_service.groq, "api_key", "mock_key")

    mock_extract = AsyncMock(
        return_value=ExtractionResponse(
            candidates=[
                Candidate(
                    field_id="full_name",
                    value="Pooja Das",
                    evidence_text="Pooja Das",
                    uncertain=False,
                    ambiguity_reason=None,
                )
            ],
            issues=[],
        )
    )
    monkeypatch.setattr(ai_service, "extract_from_transcript", mock_extract)

    res = client.post("/api/sessions", json={"form_id": REG_FORM, "locale": "en-IN"})
    assert res.status_code == 201
    sid = res.json()["session_id"]

    # Manually correct full_name
    patch_res = client.patch(
        f"/api/sessions/{sid}/fields",
        json={"field_id": "full_name", "value": "Aditi Roy", "source": "manual"},
    )
    assert patch_res.status_code == 200

    # Call extract with an AI candidate for the same field
    response = client.post(
        f"/api/sessions/{sid}/extract",
        json={"transcript": "My name is Pooja Das", "language_code": "en-IN"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["candidates"]) == 0
    assert len(data["issues"]) == 1
    assert data["issues"][0]["field_id"] == "full_name"
    assert data["issues"][0]["type"] == "MANUAL_OVERRIDE_PROTECTED"


def test_extract_route_is_non_mutating(client, monkeypatch):
    monkeypatch.setattr(ai_service.groq, "api_key", "mock_key")

    mock_extract = AsyncMock(
        return_value=ExtractionResponse(
            candidates=[
                Candidate(
                    field_id="full_name",
                    value="Aditi Sen",
                    evidence_text="Aditi Sen",
                    uncertain=False,
                    ambiguity_reason=None,
                )
            ],
            issues=[],
        )
    )
    monkeypatch.setattr(ai_service, "extract_from_transcript", mock_extract)

    res = client.post("/api/sessions", json={"form_id": REG_FORM, "locale": "en-IN"})
    assert res.status_code == 201
    sid = res.json()["session_id"]

    # Session revision initially 0
    review_before = client.get(f"/api/sessions/{sid}/review").json()
    assert review_before["revision"] == 0
    assert review_before["values"]["full_name"] is None

    # Call /extract
    client.post(
        f"/api/sessions/{sid}/extract",
        json={"transcript": "My name is Aditi Sen", "language_code": "en-IN"},
    )

    # Session revision and values must remain unchanged
    review_after = client.get(f"/api/sessions/{sid}/review").json()
    assert review_after["revision"] == 0
    assert review_after["values"]["full_name"] is None
