"""ai_adapter.py — Integration adapter between AI extraction and field mapping."""

from app.models.contracts import Candidate, ExtractionResponse, Issue
from app.services.field_mapper import map_candidates


def apply_field_mapping(
    form_id: str,
    transcript: str,
    extraction: ExtractionResponse,
    manual_fields: set[str] | None = None,
) -> ExtractionResponse:
    """Validate and filter raw AI extraction candidates through map_candidates.

    Parameters
    ----------
    form_id:
        Active form identifier.
    transcript:
        Human-approved transcript text.
    extraction:
        Raw ExtractionResponse from AI extraction service.
    manual_fields:
        Set of field IDs manually edited/corrected by the user in this session.

    Returns
    -------
    ExtractionResponse with grounded, non-conflicting, allowed candidates,
    and combined deduplicated issues.
    """
    raw_candidates = [c.model_dump() for c in extraction.candidates]
    result = map_candidates(
        form_id=form_id,
        transcript=transcript,
        raw_candidates=raw_candidates,
        manual_fields=manual_fields,
    )

    accepted_candidates = [Candidate(**c) for c in result["accepted"]]

    combined_issues: list[Issue] = list(extraction.issues)
    seen_keys = {(i.field_id, i.type, i.message) for i in combined_issues}

    for issue_dict in result["issues"]:
        issue_obj = Issue(**issue_dict)
        key = (issue_obj.field_id, issue_obj.type, issue_obj.message)
        if key not in seen_keys:
            combined_issues.append(issue_obj)
            seen_keys.add(key)

    return ExtractionResponse(candidates=accepted_candidates, issues=combined_issues)
