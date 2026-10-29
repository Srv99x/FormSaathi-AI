import json
from copy import deepcopy
from pathlib import Path

_FORMS = {
    form["$id"]: form
    for path in sorted((Path(__file__).parent / "forms").glob("*.json"))
    for form in [json.loads(path.read_text(encoding="utf-8"))]
}


def get_form(form_id: str) -> dict | None:
    return deepcopy(_FORMS.get(form_id))


def list_forms() -> list[dict]:
    return [
        {"id": form["$id"], "title": form["title"], "description": form["description"]}
        for form in _FORMS.values()
    ]
