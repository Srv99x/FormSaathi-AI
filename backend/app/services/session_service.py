from contextlib import contextmanager
from copy import deepcopy
from dataclasses import dataclass, field
from datetime import datetime, timezone
import secrets
import threading
import time

from app.schemas.registry import get_form
from app.services.errors import APIError
from app.services.validators import check_field

TTL_SECONDS = 3600
LOCALES = {"en-IN", "hi-IN"}


def require_locale(locale: str):
    if locale not in LOCALES:
        raise APIError(400, "INVALID_LOCALE", "Choose en-IN or hi-IN; Assamese is experimental and disabled.")


@dataclass
class Session:
    session_id: str
    form_id: str
    locale: str
    expires_at: float
    revision: int = 0
    values: dict = field(default_factory=dict)
    manual_fields: set = field(default_factory=set)
    voice_fields: set = field(default_factory=set)
    conflicts: dict = field(default_factory=dict)
    reviewed_revision: int | None = None
    confirmed_revision: int | None = None
    confirmation: dict | None = None
    schema: dict | None = None

    def changed(self):
        self.revision += 1
        self.reviewed_revision = None
        self.confirmed_revision = None
        self.confirmation = None


class SessionStore:
    def __init__(self, clock=time.monotonic):
        self.clock = clock
        self.sessions = {}
        self.lock = threading.RLock()

    def purge(self):
        now = self.clock()
        for sid in [sid for sid, session in self.sessions.items() if session.expires_at <= now]:
            del self.sessions[sid]

    def create(self, form_id: str, locale: str, custom_schema: dict | None = None) -> Session:
        require_locale(locale)
        if custom_schema:
            from app.schemas.registry import register_form
            register_form(custom_schema)
        schema = get_form(form_id)
        if schema is None:
            raise APIError(404, "FORM_NOT_FOUND", "This form is not available.")
        with self.lock:
            self.purge()
            session = Session(
                secrets.token_urlsafe(32),
                form_id,
                locale,
                self.clock() + TTL_SECONDS,
                values=dict.fromkeys(schema["properties"]),
                schema=deepcopy(schema),
            )
            self.sessions[session.session_id] = session
            return session

    @contextmanager
    def access(self, sid: str):
        # Keep each read/modify/review/confirm operation atomic, including revisions.
        with self.lock:
            self.purge()
            if sid not in self.sessions:
                raise APIError(404, "SESSION_NOT_FOUND", "Session expired or not found. Start a new session.")
            yield self.sessions[sid]

    def delete(self, sid: str):
        with self.access(sid):
            del self.sessions[sid]


def require_fields(session: Session, ids):
    for field_id in ids:
        if field_id not in session.values:
            raise APIError(422, "UNKNOWN_FIELD", "This field is not part of the selected form.", field_id)


def snapshot(session: Session) -> dict:
    schema = session.schema or get_form(session.form_id)
    values, statuses, messages = {}, {}, {}
    missing, invalid, conflicts = [], [], []
    for field_id, spec in schema["properties"].items():
        required = field_id in schema["required"]
        value, status, message = check_field(field_id, session.values[field_id], spec,
                                            required, datetime.now(timezone.utc).date(),
                                            field_id in session.manual_fields)
        values[field_id] = value
        if status == "empty" and required:
            missing.append(field_id)
        if status == "invalid":
            invalid.append({"field_id": field_id, "type": "invalid", "message": message})
        if field_id in session.conflicts:
            status, message = "conflict", "Different values were proposed. Please choose or enter the correct value."
            conflicts.append({"field_id": field_id, "type": "conflict", "message": message,
                              "candidates": deepcopy(session.conflicts[field_id])})
        elif (
            status == "valid"
            and field_id not in session.manual_fields
            and field_id not in session.voice_fields
            and session.values[field_id] is not None
        ):
            status, message = "needs_review", "Please check this proposed value and acknowledge it with a manual correction."
        statuses[field_id], messages[field_id] = status, message
    return {"values": values, "statuses": statuses, "messages": messages,
            "missing": missing, "invalid": invalid, "conflicts": conflicts,
            "revision": session.revision,
            "can_confirm": not missing and all(s in {"empty", "valid"} for s in statuses.values())}


def propose(session: Session, proposed_values: dict):
    require_fields(session, proposed_values)
    schema = session.schema or get_form(session.form_id)
    for field_id, value in proposed_values.items():
        old = session.values[field_id]
        spec = schema["properties"][field_id]
        normalize = lambda item: check_field(field_id, item, spec, False,
                                             datetime.now(timezone.utc).date())[0]
        if old is not None and normalize(old) != normalize(value):
            options = session.conflicts.setdefault(field_id, [old])
            if value not in options:
                options.append(value)
        elif field_id not in session.manual_fields:
            session.values[field_id] = value
    if proposed_values:
        session.changed()


def patch_field(session: Session, field_id: str, value, source: str = "manual"):
    require_fields(session, [field_id])
    if source == "voice":
        if field_id in session.manual_fields:
            raise APIError(
                409,
                "MANUAL_OVERRIDE_PROTECTED",
                f"'{field_id}' has been manually corrected; voice update rejected to preserve user edit.",
                field_id=field_id,
            )
        session.values[field_id] = value
        session.voice_fields.add(field_id)
        session.conflicts.pop(field_id, None)
        session.changed()
    else:
        session.values[field_id] = value
        session.manual_fields.add(field_id)
        session.voice_fields.discard(field_id)
        session.conflicts.pop(field_id, None)
        session.changed()


def correct(session: Session, field_id: str, value):
    patch_field(session, field_id, value, source="manual")


def confirm(session: Session, reviewed: bool, revision: int):
    if revision != session.revision or session.reviewed_revision != session.revision:
        raise APIError(409, "STALE_REVIEW", "Open the latest review and check every value before confirming.")
    result = snapshot(session)
    if not reviewed or not result["can_confirm"]:
        raise APIError(409, "CONFIRMATION_BLOCKED", "Complete and correct all fields, resolve unclear values and explicitly review them.")
    if session.confirmation is None:
        session.confirmed_revision = session.revision
        session.confirmation = {
            "confirmation_id": secrets.token_urlsafe(24), "status": "confirmed_local",
            "form_id": session.form_id, "revision": session.revision,
            "confirmed_at": datetime.now(timezone.utc).isoformat(),
            "record": deepcopy(result["values"]),
        }
    return deepcopy(session.confirmation)
