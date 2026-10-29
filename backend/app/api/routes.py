from fastapi import APIRouter, Request, Response
from app.ai import ai_service
from app.models.contracts import (ConfirmRequest, ConfirmationResponse, CreateSession,
    ExtractionRequest, ExtractionResponse, ManualChange, PatchResponse, ReviewResponse,
    SessionResponse, SpeechResponse, ValidateRequest, ValidationResponse)
from app.schemas.registry import get_form, list_forms
from app.services.ai_adapter import apply_field_mapping
from app.services.errors import APIError
from app.services.session_service import (TTL_SECONDS, confirm, correct, propose,
                                         require_locale, snapshot)

router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    return {"status": "ok", **ai_service.status()}


@router.get("/forms")
def forms():
    return {"forms": list_forms()}


@router.get("/forms/{form_id}")
def form(form_id: str):
    schema = get_form(form_id)
    if schema is None:
        raise APIError(404, "FORM_NOT_FOUND", "This form is not available.")
    return {"form_id": form_id, "title": schema["title"], "description": schema["description"],
            "fields": [{"field_id": key, "label": spec["title"],
                        "required": key in schema["required"], **spec}
                       for key, spec in schema["properties"].items()]}


@router.post("/sessions", status_code=201, response_model=SessionResponse)
def create_session(body: CreateSession, request: Request):
    session = request.app.state.sessions.create(body.form_id, body.locale)
    return {"session_id": session.session_id, "form_id": session.form_id,
            "revision": session.revision, "expires_in_seconds": TTL_SECONDS}


@router.post("/sessions/{sid}/validate", response_model=ValidationResponse)
def validate(sid: str, body: ValidateRequest, request: Request):
    with request.app.state.sessions.access(sid) as session:
        propose(session, body.proposed_values)
        return snapshot(session)


@router.patch("/sessions/{sid}/fields", response_model=PatchResponse)
def fields(sid: str, body: ManualChange, request: Request):
    with request.app.state.sessions.access(sid) as session:
        correct(session, body.field_id, body.value)
        result = snapshot(session)
        return {"revision": session.revision, "status": result["statuses"][body.field_id],
                "field": {"field_id": body.field_id,
                          "value": result["values"][body.field_id],
                          "status": result["statuses"][body.field_id],
                          "message": result["messages"][body.field_id]}}


@router.get("/sessions/{sid}/review", response_model=ReviewResponse)
def review(sid: str, request: Request):
    with request.app.state.sessions.access(sid) as session:
        result = snapshot(session)
        session.reviewed_revision = session.revision
        result["field_statuses"] = result.pop("statuses")
        return result


@router.post("/sessions/{sid}/confirm", response_model=ConfirmationResponse)
def confirmation(sid: str, body: ConfirmRequest, request: Request):
    with request.app.state.sessions.access(sid) as session:
        return confirm(session, body.reviewed, body.revision)


@router.delete("/sessions/{sid}", status_code=204)
def delete(sid: str, request: Request):
    request.app.state.sessions.delete(sid)
    return Response(status_code=204)


@router.post("/sessions/{sid}/speech", response_model=SpeechResponse,
             responses={503: {"description": "ASR_UNAVAILABLE: provider not integrated"}},
             openapi_extra={"requestBody": {"required": True, "content": {
                 "multipart/form-data": {"schema": {"type": "object", "required": ["audio", "locale"],
                     "properties": {"audio": {"type": "string", "format": "binary"},
                                    "locale": {"type": "string", "enum": ["en-IN", "hi-IN"]}}}}}}})
async def speech(sid: str, request: Request):
    with request.app.state.sessions.access(sid) as session:
        if not ai_service.speech_available:
            raise APIError(503, "ASR_UNAVAILABLE", "Speech is not integrated. Type your details instead.")
        form_data = await request.form()
        audio_file = form_data.get("audio")
        locale = form_data.get("locale")
        if not audio_file:
            raise APIError(422, "MISSING_AUDIO", "Audio file is required.")
        if not locale:
            raise APIError(400, "MISSING_LOCALE", "Locale is required.")
        require_locale(locale)
        if locale != session.locale:
            raise APIError(400, "LOCALE_MISMATCH", "Use the language selected for this session.")
        audio_bytes = await audio_file.read()
        filename = getattr(audio_file, "filename", "audio.wav")
        return await ai_service.transcribe_speech(audio_bytes, filename, locale)


@router.post("/sessions/{sid}/extract", response_model=ExtractionResponse,
             responses={503: {"description": "EXTRACTION_UNAVAILABLE: provider not integrated"}})
async def extract(sid: str, body: ExtractionRequest, request: Request):
    with request.app.state.sessions.access(sid) as session:
        require_locale(body.language_code)
        if body.language_code != session.locale:
            raise APIError(400, "LOCALE_MISMATCH", "Use the language selected for this session.")
        if not body.transcript.strip():
            raise APIError(400, "EMPTY_TRANSCRIPT", "Enter or record a transcript before extraction.")
        if not ai_service.extraction_available:
            raise APIError(503, "EXTRACTION_UNAVAILABLE", "Extraction is not integrated. Enter and check fields manually.")
        raw_extraction = await ai_service.extract_from_transcript(body.transcript, body.language_code, session.form_id, session.values)
        return apply_field_mapping(session.form_id, body.transcript, raw_extraction, session.manual_fields)


@router.post("/sessions/{sid}/assistant")
async def assistant_turn(sid: str, request: Request):
    with request.app.state.sessions.access(sid) as session:
        if not ai_service.extraction_available:
            raise APIError(503, "AI_ASSISTANT_UNAVAILABLE", "AI Assistant provider is not configured.")
        content_type = request.headers.get("content-type", "")
        audio_bytes = None
        filename = None
        transcript = None
        if "multipart/form-data" in content_type:
            form_data = await request.form()
            audio_file = form_data.get("audio")
            if audio_file:
                audio_bytes = await audio_file.read()
                filename = getattr(audio_file, "filename", "audio.webm")
            transcript = form_data.get("transcript")
        else:
            try:
                body = await request.json()
                transcript = body.get("transcript")
            except Exception:
                transcript = None

        return await ai_service.conversational_turn(
            form_id=session.form_id,
            current_values=session.values,
            locale=session.locale,
            audio_bytes=audio_bytes,
            filename=filename,
            transcript=transcript,
        )
