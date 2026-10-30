<div align="center">

# FormSaathi AI

**Intelligent Multilingual Voice-Assisted Form Completion System**

Developed by **teamRedFlagggs** for Ecclesia 4.0

[![Frontend Tests](https://img.shields.io/badge/Frontend_Tests-31%20Passed-22c55e?style=flat-square)](https://github.com)
[![Backend Tests](https://img.shields.io/badge/Backend_Tests-138%20Passed-22c55e?style=flat-square)](https://github.com)
[![Python Version](https://img.shields.io/badge/Python-3.12.9-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.3-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![License](https://img.shields.io/badge/License-MIT-gray?style=flat-square)](LICENSE)

<br />

[Live Application](#live-deployments) • [Architecture](#architecture--pipeline) • [Key Capabilities](#core-capabilities) • [API Contract](#api-endpoints) • [Local Setup](#local-development) • [Testing](#test-verification)

</div>

---

## Overview

**FormSaathi AI** is a conversational voice-assisted form assistant designed to eliminate digital accessibility barriers in educational and civic applications. It combines voice activity detection, Indic speech recognition, contextual large language model reasoning, and regional voice synthesis to guide users through structured forms in English (`en-IN`) and Hindi (`hi-IN`).

The platform enforces strict deterministic validation, ensures evidence-grounded entity extraction, safeguards manual corrections against accidental overwrites, and maintains an explicit revision-bound review cycle prior to final confirmation.

---

## Live Deployments

The application is deployed across dedicated high-availability infrastructure:

| Component | Platform | URL | Purpose |
|:---|:---|:---|:---|
| **Frontend Application** | Vercel | [Live Link](https://frontend-zeta-bice-31.vercel.app/) | Single-page application, interactive voice orb interface, visual form builder |
| **Backend REST API** | Render | [Live Link](https://formsaathi-ai.onrender.com) | FastAPI service, deterministic validation engine, in-memory session manager |
| **Interactive API Documentation** | Render | [formsaathi-ai.onrender.com/docs](https://formsaathi-ai.onrender.com/docs) | OpenAPI / Swagger interactive documentation and schema explorer |

---

## Tech Stack

### Frontend Architecture
![React](https://img.shields.io/badge/React_18-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Lucide Icons](https://img.shields.io/badge/Lucide_Icons-F97316?style=for-the-badge&logo=lucide&logoColor=white)

- **React 18 & TypeScript**: Component-driven UI with strong compile-time type guarantees.
- **Vite**: Optimized build tooling and instant hot-module replacement.
- **Tailwind CSS**: Utility-first styling with responsive, accessible layouts and dark/light themes.
- **Web Audio API**: Real-time microphone capture with Voice Activity Detection (VAD), silence cutoff (1.5s threshold), and 25s maximum recording buffer.
- **HTML5 Audio Pipeline**: Pure native audio playback eliminating browser speech synthesis discrepancies.

### Backend & AI Pipeline
![Python](https://img.shields.io/badge/Python_3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![Uvicorn](https://img.shields.io/badge/Uvicorn-499848?style=for-the-badge&logo=gunicorn&logoColor=white)
![Pydantic](https://img.shields.io/badge/Pydantic_v2-E92063?style=for-the-badge&logo=pydantic&logoColor=white)
![Groq](https://img.shields.io/badge/Groq_GPT_OSS_120B-F55036?style=for-the-badge&logo=meta&logoColor=white)

- **FastAPI & Uvicorn**: High-throughput asynchronous REST backend with automated OpenAPI generation.
- **Pydantic v2**: Strict request, response, and domain contract enforcement.
- **Sarvam AI (Saaras v4)**: High-accuracy Automatic Speech Recognition (ASR) tuned for Indian accents and codeswitching.
- **Groq (OpenAI GPT-OSS 120B / GPT-OSS 20B Fallback)**: Context-aware conversational dialogue and structured entity extraction.
- **Sarvam AI (Bulbul v3)**: Natural neural text-to-speech synthesis generating responsive WAV audio streams.

### Deployment & Tooling
![Render](https://img.shields.io/badge/Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)
![Pytest](https://img.shields.io/badge/Pytest-0A9EDC?style=for-the-badge&logo=pytest&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js_Test_Runner-339933?style=for-the-badge&logo=node.js&logoColor=white)

---

## Architecture & Pipeline

FormSaathi AI executes an end-to-end hands-free loop:

```
[User Spoken Audio]
        │
        ▼ (Web Audio API / VAD Silence Detection)
[Microphone Buffer]
        │
        ▼ (POST /api/sessions/{sid}/assistant multipart/form-data)
[Sarvam Saaras v4 STT]  ──► Accurate Regional Transcript
        │
        ▼
[Groq Llama 3.3 70B]    ──► Entity Extraction & Dynamic Conversational Turn
        │
        ├──► Extracted Form Candidates & Field Updates
        │       │
        │       ▼
        │    [Deterministic Validator] ──► Validates against CONTRACT.md Schema
        │
        └──► Spoken Assistant Reply
                │
                ▼
        [Sarvam Bulbul v3 TTS]  ──► High-fidelity Audio (Base64 WAV)
                │
                ▼
        [HTML5 Audio Player]    ──► Native Voice Playback in Browser
```

### Pure Voice Pipeline Guarantees
1. **Speech-Text-LLM-Text-Speech**: Seamless conversational loop. All speech output is synthesized through Sarvam Bulbul neural TTS. Browser `window.speechSynthesis` has been completely removed to eliminate synthetic robotic artifacts and concurrent voice conflicts.
2. **Automated Hands-Free Flow**: Built-in silence detection (energy threshold 20, 1500ms window, 25s max clip) automatically finalizes recordings when the user stops speaking.
3. **Form Context Awareness**: When opened, the assistant dynamically scans the current form, acknowledges filled fields, and specifically prompts the user for remaining required entries.
4. **Editable Manual Override**: Manual edits are tracked with `source: manual` flags. The AI model respects user-entered values and does not silently overwrite corrected fields.

---

## Core Capabilities

- **Strict Schema Compliance**: Implements verified production schemas (`student_registration_v1` and `student_assistance_v1`) as well as dynamic custom form schemas with zero field inventions.
- **Bilingual Operation**: Full support for Indian English (`en-IN`) and Hindi (`hi-IN`). Assamese (`as-IN`) is retained as an experimental tier.
- **Dual Form Experience**:
  - **Live Form Filler**: Interactive form interface with live field validation, audio recorder, and collapsible voice orb widget.
  - **Dynamic Form Builder**: Drag-and-drop / structured template editor allowing custom fields, validation patterns, and JSON schema export.
- **Deterministic Validation Engine**: Rigorous validation of 10-digit mobile numbers (6-9 prefixes, handles +91), calendar dates (rejects impossible dates like Feb 30), age boundaries (12 to 100), and enumerated values.
- **Revision-Bound Confirmation**: Final submission requires an explicit review call against the current revision number. Confirmation produces an immutable local confirmation record (`confirmed_local`).
- **Resilient Offline Fallback**: In the event of backend unavailability, the frontend safely transitions to an authenticated local verification pathway for review and verification.

---

## API Endpoints

The backend exposes a clean REST API documented via OpenAPI:

| Method | Endpoint | Description |
|:---|:---|:---|
| `GET` | `/health` | Root healthcheck and version status |
| `GET` | `/api/health` | Provider health and connectivity status |
| `GET` | `/api/forms` | List all available built-in and registered custom forms |
| `POST` | `/api/forms` | Register a new custom form schema dynamically |
| `GET` | `/api/forms/{form_id}` | Retrieve form schema definition |
| `POST` | `/api/sessions` | Create a new form session (`form_id`, `locale`, optional `custom_schema`) |
| `GET` | `/api/sessions/{sid}` | Retrieve session state, values, revision, and status |
| `PATCH` | `/api/sessions/{sid}/locale` | Update session locale in-place without resetting form data |
| `PATCH` | `/api/sessions/{sid}/fields` | Apply field updates (`values`, `source: manual\|voice`) |
| `POST` | `/api/sessions/{sid}/speech` | Raw speech-to-text audio upload (`Sarvam Saaras v4`) |
| `POST` | `/api/sessions/{sid}/extract` | Extract candidate entities from text transcripts |
| `POST` | `/api/sessions/{sid}/assistant` | Unified conversational voice turn (Audio/Text -> LLM -> Bulbul TTS) |
| `POST` | `/api/tts` | Dedicated text-to-speech synthesis endpoint (`Sarvam Bulbul`) |
| `GET` | `/api/sessions/{sid}/review` | Request validation summary and review token for current revision |
| `POST` | `/api/sessions/{sid}/confirm` | Finalize session into `confirmed_local` state |
| `DELETE` | `/api/sessions/{sid}` | Explicitly purge session from memory |

---

## Local Development

### Prerequisites
- **Python**: 3.12 or higher
- **Node.js**: 18.0 or higher
- **Package Managers**: `pip` and `npm`

### 1. Repository Setup
```bash
git clone https://github.com/your-org/FormSaathi-AI.git
cd FormSaathi-AI
```

### 2. Backend Setup

#### Windows (PowerShell)
```powershell
python -m venv backend/.venv
backend\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
Copy-Item backend/.env.example backend/.env
```

#### macOS / Linux
```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
```

Configure `backend/.env` with your API credentials:
```env
SARVAM_API_KEY=your_sarvam_api_key_here
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Start the backend server:
```bash
# Windows
backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload

# macOS / Linux
uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```
API Documentation will be live at `http://127.0.0.1:8000/docs`.

### 3. Frontend Setup
In a separate terminal:
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## Test Verification

The repository contains automated test suites covering backend validation contracts, session lifecycles, entity extraction, and frontend schema conformance.

### Run Backend Tests (138 tests)
```bash
# Run from backend directory
cd backend
.venv\Scripts\python.exe -m pytest -q    # Windows
pytest -q                                # macOS / Linux
```
*Tests pass with 138 verified test cases across unit, contract, and integration layers.*

### Run Frontend Tests (31 tests)
```bash
# From frontend directory
cd frontend
npm test
```
*Executes native Node.js test runner covering schema mapper, storage persistence, date/mobile validators, and contract adherence.*

---

## Deployment Summary

### Render (Backend)
- **Root Directory**: `.`
- **Build Command**: `pip install -r backend/requirements.txt`
- **Start Command**: `uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port $PORT`
- **Python Version**: Specified in `backend/runtime.txt` (`python-3.12.9`)
- **Configuration**: Declarative deployment configured via `render.yaml`.

### Vercel (Frontend)
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**: `VITE_API_BASE_URL=https://formsaathi-ai.onrender.com`
- **Routing**: Single Page Application rewrite rules defined in `frontend/vercel.json` and root `vercel.json`.

Detailed step-by-step instructions are available in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

---

## Privacy & Security

- **In-Memory Volatility**: Active form sessions reside exclusively in process memory with a 60-minute time-to-live (`TTL = 3600s`). No database persistence is used.
- **No Secret Leakage**: API credentials remain strictly confined to backend environment variables. Neither client applications nor network logs record API keys.
- **Local Confirmation**: FormSaathi produces local cryptographic receipt records (`confirmed_local`). No data is submitted to unauthorized third parties or external institutions.
- **Sanitized Processing**: All transcripts and audio streams are processed ephemerally for extraction and synthesis without persistent storage on external cloud drives.

---

## Author & Team

Crafted by **teamRedFlagggs** for Ecclesia 4.0.

- **Backend Engineering & AI Integration**: Sourav Chakraborty
- **Frontend Experience & Audio Interface**: Akash
- **Team**: `teamRedFlagggs`
