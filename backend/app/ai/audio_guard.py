import struct
from app.ai.config import ai_config
from app.services.errors import APIError

# Conservative byte thresholds for audio files lacking duration headers/timestamps
# Prevents unmeasurable streams from silently bypassing the 30-second limit
UNMEASURABLE_COMPRESSED_MAX_BYTES = 750 * 1024    # 750 KB for WebM/OGG (~47s at 128kbps, ~95s at 64kbps)
UNMEASURABLE_WAV_MAX_BYTES = 1024 * 1024         # 1 MB for WAV PCM (~32s at 16kHz mono)


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


def estimate_wav_duration_seconds(audio_bytes: bytes) -> float | None:
    """Parses WAV PCM header byte rate and data chunk length to estimate audio duration."""
    if len(audio_bytes) < 44 or not (audio_bytes.startswith(b"RIFF") and audio_bytes[8:12] == b"WAVE"):
        return None
    try:
        fmt_pos = audio_bytes.find(b"fmt ")
        if fmt_pos == -1 or fmt_pos + 20 > len(audio_bytes):
            return None
        byte_rate = int.from_bytes(audio_bytes[fmt_pos + 16 : fmt_pos + 20], byteorder="little")
        if byte_rate <= 0:
            return None
        data_pos = audio_bytes.find(b"data", fmt_pos + 8)
        if data_pos == -1 or data_pos + 8 > len(audio_bytes):
            data_size = len(audio_bytes) - (fmt_pos + 24)
        else:
            data_size = int.from_bytes(audio_bytes[data_pos + 4 : data_pos + 8], byteorder="little")
        return max(0.0, data_size / byte_rate)
    except Exception:
        return None


def estimate_webm_duration_seconds(audio_bytes: bytes) -> float | None:
    """
    Parses WebM Matroska container duration without external libraries:
    1. Direct Info Duration element (EBML ID 0x44 0x89) with TimecodeScale (0x2A 0xD7 0xB1).
    2. Last Cluster timestamp element (EBML ID 0x1F 0x43 0xB6 0x75 followed by 0xE7).
    """
    if len(audio_bytes) < 16 or not audio_bytes.startswith(b"\x1a\x45\xdf\xa3"):
        return None
    try:
        # 1. Check Info Duration element (0x44 0x89)
        timecode_scale = 1_000_000  # Default 1ms = 1,000,000 ns
        tc_idx = audio_bytes.find(b"\x2a\xd7\xb1")
        if tc_idx != -1 and tc_idx + 4 < len(audio_bytes):
            size = audio_bytes[tc_idx + 3] & 0x7F
            if 0 < size <= 8 and tc_idx + 4 + size <= len(audio_bytes):
                timecode_scale = int.from_bytes(audio_bytes[tc_idx + 4 : tc_idx + 4 + size], "big")

        dur_idx = audio_bytes.find(b"\x44\x89")
        if dur_idx != -1 and dur_idx + 3 < len(audio_bytes):
            size_byte = audio_bytes[dur_idx + 2]
            if size_byte == 0x84 and dur_idx + 7 <= len(audio_bytes):
                raw_float = struct.unpack(">f", audio_bytes[dur_idx + 3 : dur_idx + 7])[0]
                return max(0.0, (raw_float * timecode_scale) / 1e9)
            elif size_byte == 0x88 and dur_idx + 11 <= len(audio_bytes):
                raw_float = struct.unpack(">d", audio_bytes[dur_idx + 3 : dur_idx + 11])[0]
                return max(0.0, (raw_float * timecode_scale) / 1e9)

        # 2. Check last Cluster timestamp (0x1F 0x43 0xB6 0x75 + 0xE7)
        last_cluster = audio_bytes.rfind(b"\x1f\x43\xb6\x75")
        if last_cluster != -1:
            sub = audio_bytes[last_cluster : last_cluster + 100]
            e7_idx = sub.find(b"\xe7")
            if e7_idx != -1 and e7_idx + 2 < len(sub):
                sz = sub[e7_idx + 1] & 0x7F
                if 0 < sz <= 4 and e7_idx + 2 + sz <= len(sub):
                    ts_ms = int.from_bytes(sub[e7_idx + 2 : e7_idx + 2 + sz], "big")
                    return max(0.0, ts_ms / 1000.0)
        return None
    except Exception:
        return None


def estimate_ogg_duration_seconds(audio_bytes: bytes) -> float | None:
    """
    Parses Ogg stream duration:
    - Ogg Opus ('OpusHead'): Uses fixed 48,000 Hz clock rate per RFC 7845 Section 5.1.
    - Ogg Vorbis ('\\x01vorbis'): Reads actual stream sample rate from identification header.
    """
    if len(audio_bytes) < 28 or not audio_bytes.startswith(b"OggS"):
        return None
    try:
        sample_rate = None
        if b"OpusHead" in audio_bytes[:100]:
            sample_rate = 48000.0
        elif b"\x01vorbis" in audio_bytes[:100]:
            idx = audio_bytes.find(b"\x01vorbis")
            # In Vorbis ident header: [0:1] = 0x01, [1:7] = 'vorbis', [7:11] = version, [11:12] = channels, [12:16] = sample_rate (uint32 LE)
            if idx != -1 and idx + 16 <= len(audio_bytes):
                sr = int.from_bytes(audio_bytes[idx + 12 : idx + 16], "little")
                if sr > 0:
                    sample_rate = float(sr)

        # Fallback to 48kHz for standard Ogg streams
        if not sample_rate:
            sample_rate = 48000.0

        last_page = audio_bytes.rfind(b"OggS")
        if last_page != -1 and last_page + 14 <= len(audio_bytes):
            granule = int.from_bytes(audio_bytes[last_page + 6 : last_page + 14], "little", signed=True)
            if granule > 0:
                return max(0.0, granule / sample_rate)
        return None
    except Exception:
        return None


def estimate_audio_duration_seconds(audio_bytes: bytes, mime: str) -> float | None:
    """Dispatches duration estimation based on detected audio MIME format."""
    if mime == "audio/wav":
        return estimate_wav_duration_seconds(audio_bytes)
    if mime == "audio/webm":
        return estimate_webm_duration_seconds(audio_bytes)
    if mime == "audio/ogg":
        return estimate_ogg_duration_seconds(audio_bytes)
    return None


def validate_audio_upload(audio_bytes: bytes, filename: str | None = None) -> str:
    """
    Validates audio bytes against constraints specified in CONTRACT.md:
    - 422: Empty audio
    - 413: Exceeds size limit (default 10 MB) or max clip duration (default 30s)
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

    # Duration enforcement across WAV, WebM, and OGG formats
    duration = estimate_audio_duration_seconds(audio_bytes, mime)
    if duration is not None:
        if duration > ai_config.MAX_CLIP_SECONDS:
            raise APIError(413, "AUDIO_TOO_LONG", f"Audio duration ({duration:.1f}s) exceeds {ai_config.MAX_CLIP_SECONDS} seconds limit.")
    else:
        # Duration could not be extracted from metadata or cluster timestamps.
        # Enforce conservative byte threshold to prevent unmeasurable long recordings from bypassing the 30s limit.
        max_bytes = UNMEASURABLE_WAV_MAX_BYTES if mime == "audio/wav" else UNMEASURABLE_COMPRESSED_MAX_BYTES
        if len(audio_bytes) > max_bytes:
            raise APIError(413, "AUDIO_TOO_LONG", f"Audio duration cannot be verified and file size ({len(audio_bytes) // 1024} KB) exceeds the safe threshold for a 30-second clip.")

    return mime
