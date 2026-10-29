# FormSaathi AI — backend milestone 1

ECCLESIA 4.0 / ECCLISIA26-001. A bilingual voice-assisted form workflow in progress.
This milestone implements the deterministic backend and manual review path only.
Nothing is submitted to a college, government service or external institution.

Implemented: two PRD schemas, en-IN/hi-IN session locales, in-memory 60-minute
sessions, validation, correction, conflicts, revision-bound review and confirmed_local
records. Speech/extraction routes return documented 503 responses. No frontend or
AI provider has been implemented or demonstrated. Assamese remains disabled.

Pipeline: future speech adapter → approved transcript → future extraction adapter
→ proposed values → deterministic validation → manual correction → review → local
confirmation. Backend validation is authoritative. Every field remains editable.

## Start on Windows PowerShell

From the project root (Python 3.12):

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
Set-Location backend
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000/docs for the local API. No key is needed for this milestone.
See [BUILD_AND_RUN](docs/BUILD_AND_RUN.md) for tests and a manual API example,
[CONTRACT](docs/CONTRACT.md) for payloads and [LIMITATIONS](docs/LIMITATIONS.md).

## Ownership and sources

Sourav: backend routes/schemas/validation/sessions/integration/release.
Sayan: backend/app/ai/, speech/extraction and evaluation. Akash: frontend/ and mic/UI.
Master and Sourav playbooks establish ownership and architecture. PRD
FormSaathi_AI_Editable_Report.md A6/A13 establishes exact product fields/constraints.
See AGENTS.md before editing. No prior application code was imported.

## Verification

Run from backend: `.venv/Scripts/python.exe -m pytest -q`.
Real execution results are recorded in docs/BUILD_AND_RUN.md after execution.
No live speech, LLM, browser or bilingual voice test is implied by backend tests.

## Privacy and operation

Use synthetic data. Values exist in process memory; reload/restart loses sessions.
DELETE removes a session; expiry is fixed at one hour. Avoid multiple workers.
Keys belong only in backend environment variables; .env files and audio are ignored.
The future vendor integration needs consent and vendor-retention review; no vendor
retention promises are made here. The local API has no authentication; bind loopback.

No remote, commit, push or invented checkpoint evidence is created by this bootstrap.
Dependencies keep their upstream licences; model/API terms must be checked by Sayan
when integrating providers. Event timing conflicts remain an organiser clarification,
not an asserted verified schedule.
