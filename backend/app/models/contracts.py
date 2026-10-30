from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictBool, StrictInt, StrictStr

Value = StrictStr | StrictInt | float | None
Status = Literal["empty", "valid", "invalid", "needs_review", "conflict"]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, allow_inf_nan=False)


class CreateSession(Contract):
    form_id: str
    locale: str
    custom_schema: dict[str, Any] | None = None


class ValidateRequest(Contract):
    proposed_values: dict[str, Value]


class ManualChange(Contract):
    field_id: str
    value: Value
    source: Literal["manual", "voice"] = "manual"


class UpdateLocaleRequest(Contract):
    locale: str


class RegisterFormRequest(Contract):
    schema_definition: dict[str, Any]


class ConfirmRequest(Contract):
    reviewed: StrictBool
    revision: StrictInt = Field(ge=0)


class ExtractionRequest(Contract):
    transcript: str
    language_code: str


class Candidate(Contract):
    field_id: str
    value: Value
    evidence_text: str
    uncertain: bool
    ambiguity_reason: str | None


class Issue(Contract):
    field_id: str | None
    type: str
    message: str
    candidates: list[Any] | None = None


class ExtractionResponse(Contract):
    candidates: list[Candidate]
    issues: list[Issue]


class SpeechResponse(Contract):
    transcript: str
    language_code: str
    provider: str
    request_id: str


class SessionResponse(Contract):
    session_id: str
    form_id: str
    revision: int
    expires_in_seconds: int


class SessionDetailsResponse(Contract):
    session_id: str
    form_id: str
    locale: str
    revision: int
    expires_in_seconds: int
    values: dict[str, Value]


class ValidationResponse(Contract):
    values: dict[str, Value]
    statuses: dict[str, Status]
    messages: dict[str, str]
    missing: list[str]
    invalid: list[Issue]
    conflicts: list[Issue]
    revision: int
    can_confirm: bool


class ReviewResponse(Contract):
    values: dict[str, Value]
    field_statuses: dict[str, Status]
    messages: dict[str, str]
    missing: list[str]
    invalid: list[Issue]
    conflicts: list[Issue]
    revision: int
    can_confirm: bool


class FieldResult(Contract):
    field_id: str
    value: Value
    status: Status
    message: str


class PatchResponse(Contract):
    revision: int
    field: FieldResult
    status: Status


class ConfirmationResponse(Contract):
    confirmation_id: str
    status: Literal["confirmed_local"]
    form_id: str
    revision: int
    confirmed_at: str
    record: dict[str, Value]
