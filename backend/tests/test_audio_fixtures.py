import struct
from pathlib import Path
import pytest
from app.ai.audio_guard import (
    validate_audio_upload,
    estimate_audio_duration_seconds,
    UNMEASURABLE_COMPRESSED_MAX_BYTES
)
from app.services.errors import APIError

CHROME_MEDIA_RECORDER_BASE_WEBM = (
    b"\x1a\x45\xdf\xa3\x01\x00\x00\x00\x00\x00\x00\x1f\x42\x86\x81\x01\x42\xf7\x81\x01\x42\xf2\x81\x04\x42\xf3\x81\x08"
    b"\x42\x82\x84webm\x42\x87\x81\x04\x42\x85\x81\x02\x18\x53\x80\x67\x01\x00\x00\x00\x00\x00\x00\xff"
    b"\x15\x49\xa9\x66\x99\x2a\xd7\xb1\x83\x0f\x42\x40\x4d\x80\x84Chrome"
)


def make_webm_with_duration(duration_ms: float) -> bytes:
    dur = struct.pack(">f", duration_ms)
    return CHROME_MEDIA_RECORDER_BASE_WEBM + b"\x44\x89\x84" + dur + b"\x00" * 200


def make_webm_with_cluster_timestamp(timestamp_ms: int) -> bytes:
    # Cluster 0x1F43B675 with Timecode 0xE7
    cluster = b"\x1f\x43\xb6\x75\x01\x00\x00\x00\x00\x00\x00\x20\xe7\x82" + timestamp_ms.to_bytes(2, "big")
    return CHROME_MEDIA_RECORDER_BASE_WEBM + cluster + b"\x00" * 200


def make_ogg_opus(sec: float) -> bytes:
    # Ogg page with OpusHead packet
    page1 = (
        b"OggS\x00\x02\x00\x00\x00\x00\x00\x00\x00\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01\x13"
        b"OpusHead\x01\x02\x00\x00\x80\xbb\x00\x00\x00\x00\x00"
    )
    granule = int(sec * 48000)
    page_last = (
        b"OggS\x00\x04" + granule.to_bytes(8, "little", signed=True) +
        b"\x01\x00\x00\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00" + b"\x00" * 50
    )
    return page1 + page_last


def make_ogg_vorbis(sec: float, sample_rate: int = 44100) -> bytes:
    # Ogg page with \x01vorbis packet: sample rate at offset 12..16
    vorbis_header = bytearray(b"\x01vorbis\x00\x00\x00\x00\x02") # version 0, 2 channels
    vorbis_header.extend(sample_rate.to_bytes(4, "little"))
    vorbis_header.extend(b"\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\xb8\x01")
    page1 = (
        b"OggS\x00\x02\x00\x00\x00\x00\x00\x00\x00\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01" +
        len(vorbis_header).to_bytes(1, "little") + bytes(vorbis_header)
    )
    granule = int(sec * sample_rate)
    page_last = (
        b"OggS\x00\x04" + granule.to_bytes(8, "little", signed=True) +
        b"\x01\x00\x00\x00\x01\x00\x00\x00\x00\x00\x00\x00\x00" + b"\x00" * 50
    )
    return page1 + page_last


def make_wav(sec: float) -> bytes:
    sample_rate = 16000
    byte_rate = 32000
    data_size = int(sec * byte_rate)
    header = bytearray(b"RIFF")
    header.extend((data_size + 36).to_bytes(4, "little"))
    header.extend(b"WAVEfmt ")
    header.extend((16).to_bytes(4, "little"))
    header.extend((1).to_bytes(2, "little"))  # PCM
    header.extend((1).to_bytes(2, "little"))  # mono
    header.extend(sample_rate.to_bytes(4, "little"))
    header.extend(byte_rate.to_bytes(4, "little"))
    header.extend((2).to_bytes(2, "little"))
    header.extend((16).to_bytes(2, "little"))
    header.extend(b"data")
    header.extend(data_size.to_bytes(4, "little"))
    return bytes(header) + b"\x00" * 100


def test_browser_webm_info_duration_valid():
    """WebM with Info Duration <= 30s is accepted."""
    data = make_webm_with_duration(10000.0)
    assert validate_audio_upload(data, "test.webm") == "audio/webm"


def test_browser_webm_info_duration_too_long():
    """WebM with Info Duration > 30s is rejected with 413 AUDIO_TOO_LONG."""
    data = make_webm_with_duration(32000.0)
    with pytest.raises(APIError) as exc_info:
        validate_audio_upload(data, "test.webm")
    assert exc_info.value.status == 413
    assert exc_info.value.code == "AUDIO_TOO_LONG"


def test_browser_webm_cluster_timestamp_valid():
    """WebM when Info Duration is missing but Cluster timestamp <= 30s is accepted."""
    data = make_webm_with_cluster_timestamp(15000) # 15s
    assert validate_audio_upload(data, "test.webm") == "audio/webm"


def test_browser_webm_cluster_timestamp_too_long():
    """WebM when Info Duration is missing but Cluster timestamp > 30s is rejected with 413."""
    data = make_webm_with_cluster_timestamp(34000) # 34s
    with pytest.raises(APIError) as exc_info:
        validate_audio_upload(data, "test.webm")
    assert exc_info.value.status == 413
    assert exc_info.value.code == "AUDIO_TOO_LONG"


def test_browser_webm_unmeasurable_small_accepted():
    """Small unmeasurable WebM without duration headers is accepted safely within byte limit."""
    data = CHROME_MEDIA_RECORDER_BASE_WEBM + b"\x00" * 200
    assert validate_audio_upload(data, "test.webm") == "audio/webm"


def test_browser_webm_unmeasurable_large_rejected_with_413():
    """Large unmeasurable WebM (> 750 KB) cannot silently bypass the 30s restriction."""
    large_unmeasurable = CHROME_MEDIA_RECORDER_BASE_WEBM + b"\x00" * (UNMEASURABLE_COMPRESSED_MAX_BYTES + 1000)
    with pytest.raises(APIError) as exc_info:
        validate_audio_upload(large_unmeasurable, "test.webm")
    assert exc_info.value.status == 413
    assert exc_info.value.code == "AUDIO_TOO_LONG"


def test_ogg_opus_48khz_clock():
    """Ogg Opus uses fixed 48 kHz clock rate: 10s accepted, 35s rejected with 413."""
    opus_valid = make_ogg_opus(10.0)
    assert validate_audio_upload(opus_valid, "test.ogg") == "audio/ogg"

    opus_long = make_ogg_opus(35.0)
    with pytest.raises(APIError) as exc_info:
        validate_audio_upload(opus_long, "test.ogg")
    assert exc_info.value.status == 413
    assert exc_info.value.code == "AUDIO_TOO_LONG"


def test_ogg_vorbis_stream_sample_rate():
    """Ogg Vorbis uses actual stream sample rate (44.1 kHz): 12s accepted, 36s rejected with 413."""
    vorbis_valid = make_ogg_vorbis(12.0, sample_rate=44100)
    assert validate_audio_upload(vorbis_valid, "test.ogg") == "audio/ogg"

    vorbis_long = make_ogg_vorbis(36.0, sample_rate=44100)
    with pytest.raises(APIError) as exc_info:
        validate_audio_upload(vorbis_long, "test.ogg")
    assert exc_info.value.status == 413
    assert exc_info.value.code == "AUDIO_TOO_LONG"


def test_browser_wav_valid_and_long():
    """WAV PCM: 8s accepted, 35s rejected with 413."""
    wav_valid = make_wav(8.0)
    assert validate_audio_upload(wav_valid, "test.wav") == "audio/wav"

    wav_long = make_wav(35.0)
    with pytest.raises(APIError) as exc_info:
        validate_audio_upload(wav_long, "test.wav")
    assert exc_info.value.status == 413
    assert exc_info.value.code == "AUDIO_TOO_LONG"


def test_unsupported_codec_rejected():
    """Unrecognized / plain text binary is rejected with 415 UNSUPPORTED_AUDIO_CODEC."""
    with pytest.raises(APIError) as exc_info:
        validate_audio_upload(b"NOT_A_VALID_AUDIO_CONTAINER_STREAM_DATA")
    assert exc_info.value.status == 415
    assert exc_info.value.code == "UNSUPPORTED_AUDIO_CODEC"
