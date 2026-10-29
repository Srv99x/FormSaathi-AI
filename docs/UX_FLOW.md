# FormSaathi AI — User Experience & Interface Flows (UX_FLOW.md)

**Document Version:** 2.0.0 (Production Verified)  
**Lead Designer & Frontend Owner:** Akash Kalita  
**Core Deliverables:** Modern Conversational Voice Assistant, Responsive Form Filler, and Dynamic Visual Form Builder.

---

## 1. Executive UX Philosophy

FormSaathi AI delivers a modern, accessible interface tailored for diverse users across India. The UX eliminates anxiety around complex forms by pairing high-legibility visual forms with an intelligent, friendly voice assistant.

### Key Pillars
1. **Hands-Free Natural Conversation**: Users can fill forms by speaking naturally in Hindi (`hi-IN`) or English (`en-IN`). Voice activity detection automatically recognizes when the user stops talking, eliminating the friction of manual push-to-talk buttons.
2. **Deterministic Transparency**: Every voice-extracted candidate is visibly populated into the respective field card with real-time validation badges.
3. **Manual Sovereignty**: The user can click and edit any field at any time. The AI respects user corrections and never overwrites manual edits.
4. **Pure Indian Voice Synthesis**: Spoken replies are synthesized via Sarvam Bulbul neural TTS, avoiding unnatural browser speech synthesis or concurrent audio artifacts.

---

## 2. Core User Workflows

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FormSaathi AI Navigation                         │
└────────────────────────────────────────────────────────────────────────┘
                    │                                    │
                    ▼                                    ▼
       ┌────────────────────────┐           ┌────────────────────────┐
       │   Form Filler Page     │           │   Form Builder Page    │
       │   (/form/:formId)      │           │   (/builder)           │
       └────────────────────────┘           └────────────────────────┘
                    │                                    │
                    ▼                                    ▼
   ┌────────────────────────────────┐       ┌────────────────────────┐
   │ Context-Aware Voice Assistant  │       │ Create & Edit Schema   │
   │ - Automatic Field Inspection   │       │ - Add / Reorder Fields │
   │ - VAD Silence Auto-Cutoff      │       │ - Configure Enums/Date │
   │ - Sarvam Bulbul Spoken Reply   │       │ - Export & Publish     │
   └────────────────────────────────┘       └────────────────────────┘
                    │                                    │
                    ▼                                    ▼
   ┌────────────────────────────────┐       ┌────────────────────────┐
   │ Real-time Field Auto-Fill      │       │ Instant Test Preview   │
   │ - Live Validation Badges       │       └────────────────────────┘
   │ - Manual Edit Safeguard        │
   └────────────────────────────────┘
                    │
                    ▼
   ┌────────────────────────────────┐
   │ Review & Local Confirmation    │
   │ - Revision-Bound Check         │
   │ - Immutable Printable Receipt  │
   └────────────────────────────────┘
```

---

## 3. Workflow 1: Form Filler Experience (`/form/:formId`)

### 3.1 Initial Form State & Inspection
1. **Form Load**: The user opens a form (e.g. `student_registration_v1` or `student_assistance_v1`).
2. **Field Rendering**: Field cards render in structured schema order with clear type indicators:
   - Full Name (Text)
   - Date of Birth (Calendar date with ISO / named-month parsing)
   - Mobile Number (10 digits with automatic prefix stripping)
   - Programme & State (Dropdown selection with search and "Other" support)
3. **Contextual Status**: Each card shows an active badge:
   - `Required` (Red asterisk / badge)
   - `Valid` (Green checkmark)
   - `Needs Review` (Amber badge for age outliers or unlisted choices)
   - `Invalid` (Red inline error with clear corrective explanation)

### 3.2 Activating the Voice Assistant
1. **Floating Action Button (FAB)**: Located at the bottom right corner of the screen.
2. **Expansion to Voice Card**: Tapping the button expands a sleek glassmorphism assistant card displaying:
   - Animated Tri-State Voice Orb (`Listening`, `Thinking`, `Speaking`).
   - Live transcription preview and audio waveform.
   - Spoken subtitle response and assistant status.
3. **Smart Form Context Greeting**:
   - On opening, the assistant scans the form values.
   - If empty: *"Hello! I am your FormSaathi assistant for Student Registration. Let's get started. What is your full name?"*
   - If partially filled: *"Hello! I see you have already filled your name and mobile number. Let's continue with your date of birth."*
   - In Hindi: *"नमस्ते! मैं फॉर्मसाथी हूँ। आइए फॉर्म भरना शुरू करें। कृपया अपना पूरा नाम बताएं।"*

### 3.3 Continuous Hands-Free Speech Loop
1. **Voice Activity Detection (VAD)**:
   - The user speaks their information: *"My name is Pooja Das and I live in Guwahati"*.
   - When the user pauses for 1.35 seconds, the system automatically detects silence and finalizes the audio buffer.
2. **Unified AI Turn (`POST /api/sessions/{sid}/assistant`)**:
   - Audio is streamed to Sarvam Saaras v4 for high-accuracy Indian speech-to-text.
   - Transcript and current field state are evaluated by Groq Llama 3.3.
   - Spoken audio is generated using Sarvam Bulbul neural TTS.
3. **Simultaneous UI Updates**:
   - `Full Name` auto-fills with "Pooja Das" (green flash animation).
   - `City` auto-fills with "Guwahati".
   - The assistant speaks back warmly: *"Thanks, Pooja! Got your city as Guwahati. What is your date of birth?"*
4. **Barge-In Support**:
   - The user can tap anywhere or speak to pause the assistant and deliver new information immediately.

### 3.4 Review & Local Confirmation
1. **Pre-Confirmation Check**:
   - Once all mandatory fields are satisfied, the assistant prompts: *"All required fields are completed! You can provide optional details or click Review & Confirm."*
2. **Review Modal**:
   - Clicking **Review & Confirm** issues `GET /api/sessions/{sid}/review`.
   - The user views a clean summary card of all entered values and their validation statuses.
3. **Local Confirmation**:
   - Tapping **Confirm Submission** submits `POST /api/sessions/{sid}/confirm` with the verified revision number.
   - The session is locked in `confirmed_local` state and renders a printable confirmation slip with a unique reference ID and timestamp.

---

## 4. Workflow 2: Visual Form Builder (`/builder`)

### 4.1 Form Design Canvas
- **Header Card**: Edit form title, institutional subtitle, and instructions.
- **Dynamic Question Cards**:
  - Add text, paragraph, dropdown, date, phone, number, or email questions.
  - Reorder questions using drag handles.
  - Toggle `Required` flags.
  - Configure enumeration choices (e.g., custom courses, departments, or categories) with one-click **Add "Other"** option.
- **Form Settings**:
  - Choose default spoken language hint (`en-IN` or `hi-IN`).
  - Configure submission notes and confirmation messages.

### 4.2 Template Management & Publishing
- **Switch Templates**: Instantly switch between `student_registration_v1`, `student_assistance_v1`, or start from scratch.
- **Draft Persistence**: Auto-saves active drafts in local storage using isolated keys.
- **Publish & Share**:
  - Generates direct respondent links (`/form/:formId`).
  - Displays instant QR code for mobile respondent scanning.
  - Copy share link with single-click clipboard confirmation.

---

## 5. Error Handling & Edge States

| Scenario | System Reaction | User Guidance |
|:---|:---|:---|
| **Microphone Permission Denied** | Assistant displays warning banner; switches to manual input mode. | *"Microphone access blocked. Please enable mic permissions in your browser or type details directly."* |
| **Silent Audio / Empty Speech** | VAD detects lack of speech energy; prompts user gently without error alerts. | *"I didn't catch that. Please speak your details when ready."* |
| **Unlisted Dropdown Option Spoken** | Candidate flagged with `UNLISTED_OPTION`. Input left for user review. | Spoken assistant explains: *"That course isn't listed. You can choose 'Other' or select from the available options."* |
| **Impossible Date (e.g. Feb 30)** | Date marked `INVALID_DATE` with red border. Form confirmation blocked. | Inline message: *"February 30 is an impossible calendar date. Please enter a valid date."* |
| **Backend Unavailability** | Frontend automatically activates local session fallback. | Session transitions to offline mode, allowing manual entry and local confirmation. |
| **Stale Review Attempt (HTTP 409)** | Session re-fetches latest values and increments revision. | *"Form was modified after review. Please re-check the summary before confirming."* |
