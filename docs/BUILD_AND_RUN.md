# Build and run

Run from the selected repository root in PowerShell:

```powershell
python --version
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
Set-Location backend
.venv/Scripts/python.exe -m pytest -q
.venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Do not recreate the venv if it already exists. No activation or global package
installation is needed. No API key is needed. .env.example reserves provider
settings for a later integration; the current backend does not load those settings.
TTL=3600, disabled experimental languages and localhost CORS are fixed by code.

macOS/Linux equivalent from root:

```sh
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
cd backend
.venv/bin/python -m pytest -q
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Use a single worker. `--reload` is optional and resets memory whenever code changes.
Health: http://127.0.0.1:8000/api/health; docs: http://127.0.0.1:8000/docs.
The reserved frontend origin is http://localhost:5173; no frontend exists yet.

## Manual API smoke path

With the server running, use PowerShell:

```powershell
$base = 'http://127.0.0.1:8000/api'
Invoke-RestMethod "$base/health"
Invoke-RestMethod "$base/forms"
$created = Invoke-RestMethod "$base/sessions" -Method Post -ContentType 'application/json' -Body '{"form_id":"student_registration_v1","locale":"en-IN"}'
$sessionUrl = "$base/sessions/$($created.session_id)"
$values = @{full_name='Aditi Sen';date_of_birth='2006-04-03';mobile='9876543210';city='Guwahati';state='Assam';programme='BCA'}
foreach ($key in $values.Keys) {
    $body = @{field_id=$key;value=$values[$key];source='manual'} | ConvertTo-Json
    Invoke-RestMethod "$sessionUrl/fields" -Method Patch -ContentType 'application/json' -Body $body
}
$review = Invoke-RestMethod "$sessionUrl/review"
# Inspect every value in $review. Only then explicitly confirm this revision:
$body = @{reviewed=$true;revision=$review.revision} | ConvertTo-Json
Invoke-RestMethod "$sessionUrl/confirm" -Method Post -ContentType 'application/json' -Body $body
Invoke-RestMethod $sessionUrl -Method Delete
```

Troubleshooting: install dependencies using the venv interpreter; run pytest and
uvicorn from backend so app imports resolve. A 404 session means deleted/expired or
restarted server. A 409 confirmation requires the latest review and resolved fields.
503 speech/extract is expected; providers are deliberately not integrated.

## Actual verification — 29 October 2026

Executed in Windows PowerShell, Python 3.12.10, Git 2.52.0.windows.1:

| Command/check | Actual result |
| --- | --- |
| Get-ChildItem -Force | Initially only .git; no existing project files overwritten |
| git status --short --branch | No commits yet on main...origin/main [gone]; existing Git metadata preserved |
| rg --files ... | rg not installed; used PowerShell inspection |
| python --version / git --version | Python 3.12.10 / Git 2.52.0.windows.1 |
| python -m venv backend/.venv | Failed ensurepip due to inaccessible sandbox temp directory; venv interpreter was created |
| backend/.venv/Scripts/python.exe -m ensurepip --upgrade --default-pip | Initially PermissionError writing temporary wheel |
| ensurepip with task-specific TEMP/TMP below | Succeeded: installed pip-25.0.1 inside project venv |
| backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt | Failed: getaddrinfo failed resolving package index; no matching distribution reported after connection retries |
| .venv/Scripts/python.exe -m pytest -q (from backend) | Exit 1: No module named pytest; test suite NOT RUN |
| .venv/Scripts/python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 (from backend) | Exit 1: No module named uvicorn; server startup NOT VERIFIED |
| backend/.venv/Scripts/python.exe -m compileall -q backend/app backend/tests | Exit 0: Python source compilation passed; not a runtime/test pass |
| Standard-library JSON comparison against both A6 source schema blocks | Exit 0: exact field order, required arrays, source types, enums and constraints matched for both forms |
| git diff --check | Exit 0; new files are untracked, so this does not establish whitespace checks of their contents |
| python -m pip cache list / python -m pip show ... | No locally built wheels; global packages differ from requirements and email-validator absent; no global changes made |

Temp workaround actually executed from project root:

```powershell
New-Item -ItemType Directory -Path backend/.venv/tmp -Force | Out-Null
$env:TEMP = (Resolve-Path backend/.venv/tmp).Path
$env:TMP = $env:TEMP
backend/.venv/Scripts/python.exe -m ensurepip --upgrade --default-pip
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
```

Remaining blocker: install backend/requirements.txt when package-index access works,
then run the real pytest suite and start uvicorn. No test count, live HTTP result,
provider output or completed end-to-end feature is claimed. Global packages were
inspected read-only and were not used as a substitute for the pinned venv.
