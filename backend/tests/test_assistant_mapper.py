import pytest
from unittest.mock import AsyncMock

from app.ai import ai_service
from app.models.contracts import Candidate, ExtractionResponse, Issue, SpeechResponse

REG_FORM = "student_registration_v1"


@pytest.fixture(autouse=True)
def setup_ai_mocks(monkeypatch):
    # Ensure provider keys appear configured for assistant route
    monkeypatch.setattr(ai_service.groq, "api_key", "mock_groq_key")
    monkeypatch.setattr(ai_service.sarvam, "api_key", "mock_sarvam_key")
    # Stub TTS synthesis so it does not make network calls
    monkeypatch.setattr(ai_service.sarvam, "synthesize", AsyncMock(return_value="mock_base64_audio"))


def test_assistant_grounded_candidate(client, monkeypatch):
    transcript = "My name is Pooja Das and I live in Guwahati"
    mock_extraction = ExtractionResponse(
        candidates=[
            Candidate(
                field_id="full_name",
                value="Pooja Das",
                evidence_text="Pooja Das",
                uncertain=False,
                ambiguity_reason=None,
            ),
            Candidate(
                field_id="city",
                value="Guwahati",
                evidence_text="Guwahati",
                uncertain=False,
                ambiguity_reason=None,
            ),
        ],
        issues=[],
    )
    monkeypatch.setattr(ai_service.groq, "extract_entities", AsyncMock(return_value=mock_extraction))
    monkeypatch.setattr(ai_service.groq, "_call_llm", AsyncMock(return_value='{"message": "Hello Pooja!", "is_complete": false}'))

    res = client.post("/api/sessions", json={"form_id": REG_FORM, "locale": "en-IN"})
    assert res.status_code == 201
    sid = res.json()["session_id"]

    response = client.post(
        f"/api/sessions/{sid}/assistant",
        json={"transcript": transcript},
    )
    assert response.status_code == 200
    data = response.json()

    # Grounded candidates must be present
    cand_fields = [c["field_id"] for c in data["candidates"]]
    assert "full_name" in cand_fields
    assert "city" in cand_fields
    assert data["updated_values"]["full_name"] == "Pooja Das"
    assert data["updated_values"]["city"] == "Guwahati"
    assert data["name_candidate"] == "Pooja Das"


def test_assistant_ungrounded_candidate_rejected_from_simulated_values(client, monkeypatch):
    transcript = "I want to apply for BCA in Guwahati"
    # LLM hallucinates a city not in transcript
    mock_extraction = ExtractionResponse(
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
    monkeypatch.setattr(ai_service.groq, "extract_entities", AsyncMock(return_value=mock_extraction))
    monkeypatch.setattr(ai_service.groq, "_call_llm", AsyncMock(return_value='{"message": "Please share your city.", "is_complete": false}'))

    res = client.post("/api/sessions", json={"form_id": REG_FORM, "locale": "en-IN"})
    assert res.status_code == 201
    sid = res.json()["session_id"]

    response = client.post(
        f"/api/sessions/{sid}/assistant",
        json={"transcript": transcript},
    )
    assert response.status_code == 200
    data = response.json()

    # Ungrounded candidate must be rejected and must NOT affect simulated values
    cand_fields = [c["field_id"] for c in data["candidates"]]
    assert "city" not in cand_fields
    assert data["updated_values"]["city"] is None

    # Mapping issue must be surfaced
    issues = data.get("issues", [])
    assert any(i["field_id"] == "city" and i["type"] == "UNGROUNDED" for i in issues)


def test_assistant_manual_field_protection(client, monkeypatch):
    transcript = "My name is Pooja Das"
    mock_extraction = ExtractionResponse(
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
    monkeypatch.setattr(ai_service.groq, "extract_entities", AsyncMock(return_value=mock_extraction))
    monkeypatch.setattr(ai_service.groq, "_call_llm", AsyncMock(return_value='{"message": "Understood.", "is_complete": false}'))

    res = client.post("/api/sessions", json={"form_id": REG_FORM, "locale": "en-IN"})
    assert res.status_code == 201
    sid = res.json()["session_id"]

    # User manually corrects full_name first
    patch_res = client.patch(
        f"/api/sessions/{sid}/fields",
        json={"field_id": "full_name", "value": "Aditi Roy", "source": "manual"},
    )
    assert patch_res.status_code == 200

    # Assistant turn should NOT overwrite manually corrected full_name
    response = client.post(
        f"/api/sessions/{sid}/assistant",
        json={"transcript": transcript},
    )
    assert response.status_code == 200
    data = response.json()

    # Proposed full_name candidate must be rejected to preserve manual correction
    cand_fields = [c["field_id"] for c in data["candidates"]]
    assert "full_name" not in cand_fields
    assert data["updated_values"]["full_name"] == "Aditi Roy"

    # Issue must be present
    issues = data.get("issues", [])
    assert any(i["field_id"] == "full_name" and i["type"] == "MANUAL_OVERRIDE_PROTECTED" for i in issues)


def test_assistant_conflicting_candidates_rejected(client, monkeypatch):
    transcript = "Call 9876543210 or 9123456780"
    mock_extraction = ExtractionResponse(
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
                ambiguity_reason="Alternate number",
            ),
        ],
        issues=[],
    )
    monkeypatch.setattr(ai_service.groq, "extract_entities", AsyncMock(return_value=mock_extraction))
    monkeypatch.setattr(ai_service.groq, "_call_llm", AsyncMock(return_value='{"message": "Please clarify your number.", "is_complete": false}'))

    res = client.post("/api/sessions", json={"form_id": REG_FORM, "locale": "en-IN"})
    assert res.status_code == 201
    sid = res.json()["session_id"]

    response = client.post(
        f"/api/sessions/{sid}/assistant",
        json={"transcript": transcript},
    )
    assert response.status_code == 200
    data = response.json()

    # Both conflicting candidates must be rejected and not merged into simulated values
    cand_fields = [c["field_id"] for c in data["candidates"]]
    assert "mobile" not in cand_fields
    assert data["updated_values"]["mobile"] is None

    # Issue must be present
    issues = data.get("issues", [])
    assert any(i["field_id"] == "mobile" and i["type"] == "CONFLICT" for i in issues)


def test_assistant_does_not_mutate_persistent_session(client, monkeypatch):
    transcript = "My name is Pooja Das"
    mock_extraction = ExtractionResponse(
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
    monkeypatch.setattr(ai_service.groq, "extract_entities", AsyncMock(return_value=mock_extraction))
    monkeypatch.setattr(ai_service.groq, "_call_llm", AsyncMock(return_value='{"message": "Hello!", "is_complete": false}'))

    res = client.post("/api/sessions", json={"form_id": REG_FORM, "locale": "en-IN"})
    assert res.status_code == 201
    sid = res.json()["session_id"]

    # Call assistant turn
    response = client.post(
        f"/api/sessions/{sid}/assistant",
        json={"transcript": transcript},
    )
    assert response.status_code == 200

    # Review session: values and revision must NOT be mutated by assistant turn
    review = client.get(f"/api/sessions/{sid}/review").json()
    assert review["revision"] == 0
    assert review["values"]["full_name"] is None


def test_assistant_audio_turn_grounding(client, monkeypatch):
    mock_stt = SpeechResponse(
        transcript="My name is Rahul Roy",
        language_code="en-IN",
        provider="sarvam",
        request_id="test_req",
    )
    mock_extraction = ExtractionResponse(
        candidates=[
            Candidate(
                field_id="full_name",
                value="Rahul Roy",
                evidence_text="Rahul Roy",
                uncertain=False,
                ambiguity_reason=None,
            )
        ],
        issues=[],
    )
    monkeypatch.setattr(ai_service, "transcribe_speech", AsyncMock(return_value=mock_stt))
    monkeypatch.setattr(ai_service.groq, "extract_entities", AsyncMock(return_value=mock_extraction))
    monkeypatch.setattr(ai_service.groq, "_call_llm", AsyncMock(return_value='{"message": "Hello Rahul!", "is_complete": false}'))

    res = client.post("/api/sessions", json={"form_id": REG_FORM, "locale": "en-IN"})
    assert res.status_code == 201
    sid = res.json()["session_id"]

    wav_sample = b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00" + b"\x00" * 50
    files = {"audio": ("test.wav", wav_sample, "audio/wav")}

    response = client.post(
        f"/api/sessions/{sid}/assistant",
        files=files,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["user_transcript"] == "My name is Rahul Roy"
    assert data["updated_values"]["full_name"] == "Rahul Roy"
    assert data["name_candidate"] == "Rahul Roy"
