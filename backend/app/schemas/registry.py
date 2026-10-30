import json
import re
import threading
from collections import OrderedDict
from copy import deepcopy
from pathlib import Path

from app.services.errors import APIError

_BUILTIN_FORMS = {
    form["$id"]: form
    for path in sorted((Path(__file__).parent / "forms").glob("*.json"))
    for form in [json.loads(path.read_text(encoding="utf-8"))]
}

# In-memory custom form registry bounded to prevent unrestricted memory growth
MAX_CUSTOM_SCHEMAS = 100
MAX_SCHEMA_BYTES = 64 * 1024  # 64 KB
MAX_PROPERTIES = 50

_CUSTOM_FORMS: OrderedDict[str, dict] = OrderedDict()
_REGISTRY_LOCK = threading.RLock()


def validate_custom_schema(schema: dict) -> None:
    if not isinstance(schema, dict):
        raise APIError(422, "INVALID_SCHEMA", "Form schema must be a JSON object.")

    # Guard against oversized schema payload attacks
    try:
        serialized = json.dumps(schema)
        if len(serialized.encode("utf-8")) > MAX_SCHEMA_BYTES:
            raise APIError(413, "SCHEMA_PAYLOAD_TOO_LARGE", f"Custom schema payload exceeds {MAX_SCHEMA_BYTES // 1024} KB limit.")
    except (TypeError, ValueError):
        raise APIError(422, "INVALID_SCHEMA", "Schema is not JSON serializable.")

    form_id = schema.get("$id")
    if not form_id or not isinstance(form_id, str) or not re.fullmatch(r"[A-Za-z0-9_\-\.]{2,80}", form_id):
        raise APIError(422, "INVALID_SCHEMA_ID", "Schema $id must be a string of 2-80 alphanumeric, underscore, or hyphen characters.")
    title = schema.get("title")
    if not title or not isinstance(title, str) or len(title) > 120:
        raise APIError(422, "INVALID_SCHEMA_TITLE", "Schema title must be 1-120 characters.")
    properties = schema.get("properties")
    if not isinstance(properties, dict) or len(properties) == 0:
        raise APIError(422, "INVALID_SCHEMA_PROPERTIES", "Schema must have a non-empty 'properties' dictionary.")
    if len(properties) > MAX_PROPERTIES:
        raise APIError(422, "SCHEMA_TOO_LARGE", f"Schema cannot exceed {MAX_PROPERTIES} properties.")

    valid_types = {"string", "integer", "number", "boolean", "array"}
    for prop_id, prop_spec in properties.items():
        if not isinstance(prop_id, str) or not re.fullmatch(r"[A-Za-z0-9_]{1,64}", prop_id):
            raise APIError(422, "INVALID_FIELD_ID", f"Field ID '{prop_id}' is invalid. Use letters, numbers, and underscores.")
        if not isinstance(prop_spec, dict):
            raise APIError(422, "INVALID_FIELD_SPEC", f"Field spec for '{prop_id}' must be a dictionary.")
        p_type = prop_spec.get("type", "string")
        if isinstance(p_type, list):
            p_type = [t for t in p_type if t != "null"]
            p_type = p_type[0] if p_type else "string"
        if p_type not in valid_types:
            raise APIError(422, "INVALID_FIELD_TYPE", f"Field '{prop_id}' has unsupported type '{p_type}'.")


def register_form(schema: dict) -> dict:
    """
    Registers a custom form schema in thread-safe memory with bounded FIFO/LRU eviction.
    Overwriting builtin schemas is strictly disallowed.
    """
    validate_custom_schema(schema)
    with _REGISTRY_LOCK:
        form_id = schema["$id"]
        # Disallow overriding builtin forms
        if form_id in _BUILTIN_FORMS:
            return deepcopy(_BUILTIN_FORMS[form_id])

        # If already registered, refresh position
        if form_id in _CUSTOM_FORMS:
            _CUSTOM_FORMS.pop(form_id)
        elif len(_CUSTOM_FORMS) >= MAX_CUSTOM_SCHEMAS:
            # Evict least-recently-registered custom schema to prevent unbounded memory growth
            _CUSTOM_FORMS.popitem(last=False)

        clean_schema = deepcopy(schema)
        clean_schema.setdefault("type", "object")
        clean_schema.setdefault("required", [])
        _CUSTOM_FORMS[form_id] = clean_schema
        return deepcopy(clean_schema)


def get_form(form_id: str) -> dict | None:
    with _REGISTRY_LOCK:
        if form_id in _BUILTIN_FORMS:
            return deepcopy(_BUILTIN_FORMS[form_id])
        if form_id in _CUSTOM_FORMS:
            return deepcopy(_CUSTOM_FORMS[form_id])
        return None


def list_forms() -> list[dict]:
    with _REGISTRY_LOCK:
        all_forms = {**_BUILTIN_FORMS, **_CUSTOM_FORMS}
        return [
            {"id": form["$id"], "title": form["title"], "description": form.get("description", "")}
            for form in all_forms.values()
        ]
