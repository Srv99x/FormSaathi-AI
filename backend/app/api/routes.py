from fastapi import APIRouter, Request, Response

from app.models.contracts import (ConfirmRequest, ConfirmationResponse, CreateSession,
    ExtractionRequest, ExtractionResponse, ManualChange, PatchResponse, ReviewResponse,
    SessionResponse, SpeechResponse, ValidateRequest, ValidationResponse)
from app.schemas.registry import get_form, list_forms
from app.services.errors import APIError
from app.services.session_service import (TTL_SECONDS, confirm, correct, propose,
                                         require_locale, snapshot)

router = APIRouter(prefix="/api")


@router.get("/health")
def health():
    return {"status": "ok", "speech_provider": "unavailable", "extraction_provider": "unavailable"}


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
def speech(sid: str, request: Request):
    # Do not consume/upload arbitrary audio until Sourav's adapter and guards exist.
    with request.app.state.sessions.access(sid):
        raise APIError(503, "ASR_UNAVAILABLE", "Speech is not integrated. Type your details instead.")


@router.post("/sessions/{sid}/extract", response_model=ExtractionResponse,
             responses={503: {"description": "EXTRACTION_UNAVAILABLE: provider not integrated"}})
def extract(sid: str, body: ExtractionRequest, request: Request):
    with request.app.state.sessions.access(sid) as session:
        require_locale(body.language_code)
        if body.language_code != session.locale:
            raise APIError(400, "LOCALE_MISMATCH", "Use the language selected for this session.")
        if not body.transcript.strip():
            raise APIError(400, "EMPTY_TRANSCRIPT", "Enter or record a transcript before extraction.")
        raise APIError(503, "EXTRACTION_UNAVAILABLE", "Extraction is not integrated. Enter and check fields manually.")
