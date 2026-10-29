# FormSaathi AI — Canonical API & Domain Contract (CONTRACT.md)

**Document Version:** 2.0.0 (Production Verified)  
**Authority:** Original PRD (FormSaathi_AI_Editable_Report.md A6/A13) for domain fields; Master Development Playbook for architecture and endpoints; `AGENTS.md` for team ownership.

---

## 1. Scope & Ownership

- **Backend Development & AI Integration (Sourav Chakraborty):** `backend/app/api/`, `backend/app/models/`, `backend/app/schemas/`, `backend/app/services/`, and `backend/app/ai/`, covering speech-to-text, entity extraction, text-to-speech, session lifecycle, deterministic validation, and automated test suites.
- **Frontend Experience & Audio Capture (Akash Kalita):** `frontend/` single-page application, microphone audio capture with voice activity detection, voice orb interface, visual form builder, and local state management.
- **Designated AI Requirements:**
  - Speech-to-Text: Sarvam Saaras v4 (`saaras:v4`).
  - Structured Conversational Agent & Extraction: Groq Llama 3.3 70B Versatile.
  - Text-to-Speech Voice Synthesis: Sarvam Bulbul v3 (`bulbul:v3`).
- **Locales:** English (`en-IN`) and Hindi (`hi-IN`). Assamese (`as-IN`) is experimental and rejected on session creation.

---

## 2. Form Schemas & Field Constraints

Schemas in `backend/app/schemas/forms/` represent the canonical source of truth:

| Form ID | Required Fields | Optional Fields |
|:---|:---|:---|
| `student_registration_v1` | `full_name`, `date_of_birth`, `mobile`, `city`, `state`, `programme` | `email`, `institution`, `guardian_name`, `preferred_language` |
| `student_assistance_v1` | `full_name`, `date_of_birth`, `mobile`, `institution`, `programme`, `year_of_study`, `city`, `state`, `assistance_type` | `email`, `support_reason` |

### Allowed Enumerations
- **`state`**: `Assam`, `Manipur`, `Meghalaya`, `Tripura`, `Arunachal Pradesh`, `Nagaland`, `Mizoram`, `Other Indian State/UT`.
- **`programme`**: `BSc Physics`, `BCA`, `BA English`, `Other`.
- **`assistance_type`**: `books`, `transport`, `fees`, `other`.
- **`preferred_language`**: `English`, `Hindi`.
- **`year_of_study`**: Strict integer `1`, `2`, `3`, `4`, or `5`.

### Validation Rules
1. **`full_name`**: Non-empty string. Extra whitespace is collapsed. Preserves Unicode and standard Latin transliteration. Minimum length 2 characters.
2. **`date_of_birth`**: Strict ISO format (`YYYY-MM-DD`) or unambiguous named English month (e.g. `15 August 2004`). Impossible dates (such as `2001-02-30` or non-leap `2023-02-29`) and future dates are rejected with `INVALID_DATE`. Target age range is 12 to 100 years; outlier dates receive `NEEDS_REVIEW` and require explicit manual acknowledgment.
3. **`mobile`**: 10 ASCII digits starting with digits `6`, `7`, `8`, or `9`. Strips spaces, hyphens, and optional `+91` international dialing prefix.
4. **`email`**: Valid RFC 5322 format if provided; maximum 254 characters.
5. **`city` / `institution` / `guardian_name`**: Minimum length 2 characters.
6. **Enums**: Matched case-insensitively to allowed options. Unlisted values prompt the user to choose an existing option or select `"Other"`.

---

## 3. Authoritative HTTP API Specification

All API routes are served under `/api` (or root health `/health`).

### 3.1 Session & Form Management

| Method & Route | Request Payload | Success Response | Status |
|:---|:---|:---|:---|
| `GET /api/health` | — | `{"status": "ok", "speech_provider": "available", "extraction_provider": "available"}` | `200` |
| `GET /api/forms` | — | `{"forms": [{"id": str, "title": str, "description": str}]}` | `200` |
| `GET /api/forms/{form_id}` | — | `{"form_id": str, "title": str, "description": str, "fields": [...]}` | `200` |
| `POST /api/sessions` | `{"form_id": str, "locale": "en-IN" \| "hi-IN"}` | `{"session_id": str, "form_id": str, "revision": 0, "expires_in_seconds": 3600}` | `201` |
| `GET /api/sessions/{sid}` | — | `{"session_id": str, "form_id": str, "locale": str, "values": {...}, "revision": int}` | `200` |
| `PATCH /api/sessions/{sid}/fields` | `{"field_id": str, "value": any, "source": "manual" \| "voice"}` | `{"revision": int, "field": {"field_id": str, "value": any, "status": str, "message": str}}` | `200` |
| `POST /api/sessions/{sid}/validate` | `{"proposed_values": {field_id: value}}` | `{"values": {...}, "statuses": {...}, "missing": [...], "invalid": [...], "can_confirm": bool}` | `200` |
| `GET /api/sessions/{sid}/review` | — | `{"values": {...}, "field_statuses": {...}, "missing": [...], "invalid": [...], "can_confirm": bool, "revision": int}` | `200` |
| `POST /api/sessions/{sid}/confirm` | `{"reviewed": true, "revision": int}` | `{"confirmation_id": str, "status": "confirmed_local", "form_id": str, "revision": int, "confirmed_at": str, "record": {...}}` | `200` |
| `DELETE /api/sessions/{sid}` | — | Empty body | `204` |

---

### 3.2 AI & Conversational Voice Endpoints

#### POST `/api/sessions/{sid}/assistant`
The unified conversational turn endpoint. Accepts either `multipart/form-data` with an audio file or JSON with a text transcript.

- **Request Options**:
  - **Multipart (`multipart/form-data`)**:
    - `audio`: File upload (WebM / WAV / MP3 / OGG, max 10MB, max 30 seconds).
    - `current_values` *(optional)*: JSON-stringified map of currently filled frontend fields.
    - `transcript` *(optional)*: Direct transcript override.
  - **JSON (`application/json`)**:
    - `{"transcript": str, "current_values": {...}}`
- **Response (`200 OK`)**:
  ```json
  {
    "user_transcript": "My name is Pooja Das and I live in Guwahati",
    "candidates": [
      {
        "field_id": "full_name",
        "value": "Pooja Das",
        "evidence_text": "Pooja Das",
        "uncertain": false,
        "ambiguity_reason": null
      },
      {
        "field_id": "city",
        "value": "Guwahati",
        "evidence_text": "Guwahati",
        "uncertain": false,
        "ambiguity_reason": null
      }
    ],
    "issues": [],
    "updated_values": {
      "full_name": "Pooja Das",
      "city": "Guwahati"
    },
    "missing_required": ["date_of_birth", "mobile", "state", "programme"],
    "missing_optional": ["email", "institution", "guardian_name", "preferred_language"],
    "assistant_message": "Got it, Pooja! What is your date of birth?",
    "assistant_audio_base64": "UklGRi...",
    "name_candidate": "Pooja Das",
    "name_spelling": "P-O-O-J-A-D-A-S",
    "is_complete": false
  }
  ```

#### POST `/api/tts`
Direct neural speech synthesis endpoint powered by Sarvam Bulbul v3.

- **Request (`application/json`)**:
  ```json
  {
    "text": "Hello! I am your FormSaathi assistant. Let's get started.",
    "locale": "en-IN",
    "speaker": "priya"
  }
  ```
- **Response (`200 OK`)**:
  ```json
  {
    "audio_base64": "UklGRi..."
  }
  ```

#### POST `/api/sessions/{sid}/speech`
Raw audio transcription via Sarvam Saaras v4 (`saaras:v4`).

- **Request**: Multipart file `audio` and optional `locale`.
- **Response**: `{"transcript": str, "language_code": str, "provider": "sarvam", "request_id": str}`

#### POST `/api/sessions/{sid}/extract`
Structured candidate extraction from transcript via Groq Llama 3.3.

- **Request**: `{"transcript": str, "language_code": "en-IN" | "hi-IN"}`
- **Response**: `{"candidates": [...], "issues": [...]}`

---

## 4. Confirmation & Review Lifecycle

1. **Review Requirement**: Clients must invoke `GET /api/sessions/{sid}/review` prior to confirmation. This endpoint checks that:
   - All required fields are present and valid (`missing` is empty).
   - No fields have `invalid` or unresolved `conflict` statuses.
   - If conditions are met, `can_confirm: true` is returned with the current snapshot `revision`.
2. **Atomic Confirmation**: Confirmation (`POST /api/sessions/{sid}/confirm`) must include `reviewed: true` and the exact matching `revision` integer.
   - If the session was modified after the review snapshot was taken, the server returns `409 STALE_REVIEW`.
   - If validation criteria fail, the server returns `409 CONFIRMATION_BLOCKED`.
3. **Confirmed Record**: Successful confirmation transitions the session into `confirmed_local` and returns a persistent confirmation ID and timestamped snapshot.

---

## 5. Security & Session Guarantees

- **Session Expiry**: Sessions are held strictly in process memory with a 3600-second time-to-live (`TTL = 1 hour`). Expired sessions are automatically reclaimed.
- **No External Exfiltration**: Form data is preserved locally in memory; no submission is made to external government or college backends.
- **CORS Policy**: Dynamic CORS middleware allows requests from `http://localhost:5173`, `http://127.0.0.1:5173`, all Vercel preview and production subdomains (`https://*.vercel.app`), and any origins defined in `CORS_ORIGINS`.
