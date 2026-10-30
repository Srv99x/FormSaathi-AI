# FormSaathi AI — Real Technical Boundaries & Limitations (LIMITATIONS.md)

This document provides a transparent, factual inventory of the architectural boundaries, system limits, and operational scope of FormSaathi AI.

---

## 1. Storage & Session Lifecycle

- **Process Memory Exclusivity**: Form sessions reside entirely in server RAM. There is no external SQL, PostgreSQL, MongoDB, or Redis persistent database connected in this release.
- **60-Minute Session Expiry**: Sessions are bounded by a strict 3600-second time-to-live (`TTL = 3600s`). Inactivity or elapsed time triggers automatic session reclamation.
- **Single-Process Constraint**: The in-memory session manager is bound to a single worker process (`workers = 1`). In multi-instance deployments without sticky sessions, requests routed to alternate instances will receive `404 SESSION_NOT_FOUND`.
- **Server Restart Volatility**: Restarting the backend server or encountering Render free-tier cold spins clears active in-memory sessions. The frontend implements defensive caching and local receipt fallback when network connectivity is disrupted.

---

## 2. Confirmation Scope

- **Local Confirmation Record**: Submitting a form transitions the session state to `confirmed_local`. It generates an immutable confirmation ID, timestamp, and normalized field snapshot.
- **No External Institutional Submission**: FormSaathi AI does not submit data to any university administration portal, state scholarship portal, or government civic agency. It serves as a client-side assistive interface.

---

## 3. Third-Party AI Provider Dependencies

- **API Credentials Required**:
  - **Sarvam AI**: Required for Automatic Speech Recognition via Saaras v4 (`saaras:v4`) and Text-to-Speech synthesis via Bulbul v3 (`bulbul:v3`).
  - **Groq Cloud**: Required for OpenAI GPT-OSS 120B (`openai/gpt-oss-120b`, with dual-model fallback to `openai/gpt-oss-20b`) conversational guidance and structured entity extraction.
- **Rate Limits & Upstream Errors**: During network degradation or upstream vendor rate limits (HTTP 429), the API surfaces structured, retryable error codes (`EXTRACTION_TIMEOUT`, `AI_ASSISTANT_UNAVAILABLE`).
- **Graceful Manual Fallback**: When AI keys are unconfigured or unavailable, form filling remains 100% accessible via manual keyboard and pointer inputs.

---

## 4. Audio Input & Synthesis Limits

- **Payload Size & Duration**: Single audio recordings sent to `/api/sessions/{sid}/assistant` or `/api/sessions/{sid}/speech` must not exceed 10 MB and a maximum duration of 30.0 seconds (server-side duration enforced across WAV, WebM, and OGG formats with 413 AUDIO_TOO_LONG).
- **Voice Activity Detection**: Browser-side VAD uses an energy threshold of 20, a 1.5-second silence detection window, and a 25-second maximum recording safety duration. In high-background-noise environments, users may tap the explicit pause or stop controls.
- **Supported Codecs**: Audio capture relies on the host browser's `MediaRecorder` API (standard WebM Opus, WAV, OGG, or AAC).

---

## 5. Locales & Language Boundaries

- **Active Locales**: Form filling and voice guidance are optimized for Indian English (`en-IN`) and conversational Hindi (`hi-IN`).
- **Experimental Tier**: Assamese (`as-IN`) is retained in schema documentation as experimental and is intentionally rejected during active session initialization until regional speech acoustic models are calibrated.
- **Field Normalization**: While users may speak in Hindi or English, all extracted field values are normalized and transliterated into standardized Latin English script to ensure compatibility with institutional databases.

---

## 6. Privacy & Data Handling

- **Zero Secret Exposure**: Server credentials (`SARVAM_API_KEY`, `GROQ_API_KEY`) reside exclusively in backend environment variables and are never transmitted to the browser.
- **Ephemeral Processing**: Spoken audio and transcripts are processed in memory during the request lifecycle. No audio files are permanently archived to server disk storage.
