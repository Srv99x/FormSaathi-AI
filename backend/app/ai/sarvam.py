import uuid
import httpx

from app.ai.audio_guard import validate_audio_upload
from app.ai.config import ai_config
from app.services.errors import APIError


class SarvamClient:
    """Client for Sarvam AI Speech-to-Text (Saaras v4) and Text-to-Speech (Bulbul)."""

    def __init__(self, api_key: str | None = None, base_url: str | None = None):
        self.api_key = api_key or ai_config.SARVAM_API_KEY
        self.base_url = (base_url or ai_config.SARVAM_BASE_URL).rstrip("/")
        self.asr_model = ai_config.SARVAM_ASR_MODEL
        self.tts_model = ai_config.SARVAM_TTS_MODEL

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.api_key.strip())

    async def transcribe(self, audio_bytes: bytes, filename: str, language_code: str) -> dict:
        """
        Transcribes speech audio using Sarvam Saaras v4.
        Returns: {transcript: str, language_code: str, provider: str, request_id: str}
        """
        mime = validate_audio_upload(audio_bytes, filename)

        if not self.is_configured:
            raise APIError(503, "ASR_UNAVAILABLE", "Sarvam API key not configured on backend. Set SARVAM_API_KEY in environment.")

        url = f"{self.base_url}/speech-to-text"
        headers = {
            "api-subscription-key": self.api_key,
        }

        # Sarvam expects multipart form data with file, model, language_code
        files = {
            "file": (filename or "audio.wav", audio_bytes, mime),
        }
        data = {
            "model": self.asr_model,
            "language_code": language_code,
        }

        request_id = f"sarvam-{uuid.uuid4().hex[:10]}"

        try:
            async with httpx.AsyncClient(timeout=ai_config.TIMEOUT_SECONDS) as client:
                response = await client.post(url, headers=headers, files=files, data=data)
        except httpx.TimeoutException:
            raise APIError(504, "ASR_TIMEOUT", "Speech-to-text request timed out. Please try recording again.", retryable=True)
        except httpx.RequestError as exc:
            raise APIError(502, "ASR_NETWORK_ERROR", f"Failed to contact speech provider: {str(exc)}", retryable=True)

        if response.status_code == 401 or response.status_code == 403:
            raise APIError(503, "ASR_AUTH_ERROR", "Speech provider authentication failed. Check SARVAM_API_KEY.")
        if response.status_code != 200:
            raise APIError(502, "ASR_UPSTREAM_ERROR", f"Speech provider returned error ({response.status_code}): {response.text}")

        result = response.json()
        transcript = result.get("transcript", "").strip()

        return {
            "transcript": transcript,
            "language_code": language_code,
            "provider": "sarvam",
            "request_id": request_id,
        }

    async def synthesize(self, text: str, language_code: str = "hi-IN", speaker: str = "priya") -> str | None:
        """
        Synthesizes text to speech using Sarvam Bulbul.
        Returns base64 encoded audio string (WAV) or None if not configured/failed.
        """
        if not self.is_configured or not text.strip():
            return None

        url = f"{self.base_url}/text-to-speech"
        headers = {
            "api-subscription-key": self.api_key,
            "Content-Type": "application/json",
        }
        payload = {
            "inputs": [text],
            "target_language_code": language_code,
            "speaker": speaker,
            "model": self.tts_model,
        }

        try:
            async with httpx.AsyncClient(timeout=ai_config.TIMEOUT_SECONDS) as client:
                response = await client.post(url, headers=headers, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    audios = data.get("audios", [])
                    if audios and len(audios) > 0:
                        return audios[0]  # Base64 encoded audio string
        except Exception:
            pass  # TTS failure should be non-blocking for conversational turn
        return None
