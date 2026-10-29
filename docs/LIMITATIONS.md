# Milestone 1 limitations

- No real speech-to-text, LLM extraction, offline ASR or live language evaluation.
  Speech and extraction intentionally return 503; no fake output or provider calls.
- No frontend, microphone capture, transcript-acceptance UI or end-to-end demo.
  en-IN/hi-IN are accepted locales, not evidence of working voice integration.
- as-IN remains experimental and unavailable. No database, authentication or hosting.
- Fixed 60-minute memory-only sessions, single process. Restart/reload discards all
  state. Purge occurs on session access/create, so idle expired memory may remain
  until the next access. No production retention guarantee or security certification.
- Unverified /validate proposals require explicit manual acknowledgement. Candidate
  shape exists for Sayan's handoff; evidence-grounded candidate application is still
  a later integration. No manual correction can be silently replaced by a proposal.
- GET review records a snapshot; the client must show it. POST reviewed=true is
  explicit attestation, not proof that a human read the screen. Authentication and
  browser UX enforcement are outside this milestone.
- Date handling is deliberately conservative: ISO, English named months and numeric
  slash ambiguity detection. Hindi spoken-date normalization belongs to Sayan.
  Age outliers require explicit manual acknowledgement, not an eligibility decision.
- PRD's states are a demo subset with Other Indian State/UT, not a complete state list.
- Speech upload sniffing/size/duration checks and provider retry/timeout handling are
  prerequisites to enabling speech, not completed features. The unavailable route
  does not consume audio. No vendor account/key or credits have been tested.
- No external institutional form submission, admission approval or assistance
  eligibility is claimed. confirmed_local is an in-memory copy of reviewed values.
- No Git commits/pushes/checkpoint history or organiser schedule verification.

Next bounded Sourav task: review Sayan's adapter interfaces and evidence fixtures,
design the revision-bound candidate handoff, then integrate one real speech route
with byte/duration checks and honest English/Hindi smoke evidence. Coordinate with
Akash before changing frontend interfaces. Do not broaden to the full application.
