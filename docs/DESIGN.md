# FormSaathi AI — Frontend Architecture & Design Specification (design.md)

**Document Version:** 1.0.0  
**Target Platform:** React (Vite / TypeScript) + Vanilla CSS / Material Design System  
**Author:** Akash (Frontend Lead) & FormSaathi Architecture Team  
**Scope:** Complete Blueprint for Public Voice-Enabled Form Filling & Google Forms-style Form Builder  

---

## 1. Executive Summary & Product Vision

FormSaathi AI delivers a next-generation civic and educational form platform designed for the Indian digital ecosystem. It solves the critical accessibility barrier in digital forms through natural, bilingual voice assistance (Hindi `hi-IN` and English `en-IN`), real-time barge-in interruption, and conversational validation.

The frontend is divided into two decoupled, high-impact user experiences:
1. **Form Creator & Admin Dashboard (`/create` / `/forms/{id}/edit`):** A clean, professional, Material-inspired form builder rivaling Google Forms. Authorities can compose custom forms, add typed fields, configure validations, customize voice assistance parameters, and publish instant shareable links.
2. **Public Respondent & Voice Call Page (`/fill/{id}`):** The citizen-facing form interface. Clean, focused, card-based layout featuring FormSaathi’s real-time Hands-Free Voice Assistant (`📞 Voice Call Mode`), live field auto-population, spelling verification, and one-click confirmation.

---

## 2. Design System & Aesthetic Principles

### 2.1 Core Visual Philosophy
- **Light, Crisp, and Professional:** Strictly light-themed surfaces. No heavy dark backgrounds.
- **Material-Clean Ergonomics:** Inspired by Google Material 3 and Google Forms. High contrast, readable typography, subtle elevation shadows.
- **Controlled Corner Geometry:** Subtle corner rounding (`border-radius: 6px` to `8px`). Avoid excessive pill shapes.
- **Thin, Defined Borders:** 1px hairline borders (`#dadce0` / `#e2e8f0`) to provide structured, trustworthy card divisions.
- **Accessible Color Palette:** Standard functional RGB colors (Google Blue, Emerald Green, Amber Warning, Ruby Red).

### 2.2 Color Tokens & Palette Specification

```css
:root {
  /* Surface & Backgrounds */
  --bg-app: #f8fafc;              /* Slate-50: Main app backdrop */
  --bg-surface: #ffffff;          /* Pure White: Card & sheet background */
  --bg-surface-hover: #f1f5f9;    /* Slate-100: Hover states */
  --bg-accent-tint: #e8f0fe;      /* Soft Google Blue tint for active cards */
  --bg-success-tint: #e6f4ea;     /* Soft Green tint for filled valid fields */
  --bg-warning-tint: #fef7e0;     /* Soft Amber tint for review alerts */

  /* Primary Brand & Accents */
  --primary-blue: #1a73e8;        /* Google Core Blue (Actions, Active borders) */
  --primary-blue-hover: #1557b0;  /* Darker Blue on hover */
  --primary-blue-focus: rgba(26, 115, 232, 0.2);

  /* Functional Status Colors */
  --color-success: #1e8e3e;       /* Forest/Google Green (Valid, Confirmed) */
  --color-warning: #f9ab00;       /* Amber / Ochre (Needs review / Missing) */
  --color-danger: #d93025;        /* Crimson Red (Required asterisk, Errors) */
  --color-neutral: #5f6368;       /* Slate Neutral (Muted text, Icons) */

  /* Text & Typography */
  --text-primary: #202124;        /* Near black: High legibility */
  --text-secondary: #5f6368;      /* Mid-gray: Subtitles, helper text */
  --text-muted: #80868b;          /* Light gray: Placeholders, timestamps */
  --text-link: #1a73e8;

  /* Borders & Dividers */
  --border-light: #dadce0;        /* 1px default Google hairline border */
  --border-focus: #1a73e8;        /* 2px active focus border */
  --border-error: #d93025;        /* 1px error border */

  /* Elevation Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(60, 64, 67, 0.3), 0 1px 3px 1px rgba(60, 64, 67, 0.15);
  --shadow-md: 0 1px 3px 0 rgba(60, 64, 67, 0.3), 0 4px 8px 3px rgba(60, 64, 67, 0.15);
  --shadow-active: 0 2px 6px 2px rgba(60, 64, 67, 0.15);

  /* Geometry */
  --radius-sm: 4px;
  --radius-md: 8px;               /* Default card & button corner radius */
  --radius-lg: 12px;
}
```

### 2.3 Typography Matrix
- **Font Family:** `'Outfit', 'Google Sans', 'Inter', -apple-system, sans-serif`
- **Headings:**
  - `H1 (Form Title)`: 26px / 32px, SemiBold (600), `--text-primary`
  - `H2 (Section Header)`: 18px / 24px, Medium (500), `--text-primary`
  - `Field Title (Questions)`: 15px / 20px, Medium (500), `--text-primary`
  - `Input & Labels`: 14px / 20px, Regular (400), `--text-primary`
  - `Helper / Subtitles`: 12px / 16px, Regular (400), `--text-secondary`

---

## 3. Page 1: Form Builder Dashboard (`/create` / `/forms/{id}/edit`)

### 3.1 Overview
The Form Builder empowers administrators and university/department authorities to design, customize, preview, and deploy digital voice-ready forms with zero code.

### 3.2 Visual Layout & Hierarchy

```
┌────────────────────────────────────────────────────────────────────────┐
│ [Logo] FormSaathi Studio    [Title: Student Admission Form]   [Settings] [Preview] [Publish] │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│                      ┌──────────────────────────┐                      │
│                      │ Form Header Card         │                      │
│                      │ - Title                  │                      │
│                      │ - Description / Notice   │                      │
│                      └──────────────────────────┘                      │
│                                                                        │
│   ┌───────────────────────────────────────────────┐ ┌──────────────┐   │
│   │ Active Question Card (Selected)               │ │ Floating     │   │
│   │ [Left Accent Strip (4px Blue)]               │ │ Tool Palette │   │
│   │ [Question Title Input]    [Type Dropdown v]   │ │  (+) Add Q   │   │
│   │                                               │ │  (T) Text    │   │
│   │ (Option 1) [Input]                            │ │  (v) Select  │   │
│   │ (Option 2) [Input]                            │ │  (D) Date    │   │
│   │ [+ Add Option] or [Add "Other"]               │ │  (⚙) Config  │   │
│   │ ───────────────────────────────────────────── │ └──────────────┘   │
│   │ [Duplicate] [Delete] | [x] Required [v More]  │                    │
│   └───────────────────────────────────────────────┘                    │
│                                                                        │
│   ┌───────────────────────────────────────────────┐                    │
│   │ Inactive Question Card                        │                    │
│   │ 2. Mobile Number (Text · 10 Digits) *         │                    │
│   └───────────────────────────────────────────────┘                    │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Core Capabilities & Google Forms Parity

#### A. Question / Field Types
Each field created in the builder maps directly to JSON Schema constraints verified by `CONTRACT.md`:
1. **Short Answer (`text`):** Single-line string (e.g., Full Name, City, Institution). Supports min/max length validation.
2. **Paragraph (`textarea`):** Multi-line string (e.g., Reason for Support, Address).
3. **Dropdown (`select`):** Single choice from explicit enumeration list (e.g., Programme: `BSc Physics`, `BCA`, `BA English`, `Other`). Supports `Add "Other"` option toggle.
4. **Multiple Choice (`radio`):** Single select with visible radio options.
5. **Checkboxes (`multiselect`):** Multi-choice array.
6. **Date (`date`):** ISO-formatted date selector with past/future restrictions (e.g., Date of Birth, 12–100 years constraint).
7. **Number (`integer`):** Numeric input with strict `minimum` and `maximum` bounds (e.g., Study Year: `1` to `5`).
8. **Phone Number (`tel`):** Validated 10-digit Indian mobile number starting with `6-9`.
9. **Email (`email`):** RFC 5322 email string with nullability support.

#### B. Dynamic Field Controls (Bottom Toolbar per Card)
- **Required Toggle:** Native switch setting `required: true/false`.
- **Add "Other" Button:** Automatically appends an open `"Other"` choice for enums.
- **Duplicate Question:** Duplicates field configuration and options.
- **Delete Question:** Removes field with undo toast support.
- **Reorder Handle:** 6-dot drag handle to reorder questions vertically.

#### C. Form Settings Drawer
Accessible via the header gear icon (`⚙️ Settings`):
- **Voice Agent Settings:**
  - Default spoken dialect (`hi-IN` Hindi, `en-IN` English).
  - Enable/Disable hands-free barge-in interruption.
  - Require Name Spelling Confirmation modal before acceptance.
- **Submission Rules:**
  - Restrict to single submission per device/IP.
  - Email notification on new submission.
  - Confirmation message text.

#### D. Publishing & Sharing Modal (`[Share / Publish]` button)
- **Direct Link:** `https://formsaathi.ai/fill/student_registration_v1`
- **One-Click Copy Link:** Copies URL with instant checkmark feedback.
- **QR Code Generator:** Generates high-resolution QR code for university noticeboards or helpdesk counters.
- **Embed Snippet:** Clean `<iframe>` embed code for institutional portals.

---

## 4. Page 2: Public Form Filling Page (`/fill/{id}`)

### 4.1 Overview
The public respondent interface is engineered for frictionless completion on mobile, tablet, and desktop. Users can fill the form manually, or activate the **Voice Assistant** to complete the entire form hands-free.

### 4.2 Visual Layout & Components

```
┌───────────────────────────────────────────────────────────────┐
│                      FormSaathi AI                            │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│                ┌─────────────────────────────┐                │
│                │ Top Header Card             │                │
│                │ 🎓 Student Registration     │                │
│                │ Complete your details below │                │
│                │ * Required fields           │                │
│                └─────────────────────────────┘                │
│                                                               │
│                ┌─────────────────────────────┐                │
│                │ 1. Full Name *              │                │
│                │ [Rahul Sharma             ] │                │
│                │ ✓ Confirmed via Voice (R-A-H)               │
│                └─────────────────────────────┘                │
│                                                               │
│                ┌─────────────────────────────┐                │
│                │ 2. Course or Programme *    │                │
│                │ [ BCA                     v]│                │
│                │ ✓ Selected from dropdown    │                │
│                └─────────────────────────────┘                │
│                                                               │
│                ┌─────────────────────────────┐                │
│                │ [ Review & Submit Form ]    │                │
│                └─────────────────────────────┘                │
│                                                               │
│    ┌─────────────────────────────────────────────────────┐    │
│    │ 📞 FLOATING REALTIME VOICE BAR                      │    │
│    │ [Orb Animation]  "Speak now, I'm listening..."     │    │
│    │ [✋ Interrupt]  [✅ Done Speaking]  [🛑 End Call]   │    │
│    └─────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────────┘
```

### 4.3 Realtime Voice Call Experience (Key Innovation)
The Voice Calling Agent is embedded directly into the public form as a persistent bottom dock (or floating widget on mobile):

1. **One-Tap Initiation:** A prominent green button `[📞 Start Voice Call]` opens the session.
2. **Visual Voice Orb:** A 3-state animated SVG orb communicates system status:
   - `Listening (Green ripple)`: Actively capturing user speech via Web Audio VAD.
   - `Thinking (Purple pulse)`: Groq LLM entity extraction & dialog turn processing.
   - `Speaking (Blue glow waves)`: Audio TTS streaming back to user.
3. **Barge-in / Voice Interruption:**
   - When FormSaathi speaks, the mic remains active with echo cancellation.
   - If the user interrupts verbally or taps `[✋ Tap to Interrupt]`, audio playback stops within 100ms and switches immediately to listening.
4. **Live Field Auto-Population:**
   - As fields are recognized (name, DOB, mobile, city, programme), inputs update in real time with a gentle green highlight flash.
   - Dropdown fields (`programme`, `state`) auto-select the recognized option.
5. **Dynamic Dropdown Handling:**
   - If the user speaks a course not in the dropdown (e.g., *"Mechanical Engineering"*), the agent speaks:
     *"Sorry, Mechanical Engineering is not in the list. However, you can choose 'Other', or pick from: BSc Physics, BCA, or BA English. Would you like me to select 'Other'?"*
   - If the user agrees (*"Yes"* / *"हाँ"*), it auto-selects `"Other"`.
6. **Name Spelling Verification Modal:**
   - When a name candidate is extracted, a confirmation modal presents:
     `"I heard your name as Rahul Sharma (R-A-H-U-L S-H-A-R-M-A). Is this correct?"`
   - User can confirm verbally, edit spelling inline, or accept.
7. **Optional Fields Recommendation:**
   - Once all mandatory fields are satisfied, the assistant recommends optional fields:
     *"All required fields are filled! Would you like to add your email or institution? (If not, just say 'No thanks')*
   - If user says *"No thanks"*, the assistant completes the call and focuses the **Review & Confirm** button.

---

## 5. Component Hierarchy & File Structure

```
frontend/
├── index.html                     # HTML5 shell with Google Fonts & Meta tags
├── package.json                   # Dependencies (React 18+, Vite, Lucide-react)
├── vite.config.ts                 # Dev server proxying /api to http://127.0.0.1:8000
├── tsconfig.json
└── src/
    ├── main.tsx                   # React root mount
    ├── App.tsx                    # React Router configuration
    ├── index.css                  # Design system variables, reset & typography
    │
    ├── pages/
    │   ├── FormBuilderPage.tsx    # Page 1: Google Forms style builder
    │   ├── FormFillerPage.tsx     # Page 2: Respondent filling view
    │   ├── FormSharePage.tsx      # Share link & QR code landing
    │   └── NotFoundPage.tsx
    │
    ├── components/
    │   ├── common/
    │   │   ├── Header.tsx         # Universal top app bar
    │   │   ├── Button.tsx         # Material-styled button variants
    │   │   ├── Input.tsx          # Text, date, number inputs
    │   │   ├── Select.tsx         # Dropdown with accessible options
    │   │   ├── Modal.tsx          # Accessible modal dialog
    │   │   └── Toast.tsx          # Notification banner
    │   │
    │   ├── builder/
    │   │   ├── FormHeaderEditor.tsx # Title & description card
    │   │   ├── QuestionCard.tsx     # Active/inactive question editor
    │   │   ├── QuestionTypePicker.tsx # Type selector dropdown
    │   │   ├── OptionListEditor.tsx # Enum choices editor (with Add "Other")
    │   │   ├── BuilderToolbar.tsx   # Floating side action palette (+, T, etc.)
    │   │   ├── FormSettingsModal.tsx# Voice & submission settings
    │   │   └── PublishModal.tsx     # Share link, QR code, copy button
    │   │
    │   ├── filler/
    │   │   ├── FieldCard.tsx        # Respondent question card with status badge
    │   │   ├── NameSpellingModal.tsx# Phonetic letter verification dialog
    │   │   ├── FormSubmissionCard.tsx# Final review & local confirmation record
    │   │   └── ConfirmationReceipt.tsx # Printable confirmation slip
    │   │
    │   └── voice/
    │       ├── VoiceAgentBar.tsx    # Floating realtime voice call bar
    │       ├── VoiceOrb.tsx         # Tri-state animated glowing SVG orb
    │       ├── AudioVisualizer.tsx  # Canvas frequency waveform
    │       └── MicVolumeMeter.tsx   # Live input volume level bar
    │
    ├── hooks/
    │   ├── useVoiceCall.ts          # Web Audio, VAD, Barge-in, and Assistant turn loop
    │   ├── useFormSession.ts        # Backend session sync, patch, and validate
    │   └── useMediaRecorder.ts     # Audio chunk recording
    │
    ├── services/
    │   ├── api.ts                  # Axios/Fetch client against FastAPI endpoints
    │   └── schemaMapper.ts         # Bidirectional JSON Schema <-> Builder state
    │
    └── types/
        ├── form.ts                 # FormSchema, FieldDefinition, EnumChoice
        ├── session.ts              # SessionState, ValidationStatus, Confirmation
        └── voice.ts                # OrbState, AssistantResponse, Candidate
```

---

## 6. Frontend State Management & API Contract Integration

### 6.1 State Architecture (Zustand or React Context)
Two primary state slices drive the application:

```typescript
// 1. Form Builder Store (Builder State)
interface FormBuilderState {
  formId: string;
  title: string;
  description: string;
  fields: FormField[];
  activeFieldId: string | null;
  settings: FormSettings;
  isDirty: boolean;
  isPublished: boolean;
  
  // Actions
  addField: (type: FieldType) => void;
  updateField: (fieldId: string, updates: Partial<FormField>) => void;
  removeField: (fieldId: string) => void;
  reorderFields: (startIndex: number, endIndex: number) => void;
  saveForm: () => Promise<void>;
  publishForm: () => Promise<string>;
}

// 2. Form Filler & Voice Session Store
interface FormFillerState {
  sessionId: string | null;
  formId: string;
  formSchema: FormSchema | null;
  values: Record<string, any>;
  fieldStatuses: Record<string, "empty" | "valid" | "invalid" | "needs_review">;
  
  // Realtime Voice Call States
  isCallActive: boolean;
  orbState: "idle" | "listening" | "thinking" | "speaking";
  callDurationSeconds: number;
  lastAssistantMessage: string;
  userTranscript: string;
  pendingNameVerification: { name: string; spelling: string } | null;
  
  // Actions
  initSession: (formId: string, locale: "hi-IN" | "en-IN") => Promise<void>;
  updateFieldValue: (fieldId: string, value: any, source: "manual" | "voice") => Promise<void>;
  confirmForm: () => Promise<ConfirmationRecord>;
}
```

### 6.2 Frozen Backend API Contract Alignment

| Client Action | HTTP Endpoint | Payload / Behavior |
| :--- | :--- | :--- |
| **Load Form Definition** | `GET /api/forms/{form_id}` | Returns schema, fields, required list, enums |
| **Initialize Session** | `POST /api/sessions` | `{ form_id, locale: "hi-IN" \| "en-IN" }` |
| **Send Voice Audio** | `POST /api/sessions/{sid}/assistant` | `FormData` with `audio/webm` blob & locale |
| **Send Text Turn** | `POST /api/sessions/{sid}/assistant` | `{ transcript: "My name is Rahul" }` |
| **Update / Patch Field** | `PATCH /api/sessions/{sid}/fields` | `{ field_id, value, source: "manual" }` |
| **Pre-Submit Review** | `GET /api/sessions/{sid}/review` | Returns `can_confirm`, statuses, missing list |
| **Local Confirm** | `POST /api/sessions/{sid}/confirm` | `{ reviewed: true, revision: N }` |

---

## 7. Accessibility, Responsiveness & Performance

### 7.1 Accessibility (WCAG 2.1 AA Standards)
- All interactive controls feature keyboard navigation (`Tab`, `Space`, `Enter`).
- Standard `<label for="...">` associations for every question.
- High contrast ratio: Text on white surface exceeds `7.1:1` AAA standard.
- Screen reader announcements (`aria-live="polite"`) for incoming voice agent subtitles and field auto-fill updates.

### 7.2 Mobile Responsiveness
- **Desktop (>= 1024px):** Centered 720px form card container with floating right-side action toolbar in builder. Persistent bottom voice call bar.
- **Mobile (< 768px):** Full-width edge-to-edge cards with 12px margin. Floating action bar converts to a bottom docked sheet. Voice Call Orb collapses into an expandable corner action button.

---

## 8. Implementation Phases & Milestones

1. **Phase 1: Design Tokens & Component Library**
   - Implement `index.css` tokens, button variants, card containers, and clean Material inputs.
2. **Phase 2: Respondent Filling Page (`FormFillerPage`)**
   - Connect existing working Groq & Web Audio voice pipeline (`/assistant`, barge-in, auto-fill).
   - Render fields dynamically from `GET /api/forms/{id}`.
   - Implement Name Spelling Modal & Local Confirmation receipt.
3. **Phase 3: Form Builder (`FormBuilderPage`)**
   - Implement Google Forms card layout, dynamic field addition, and type picker.
   - Add enum choice editor with `Add "Other"` support.
   - Implement `PublishModal` with link generation and clipboard copy.
4. **Phase 4: End-to-End Verification & Polish**
   - Validate bidirectional voice interaction across desktop Chrome, Edge, and mobile browsers.
   - Execute integration test suite and verify full compliance with `CONTRACT.md`.
