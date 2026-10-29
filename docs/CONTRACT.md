# Frozen milestone 1 contract

Sources read: FormSaathi_AI_Editable_Report.md (PRD A6, A10, A12–A14),
FormSaathi_AI_Hackathon_Master_Development_Playbook.docx (canonical contract),
FormSaathi_Sourav_Personal_Development_Playbook.docx. Separate Sayan/Akash
playbooks were unavailable; their master workstreams define their boundaries.
PRD controls product fields; master controls shared interfaces.

## Forms

Schemas in backend/app/schemas/forms are the machine-readable source of truth.
Each property has an explicit required flag in GET form responses, derived from
the JSON Schema required array. No envelope metadata is a form value.

| Form | Required fields | Optional fields |
| --- | --- | --- |
| student_registration_v1 | full_name, date_of_birth, mobile, city, state, programme | email, institution, guardian_name, preferred_language |
| student_assistance_v1 | full_name, date_of_birth, mobile, institution, programme, year_of_study, city, state, assistance_type | email, support_reason |

Exact states: Assam, Manipur, Meghalaya, Tripura, Arunachal Pradesh, Nagaland,
Mizoram, Other Indian State/UT. Programmes: BSc Physics, BCA, BA English, Other.
Assistance types: books, transport, fees, other. Preferred language: English, Hindi.
Study year is an integer 1–5. Locale en-IN/hi-IN is session metadata, independent
of preferred_language. as-IN is experimental and rejected in this milestone.

PRD A6 prose supplies optional institution/guardian minimum lengths (2), email
maximum length (254), and DOB rules omitted from its abridged JSON. Both are
applied. Optional null/empty values are absent. Required null/empty/whitespace or
"unknown" values are missing. Unicode spelling is preserved; name whitespace is
collapsed. Mobile strips spaces/hyphens and optional +91, then requires ASCII
ten digits starting 6–9. Enums match case-insensitively to listed values only.
Dates accept strict ISO or explicit English named month (e.g. 3 April 2006).
Slash dates with two possible interpretations require an explicit ISO/named-month
correction. Impossible/future dates are invalid. Ages outside 12–100 need review;
an explicit manual ISO/named-month correction acknowledges an age outlier.

## HTTP interfaces

| Method/path | Request | Response |
| --- | --- | --- |
| GET /api/health | — | {status:"ok",speech_provider:"unavailable",extraction_provider:"unavailable"} |
| GET /api/forms | — | {forms:[{id,title,description}]} |
| GET /api/forms/{form_id} | — | {form_id,title,description,fields:[{field_id,label,required,...JSON Schema constraints}]} |
| POST /api/sessions | {form_id,locale} | {session_id,form_id,revision:0,expires_in_seconds:3600} (201) |
| POST /api/sessions/{sid}/validate | {proposed_values:{field_id:value}} | {values,statuses,messages,missing,invalid,conflicts,revision,can_confirm} |
| PATCH /api/sessions/{sid}/fields | {field_id,value,source:"manual"} | {revision,field:{field_id,value,status,message},status} |
| GET /api/sessions/{sid}/review | — | {values,field_statuses,messages,missing,invalid,conflicts,can_confirm,revision} |
| POST /api/sessions/{sid}/confirm | {reviewed:true,revision:int} | {confirmation_id,status:"confirmed_local",form_id,revision,confirmed_at,record} |
| DELETE /api/sessions/{sid} | — | 204 |

Values are strings, numbers or null; study year alone requires a strict integer.
Unknown fields/envelope properties are rejected before mutation. Validation returns
field-level invalid states with 200 so users can correct values. All fields have
an explicit status/message, including optional empty fields. Lists follow schema order.

Validation proposals are unverified, not manual approval. Until Sayan's evidence
bridge exists, syntactically valid proposals require manual acknowledgement via
PATCH. Contradictory proposals create conflicts without replacing an existing
value, including manual values. PATCH resolves that field's uncertainty/conflict.
No absent field is autofilled. Nonempty validate batches and every PATCH increment
revision and clear prior review/confirmation. Empty validate rechecks without edits.

GET review records the served snapshot revision; it does not itself approve values.
POST confirm must explicitly assert reviewed=true with that current revision.
It revalidates server state and rejects missing/invalid/needs_review/conflict fields,
including invalid optional fields. A stale or absent review is 409. Record is a copy
of the complete normalized values map (including optional nulls), never an external
submission. Subsequent edits invalidate confirmation. Repeated confirm at the same
reviewed revision returns the same local confirmation.

## Reserved AI interfaces (Sayan adapter, Sourav route)

POST /api/sessions/{sid}/speech: multipart audio (file) and locale (en-IN/hi-IN).
Agreed response: {transcript,language_code,provider,request_id}.
Future adapter: SpeechProvider.transcribe(audio_bytes, filename, locale).
Before provider integration: 503 ASR_UNAVAILABLE. No audio is parsed or persisted.
Before enabling it, enforce 10 MB, byte-sniffed audio/webm|wav|mpeg|ogg and measured
duration <=30 seconds (client <=25), session locale binding, one upload/session,
bounded timeout/retry. Rejections: 413 size, 415 codec, 422 empty/duration,
502 upstream error, 504 timeout. These upload checks are not implemented yet.

POST /api/sessions/{sid}/extract JSON: {transcript,language_code}; transcript must
be nonblank and language must match session. Frontend must show and obtain human
acceptance of the transcript before this call. Agreed result: {candidates,issues}.
Candidate: {field_id:string,value:string|number|null,evidence_text:string,
uncertain:boolean,ambiguity_reason:string|null}. All five keys required; extra
keys rejected. Issue: {field_id:string|null,type:string,message:string,
candidates?:unknown[]}. Adapter: Extractor.extract(transcript,allowed_fields,
session_values). Before provider integration: 503 EXTRACTION_UNAVAILABLE, no state
mutation or fabricated candidates. Future integration must retain evidence and
uncertainty in server state, reject unsupported IDs/evidence, preserve manual
corrections and bind proposals to the session/revision. Shape alone proves no facts.

## Errors and lifecycle

Envelope: {error:{code,message,retryable,field_id,request_id}}. Safe request IDs
are generated server-side. No raw request payload appears in error responses.
400 invalid locale; 404 unknown form/session (including expired/deleted);
409 blocked/stale review; 422 malformed payload/unknown field; 503 unavailable AI.
All sessions use opaque random IDs and fixed creation-time expiry at 3600 seconds.
Expiry is not extended by use. Expired entries are purged on API session access
and creation; idle memory is reclaimed at the next access. Single-process only.
CORS allows only http://localhost:5173. No authentication; keep server on loopback.
