# Build and Run Guide — FormSaathi AI

This guide details how to install dependencies, run the backend and frontend locally, execute automated test suites, and verify API endpoints.

---

## 1. Quick Start

### Prerequisites
- **Python**: 3.12 or higher
- **Node.js**: 18.0 or higher
- **Package Managers**: `pip` and `npm`
- **API Keys** (optional for local mock/deterministic tests; required for live voice & AI extraction):
  - `SARVAM_API_KEY`: Sarvam AI platform key (Speech-to-Text via Saaras v4 and Text-to-Speech via Bulbul v3)
  - `GROQ_API_KEY`: Groq Cloud key (Llama 3.3 70B Versatile for conversation and entity extraction)

---

## 2. Backend Setup (FastAPI)

### Windows (PowerShell)

From the project root:

```powershell
# Create and populate Python virtual environment
python -m venv backend/.venv
backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt

# Configure environment variables
Copy-Item backend/.env.example backend/.env

# Run automated tests (99 tests)
Set-Location backend
.venv\Scripts\python.exe -m pytest -q

# Start FastAPI server on port 8000
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### macOS / Linux

From the project root:

```bash
# Create and populate Python virtual environment
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt

# Configure environment variables
cp backend/.env.example backend/.env

# Run automated tests (99 tests)
cd backend
pytest -q

# Start FastAPI server on port 8000
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Backend Verification
- Interactive Swagger UI: `http://127.0.0.1:8000/docs`
- Service Healthcheck: `http://127.0.0.1:8000/api/health`
- Dynamic CORS: Automatically allows `http://localhost:5173`, `http://127.0.0.1:5173`, `https://*.vercel.app`, or any origins defined in `CORS_ORIGINS`.

---

## 3. Frontend Setup (React 18 + Vite + Tailwind CSS)

In a separate terminal:

```bash
cd frontend
npm install

# Copy environment template
cp .env.example .env

# Run automated contract & UI tests (26 tests)
npm test

# Start Vite development server
npm run dev
```

- Open `http://localhost:5173` in your browser.
- Vite automatically proxies `/api` requests to `http://127.0.0.1:8000` during local development.

---

## 4. Test Verification Summary

Both test suites execute locally without requiring live external network calls or paid API credits:

### Backend Test Suite (Pytest)
```powershell
Set-Location backend
.venv\Scripts\python.exe -m pytest -v
```
- **Total Test Cases**: 99 tests passing.
- **Coverage**:
  - Exact JSON Schema validation for `student_registration_v1` and `student_assistance_v1`.
  - Date normalization (ISO dates, named English months, impossible calendar date rejection like Feb 30, age boundaries 12–100).
  - Indian mobile number validation (10 ASCII digits, 6–9 starting digit, `+91` prefix handling).
  - Session lifecycle (in-memory storage, 3600-second TTL, atomic access, deletion, purge).
  - Candidate mapping, grounded entity extraction, and manual override preservation.
  - Conversational turn processing and Sarvam Bulbul TTS base64 generation.
  - Revision-bound review verification and immutable local confirmation receipt creation.

### Frontend Test Suite (Node.js Test Runner)
```bash
cd frontend
npm test
```
- **Total Test Cases**: 26 tests passing.
- **Coverage**:
  - `schemaMapper` draft persistence and template switching without ID collision.
  - Mobile number and calendar date offline validation rules.
  - Offline review and confirmation boundary states (stale review rejection, network fallback handling).
  - Schema alignment against `CONTRACT.md`.
  - API client compliance (`PATCH` with `source: "manual"`, `ConfirmSession` with revision integer).

---

## 5. Manual API Smoke Verification

With the backend server running on `http://127.0.0.1:8000`, run this PowerShell script to verify the full session lifecycle:

```powershell
$base = 'http://127.0.0.1:8000/api'

# 1. Check health
Invoke-RestMethod "$base/health"

# 2. List available forms
Invoke-RestMethod "$base/forms"

# 3. Create a session for Student Registration (English)
$created = Invoke-RestMethod "$base/sessions" -Method Post -ContentType 'application/json' -Body '{"form_id":"student_registration_v1","locale":"en-IN"}'
$sessionId = $created.session_id
$sessionUrl = "$base/sessions/$sessionId"
Write-Host "Created session: $sessionId"

# 4. Patch form values manually
$values = @{
    full_name      = 'Pooja Das'
    date_of_birth  = '2005-08-15'
    mobile         = '9876543210'
    city           = 'Guwahati'
    state          = 'Assam'
    programme      = 'BCA'
}
foreach ($key in $values.Keys) {
    $body = @{field_id=$key; value=$values[$key]; source='manual'} | ConvertTo-Json
    Invoke-RestMethod "$sessionUrl/fields" -Method Patch -ContentType 'application/json' -Body $body | Out-Null
}

# 5. Request review snapshot
$review = Invoke-RestMethod "$sessionUrl/review"
Write-Host "Can confirm: $($review.can_confirm), Revision: $($review.revision)"

# 6. Confirm the form locally
$confirmBody = @{reviewed=$true; revision=$review.revision} | ConvertTo-Json
$confirmed = Invoke-RestMethod "$sessionUrl/confirm" -Method Post -ContentType 'application/json' -Body $confirmBody
Write-Host "Confirmation ID: $($confirmed.confirmation_id), Status: $($confirmed.status)"

# 7. Clean up session
Invoke-RestMethod $sessionUrl -Method Delete
Write-Host "Session purged successfully."
```

---

## 6. Production Deployment

Refer to [`docs/DEPLOYMENT.md`](DEPLOYMENT.md) for complete instructions:
- **Render Backend**: Deploys the Python 3.12 FastAPI service using `render.yaml`.
- **Vercel Frontend**: Deploys the React 18 Single-Page Application using `frontend/vercel.json`.
