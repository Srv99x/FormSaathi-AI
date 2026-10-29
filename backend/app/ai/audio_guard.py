from app.ai.config import ai_config
from app.services.errors import APIError


# Magic bytes for supported audio formats:
# WAV: starts with 'RIFF' and bytes 8..12 are 'WAVE'
# MP3: starts with 'ID3' or sync bits 0xFF 0xFB/F3/F2
# OGG: starts with 'OggS'
# WebM: EBML header starting with \x1a\x45\xdf\xa3
def detect_audio_mime(header: bytes) -> str | None:
    if len(header) < 4:
        return None
    if header.startswith(b"RIFF") and len(header) >= 12 and header[8:12] == b"WAVE":
        return "audio/wav"
    if header.startswith(b"ID3") or (header[0] == 0xFF and (header[1] & 0xE0) == 0xE0):
        return "audio/mpeg"
    if header.startswith(b"OggS"):
        return "audio/ogg"
    if header.startswith(b"\x1a\x45\xdf\xa3"):
        return "audio/webm"
    return None


def validate_audio_upload(audio_bytes: bytes, filename: str | None = None) -> str:
    """
    Validates audio bytes against constraints specified in CONTRACT.md:
    - 422: Empty audio
    - 413: Exceeds size limit (default 10 MB)
    - 415: Unsupported codec / unrecognized magic bytes
    Returns the detected MIME type.
    """
    if not audio_bytes or len(audio_bytes) == 0:
        raise APIError(422, "EMPTY_AUDIO", "Uploaded audio file is empty.")

    if len(audio_bytes) > ai_config.MAX_AUDIO_BYTES:
        raise APIError(413, "AUDIO_TOO_LARGE", f"Audio size exceeds {ai_config.MAX_AUDIO_BYTES // (1024 * 1024)} MB limit.")

    mime = detect_audio_mime(audio_bytes[:32])
    if not mime:
        # Fallback to extension check if magic bytes are obscured (e.g. raw webm streaming chunks)
        if filename:
            lower = filename.lower()
            if lower.endswith(".wav"):
                mime = "audio/wav"
            elif lower.endswith(".mp3"):
                mime = "audio/mpeg"
            elif lower.endswith(".ogg"):
                mime = "audio/ogg"
            elif lower.endswith(".webm"):
                mime = "audio/webm"

    if not mime:
        raise APIError(415, "UNSUPPORTED_AUDIO_CODEC", "Audio format must be audio/webm, audio/wav, audio/mpeg, or audio/ogg.")

    return mime
