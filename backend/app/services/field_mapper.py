"""field_mapper.py — Pure field-mapping layer for FormSaathi AI.

Receives raw AI candidates and a transcript, validates each candidate against
the registered form schema, performs evidence-grounding checks, detects
conflicts, and returns typed accepted/rejected/issue lists.

Contract compatibility
----------------------
Accepted candidates match the shape of ``app.models.contracts.Candidate``
(field_id, value, evidence_text, uncertain, ambiguity_reason).
Issues match ``app.models.contracts.Issue`` (field_id, type, message).

This module is intentionally pure: it has no session state, no AI calls,
and no HTTP concerns.  The caller is responsible for feeding the output into
the session's propose() path once a real extractor adapter exists.

Rules
-----
1.  Unknown field IDs → UNKNOWN_FIELD issue; candidate dropped.
2.  Blank evidence_text → MISSING_EVIDENCE issue; candidate dropped.
3.  evidence_text not grounded in transcript → UNGROUNDED issue; dropped.
4.  null value → NULL_VALUE issue; candidate not proposed.
5.  Two candidates for the same field → CONFLICT issue; both kept in issue
    candidates list; neither is auto-accepted.
6.  Manual-correction fields → MANUAL_OVERRIDE_PROTECTED issue; dropped.
7.  uncertain=True → candidate kept but uncertain flag preserved for review.
8.  Type/enum/date/phone/required validation is left to validators.py.
9.  No confidence scores, translations, or invented values are introduced.

Grounding check
---------------
Normalised whitespace comparison: the evidence text (lowercased, whitespace
collapsed) must be a contiguous substring of the normalised transcript.
This is deliberately conservative; it is not a semantic similarity check.
"""

from __future__ import annotations

import re
from typing import Any

from app.schemas.registry import get_form


def _normalise(text: str) -> str:
    """Collapse all whitespace sequences to a single space and lowercase."""
    return re.sub(r"\s+", " ", text).strip().lower()


def map_candidates(
    form_id: str,
    transcript: str,
    raw_candidates: list[dict[str, Any]],
    allowed_fields: set[str] | None = None,
    manual_fields: set[str] | None = None,
) -> dict[str, Any]:
    """Map and validate raw AI candidates against the form schema.

    Parameters
    ----------
    form_id:
        The active form identifier (must be registered in app.schemas.registry).
    transcript:
        The human-approved transcript string.  Evidence grounding is checked
        against this value.
    raw_candidates:
        Each element must carry the five CONTRACT keys:
        ``field_id``, ``value``, ``evidence_text``, ``uncertain``,
        ``ambiguity_reason``.  Extra keys are rejected with UNKNOWN_KEY.
    allowed_fields:
        Optional subset of field IDs to allow. Must belong to the registered
        form's schema properties. If None, all properties of the form are allowed.
    manual_fields:
        Optional set of field IDs that the user has already corrected manually.
        Candidates for these fields are rejected to preserve manual corrections.

    Returns
    -------
    dict with three keys:
        ``accepted``  – list of clean candidate dicts (CONTRACT shape).
        ``issues``    – list of issue dicts (CONTRACT shape).
        ``conflicts`` – list of field_ids where multiple candidates collided.

    Notes
    -----
    * Validation of type, enum, date, phone etc. is NOT done here.
      Leave that to ``validators.check_field``.
    * The caller must route ``accepted`` through ``session_service.propose()``
      once a real extractor adapter exists.
    """
    schema = get_form(form_id)
    if schema is None:
        return {
            "accepted": [],
            "issues": [{
                "field_id": None,
                "type": "UNKNOWN_FORM",
                "message": f"Form '{form_id}' is not registered.",
            }],
            "conflicts": [],
        }

    form_fields = set(schema["properties"].keys())
    if allowed_fields is None:
        effective_allowed = form_fields
    else:
        disallowed = set(allowed_fields) - form_fields
        if disallowed:
            return {
                "accepted": [],
                "issues": [{
                    "field_id": None,
                    "type": "INVALID_ALLOWLIST",
                    "message": (
                        f"Allowed fields contain field(s) {sorted(disallowed)!r} "
                        f"not belonging to form '{form_id}'."
                    ),
                }],
                "conflicts": [],
            }
        effective_allowed = set(allowed_fields)

    if manual_fields is None:
        manual_fields = set()

    norm_transcript = _normalise(transcript)

    # First pass: validate structure and grounding; bucket by field_id.
    # field_id → list of structurally valid candidates
    by_field: dict[str, list[dict]] = {}
    issues: list[dict] = []

    _REQUIRED_KEYS = {"field_id", "value", "evidence_text", "uncertain", "ambiguity_reason"}

    for idx, raw in enumerate(raw_candidates):
        # --- structural check -------------------------------------------------
        if not isinstance(raw, dict):
            issues.append({
                "field_id": None,
                "type": "MALFORMED_CANDIDATE",
                "message": f"Candidate at index {idx} is not a dict; ignored.",
            })
            continue

        extra = set(raw.keys()) - _REQUIRED_KEYS
        if extra:
            issues.append({
                "field_id": raw.get("field_id"),
                "type": "UNKNOWN_KEY",
                "message": f"Extra key(s) {sorted(extra)!r} are not permitted; candidate ignored.",
            })
            continue

        missing_keys = _REQUIRED_KEYS - set(raw.keys())
        if missing_keys:
            issues.append({
                "field_id": raw.get("field_id"),
                "type": "MALFORMED_CANDIDATE",
                "message": f"Missing required key(s) {sorted(missing_keys)!r}; candidate ignored.",
            })
            continue

        field_id = raw["field_id"]
        value = raw["value"]
        evidence = raw["evidence_text"]
        uncertain = raw["uncertain"]
        ambiguity_reason = raw["ambiguity_reason"]

        # --- field_id type check ---------------------------------------------
        if not isinstance(field_id, str) or not field_id.strip():
            issues.append({
                "field_id": None,
                "type": "UNKNOWN_FIELD",
                "message": "field_id must be a non-empty string; candidate ignored.",
            })
            continue

        # --- unknown field check ---------------------------------------------
        if field_id not in effective_allowed:
            issues.append({
                "field_id": field_id,
                "type": "UNKNOWN_FIELD",
                "message": f"'{field_id}' is not part of form '{form_id}'; candidate ignored.",
            })
            continue

        # --- manual-correction protection ------------------------------------
        if field_id in manual_fields:
            issues.append({
                "field_id": field_id,
                "type": "MANUAL_OVERRIDE_PROTECTED",
                "message": (
                    f"'{field_id}' has been manually corrected; "
                    "AI proposal rejected to preserve the user's value."
                ),
            })
            continue

        # --- null value check ------------------------------------------------
        if value is None:
            issues.append({
                "field_id": field_id,
                "type": "NULL_VALUE",
                "message": (
                    f"Candidate for '{field_id}' carries null; "
                    "null means the extractor found no value—do not propose absent information."
                ),
            })
            continue

        # --- evidence presence check -----------------------------------------
        if not isinstance(evidence, str) or not evidence.strip():
            issues.append({
                "field_id": field_id,
                "type": "MISSING_EVIDENCE",
                "message": (
                    f"Candidate for '{field_id}' has blank evidence_text; "
                    "cannot verify grounding."
                ),
            })
            continue

        # --- grounding check -------------------------------------------------
        norm_evidence = _normalise(evidence)
        if norm_evidence not in norm_transcript:
            issues.append({
                "field_id": field_id,
                "type": "UNGROUNDED",
                "message": (
                    f"evidence_text for '{field_id}' was not found in the transcript; "
                    "proposal rejected to prevent fabricated values."
                ),
            })
            continue

        # --- boolean check for uncertain -------------------------------------
        if not isinstance(uncertain, bool):
            issues.append({
                "field_id": field_id,
                "type": "MALFORMED_CANDIDATE",
                "message": f"'uncertain' must be a bool for '{field_id}'; candidate ignored.",
            })
            continue

        # Structurally valid: bucket for conflict detection
        clean = {
            "field_id": field_id,
            "value": value,
            "evidence_text": evidence,
            "uncertain": uncertain,
            "ambiguity_reason": ambiguity_reason,
        }
        by_field.setdefault(field_id, []).append(clean)

    # Second pass: conflict detection
    accepted: list[dict] = []
    conflicts: list[str] = []

    for field_id, candidates in by_field.items():
        if len(candidates) == 1:
            accepted.append(candidates[0])
        else:
            # Two or more proposals for the same field — flag conflict, accept none.
            conflicts.append(field_id)
            issues.append({
                "field_id": field_id,
                "type": "CONFLICT",
                "message": (
                    f"Multiple candidates for '{field_id}' disagree; "
                    "none applied. Please choose or enter the correct value."
                ),
                "candidates": [c["value"] for c in candidates],
            })

    return {"accepted": accepted, "issues": issues, "conflicts": conflicts}
