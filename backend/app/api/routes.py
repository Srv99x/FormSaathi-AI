import json
from fastapi import APIRouter, Request, Response
from app.ai import ai_service
from app.models.contracts import (ConfirmRequest, ConfirmationResponse, CreateSession,
    ExtractionRequest, ExtractionResponse, ManualChange, PatchResponse, RegisterFormRequest,
    ReviewResponse, SessionDetailsResponse, SessionResponse, SpeechResponse, UpdateLocaleRequest,
    ValidateRequest, ValidationResponse)
from app.schemas.registry import get_form, list_forms, register_form
from app.services.ai_adapter import apply_field_mapping
from app.services.errors import APIError
from app.services.session_service import (TTL_SECONDS, confirm, patch_field, propose,
                                         require_locale, snapshot)

router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    return {"status": "ok", **ai_service.status()}


@router.get("/forms")
def forms():
    return {"forms": list_forms()}


@router.post("/forms", status_code=201)
def create_custom_form(body: RegisterFormRequest):
    reg = register_form(body.schema_definition)
    return {"form_id": reg["$id"], "title": reg["title"], "status": "registered"}


@router.get("/forms/{form_id}")
def form(form_id: str):
    schema = get_form(form_id)
    if schema is None:
        raise APIError(404, "FORM_NOT_FOUND", "This form is not available.")
    return {"form_id": form_id, "title": schema["title"], "description": schema.get("description", ""),
            "fields": [{"field_id": key, "label": spec.get("title", key),
                        "required": key in schema.get("required", []), **spec}
                       for key, spec in schema["properties"].items()]}


@router.post("/sessions", status_code=201, response_model=SessionResponse)
def create_session(body: CreateSession, request: Request):
    session = request.app.state.sessions.create(body.form_id, body.locale, body.custom_schema)
    return {"session_id": session.session_id, "form_id": session.form_id,
            "revision": session.revision, "expires_in_seconds": TTL_SECONDS}


@router.get("/sessions/{sid}", response_model=SessionDetailsResponse)
def get_session(sid: str, request: Request):
    with request.app.state.sessions.access(sid) as session:
        remaining_ttl = max(0, int(session.expires_at - request.app.state.sessions.clock()))
        return {
            "session_id": session.session_id,
            "form_id": session.form_id,
            "locale": session.locale,
            "revision": session.revision,
            "expires_in_seconds": remaining_ttl,
            "values": session.values,
        }


@router.patch("/sessions/{sid}/locale", response_model=SessionResponse)
def update_session_locale(sid: str, body: UpdateLocaleRequest, request: Request):
    require_locale(body.locale)
    with request.app.state.sessions.access(sid) as session:
        session.locale = body.locale
        session.changed()
        return {
            "session_id": session.session_id,
            "form_id": session.form_id,
            "revision": session.revision,
            "expires_in_seconds": TTL_SECONDS,
        }


@router.post("/sessions/{sid}/validate", response_model=ValidationResponse)
def validate(sid: str, body: ValidateRequest, request: Request):
    with request.app.state.sessions.access(sid) as session:
        propose(session, body.proposed_values)
        return snapshot(session)


@router.patch("/sessions/{sid}/fields", response_model=PatchResponse)
def fields(sid: str, body: ManualChange, request: Request):
    with request.app.state.sessions.access(sid) as session:
        patch_field(session, body.field_id, body.value, body.source)
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
        current_values_override = None
        if "multipart/form-data" in content_type:
            form_data = await request.form()
            audio_file = form_data.get("audio")
            if audio_file:
                audio_bytes = await audio_file.read()
                filename = getattr(audio_file, "filename", "audio.webm")
            transcript = form_data.get("transcript")
            raw_cv = form_data.get("current_values")
            if raw_cv:
                try:
                    current_values_override = json.loads(str(raw_cv))
                except Exception:
                    pass
        else:
            try:
                body = await request.json()
                transcript = body.get("transcript")
                current_values_override = body.get("current_values")
            except Exception:
                transcript = None

        # Merge client's current screen values with session values for full context
        effective_values = dict(session.values)
        if isinstance(current_values_override, dict):
            for k, v in current_values_override.items():
                if v is not None and str(v).strip() != "":
                    effective_values[k] = v

        return await ai_service.conversational_turn(
            form_id=session.form_id,
            current_values=effective_values,
            locale=session.locale,
            audio_bytes=audio_bytes,
            filename=filename,
            transcript=transcript,
            manual_fields=session.manual_fields,
        )


@router.post("/tts")
async def tts_synthesize(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    text = body.get("text", "")
    locale = body.get("locale", "en-IN")
    speaker = body.get("speaker")
    if not text or not str(text).strip():
        raise APIError(422, "MISSING_TEXT", "Text is required for speech synthesis.")
    audio_base64 = await ai_service.synthesize_speech(text=str(text), locale=locale, speaker=speaker)
    return {"audio_base64": audio_base64}
