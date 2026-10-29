# FormSaathi AI engineering rules

Read docs/CONTRACT.md and backend/app/schemas/forms before modifying code.
Authority: original PRD (FormSaathi_AI_Editable_Report.md A6/A13) for fields;
master development playbook for architecture/API; personal playbooks for ownership.

- Sourav owns backend routes, schemas, models, deterministic validation, sessions,
  integration, shared contracts, tests and release.
- Sayan owns backend/app/ai/, speech-to-text, extraction adapters and AI evaluation.
- Akash owns frontend/, microphone capture, transcript acceptance and user interface.
- Coordinate before changing another owner's implementation. The initial bootstrap
  may create empty ownership directories, but must not implement teammate modules.
- Only student_registration_v1 and student_assistance_v1; never invent fields/options.
- MVP locales: en-IN and hi-IN. as-IN stays experimental and disabled until the
  entire pipeline is verified. Never advertise unexecuted speech tests as working.
- Sessions are in memory for 3600 seconds, one process. No database or login.
- Keys stay in backend environment variables; never log secrets, audio or transcripts.
- Every value remains editable. Never silently replace manual corrections or infer
  absent details. Confirmation requires valid resolved fields and explicit review
  of the current revision. Only confirmed_local; no external submission.
- Build new code only within the authorised scope. Do not reuse old solution code,
  fabricate Git history, vendor responses, screenshots, measurements or test results.
- Use small changes and run relevant checks. Report actual commands and failures.
- No deletion, destructive operations, commits or pushes without user authorisation.

Next changes must preserve the frozen API or document a coordinated contract change.
