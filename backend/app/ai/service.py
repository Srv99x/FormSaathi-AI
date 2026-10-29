from app.ai.audio_guard import validate_audio_upload
from app.ai.groq_agent import GroqAgent
from app.ai.sarvam import SarvamClient
from app.models.contracts import ExtractionResponse, SpeechResponse
from app.schemas.registry import get_form
from app.services.errors import APIError


class AIService:
    """Unified service interface for Speech-to-Text, Structured Extraction, and Voice Dialog."""

    def __init__(self):
        self.sarvam = SarvamClient()
        self.groq = GroqAgent()

    @property
    def speech_available(self) -> bool:
        return self.sarvam.is_configured

    @property
    def extraction_available(self) -> bool:
        return self.groq.is_configured

    def status(self) -> dict:
        return {
            "speech_provider": "available" if self.speech_available else "unavailable",
            "extraction_provider": "available" if self.extraction_available else "unavailable",
        }

    async def transcribe_speech(self, audio_bytes: bytes, filename: str, locale: str) -> SpeechResponse:
        """Transcribes incoming audio file into text using Sarvam Saaras v4."""
        result = await self.sarvam.transcribe(audio_bytes, filename, locale)
        return SpeechResponse(**result)

    async def extract_from_transcript(
        self,
        transcript: str,
        language_code: str,
        form_id: str,
        current_values: dict | None = None,
    ) -> ExtractionResponse:
        """Extracts structured form fields from transcript using Groq Llama 3.3."""
        form_schema = get_form(form_id)
        if not form_schema:
            raise APIError(404, "FORM_NOT_FOUND", "Specified form does not exist.")

        return await self.groq.extract_entities(
            transcript=transcript,
            language_code=language_code,
            form_schema=form_schema,
            current_values=current_values,
        )

    async def conversational_turn(
        self,
        form_id: str,
        current_values: dict,
        locale: str,
        audio_bytes: bytes | None = None,
        filename: str | None = None,
        transcript: str | None = None,
    ) -> dict:
        """
        Executes a complete interactive voice assistant turn:
        1. Transcribes audio if provided.
        2. Reasons over missing form fields and extracts candidates.
        3. Formulates a natural conversational response in the user's locale.
        4. Synthesizes voice audio (TTS) so the assistant can speak back.
        """
        form_schema = get_form(form_id)
        if not form_schema:
            raise APIError(404, "FORM_NOT_FOUND", "Specified form does not exist.")

        # Transcribe audio if provided
        user_text = transcript
        if audio_bytes and len(audio_bytes) > 0:
            stt_result = await self.transcribe_speech(audio_bytes, filename or "audio.webm", locale)
            user_text = stt_result.transcript

        # Run conversational agent reasoning
        turn_result = await self.groq.dialog_turn(
            form_schema=form_schema,
            current_values=current_values,
            transcript=user_text,
            language_code=locale,
        )

        # Generate voice output using Sarvam Bulbul
        audio_base64 = None
        assistant_message = turn_result.get("assistant_message", "")
        if assistant_message and self.sarvam.is_configured:
            speaker = "arvind" if locale == "hi-IN" else "meera"
            audio_base64 = await self.sarvam.synthesize(assistant_message, language_code=locale, speaker=speaker)

        return {
            "user_transcript": user_text,
            "candidates": turn_result["candidates"],
            "updated_values": turn_result["updated_values"],
            "missing_required": turn_result["missing_required"],
            "missing_optional": turn_result["missing_optional"],
            "assistant_message": assistant_message,
            "assistant_audio_base64": audio_base64,
            "is_complete": turn_result["is_complete"],
        }


ai_service = AIService()
