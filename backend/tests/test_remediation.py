import struct
import pytest
from datetime import date
from unittest.mock import AsyncMock

from app.ai.audio_guard import validate_audio_upload
from app.ai.config import ai_config
from app.services.errors import APIError

REG_FORM = "student_registration_v1"


def test_voice_field_provenance_and_repeated_voice_updates(client):
    """F-001: Voice fields allow subsequent voice updates without being locked."""
    res = client.post("/api/sessions", json={"form_id": REG_FORM, "locale": "en-IN"})
    assert res.status_code == 201
    sid = res.json()["session_id"]

    # First voice turn sets full_name
    patch1 = client.patch(
        f"/api/sessions/{sid}/fields",
        json={"field_id": "full_name", "value": "Rahul Sharma", "source": "voice"},
    )
    assert patch1.status_code == 200
    assert patch1.json()["field"]["value"] == "Rahul Sharma"
    assert patch1.json()["status"] == "valid"

    # Second voice turn updates full_name (MUST succeed, not locked!)
    patch2 = client.patch(
        f"/api/sessions/{sid}/fields",
        json={"field_id": "full_name", "value": "Rahul Sen", "source": "voice"},
    )
    assert patch2.status_code == 200
    assert patch2.json()["field"]["value"] == "Rahul Sen"
    assert patch2.json()["status"] == "valid"


def test_manual_field_protected_from_voice_overwrites(client):
    """F-001: Genuine manual keyboard edits are protected from accidental voice overwrites."""
    res = client.post("/api/sessions", json={"form_id": REG_FORM, "locale": "en-IN"})
    sid = res.json()["session_id"]

    # User manually edits city
    patch_manual = client.patch(
        f"/api/sessions/{sid}/fields",
        json={"field_id": "city", "value": "Guwahati", "source": "manual"},
    )
    assert patch_manual.status_code == 200

    # Subsequent voice attempt to overwrite city is rejected with 409
    patch_voice = client.patch(
        f"/api/sessions/{sid}/fields",
        json={"field_id": "city", "value": "Silchar", "source": "voice"},
    )
    assert patch_voice.status_code == 409
    assert patch_voice.json()["error"]["code"] == "MANUAL_OVERRIDE_PROTECTED"

    # City remains unchanged
    session_data = client.get(f"/api/sessions/{sid}").json()
    assert session_data["values"]["city"] == "Guwahati"


def test_voice_populated_fields_can_confirm_after_review(client):
    """F-001: Forms completed via voice can pass review and confirm successfully."""
    res = client.post("/api/sessions", json={"form_id": REG_FORM, "locale": "en-IN"})
    sid = res.json()["session_id"]

    fields_to_fill = {
        "full_name": "Pooja Das",
        "date_of_birth": "2004-08-15",
        "mobile": "9876543210",
        "city": "Guwahati",
        "state": "Assam",
        "programme": "BCA",
    }
    for fid, val in fields_to_fill.items():
        patch_res = client.patch(
            f"/api/sessions/{sid}/fields",
            json={"field_id": fid, "value": val, "source": "voice"},
        )
        assert patch_res.status_code == 200

    # Review snapshot should have can_confirm: True
    review = client.get(f"/api/sessions/{sid}/review").json()
    assert review["can_confirm"] is True
    assert len(review["missing"]) == 0

    # Confirmation succeeds
    confirm_res = client.post(
        f"/api/sessions/{sid}/confirm",
        json={"reviewed": True, "revision": review["revision"]},
    )
    assert confirm_res.status_code == 200
    assert confirm_res.json()["status"] == "confirmed_local"
    assert confirm_res.json()["record"]["full_name"] == "Pooja Das"


def test_language_switch_preserves_form_values(client):
    """F-002: Switching locale preserves all entered field values."""
    res = client.post("/api/sessions", json={"form_id": REG_FORM, "locale": "en-IN"})
    sid = res.json()["session_id"]

    # Fill fields in English
    client.patch(f"/api/sessions/{sid}/fields", json={"field_id": "full_name", "value": "Amit Roy", "source": "voice"})
    client.patch(f"/api/sessions/{sid}/fields", json={"field_id": "city", "value": "Silchar", "source": "manual"})

    # Switch session locale to hi-IN
    switch_res = client.patch(f"/api/sessions/{sid}/locale", json={"locale": "hi-IN"})
    assert switch_res.status_code == 200

    # Query session details
    details = client.get(f"/api/sessions/{sid}").json()
    assert details["locale"] == "hi-IN"
    assert details["values"]["full_name"] == "Amit Roy"
    assert details["values"]["city"] == "Silchar"


def test_get_session_details_endpoint(client):
    """F-009: GET /api/sessions/{sid} returns authoritative session metadata and values."""
    res = client.post("/api/sessions", json={"form_id": REG_FORM, "locale": "en-IN"})
    sid = res.json()["session_id"]

    details_res = client.get(f"/api/sessions/{sid}")
    assert details_res.status_code == 200
    data = details_res.json()
    assert data["session_id"] == sid
    assert data["form_id"] == REG_FORM
    assert data["locale"] == "en-IN"
    assert "values" in data
    assert data["revision"] == 0
    assert data["expires_in_seconds"] > 3500


def test_custom_form_builder_registration_and_workflow(client):
    """F-003: Custom forms can be registered and used end-to-end with validation and review."""
    custom_schema = {
        "$id": "scholarship_app_custom_v1",
        "title": "Scholarship Application",
        "description": "Custom student scholarship application.",
        "type": "object",
        "properties": {
            "applicant_name": {"title": "Applicant Name", "type": "string", "minLength": 2, "maxLength": 80},
            "contact_phone": {"title": "Contact Phone", "type": "string", "pattern": "^[6-9][0-9]{9}$"},
            "residence_city": {"title": "City", "type": "string", "minLength": 2, "maxLength": 80},
        },
        "required": ["applicant_name", "contact_phone", "residence_city"],
    }

    # Register custom form
    reg_res = client.post("/api/forms", json={"schema_definition": custom_schema})
    assert reg_res.status_code == 201
    assert reg_res.json()["form_id"] == "scholarship_app_custom_v1"

    # Create session with the registered form
    sess_res = client.post("/api/sessions", json={"form_id": "scholarship_app_custom_v1", "locale": "en-IN"})
    assert sess_res.status_code == 201
    sid = sess_res.json()["session_id"]

    # Patch fields
    client.patch(f"/api/sessions/{sid}/fields", json={"field_id": "applicant_name", "value": "Suman Nath", "source": "voice"})
    client.patch(f"/api/sessions/{sid}/fields", json={"field_id": "contact_phone", "value": "9123456789", "source": "voice"})
    client.patch(f"/api/sessions/{sid}/fields", json={"field_id": "residence_city", "value": "Tezpur", "source": "manual"})

    # Review and confirm
    review = client.get(f"/api/sessions/{sid}/review").json()
    assert review["can_confirm"] is True
    assert len(review["missing"]) == 0

    confirm_res = client.post(f"/api/sessions/{sid}/confirm", json={"reviewed": True, "revision": review["revision"]})
    assert confirm_res.status_code == 200
    assert confirm_res.json()["status"] == "confirmed_local"
    assert confirm_res.json()["record"]["applicant_name"] == "Suman Nath"


def test_custom_form_inline_creation(client):
    """F-003: Sessions can be created with inline custom_schema."""
    custom_schema = {
        "$id": "inline_feedback_form_v1",
        "title": "Feedback Form",
        "properties": {
            "feedback": {"title": "Feedback", "type": "string", "minLength": 2, "maxLength": 200},
        },
        "required": ["feedback"],
    }

    sess_res = client.post("/api/sessions", json={
        "form_id": "inline_feedback_form_v1",
        "locale": "en-IN",
        "custom_schema": custom_schema,
    })
    assert sess_res.status_code == 201
    sid = sess_res.json()["session_id"]

    details = client.get(f"/api/sessions/{sid}").json()
    assert details["form_id"] == "inline_feedback_form_v1"
    assert "feedback" in details["values"]


def test_invalid_custom_schema_rejected(client):
    """F-003: Malformed custom form schemas are rejected safely with 422."""
    bad_schema = {
        "$id": "bad/id/with/slashes",
        "title": "Bad Schema",
        "properties": {},
    }
    res = client.post("/api/forms", json={"schema_definition": bad_schema})
    assert res.status_code == 422


def test_wav_audio_duration_enforced():
    """F-011: Audio exceeding MAX_CLIP_SECONDS is rejected with 413 AUDIO_TOO_LONG."""
    # 16-bit mono 16000Hz PCM: byte rate = 32000 bytes/sec
    sample_rate = 16000
    channels = 1
    bits_per_sample = 16
    byte_rate = sample_rate * channels * (bits_per_sample // 8)  # 32000 bytes/sec

    # 35 seconds of audio data = 35 * 32000 = 1,120,000 bytes
    duration_sec = 35
    data_size = duration_sec * byte_rate

    # Construct minimal WAV header
    wav_header = bytearray(b"RIFF")
    wav_header.extend((data_size + 36).to_bytes(4, byteorder="little"))
    wav_header.extend(b"WAVEfmt ")
    wav_header.extend((16).to_bytes(4, byteorder="little"))  # Subchunk1Size
    wav_header.extend((1).to_bytes(2, byteorder="little"))   # AudioFormat (PCM)
    wav_header.extend(channels.to_bytes(2, byteorder="little"))
    wav_header.extend(sample_rate.to_bytes(4, byteorder="little"))
    wav_header.extend(byte_rate.to_bytes(4, byteorder="little"))
    wav_header.extend((2).to_bytes(2, byteorder="little"))   # BlockAlign
    wav_header.extend(bits_per_sample.to_bytes(2, byteorder="little"))
    wav_header.extend(b"data")
    wav_header.extend(data_size.to_bytes(4, byteorder="little"))

    audio_bytes = bytes(wav_header) + b"\x00" * 1000  # header + some bytes

    with pytest.raises(APIError) as exc_info:
        validate_audio_upload(audio_bytes, "long.wav")

    assert exc_info.value.status == 413
    assert exc_info.value.code == "AUDIO_TOO_LONG"



def test_webm_audio_duration_enforced():
    """F-011: WebM audio exceeding MAX_CLIP_SECONDS is rejected with 413 AUDIO_TOO_LONG."""
    header = b"\x1a\x45\xdf\xa3\x01\x00\x00\x00\x00\x00\x00\x1f\x42\x86\x81\x01\x42\xf7\x81\x01\x42\xf2\x81\x04\x42\xf3\x81\x08\x42\x82\x84webm"
    
    # 35 seconds WebM (exceeds 30s limit)
    dur_bytes_long = b"\x44\x89\x84" + struct.pack(">f", 35000.0)
    audio_bytes_long = header + dur_bytes_long + b"\x00" * 100
    with pytest.raises(APIError) as exc_info:
        validate_audio_upload(audio_bytes_long, "long.webm")
    assert exc_info.value.status == 413
    assert exc_info.value.code == "AUDIO_TOO_LONG"

    # 15 seconds WebM (within 30s limit)
    dur_bytes_valid = b"\x44\x89\x84" + struct.pack(">f", 15000.0)
    audio_bytes_valid = header + dur_bytes_valid + b"\x00" * 100
    assert validate_audio_upload(audio_bytes_valid, "valid.webm") == "audio/webm"


def test_ogg_audio_duration_enforced():
    """F-011: OGG audio exceeding MAX_CLIP_SECONDS is rejected with 413 AUDIO_TOO_LONG."""
    # 35 seconds Ogg at 48kHz = 35 * 48000 = 1,680,000 granules
    granule_long = int(35 * 48000)
    ogg_page_long = b"OggS\x00\x04" + granule_long.to_bytes(8, "little", signed=True) + b"\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"
    audio_bytes_long = ogg_page_long + b"\x00" * 50
    with pytest.raises(APIError) as exc_info:
        validate_audio_upload(audio_bytes_long, "long.ogg")
    assert exc_info.value.status == 413
    assert exc_info.value.code == "AUDIO_TOO_LONG"

    # 12 seconds Ogg at 48kHz = 12 * 48000 = 576,000 granules
    granule_valid = int(12 * 48000)
    ogg_page_valid = b"OggS\x00\x04" + granule_valid.to_bytes(8, "little", signed=True) + b"\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00"
    audio_bytes_valid = ogg_page_valid + b"\x00" * 50
    assert validate_audio_upload(audio_bytes_valid, "valid.ogg") == "audio/ogg"


def test_groq_dual_model_fallback(monkeypatch):
    import asyncio
    """F-008: Groq agent attempts fallback model when primary model returns 400 deprecation."""
    from app.ai.groq_agent import GroqAgent
    import httpx

    agent = GroqAgent(api_key="test_groq_key", model="openai/gpt-oss-120b", fallback_model="openai/gpt-oss-20b")
    call_log = []

    async def mock_post(client, url, headers=None, json=None):
        requested_model = json.get("model")
        call_log.append(requested_model)
        if requested_model == "openai/gpt-oss-120b":
            # Simulate 400 model decommissioned error
            return httpx.Response(
                400,
                text='{"error": {"message": "The model openai/gpt-oss-120b is decommissioned.", "code": "model_decommissioned"}}',
                request=httpx.Request("POST", url)
            )
        elif requested_model == "openai/gpt-oss-20b":
            # Fallback model succeeds
            return httpx.Response(
                200,
                json={"choices": [{"message": {"content": '{"candidates": [], "issues": []}'}}]},
                request=httpx.Request("POST", url)
            )
        return httpx.Response(500, text="Unexpected model", request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx.AsyncClient, "post", mock_post)

    resp = asyncio.run(agent.extract_entities("Hello world", "en-IN", {"properties": {}, "required": []}))
    assert len(call_log) == 2
    assert call_log[0] == "openai/gpt-oss-120b"
    assert call_log[1] == "openai/gpt-oss-20b"
    assert isinstance(resp.candidates, list)
