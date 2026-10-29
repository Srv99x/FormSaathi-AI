/**
 * uiCopy.ts — FormSaathi AI bilingual UI copy
 *
 * Owner: Akash Kalita (frontend, UX)
 * Branch: feat/ui-akash
 * Task: A1 — UX Flow and Bilingual Content
 *
 * RULES:
 *  - All form IDs, field IDs, endpoint paths and enum values are taken verbatim
 *    from docs/CONTRACT.md and backend/app/schemas/forms/.
 *  - Session locale values are "en-IN" and "hi-IN" only. "as-IN" is not offered.
 *  - Session locale is separate from the form field `preferred_language`.
 *  - No privacy claim implies local-only processing; audio and transcripts go to
 *    the backend and onward to the Sarvam API (server-side).
 *  - Confirmation is local to this demo session. No external submission occurs.
 *  - PDF export is NOT implemented; no copy claims it is.
 *  - 503 errors are shown as honest service-unavailable messages; no mock results.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The two session locales supported in this milestone. */
export type Locale = "en-IN" | "hi-IN";

/** Bilingual string pair. */
export interface BilingualText {
  "en-IN": string;
  "hi-IN": string;
}

/** Helper — pick the string for the active locale. */
export function t(entry: BilingualText, locale: Locale): string {
  return entry[locale];
}

// ---------------------------------------------------------------------------
// Field ID constants (contract-frozen; from backend/app/schemas/forms/)
// Use these when constructing PATCH /api/sessions/{sid}/fields payloads,
// reading extract candidate field_id values, and mapping validation statuses.
// ---------------------------------------------------------------------------

export const FIELD_IDS = {
  // Shared by both forms
  full_name: "full_name",
  date_of_birth: "date_of_birth",
  mobile: "mobile",
  email: "email",
  city: "city",
  state: "state",
  programme: "programme",

  // "institution" is used in both forms:
  //   student_registration_v1 — optional field
  //   student_assistance_v1  — required field
  // The API field_id string is identical: "institution" in both schemas.
  institution: "institution",

  // student_registration_v1 optional
  guardian_name: "guardian_name",
  preferred_language: "preferred_language",

  // student_assistance_v1 required
  year_of_study: "year_of_study",
  assistance_type: "assistance_type",

  // student_assistance_v1 optional
  support_reason: "support_reason",
} as const;

// ---------------------------------------------------------------------------
// Form catalogue (mirrors GET /api/forms contract; do not hardcode titles)
// ---------------------------------------------------------------------------

/**
 * The two supported form IDs. Titles and descriptions come from the API
 * (GET /api/forms). These IDs are used to construct API paths only.
 */
export const FORM_IDS = {
  STUDENT_REGISTRATION: "student_registration_v1",
  STUDENT_ASSISTANCE: "student_assistance_v1",
} as const;

export type FormId = (typeof FORM_IDS)[keyof typeof FORM_IDS];

// ---------------------------------------------------------------------------
// Session locale options shown in S3
// ---------------------------------------------------------------------------

export interface LocaleOption {
  locale: Locale;
  /** Display label rendered in the language itself. */
  label: string;
  /** ARIA label for screen readers. */
  ariaLabel: string;
}

export const LOCALE_OPTIONS: LocaleOption[] = [
  {
    locale: "en-IN",
    label: "English",
    ariaLabel: "Select English as the session language",
  },
  {
    locale: "hi-IN",
    label: "हिन्दी",
    ariaLabel: "हिन्दी भाषा चुनें",
  },
  // NOTE: as-IN is NOT listed. It is rejected by the backend in this milestone.
];

// ---------------------------------------------------------------------------
// Screen S1 — Welcome
// ---------------------------------------------------------------------------

export const S1 = {
  title: {
    "en-IN": "FormSaathi AI",
    "hi-IN": "फॉर्मसाथी AI",
  } satisfies BilingualText,

  tagline: {
    "en-IN": "Voice-guided form filling — speak, review, and save locally.",
    "hi-IN": "आवाज़ से फॉर्म भरें — बोलें, जांचें, और सुरक्षित करें।",
  } satisfies BilingualText,

  description: {
    "en-IN":
      "Describe your details by voice. FormSaathi transcribes your speech and helps you fill a form — you review and approve every step.",
    "hi-IN":
      "अपनी जानकारी आवाज़ में बताएं। फॉर्मसाथी आपकी आवाज़ को टेक्स्ट में बदलेगा और फॉर्म भरने में मदद करेगा — हर कदम पर आप खुद जांचेंगे।",
  } satisfies BilingualText,

  /**
   * Honest disclosure: audio goes to a server-side API; confirmation is local;
   * no external submission. Do not soften or remove these statements.
   */
  privacyNotice: {
    "en-IN":
      "Your voice is sent to a server-side speech API for transcription. No data is submitted to any government body or external authority. Confirmation is saved in this demo session only, and disappears when the session expires.",
    "hi-IN":
      "आपकी आवाज़ सर्वर-साइड स्पीच API को भेजी जाती है। कोई भी जानकारी किसी सरकारी विभाग या बाहरी अधिकारी को नहीं भेजी जाती। पुष्टि केवल इस डेमो सेशन में सुरक्षित होती है और सेशन समाप्त होने पर मिट जाती है।",
  } satisfies BilingualText,

  ctaGetStarted: {
    "en-IN": "Get Started",
    "hi-IN": "शुरू करें",
  } satisfies BilingualText,
};

// ---------------------------------------------------------------------------
// Screen S2 — Choose Form
// ---------------------------------------------------------------------------

export const S2 = {
  heading: {
    "en-IN": "Select a Form",
    "hi-IN": "फॉर्म चुनें",
  } satisfies BilingualText,

  subheading: {
    "en-IN": "Choose the form you want to fill today.",
    "hi-IN": "वह फॉर्म चुनें जिसे आप आज भरना चाहते हैं।",
  } satisfies BilingualText,

  /** Accessible label for the form selection card group. */
  formListAriaLabel: {
    "en-IN": "Available forms",
    "hi-IN": "उपलब्ध फॉर्म",
  } satisfies BilingualText,

  /** Accessible label for each form card's selection state. */
  selectedAriaLabel: {
    "en-IN": "Selected",
    "hi-IN": "चुना गया",
  } satisfies BilingualText,

  ctaContinue: {
    "en-IN": "Continue",
    "hi-IN": "जारी रखें",
  } satisfies BilingualText,

  ctaContinueDisabledHint: {
    "en-IN": "Please select a form to continue.",
    "hi-IN": "जारी रखने के लिए एक फॉर्म चुनें।",
  } satisfies BilingualText,

  loadError: {
    "en-IN":
      "Could not load the form list. Please check your connection and try again.",
    "hi-IN":
      "फॉर्म सूची लोड नहीं हो सकी। कृपया अपना कनेक्शन जांचें और पुनः प्रयास करें।",
  } satisfies BilingualText,

  ctaRetry: {
    "en-IN": "Retry",
    "hi-IN": "पुनः प्रयास करें",
  } satisfies BilingualText,
};

// ---------------------------------------------------------------------------
// Screen S3 — Choose Language
// ---------------------------------------------------------------------------

export const S3 = {
  heading: {
    "en-IN": "Choose Your Language",
    "hi-IN": "अपनी भाषा चुनें",
  } satisfies BilingualText,

  subheading: {
    "en-IN":
      "FormSaathi will use this language for voice recording and the form interface.",
    "hi-IN":
      "फॉर्मसाथी इस भाषा का उपयोग आवाज़ रिकॉर्डिंग और फॉर्म इंटरफेस के लिए करेगा।",
  } satisfies BilingualText,

  /**
   * Clarification that session locale ≠ preferred_language field.
   * Only shown on student_registration_v1 which has a preferred_language field.
   */
  preferredLanguageNote: {
    "en-IN":
      'Note: This sets the session language for your interaction. The form also has a separate "Preferred language" field that you can fill in later.',
    "hi-IN":
      'नोट: यह आपकी इंटरैक्शन के लिए सेशन भाषा सेट करता है। फॉर्म में एक अलग "पसंदीदा भाषा" फ़ील्ड भी है जिसे आप बाद में भर सकते हैं।',
  } satisfies BilingualText,

  sessionNote: {
    "en-IN":
      "Your session lasts 60 minutes. It is not saved if you close or refresh this page.",
    "hi-IN":
      "आपका सेशन 60 मिनट तक रहता है। पेज बंद करने या रिफ्रेश करने पर यह सेव नहीं होगा।",
  } satisfies BilingualText,

  ctaSetLanguage: {
    "en-IN": "Set Language & Continue",
    "hi-IN": "भाषा सेट करें और जारी रखें",
  } satisfies BilingualText,

  ctaBack: {
    "en-IN": "Back",
    "hi-IN": "वापस",
  } satisfies BilingualText,

  sessionCreateError: {
    "en-IN":
      "Could not start a session. Please try again or choose a different form.",
    "hi-IN":
      "सेशन शुरू नहीं हो सका। कृपया पुनः प्रयास करें या कोई अन्य फॉर्म चुनें।",
  } satisfies BilingualText,

  /**
   * 400 — invalid locale returned by POST /api/sessions.
   * This occurs if the client sends an unsupported locale (e.g. as-IN).
   * as-IN is not offered in the UI; this message is a defensive fallback.
   */
  error400Locale: {
    "en-IN":
      "The selected language is not supported in this version. Please choose English or Hindi.",
    "hi-IN":
      "चुनी गई भाषा इस संस्करण में समर्थित नहीं है। कृपया English या हिन्दी चुनें।",
  } satisfies BilingualText,
};

// ---------------------------------------------------------------------------
// Screen S4 — Record
// ---------------------------------------------------------------------------

export const S4 = {
  heading: {
    "en-IN": "Record Your Details",
    "hi-IN": "अपनी जानकारी बोलें",
  } satisfies BilingualText,

  instruction: {
    "en-IN":
      "Speak your details clearly. You have up to 25 seconds. Mention your name, date of birth, mobile number, city, state, and course.",
    "hi-IN":
      "अपनी जानकारी साफ़ आवाज़ में बोलें। आपके पास 25 सेकंड हैं। अपना नाम, जन्म तिथि, मोबाइल नंबर, शहर, राज्य और कोर्स बताएं।",
  } satisfies BilingualText,

  // --- Microphone states ---

  stateIdle: {
    "en-IN": "Tap the microphone to start recording.",
    "hi-IN": "रिकॉर्डिंग शुरू करने के लिए माइक्रोफ़ोन टैप करें।",
  } satisfies BilingualText,

  stateListening: {
    "en-IN": "Listening… Speak clearly at a steady pace.",
    "hi-IN": "सुन रहे हैं… साफ़ और सहज गति से बोलें।",
  } satisfies BilingualText,

  stateProcessing: {
    "en-IN": "Uploading and processing your audio…",
    "hi-IN": "आपका ऑडियो अपलोड और प्रोसेस हो रहा है…",
  } satisfies BilingualText,

  // --- Permission ---

  errorPermissionDenied: {
    "en-IN":
      "Microphone access was denied. Please allow microphone access in your browser settings, then reload the page.",
    "hi-IN":
      "माइक्रोफ़ोन की अनुमति नहीं मिली। कृपया अपने ब्राउज़र सेटिंग्स में माइक्रोफ़ोन की अनुमति दें, फिर पेज रीलोड करें।",
  } satisfies BilingualText,

  errorPermissionDeniedAriaAlert: {
    "en-IN": "Microphone permission denied. Action required.",
    "hi-IN": "माइक्रोफ़ोन अनुमति अस्वीकृत। कार्रवाई आवश्यक है।",
  } satisfies BilingualText,

  // --- Recording errors ---

  /** Client-side: clip too short before upload */
  errorTooShort: {
    "en-IN":
      "The recording seems too short. Please speak for at least a few seconds and try again.",
    "hi-IN":
      "रिकॉर्डिंग बहुत छोटी लगती है। कृपया कम से कम कुछ सेकंड बोलें और पुनः प्रयास करें।",
  } satisfies BilingualText,

  /** 413 — audio file too large */
  errorFileTooLarge: {
    "en-IN":
      "The recording is too large to upload. Please try a shorter recording (under 25 seconds).",
    "hi-IN":
      "रिकॉर्डिंग अपलोड करने के लिए बहुत बड़ी है। कृपया छोटी रिकॉर्डिंग आज़माएं (25 सेकंड से कम)।",
  } satisfies BilingualText,

  /** 415 — unsupported audio codec */
  errorUnsupportedCodec: {
    "en-IN":
      "Your browser's audio format is not supported. Please try again; a different recording format may be used.",
    "hi-IN":
      "आपके ब्राउज़र का ऑडियो फॉर्मेट समर्थित नहीं है। कृपया पुनः प्रयास करें।",
  } satisfies BilingualText,

  /** 422 — empty audio or duration invalid */
  errorDurationInvalid: {
    "en-IN":
      "The audio duration is invalid (must be between 1 and 25 seconds). Please re-record.",
    "hi-IN":
      "ऑडियो की अवधि अमान्य है (1 से 25 सेकंड के बीच होनी चाहिए)। कृपया फिर से रिकॉर्ड करें।",
  } satisfies BilingualText,

  /** 503 — ASR_UNAVAILABLE */
  error503: {
    "en-IN":
      "Speech processing is not available right now. You can retry, or type your details manually in the next step.",
    "hi-IN":
      "अभी स्पीच प्रोसेसिंग उपलब्ध नहीं है। आप पुनः प्रयास कर सकते हैं, या अगले चरण में अपनी जानकारी मैन्युअली टाइप कर सकते हैं।",
  } satisfies BilingualText,

  /** 502 — upstream speech provider error (Sarvam API returned an error) */
  error502: {
    "en-IN":
      "The speech service returned an error. Please try again in a moment.",
    "hi-IN":
      "स्पीच सेवा में त्रुटि आई। कृपया थोड़ी देर बाद पुनः प्रयास करें।",
  } satisfies BilingualText,

  /** 504 — speech request timed out */
  error504: {
    "en-IN":
      "The speech service took too long to respond. Please check your connection and try again.",
    "hi-IN":
      "स्पीच सेवा ने बहुत अधिक समय लिया। कृपया अपना कनेक्शन जांचें और पुनः प्रयास करें।",
  } satisfies BilingualText,

  /** Generic network or server error */
  errorGeneric: {
    "en-IN":
      "Something went wrong while uploading the recording. Please check your connection and try again.",
    "hi-IN":
      "रिकॉर्डिंग अपलोड करते समय कुछ गड़बड़ हुई। कृपया अपना कनेक्शन जांचें और पुनः प्रयास करें।",
  } satisfies BilingualText,

  // --- Controls ---

  ctaStartRecording: {
    "en-IN": "Start Recording",
    "hi-IN": "रिकॉर्डिंग शुरू करें",
  } satisfies BilingualText,

  ctaStopRecording: {
    "en-IN": "Stop & Review",
    "hi-IN": "रोकें और समीक्षा करें",
  } satisfies BilingualText,

  ctaRetryRecording: {
    "en-IN": "Re-record",
    "hi-IN": "फिर से रिकॉर्ड करें",
  } satisfies BilingualText,

  ctaSkipToManual: {
    "en-IN": "Enter details manually instead",
    "hi-IN": "इसके बजाय मैन्युअली जानकारी दर्ज करें",
  } satisfies BilingualText,

  timerAriaLabel: {
    "en-IN": "Recording duration",
    "hi-IN": "रिकॉर्डिंग की अवधि",
  } satisfies BilingualText,
};

// ---------------------------------------------------------------------------
// Screen S5 — Transcript Review
// ---------------------------------------------------------------------------

export const S5 = {
  heading: {
    "en-IN": "Review Your Transcript",
    "hi-IN": "अपना ट्रांसक्रिप्ट जांचें",
  } satisfies BilingualText,

  instruction: {
    "en-IN":
      "Read the text below carefully. Correct any mistakes, then tap \u201cApprove\u201d to extract your form details. Your transcript will be sent to a server-side AI for extraction.",
    "hi-IN":
      "नीचे लिखे टेक्स्ट को ध्यान से पढ़ें। कोई गलती हो तो सुधारें, फिर \u201cस्वीकार करें\u201d टैप करें। आपका ट्रांसक्रिप्ट सर्वर-साइड AI को भेजा जाएगा।",
  } satisfies BilingualText,

  transcriptAriaLabel: {
    "en-IN": "Editable transcript. Review and correct before approving.",
    "hi-IN": "संपादन योग्य ट्रांसक्रिप्ट। स्वीकार करने से पहले समीक्षा और सुधार करें।",
  } satisfies BilingualText,

  editHint: {
    "en-IN": "Tap to edit the transcript text directly.",
    "hi-IN": "ट्रांसक्रिप्ट सीधे संपादित करने के लिए टैप करें।",
  } satisfies BilingualText,

  playbackAriaLabel: {
    "en-IN": "Play back your recording",
    "hi-IN": "अपनी रिकॉर्डिंग सुनें",
  } satisfies BilingualText,

  // --- Extraction states ---

  stateExtracting: {
    "en-IN": "Extracting form details from your transcript…",
    "hi-IN": "आपके ट्रांसक्रिप्ट से फॉर्म विवरण निकाला जा रहा है…",
  } satisfies BilingualText,

  /** 503 — EXTRACTION_UNAVAILABLE */
  error503: {
    "en-IN":
      "Automatic extraction is not available right now. You can retry, or continue and fill in the fields manually.",
    "hi-IN":
      "अभी स्वचालित एक्सट्रैक्शन उपलब्ध नहीं है। आप पुनः प्रयास कर सकते हैं, या जारी रखें और फ़ील्ड मैन्युअली भरें।",
  } satisfies BilingualText,

  errorGeneric: {
    "en-IN":
      "Extraction failed. Please check your connection and retry, or continue manually.",
    "hi-IN":
      "एक्सट्रैक्शन विफल हुआ। कृपया अपना कनेक्शन जांचें और पुनः प्रयास करें, या मैन्युअली जारी रखें।",
  } satisfies BilingualText,

  // --- Controls ---

  ctaApprove: {
    "en-IN": "Approve & Extract Details",
    "hi-IN": "स्वीकार करें और विवरण निकालें",
  } satisfies BilingualText,

  ctaApproveAriaLabel: {
    "en-IN":
      "Approve this transcript and send it for field extraction. This will call the server.",
    "hi-IN":
      "इस ट्रांसक्रिप्ट को स्वीकार करें और फ़ील्ड एक्सट्रैक्शन के लिए भेजें। यह सर्वर को कॉल करेगा।",
  } satisfies BilingualText,

  ctaRerecord: {
    "en-IN": "Discard & Re-record",
    "hi-IN": "रद्द करें और फिर से रिकॉर्ड करें",
  } satisfies BilingualText,

  ctaRetryExtract: {
    "en-IN": "Retry Extraction",
    "hi-IN": "पुनः एक्सट्रैक्शन करें",
  } satisfies BilingualText,

  ctaSkipExtract: {
    "en-IN": "Continue Without Extraction",
    "hi-IN": "एक्सट्रैक्शन के बिना जारी रखें",
  } satisfies BilingualText,
};

// ---------------------------------------------------------------------------
// Screen S6 — Filled Form
// ---------------------------------------------------------------------------

export const S6 = {
  heading: {
    "en-IN": "Review Extracted Details",
    "hi-IN": "निकाले गए विवरण की समीक्षा करें",
  } satisfies BilingualText,

  subheading: {
    "en-IN":
      "The fields below were filled from your recording. You can edit any field directly. All changes are saved to your session.",
    "hi-IN":
      "नीचे के फ़ील्ड आपकी रिकॉर्डिंग से भरे गए हैं। आप कोई भी फ़ील्ड सीधे संपादित कर सकते हैं। सभी बदलाव आपके सेशन में सेव होते हैं।",
  } satisfies BilingualText,

  /** Shown when extract returned 503 and user chose to continue manually. */
  manualEntryBanner: {
    "en-IN":
      "Extraction was not available. Please fill in your details manually below.",
    "hi-IN":
      "एक्सट्रैक्शन उपलब्ध नहीं था। कृपया नीचे अपनी जानकारी मैन्युअली भरें।",
  } satisfies BilingualText,

  // --- Field status badges ---

  statusOk: {
    "en-IN": "Filled",
    "hi-IN": "भरा गया",
  } satisfies BilingualText,

  statusMissing: {
    "en-IN": "Required — please fill this field",
    "hi-IN": "आवश्यक — कृपया यह फ़ील्ड भरें",
  } satisfies BilingualText,

  statusInvalid: {
    "en-IN": "Invalid value — please correct",
    "hi-IN": "अमान्य मान — कृपया सुधारें",
  } satisfies BilingualText,

  statusNeedsReview: {
    "en-IN": "Needs review",
    "hi-IN": "समीक्षा आवश्यक",
  } satisfies BilingualText,

  statusConflict: {
    "en-IN": "Conflict — two values found, please choose one",
    "hi-IN": "विरोध — दो मान मिले, कृपया एक चुनें",
  } satisfies BilingualText,

  statusUncertain: {
    "en-IN": "Uncertain — please verify",
    "hi-IN": "अनिश्चित — कृपया जांचें",
  } satisfies BilingualText,

  // --- Field-level validation messages ---

  /** Full name */
  fieldFullNameLabel: {
    "en-IN": "Full name",
    "hi-IN": "पूरा नाम",
  } satisfies BilingualText,

  fieldFullNameInvalid: {
    "en-IN": "Name must be between 2 and 80 characters.",
    "hi-IN": "नाम 2 से 80 अक्षरों के बीच होना चाहिए।",
  } satisfies BilingualText,

  /** Date of birth */
  fieldDobLabel: {
    "en-IN": "Date of birth",
    "hi-IN": "जन्म तिथि",
  } satisfies BilingualText,

  fieldDobHint: {
    "en-IN": "Format: YYYY-MM-DD, e.g. 2005-04-03",
    "hi-IN": "प्रारूप: YYYY-MM-DD, उदाहरण: 2005-04-03",
  } satisfies BilingualText,

  fieldDobAmbiguous: {
    "en-IN":
      "This date is ambiguous (e.g. 03/04/2005 could be 3 April or 4 March). Please enter the exact date in YYYY-MM-DD format or as \u201c3 April 2005\u201d.",
    "hi-IN":
      "यह तारीख अस्पष्ट है (जैसे 03/04/2005 का अर्थ 3 अप्रैल या 4 मार्च हो सकता है)। कृपया सटीक तारीख YYYY-MM-DD प्रारूप में या \u201c3 अप्रैल 2005\u201d के रूप में दर्ज करें।",
  } satisfies BilingualText,

  fieldDobFuture: {
    "en-IN": "Date of birth cannot be in the future.",
    "hi-IN": "जन्म तिथि भविष्य में नहीं हो सकती।",
  } satisfies BilingualText,

  fieldDobAgeOutlier: {
    "en-IN":
      "The age calculated from this date is outside the expected range (12–100 years). Please confirm this is correct by entering the exact date in YYYY-MM-DD format.",
    "hi-IN":
      "इस तारीख से गणना की गई आयु अपेक्षित सीमा (12–100 वर्ष) से बाहर है। कृपया पुष्टि करें कि यह सही है — सटीक तारीख YYYY-MM-DD प्रारूप में दर्ज करें।",
  } satisfies BilingualText,

  /** Mobile */
  fieldMobileLabel: {
    "en-IN": "Mobile number",
    "hi-IN": "मोबाइल नंबर",
  } satisfies BilingualText,

  fieldMobileHint: {
    "en-IN": "10-digit Indian mobile number starting with 6, 7, 8, or 9.",
    "hi-IN": "10 अंकों का भारतीय मोबाइल नंबर, जो 6, 7, 8 या 9 से शुरू हो।",
  } satisfies BilingualText,

  fieldMobileInvalid: {
    "en-IN":
      "Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9. Do not include spaces, hyphens, or country code.",
    "hi-IN":
      "6, 7, 8 या 9 से शुरू होने वाला वैध 10 अंकों का मोबाइल नंबर दर्ज करें। स्पेस, हाइफन या कंट्री कोड न डालें।",
  } satisfies BilingualText,

  /** Email */
  fieldEmailLabel: {
    "en-IN": "Email (optional)",
    "hi-IN": "ईमेल (वैकल्पिक)",
  } satisfies BilingualText,

  fieldEmailInvalid: {
    "en-IN": "Enter a valid email address (max 254 characters).",
    "hi-IN": "एक वैध ईमेल पता दर्ज करें (अधिकतम 254 अक्षर)।",
  } satisfies BilingualText,

  /** City */
  fieldCityLabel: {
    "en-IN": "City",
    "hi-IN": "शहर",
  } satisfies BilingualText,

  /** State */
  fieldStateLabel: {
    "en-IN": "State",
    "hi-IN": "राज्य",
  } satisfies BilingualText,

  /** Programme */
  fieldProgrammeLabel: {
    "en-IN": "Course or programme",
    "hi-IN": "कोर्स या कार्यक्रम",
  } satisfies BilingualText,

  /** Institution */
  fieldInstitutionLabel: {
    "en-IN": "Institution (optional)",
    "hi-IN": "संस्थान (वैकल्पिक)",
  } satisfies BilingualText,

  fieldInstitutionRequiredLabel: {
    "en-IN": "Institution",
    "hi-IN": "संस्थान",
  } satisfies BilingualText,

  fieldInstitutionInvalid: {
    "en-IN": "Institution name must be at least 2 characters.",
    "hi-IN": "संस्थान का नाम कम से कम 2 अक्षरों का होना चाहिए।",
  } satisfies BilingualText,

  /** Guardian name (student_registration_v1 optional) */
  fieldGuardianNameLabel: {
    "en-IN": "Guardian name (optional)",
    "hi-IN": "अभिभावक का नाम (वैकल्पिक)",
  } satisfies BilingualText,

  /** Preferred language (student_registration_v1 optional — a form field, not session locale) */
  fieldPreferredLanguageLabel: {
    "en-IN": "Preferred language (optional)",
    "hi-IN": "पसंदीदा भाषा (वैकल्पिक)",
  } satisfies BilingualText,

  fieldPreferredLanguageNote: {
    "en-IN":
      'This is a form field — your preference for communicating with the institution. It is separate from the language you are using to interact with FormSaathi.',
    "hi-IN":
      "यह एक फॉर्म फ़ील्ड है — संस्थान के साथ संवाद के लिए आपकी प्राथमिकता। यह FormSaathi के साथ इंटरैक्शन के लिए उपयोग की जाने वाली भाषा से अलग है।",
  } satisfies BilingualText,

  /** Year of study (student_assistance_v1) */
  fieldYearOfStudyLabel: {
    "en-IN": "Study year",
    "hi-IN": "अध्ययन वर्ष",
  } satisfies BilingualText,

  fieldYearOfStudyHint: {
    "en-IN": "Enter a number from 1 to 5.",
    "hi-IN": "1 से 5 के बीच एक संख्या दर्ज करें।",
  } satisfies BilingualText,

  fieldYearOfStudyInvalid: {
    "en-IN": "Study year must be a whole number between 1 and 5.",
    "hi-IN": "अध्ययन वर्ष 1 से 5 के बीच एक पूर्ण संख्या होनी चाहिए।",
  } satisfies BilingualText,

  /** Assistance type (student_assistance_v1) */
  fieldAssistanceTypeLabel: {
    "en-IN": "Help needed",
    "hi-IN": "किस प्रकार की सहायता चाहिए",
  } satisfies BilingualText,

  /** Support reason (student_assistance_v1 optional) */
  fieldSupportReasonLabel: {
    "en-IN": "Short reason (optional)",
    "hi-IN": "संक्षिप्त कारण (वैकल्पिक)",
  } satisfies BilingualText,

  fieldSupportReasonInvalid: {
    "en-IN": "Reason must be 240 characters or fewer.",
    "hi-IN": "कारण 240 अक्षरों से अधिक नहीं होना चाहिए।",
  } satisfies BilingualText,

  // --- Edit and save controls ---

  ctaEdit: {
    "en-IN": "Edit",
    "hi-IN": "संपादित करें",
  } satisfies BilingualText,

  ctaSave: {
    "en-IN": "Save",
    "hi-IN": "सेव करें",
  } satisfies BilingualText,

  ctaCancel: {
    "en-IN": "Cancel",
    "hi-IN": "रद्द करें",
  } satisfies BilingualText,

  ctaContinueToQuestions: {
    "en-IN": "Next: Resolve Issues",
    "hi-IN": "अगला: समस्याएं हल करें",
  } satisfies BilingualText,

  ctaGoToFinalReview: {
    "en-IN": "Go to Final Review",
    "hi-IN": "अंतिम समीक्षा पर जाएं",
  } satisfies BilingualText,

  patchError: {
    "en-IN": "Could not save this field. Please try again.",
    "hi-IN": "यह फ़ील्ड सेव नहीं हो सकी। कृपया पुनः प्रयास करें।",
  } satisfies BilingualText,
};

// ---------------------------------------------------------------------------
// Screen S7 — Questions (Clarification)
// ---------------------------------------------------------------------------

export const S7 = {
  heading: {
    "en-IN": "A Few Things Need Clarification",
    "hi-IN": "कुछ जानकारियां स्पष्ट करनी हैं",
  } satisfies BilingualText,

  subheading: {
    "en-IN":
      "Please answer the questions below to complete your form. Required fields cannot be skipped.",
    "hi-IN":
      "कृपया अपना फॉर्म पूरा करने के लिए नीचे के सवालों का जवाब दें। आवश्यक फ़ील्ड छोड़ी नहीं जा सकती।",
  } satisfies BilingualText,

  // --- Missing DOB ---

  questionDobMissing: {
    "en-IN": "What is your date of birth?",
    "hi-IN": "आपकी जन्म तिथि क्या है?",
  } satisfies BilingualText,

  questionDobMissingHint: {
    "en-IN": "Enter as YYYY-MM-DD (e.g. 2005-04-03) or as \u201c3 April 2005\u201d.",
    "hi-IN": 'YYYY-MM-DD (जैसे 2005-04-03) या "3 अप्रैल 2005" के रूप में दर्ज करें।',
  } satisfies BilingualText,

  // --- Ambiguous DOB ---

  questionDobAmbiguous: {
    "en-IN": "Your date of birth is unclear. What did you mean?",
    "hi-IN": "आपकी जन्म तिथि अस्पष्ट है। आपका क्या मतलब था?",
  } satisfies BilingualText,

  questionDobAmbiguousHint: {
    "en-IN":
      "For example, \u201c03/04/2005\u201d could be 3 April or 4 March. Please confirm the exact date in YYYY-MM-DD format.",
    "hi-IN":
      "उदाहरण के लिए, \u201c03/04/2005\u201d का अर्थ 3 अप्रैल या 4 मार्च हो सकता है। कृपया YYYY-MM-DD प्रारूप में सटीक तारीख बताएं।",
  } satisfies BilingualText,

  // --- Age outlier ---

  questionDobAgeOutlier: {
    "en-IN":
      "The date you gave suggests an age outside the usual range (12–100 years). Please confirm this is correct.",
    "hi-IN":
      "आपके द्वारा दी गई तारीख से जो आयु निकलती है वह सामान्य सीमा (12–100 वर्ष) से बाहर है। कृपया पुष्टि करें कि यह सही है।",
  } satisfies BilingualText,

  questionDobAgeOutlierHint: {
    "en-IN":
      "Enter the date in YYYY-MM-DD format to confirm. This acknowledges the age is unusual.",
    "hi-IN":
      "पुष्टि के लिए YYYY-MM-DD प्रारूप में तारीख दर्ज करें। इससे यह स्वीकार होगा कि आयु असामान्य है।",
  } satisfies BilingualText,

  // --- Missing mobile ---

  questionMobileMissing: {
    "en-IN": "What is your 10-digit mobile number?",
    "hi-IN": "आपका 10 अंकों का मोबाइल नंबर क्या है?",
  } satisfies BilingualText,

  questionMobileMissingHint: {
    "en-IN":
      "Enter a 10-digit number starting with 6, 7, 8, or 9. Do not include +91 or spaces.",
    "hi-IN":
      "6, 7, 8 या 9 से शुरू होने वाला 10 अंकों का नंबर दर्ज करें। +91 या स्पेस न डालें।",
  } satisfies BilingualText,

  // --- Invalid mobile ---

  questionMobileInvalid: {
    "en-IN":
      "The mobile number entered is not valid. Please re-enter a 10-digit number starting with 6, 7, 8, or 9.",
    "hi-IN":
      "दर्ज किया गया मोबाइल नंबर वैध नहीं है। कृपया 6, 7, 8 या 9 से शुरू होने वाला 10 अंकों का नंबर दोबारा दर्ज करें।",
  } satisfies BilingualText,

  // --- Conflict resolution ---

  questionConflict: {
    "en-IN":
      "Two different values were found for this field. Please choose the correct one.",
    "hi-IN":
      "इस फ़ील्ड के लिए दो अलग-अलग मान मिले। कृपया सही मान चुनें।",
  } satisfies BilingualText,

  ctaChooseValue: {
    "en-IN": "Use this value",
    "hi-IN": "यह मान उपयोग करें",
  } satisfies BilingualText,

  // --- Skip optional ---

  ctaSkipOptional: {
    "en-IN": "Skip (leave blank)",
    "hi-IN": "छोड़ें (खाली रखें)",
  } satisfies BilingualText,

  skipOptionalConfirm: {
    "en-IN": "This field is optional. Leave it blank?",
    "hi-IN": "यह फ़ील्ड वैकल्पिक है। क्या इसे खाली छोड़ें?",
  } satisfies BilingualText,

  // --- Navigation ---

  ctaSaveAnswer: {
    "en-IN": "Save & Continue",
    "hi-IN": "सेव करें और जारी रखें",
  } satisfies BilingualText,

  ctaBackToForm: {
    "en-IN": "Back to Form",
    "hi-IN": "फॉर्म पर वापस जाएं",
  } satisfies BilingualText,

  progressLabel: {
    "en-IN": "Question {current} of {total}",
    "hi-IN": "प्रश्न {current} / {total}",
  } satisfies BilingualText,

  allResolvedMessage: {
    "en-IN": "All issues resolved. You can now proceed to Final Review.",
    "hi-IN": "सभी समस्याएं हल हो गई हैं। अब आप अंतिम समीक्षा पर जा सकते हैं।",
  } satisfies BilingualText,
};

// ---------------------------------------------------------------------------
// Screen S8 — Final Review
// ---------------------------------------------------------------------------

export const S8 = {
  heading: {
    "en-IN": "Final Review",
    "hi-IN": "अंतिम समीक्षा",
  } satisfies BilingualText,

  subheading: {
    "en-IN":
      "Check your details carefully. You can edit any section before confirming.",
    "hi-IN":
      "अपनी जानकारी ध्यान से जांचें। पुष्टि करने से पहले आप किसी भी भाग को संपादित कर सकते हैं।",
  } satisfies BilingualText,

  /**
   * Honest notice about what "confirm" means.
   * Must not claim external submission.
   */
  confirmationScopeNotice: {
    "en-IN":
      "Confirming saves your form locally in this demo session only. This is not a submission to any government body or external authority.",
    "hi-IN":
      "पुष्टि करने से आपका फॉर्म केवल इस डेमो सेशन में सेव होता है। यह किसी सरकारी विभाग या बाहरी अधिकारी को प्रस्तुत नहीं किया जाता।",
  } satisfies BilingualText,

  declarationCheckboxLabel: {
    "en-IN":
      "I have reviewed all the details above and confirm they are correct to the best of my knowledge.",
    "hi-IN":
      "मैंने ऊपर की सभी जानकारियां जांच ली हैं और पुष्टि करता/करती हूँ कि वे मेरी जानकारी के अनुसार सही हैं।",
  } satisfies BilingualText,

  ctaConfirmDisabledHint: {
    "en-IN": "Please check the declaration box to enable confirmation.",
    "hi-IN": "पुष्टि सक्षम करने के लिए घोषणा बॉक्स चेक करें।",
  } satisfies BilingualText,

  ctaConfirm: {
    "en-IN": "Confirm & Complete",
    "hi-IN": "पुष्टि करें और समाप्त करें",
  } satisfies BilingualText,

  ctaEditSection: {
    "en-IN": "Edit",
    "hi-IN": "संपादित करें",
  } satisfies BilingualText,

  // --- Errors during confirm ---

  /** 409 — stale or blocked review */
  error409: {
    "en-IN":
      "Your form was changed after you last reviewed it. The review has been refreshed — please check the changes and confirm again.",
    "hi-IN":
      "आपकी अंतिम समीक्षा के बाद फॉर्म में बदलाव हुए। समीक्षा ताज़ा कर दी गई है — कृपया बदलाव जांचें और दोबारा पुष्टि करें।",
  } satisfies BilingualText,

  errorStillInvalid: {
    "en-IN":
      "Some fields are still missing or invalid. Please correct them before confirming.",
    "hi-IN":
      "कुछ फ़ील्ड अभी भी खाली या अमान्य हैं। कृपया पुष्टि करने से पहले उन्हें सुधारें।",
  } satisfies BilingualText,

  errorGeneric: {
    "en-IN":
      "Confirmation failed. Please check your connection and try again.",
    "hi-IN":
      "पुष्टि विफल हुई। कृपया अपना कनेक्शन जांचें और पुनः प्रयास करें।",
  } satisfies BilingualText,

  confirming: {
    "en-IN": "Saving your form…",
    "hi-IN": "आपका फॉर्म सेव हो रहा है…",
  } satisfies BilingualText,
};

// ---------------------------------------------------------------------------
// Screen S9 — Confirmed Locally
// ---------------------------------------------------------------------------

export const S9 = {
  heading: {
    "en-IN": "Form Confirmed",
    "hi-IN": "फॉर्म पुष्टि हो गया",
  } satisfies BilingualText,

  /**
   * Contract field: status is "confirmed_local".
   * Must not imply external submission.
   */
  statusLabel: {
    "en-IN": "Status: Confirmed (local demo session)",
    "hi-IN": "स्थिति: पुष्टि हुई (स्थानीय डेमो सेशन)",
  } satisfies BilingualText,

  confirmationIdLabel: {
    "en-IN": "Confirmation ID",
    "hi-IN": "पुष्टि आईडी",
  } satisfies BilingualText,

  confirmedAtLabel: {
    "en-IN": "Confirmed at",
    "hi-IN": "पुष्टि का समय",
  } satisfies BilingualText,

  /**
   * Accurate disclosure: no external submission.
   * Do not soften or replace this text.
   */
  localOnlyNotice: {
    "en-IN":
      "This form has been saved in your local demo session only. It has not been submitted to any government authority, department, or external service. Your session data will be lost when the session expires (60 minutes) or the server is restarted.",
    "hi-IN":
      "यह फॉर्म केवल आपके स्थानीय डेमो सेशन में सेव किया गया है। इसे किसी सरकारी प्राधिकरण, विभाग या बाहरी सेवा को प्रस्तुत नहीं किया गया है। आपका सेशन डेटा सेशन समाप्त होने (60 मिनट) या सर्वर पुनः आरंभ होने पर खो जाएगा।",
  } satisfies BilingualText,

  // PDF export is NOT implemented in this milestone. Do not add a download button.
  // When implemented, the button text should be:
  //   en-IN: "Download Summary"
  //   hi-IN: "सारांश डाउनलोड करें"
  // Until then, do not display any download or print option.

  ctaStartNewForm: {
    "en-IN": "Start a New Form",
    "hi-IN": "नया फॉर्म शुरू करें",
  } satisfies BilingualText,

  ctaStartNewFormAriaLabel: {
    "en-IN": "Start over with a new form. This will clear your current session data.",
    "hi-IN": "नए फॉर्म के साथ फिर से शुरू करें। इससे आपका वर्तमान सेशन डेटा साफ़ हो जाएगा।",
  } satisfies BilingualText,
};

// ---------------------------------------------------------------------------
// Global / shared error messages
// ---------------------------------------------------------------------------

export const ERRORS = {
  sessionExpired: {
    "en-IN":
      "Your session has expired (after 60 minutes). Please start a new form.",
    "hi-IN":
      "आपका सेशन समाप्त हो गया (60 मिनट बाद)। कृपया एक नया फॉर्म शुरू करें।",
  } satisfies BilingualText,

  sessionNotFound: {
    "en-IN":
      "Session not found. It may have expired or the server may have restarted. Please start again.",
    "hi-IN":
      "सेशन नहीं मिला। यह समाप्त हो गया होगा या सर्वर पुनः आरंभ हो गया होगा। कृपया फिर से शुरू करें।",
  } satisfies BilingualText,

  networkError: {
    "en-IN":
      "Network error. Please check your internet connection and try again.",
    "hi-IN":
      "नेटवर्क त्रुटि। कृपया अपना इंटरनेट कनेक्शन जांचें और पुनः प्रयास करें।",
  } satisfies BilingualText,

  unknownServerError: {
    "en-IN":
      "An unexpected server error occurred. Please try again. (Request ID: {request_id})",
    "hi-IN":
      "एक अप्रत्याशित सर्वर त्रुटि हुई। कृपया पुनः प्रयास करें। (अनुरोध ID: {request_id})",
  } satisfies BilingualText,

  ctaRetry: {
    "en-IN": "Retry",
    "hi-IN": "पुनः प्रयास करें",
  } satisfies BilingualText,

  ctaStartOver: {
    "en-IN": "Start Over",
    "hi-IN": "फिर से शुरू करें",
  } satisfies BilingualText,
};

// ---------------------------------------------------------------------------
// Enum option display labels
// (Contract-frozen values; match case-insensitively against the API)
// ---------------------------------------------------------------------------

/**
 * Display labels for the `state` enum used in both forms.
 * API values (exact): Assam, Manipur, Meghalaya, Tripura, Arunachal Pradesh,
 *   Nagaland, Mizoram, Other Indian State/UT
 */
export const STATE_LABELS: Record<string, BilingualText> = {
  Assam: { "en-IN": "Assam", "hi-IN": "असम" },
  Manipur: { "en-IN": "Manipur", "hi-IN": "मणिपुर" },
  Meghalaya: { "en-IN": "Meghalaya", "hi-IN": "मेघालय" },
  Tripura: { "en-IN": "Tripura", "hi-IN": "त्रिपुरा" },
  "Arunachal Pradesh": {
    "en-IN": "Arunachal Pradesh",
    "hi-IN": "अरुणाचल प्रदेश",
  },
  Nagaland: { "en-IN": "Nagaland", "hi-IN": "नागालैंड" },
  Mizoram: { "en-IN": "Mizoram", "hi-IN": "मिज़ोरम" },
  "Other Indian State/UT": {
    "en-IN": "Other Indian State / Union Territory",
    "hi-IN": "अन्य भारतीय राज्य / केंद्र शासित प्रदेश",
  },
};

/**
 * Display labels for the `programme` enum.
 * API values (exact): BSc Physics, BCA, BA English, Other
 */
export const PROGRAMME_LABELS: Record<string, BilingualText> = {
  "BSc Physics": { "en-IN": "BSc Physics", "hi-IN": "बीएससी भौतिकी" },
  BCA: { "en-IN": "BCA", "hi-IN": "बीसीए" },
  "BA English": { "en-IN": "BA English", "hi-IN": "बीए अंग्रेज़ी" },
  Other: { "en-IN": "Other", "hi-IN": "अन्य" },
};

/**
 * Display labels for the `assistance_type` enum (student_assistance_v1 only).
 * API values (exact): books, transport, fees, other
 */
export const ASSISTANCE_TYPE_LABELS: Record<string, BilingualText> = {
  books: { "en-IN": "Books", "hi-IN": "किताबें" },
  transport: { "en-IN": "Transport", "hi-IN": "परिवहन" },
  fees: { "en-IN": "Fees", "hi-IN": "शुल्क" },
  other: { "en-IN": "Other", "hi-IN": "अन्य" },
};

/**
 * Display labels for the `preferred_language` field (student_registration_v1 optional).
 * NOTE: This is a form VALUE, not the session locale.
 * API values (exact): English, Hindi (or null/absent)
 */
export const PREFERRED_LANGUAGE_LABELS: Record<string, BilingualText> = {
  English: { "en-IN": "English", "hi-IN": "अंग्रेज़ी" },
  Hindi: { "en-IN": "Hindi", "hi-IN": "हिन्दी" },
};
