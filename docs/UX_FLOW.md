# UX Flow — FormSaathi AI

**Owner:** Akash Kalita (frontend, UX)
**Status:** A1 — UX Flow and Bilingual Content
**Branch:** feat/ui-akash
**Contract reference:** docs/CONTRACT.md (Frozen milestone 1)

> This document describes the nine-screen user journey, state transitions, and
> all error states for the FormSaathi AI frontend. It is derived exclusively from
> the frozen contract in `docs/CONTRACT.md` and the form schemas in
> `backend/app/schemas/forms/`. No field names, form IDs, endpoint paths, or
> option values are invented here.

---

## Privacy and confirmation notice

FormSaathi AI is a local demo application. When a user confirms a form:

- The backend returns `status: "confirmed_local"`. This means the form data is
  stored in the server's in-memory session only, for up to 3600 seconds.
- **The application does not submit data to any government authority, external
  service, or database.**
- Audio is sent to the backend for speech-to-text processing via the Sarvam API
  (server-side). Audio is not persisted by the backend after transcription.
- Transcripts are sent to the backend for structured extraction via the Sarvam
  API (server-side). The frontend must display the transcript to the user and
  obtain explicit human approval before calling the extract endpoint.
- PDF export is **not implemented** in this milestone.

---

## Session locale vs. form field `preferred_language`

| Concept | Values | Where used |
|---|---|---|
| Session locale (`locale`) | `en-IN`, `hi-IN` | Sent in `POST /api/sessions` body; controls UI language, speech-to-text language hint, and extract language hint. `as-IN` is rejected in this milestone. |
| Form field `preferred_language` | `"English"`, `"Hindi"`, or `null` | A **form value** inside `student_registration_v1` only. Optional. The user fills it like any other field. Completely separate from the session locale. |

---

## Nine-screen journey

```
[S1 Welcome]
     │
     ▼
[S2 Choose Form]
     │  GET /api/forms
     ▼
[S3 Choose Language]
     │  POST /api/sessions {form_id, locale}
     ▼
[S4 Record]
     │  POST /api/sessions/{sid}/speech  (multipart: file, locale)
     │  ┌─ 503 ASR_UNAVAILABLE ──────────────── S4 error state (retryable)
     │  ├─ 413 / 415 / 422 ─────────────────── S4 error state (actionable)
     │  └─ success → transcript displayed
     ▼
[S5 Transcript Review]   ← user edits transcript text; must explicitly approve
     │  [Approve] button → POST /api/sessions/{sid}/extract {transcript, language_code}
     │  ┌─ 503 EXTRACTION_UNAVAILABLE ────────── S5 error state (retryable)
     │  └─ success {candidates, issues}
     ▼
[S6 Filled Form]         ← candidates shown per field; all editable
     │  PATCH /api/sessions/{sid}/fields {field_id, value, source:"manual"} per edit
     │  POST /api/sessions/{sid}/validate {proposed_values} for batch check
     │  └─ fields with missing/invalid status → S7 Questions
     ▼
[S7 Questions]           ← one question at a time for missing/ambiguous fields
     │  PATCH /api/sessions/{sid}/fields per answer
     │  └─ all resolved → S8 Final Review
     ▼
[S8 Final Review]        ← GET /api/sessions/{sid}/review
     │  └─ can_confirm: true required to proceed
     │  POST /api/sessions/{sid}/confirm {reviewed: true, revision: <int>}
     │  ┌─ 409 stale/blocked ──────────────── back to S8 with error
     │  └─ success {confirmation_id, status:"confirmed_local"}
     ▼
[S9 Confirmed Locally]
```

---

## Screen specifications

### S1 — Welcome

**Purpose:** Orient the user, set accurate expectations about what the app does and
does not do.

**Entry condition:** App load.
**Exit condition:** User taps "Get Started".
**API calls:** None on this screen. (Optionally `GET /api/health` in background to
determine whether AI services are available, so S4/S5 can show early warnings.)

**Required UI elements:**
- App name and tagline.
- Short description of the voice-to-form workflow.
- Honest notice: form data is processed by a server-side AI API; confirmation is
  local to this demo session; no external submission occurs.
- Primary CTA: Get Started / शुरू करें.

---

### S2 — Choose Form

**Purpose:** Let the user pick exactly one of the two supported forms.

**Entry condition:** User tapped "Get Started".
**Exit condition:** User selects a form and taps "Continue".
**API calls:** `GET /api/forms` — fetches `[{id, title, description}]`.

**Supported form IDs (contract-frozen):**

| `id` | `title` |
|---|---|
| `student_registration_v1` | Student Registration |
| `student_assistance_v1` | Student Assistance Request |

**Required UI elements:**
- Card list of forms from API response (do not hardcode titles; use API `title` field).
- Selected form shows a clear focus/active state.
- "Continue" button disabled until one form is selected.
- If `GET /api/forms` fails: show inline error with retry option.

---

### S3 — Choose Language

**Purpose:** Set the session locale used for all subsequent API calls and UI copy.

**Entry condition:** User selected a form.
**Exit condition:** User selects a language and taps "Set Language & Continue".
**API calls:** `POST /api/sessions` with `{form_id, locale}` → `{session_id, form_id, revision, expires_in_seconds}`.

**Supported locales:**

| Display name | `locale` value sent to API |
|---|---|
| English | `en-IN` |
| हिन्दी | `hi-IN` |

- `as-IN` must **not** be offered; it is rejected by the backend in this milestone.
- Selected locale controls all subsequent UI copy and is sent as `locale` in every
  relevant API call.
- Remind user that session lasts 3600 seconds and is not persisted across browser
  refreshes.

---

### S4 — Record

**Purpose:** Capture the user's voice describing their form details.

**Entry condition:** Session created (`session_id` in state).
**Exit condition:** Successful transcript received, or user retries.
**API calls:** `POST /api/sessions/{sid}/speech` (multipart: `file`, `locale`).

**Recording constraints (enforced client-side before upload):**
- Max duration: 25 seconds (server limit is 30; client enforces 25 as buffer).
- Accepted formats: `audio/webm`, `audio/wav`, `audio/mpeg`, `audio/ogg`.
- Min duration check: warn if clip appears silent (< 1 second of audio data).

**States and transitions:**

| State | Description |
|---|---|
| `idle` | Microphone not yet started. |
| `permission_denied` | User or browser denied microphone access. |
| `listening` | MediaRecorder active; waveform visualizer running. |
| `processing` | Audio uploaded; awaiting API response. |
| `error_503` | Backend returned `503 ASR_UNAVAILABLE`. Retryable. |
| `error_502` | Backend returned `502` — upstream Sarvam API error. Retryable. |
| `error_504` | Backend returned `504` — speech request timed out. Retryable. |
| `error_size` | Audio exceeds 10 MB (`413`). |
| `error_codec` | Unsupported audio format (`415`). |
| `error_duration` | Audio too short or exceeds 30 s (`422`). |
| `success` | Transcript received; advance to S5. |

---

### S5 — Transcript Review

**Purpose:** Show the transcript from speech-to-text; let the user read, correct,
and explicitly approve it before any extraction happens.

**Entry condition:** Transcript text available in state.
**Exit condition (approve):** User taps "Approve & Extract" — triggers extract call.
**Exit condition (reject):** User taps "Re-record" — returns to S4.
**API calls (on approve):** `POST /api/sessions/{sid}/extract` with `{transcript, language_code}`.

> **Critical gate:** The extract endpoint must never be called without explicit
> user approval of the transcript text. The UI must not auto-advance.

**States and transitions:**

| State | Description |
|---|---|
| `reviewing` | User reading/editing transcript text. |
| `extracting` | Waiting for extract API response. |
| `error_503` | Backend returned `503 EXTRACTION_UNAVAILABLE`. Retryable. |
| `success` | Candidates and issues received; advance to S6. |

**Extract response shape (from contract):**
- `candidates`: array of `{field_id, value, evidence_text, uncertain, ambiguity_reason}`.
- `issues`: array of `{field_id|null, type, message, candidates?}`.
- No fabricated candidates are displayed. If service is unavailable (`503`), the
  user is informed and offered retry or manual entry path (skip extract, go to S6
  with all fields empty/editable).

---

### S6 — Filled Form

**Purpose:** Show all form fields, pre-populated from extract candidates where
available, all editable by the user.

**Entry condition:** Extract returned candidates (or user skipped extract after 503).
**Exit condition:** User taps "Next: Review Questions" (if missing/invalid fields)
or "Go to Final Review" (if `can_confirm` is true).
**API calls:**
- `PATCH /api/sessions/{sid}/fields` with `{field_id, value, source: "manual"}` on every user edit.
- `POST /api/sessions/{sid}/validate` with `{proposed_values}` to batch-check before advancing.

**Field display rules:**
- Every field from `GET /api/forms/{form_id}` is rendered, in schema order.
- Candidate value pre-filled if provided; `uncertain: true` candidates are visually
  flagged (e.g., amber badge).
- All values remain editable. Manual edits always use `source: "manual"` in PATCH.
- Validation statuses from contract: `ok`, `missing`, `invalid`, `needs_review`, `conflict`.
- `missing` and `invalid` fields are highlighted with clear inline messages.
- `conflict` state: a proposed value contradicts an existing manual value; user must
  explicitly choose via PATCH.

**Field names and rules (from contract and schemas):**

*student_registration_v1 required:*
`full_name`, `date_of_birth`, `mobile`, `city`, `state`, `programme`

*student_registration_v1 optional:*
`email`, `institution`, `guardian_name`, `preferred_language`

*student_assistance_v1 required:*
`full_name`, `date_of_birth`, `mobile`, `institution`, `programme`,
`year_of_study`, `city`, `state`, `assistance_type`

*student_assistance_v1 optional:*
`email`, `support_reason`

**Enum options (exact values, case-insensitive match on input):**
- `state`: Assam, Manipur, Meghalaya, Tripura, Arunachal Pradesh, Nagaland, Mizoram, Other Indian State/UT
- `programme`: BSc Physics, BCA, BA English, Other
- `assistance_type`: books, transport, fees, other
- `preferred_language`: English, Hindi (or null/absent)
- `year_of_study`: integer 1–5

---

### S7 — Questions (Clarification)

**Purpose:** Resolve remaining missing or ambiguous fields one at a time before
allowing final confirmation.

**Entry condition:** Validate response shows `missing` or `invalid` or
`needs_review` fields, and `can_confirm` is false.
**Exit condition:** All required fields resolved; `can_confirm` becomes true.
**API calls:** `PATCH /api/sessions/{sid}/fields` per answer.

**Question types and handling:**

| Scenario | Trigger | UI action |
|---|---|---|
| Missing `date_of_birth` | Field absent or empty | Ask for DOB; offer date picker (ISO format `YYYY-MM-DD`) |
| Missing `mobile` | Field absent or empty | Ask for mobile; enforce 10-digit `[6-9][0-9]{9}` pattern |
| Ambiguous date | Extract issue `ambiguity_reason` on DOB | Show what was heard; ask user to confirm exact date |
| Invalid `mobile` format | Validation `invalid` | Show pattern hint; let user retype |
| Invalid enum value | Validation `invalid` on state/programme/etc. | Show allowed options; let user pick |
| Age outside 12–100 | Validation `needs_review` | Warn; require explicit ISO/named-month correction to acknowledge |
| Conflict | Validation `conflict` | Show both values; require user to pick one via PATCH |

User can also choose to skip an **optional** field explicitly (leaving it null/absent).
Required fields cannot be skipped.

---

### S8 — Final Review

**Purpose:** Show the complete form state; obtain explicit user confirmation.

**Entry condition:** `can_confirm: true` in latest validate response.
**Exit condition:** Successful confirm (`status: "confirmed_local"`), or user edits and revisits S6/S7.
**API calls:**
1. `GET /api/sessions/{sid}/review` — fetch final snapshot and current `revision`.
2. `POST /api/sessions/{sid}/confirm` with `{reviewed: true, revision: <current>}`.

**Rules:**
- The "Confirm & Complete" button must be disabled until the user checks a
  declaration checkbox acknowledging that details are correct.
- If `POST /api/sessions/{sid}/confirm` returns `409` (stale or blocked review),
  display an error, re-fetch review, and require the user to re-acknowledge the
  declaration before trying again.
- Any edit after fetching review invalidates confirmation; user must return to S6/S7.
- The `GET /api/sessions/{sid}/review` must be called (and revision stored) before
  the confirm payload is constructed.

---

### S9 — Confirmed Locally

**Purpose:** Acknowledge successful local confirmation; present accurate status.

**Entry condition:** `POST /api/sessions/{sid}/confirm` returned `{confirmation_id, status: "confirmed_local", confirmed_at, record}`.
**Exit condition:** User taps "Start New Form" (resets all state and returns to S1).

**Required display:**
- `confirmation_id` and `confirmed_at` timestamp from API response.
- `status: "confirmed_local"` clearly labelled: *"Form saved in this demo session only."*
- Explicit notice: *"This is not a submission to any government body or external authority."*
- Session expiry warning: data is held in memory; it will be lost when the session
  expires (3600 seconds) or the server restarts.
- **No PDF download button** (not implemented in this milestone).
- "Start New Form" button clears all frontend state and returns to S1.

---

## Error states reference

| Error | HTTP code / condition | User-facing action |
|---|---|---|
| Microphone permission denied | Browser API denial | Show guidance to enable mic in browser settings; offer manual-entry fallback path |
| Recording too short | Client-side check | Warn before upload; let user re-record |
| Audio too large | 413 from speech endpoint | Warn: recording too long; ask user to re-record under 25 s |
| Unsupported audio codec | 415 from speech endpoint | Warn: audio format not supported; suggest re-recording |
| Audio duration invalid | 422 from speech endpoint | Explain duration constraint; let user re-record |
| Speech service unavailable | 503 ASR_UNAVAILABLE | Honest message: "Speech processing is not available right now." Offer retry or manual text entry |
| Upstream speech provider error | 502 from speech endpoint | Message: "The speech service returned an error." Offer retry |
| Speech request timed out | 504 from speech endpoint | Message: "The speech service took too long to respond." Offer retry |
| Extraction service unavailable | 503 EXTRACTION_UNAVAILABLE | Honest message: "Automatic field extraction is not available right now." Offer retry or continue with empty fields |
| Invalid locale on session creation | 400 from POST /api/sessions | Message: "The selected language is not supported." Prompt user to choose English or Hindi; do not offer as-IN |
| Session not found / expired | 404 from any endpoint | Inform user the session has expired; restart from S1 |
| Stale review on confirm | 409 from confirm endpoint | Inform user the form was edited after review; re-fetch review and re-confirm |
| Network error | fetch() rejection | Generic offline/retry message |
| Unknown server error | 5xx other | Show `request_id` from error envelope; suggest retry |
