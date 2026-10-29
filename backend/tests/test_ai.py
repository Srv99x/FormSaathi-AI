import pytest
from app.ai.audio_guard import detect_audio_mime, validate_audio_upload
from app.ai.config import ai_config
from app.ai.service import ai_service
from app.services.errors import APIError


def test_audio_guard_mime_detection():
    # WAV header: RIFF....WAVE
    wav_header = b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00"
    assert detect_audio_mime(wav_header) == "audio/wav"

    # MP3 ID3 header
    id3_header = b"ID3\x03\x00\x00\x00\x00\x00\x00"
    assert detect_audio_mime(id3_header) == "audio/mpeg"

    # OGG header: OggS
    ogg_header = b"OggS\x00\x02\x00\x00"
    assert detect_audio_mime(ogg_header) == "audio/ogg"

    # WebM header: \x1a\x45\xdf\xa3
    webm_header = b"\x1a\x45\xdf\xa3\x9f\x42\x86\x81"
    assert detect_audio_mime(webm_header) == "audio/webm"

    # Unknown
    assert detect_audio_mime(b"GIF89a") is None


def test_audio_guard_rejections():
    # Empty
    with pytest.raises(APIError) as exc:
        validate_audio_upload(b"")
    assert exc.value.status == 422
    assert exc.value.code == "EMPTY_AUDIO"

    # Unsupported format
    with pytest.raises(APIError) as exc:
        validate_audio_upload(b"PLAIN TEXT NOT AUDIO")
    assert exc.value.status == 415
    assert exc.value.code == "UNSUPPORTED_AUDIO_CODEC"

    # Valid WAV
    wav_sample = b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00" + b"\x00" * 50
    mime = validate_audio_upload(wav_sample)
    assert mime == "audio/wav"


def test_ai_status():
    status = ai_service.status()
    assert "speech_provider" in status
    assert "extraction_provider" in status


@pytest.mark.anyio
async def test_speech_endpoint_unavailable_when_no_key(client):
    res = client.post("/api/sessions", json={"form_id": "student_registration_v1", "locale": "en-IN"})
    sid = res.json()["session_id"]

    wav_sample = b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00" + b"\x00" * 50
    files = {"audio": ("test.wav", wav_sample, "audio/wav")}
    data = {"locale": "en-IN"}

    # If SARVAM_API_KEY is not set, speech returns 503 ASR_UNAVAILABLE
    if not ai_service.speech_available:
        response = client.post(f"/api/sessions/{sid}/speech", files=files, data=data)
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "ASR_UNAVAILABLE"


@pytest.mark.anyio
async def test_extract_endpoint_unavailable_when_no_key(client):
    res = client.post("/api/sessions", json={"form_id": "student_registration_v1", "locale": "en-IN"})
    sid = res.json()["session_id"]

    # If GROQ_API_KEY is not set, extract returns 503 EXTRACTION_UNAVAILABLE
    if not ai_service.extraction_available:
        response = client.post(f"/api/sessions/{sid}/extract", json={"transcript": "My name is John", "language_code": "en-IN"})
        assert response.status_code == 503
        assert response.json()["error"]["code"] == "EXTRACTION_UNAVAILABLE"
