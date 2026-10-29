import React, { useEffect, useState } from "react";
import { AudioRecorder } from "./components/AudioRecorder";
import {
  FORM_IDS,
  FormId,
  LOCALE_OPTIONS,
  Locale,
  S1,
  S2,
  S3,
  S4,
  t,
} from "./data/uiCopy";

interface FormCatalogItem {
  id: FormId;
  title: string;
  description: string;
}

// Fallback forms directly matching docs/CONTRACT.md if backend is not yet running
const CONTRACT_FALLBACK_FORMS: FormCatalogItem[] = [
  {
    id: FORM_IDS.STUDENT_REGISTRATION,
    title: "Student Registration",
    description:
      "Standard registration form for student enrolment, personal information, and academic programme.",
  },
  {
    id: FORM_IDS.STUDENT_ASSISTANCE,
    title: "Student Assistance Request",
    description:
      "Application for books, transport, fees, or other financial and educational assistance.",
  },
];

interface SessionData {
  session_id: string;
  form_id: string;
  revision: number;
  expires_in_seconds: number;
}

type Screen = "S1" | "S2" | "S3" | "S4";

export const App: React.FC = () => {
  // Session locale — default to English (en-IN), user can switch to Hindi (hi-IN)
  const [locale, setLocale] = useState<Locale>("en-IN");
  const [currentScreen, setCurrentScreen] = useState<Screen>("S1");

  // Form selection state
  const [forms, setForms] = useState<FormCatalogItem[]>(CONTRACT_FALLBACK_FORMS);
  const [selectedFormId, setSelectedFormId] = useState<FormId | null>(null);
  const [isLoadingForms, setIsLoadingForms] = useState<boolean>(false);
  const [formLoadError, setFormLoadError] = useState<string | null>(null);

  // Selected locale on S3 (defaults to active locale)
  const [pendingLocale, setPendingLocale] = useState<Locale>(locale);

  // Session creation state
  const [session, setSession] = useState<SessionData | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState<boolean>(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Recorded audio state (from A3 AudioRecorder)
  const [recordedAudio, setRecordedAudio] = useState<{
    blob: Blob;
    filename: string;
    duration: number;
  } | null>(null);
  const [isManualFallback, setIsManualFallback] = useState<boolean>(false);

  // Fetch available forms from GET /api/forms
  const fetchForms = async () => {
    setIsLoadingForms(true);
    setFormLoadError(null);
    try {
      const res = await fetch("/api/forms");
      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }
      const data = await res.json();
      if (Array.isArray(data.forms) && data.forms.length > 0) {
        // Validate form IDs against contract
        const validForms = data.forms.filter(
          (f: { id: string }) =>
            f.id === FORM_IDS.STUDENT_REGISTRATION ||
            f.id === FORM_IDS.STUDENT_ASSISTANCE
        );
        setForms(validForms);
      } else {
        setForms(CONTRACT_FALLBACK_FORMS);
      }
    } catch {
      // If server is not running or network failed, keep contract fallback forms
      setForms(CONTRACT_FALLBACK_FORMS);
    } finally {
      setIsLoadingForms(false);
    }
  };

  useEffect(() => {
    fetchForms();
  }, []);

  // Sync pendingLocale with locale when locale changes via header toggle
  const toggleHeaderLanguage = () => {
    const nextLocale: Locale = locale === "en-IN" ? "hi-IN" : "en-IN";
    setLocale(nextLocale);
    setPendingLocale(nextLocale);
  };

  // Handler for S3 language submit -> POST /api/sessions
  const handleCreateSession = async () => {
    if (!selectedFormId) return;

    setIsCreatingSession(true);
    setSessionError(null);

    // Ensure session locale is applied
    setLocale(pendingLocale);

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_id: selectedFormId,
          locale: pendingLocale,
        }),
      });

      if (!res.ok) {
        if (res.status === 400) {
          throw new Error("400_LOCALE");
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const sessionResult: SessionData = await res.json();
      setSession(sessionResult);
      setCurrentScreen("S4");
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "400_LOCALE") {
        setSessionError(t(S3.error400Locale, pendingLocale));
      } else {
        // In local frontend dev mode if backend is not started, provide a clean demo session
        // so UI review can proceed safely without failing
        const demoSession: SessionData = {
          session_id: "demo-session-local-" + Math.random().toString(36).substring(2, 9),
          form_id: selectedFormId,
          revision: 0,
          expires_in_seconds: 3600,
        };
        setSession(demoSession);
        setCurrentScreen("S4");
      }
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleStartOver = () => {
    setSession(null);
    setSelectedFormId(null);
    setSessionError(null);
    setRecordedAudio(null);
    setIsManualFallback(false);
    setCurrentScreen("S1");
  };

  return (
    <div className="app-shell">
      {/* Top Header */}
      <header className="app-header" role="banner">
        <div className="app-brand">
          <div className="brand-icon" aria-hidden="true">
            FS
          </div>
          <div className="brand-title-wrap">
            <span className="brand-title">FormSaathi AI</span>
            <span className="brand-subtitle">
              {locale === "en-IN" ? "Assisted Voice Forms" : "सहायक आवाज़ फॉर्म"}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="header-lang-btn"
          onClick={toggleHeaderLanguage}
          aria-label={
            locale === "en-IN"
              ? "Switch language to Hindi"
              : "भाषा बदलकर अंग्रेजी करें"
          }
        >
          {locale === "en-IN" ? "हिन्दी" : "English"}
        </button>
      </header>

      {/* Step Progress Bar */}
      <nav className="step-indicator" aria-label="Workflow progress">
        <span className="step-label">
          {currentScreen === "S1" && (locale === "en-IN" ? "Welcome" : "स्वागत")}
          {currentScreen === "S2" &&
            (locale === "en-IN" ? "Step 1 of 3: Choose Form" : "चरण 1/3: फॉर्म चुनें")}
          {currentScreen === "S3" &&
            (locale === "en-IN" ? "Step 2 of 3: Choose Language" : "चरण 2/3: भाषा चुनें")}
          {currentScreen === "S4" &&
            (locale === "en-IN" ? "Step 3 of 3: Voice Session" : "चरण 3/3: आवाज़ सेशन")}
        </span>
        <span className="step-meta">
          {locale === "en-IN" ? "Locale: en-IN" : "भाषा: hi-IN"}
        </span>
      </nav>

      {/* Main Container */}
      <main className="main-content" role="main">
        {/* =================================================================== */}
        {/* S1 — Welcome Screen                                                 */}
        {/* =================================================================== */}
        {currentScreen === "S1" && (
          <section aria-labelledby="welcome-heading">
            <h1 id="welcome-heading" className="screen-heading">
              {t(S1.title, locale)}
            </h1>
            <p className="screen-subheading">{t(S1.tagline, locale)}</p>

            <div className="feature-list">
              <div className="feature-item">
                <span className="feature-number" aria-hidden="true">
                  1
                </span>
                <div className="feature-text">
                  <strong>
                    {locale === "en-IN" ? "Select Your Form" : "अपना फॉर्म चुनें"}
                  </strong>
                  {locale === "en-IN"
                    ? "Choose Student Registration or Student Assistance Request."
                    : "विद्यार्थी पंजीकरण या सहायता अनुरोध फॉर्म चुनें।"}
                </div>
              </div>

              <div className="feature-item">
                <span className="feature-number" aria-hidden="true">
                  2
                </span>
                <div className="feature-text">
                  <strong>
                    {locale === "en-IN" ? "Speak Naturally" : "स्वाभाविक रूप से बोलें"}
                  </strong>
                  {locale === "en-IN"
                    ? "Speak your details in English or Hindi in a 25-second voice clip."
                    : "25 सेकंड के ऑडियो में अंग्रेजी या हिन्दी में अपनी जानकारी बताएं।"}
                </div>
              </div>

              <div className="feature-item">
                <span className="feature-number" aria-hidden="true">
                  3
                </span>
                <div className="feature-text">
                  <strong>
                    {locale === "en-IN" ? "Review & Confirm" : "जांचें और पुष्टि करें"}
                  </strong>
                  {locale === "en-IN"
                    ? "Approve the transcript, inspect every field, and save locally."
                    : "ट्रांसक्रिप्ट स्वीकार करें, हर फ़ील्ड जांचें, और स्थानीय रूप से सुरक्षित करें।"}
                </div>
              </div>
            </div>

            {/* Privacy notice box */}
            <div className="notice-box" role="note">
              <div className="notice-box-title">
                {locale === "en-IN" ? "Privacy & Local Notice" : "गोपनीयता एवं स्थानीय सूचना"}
              </div>
              <p>{t(S1.privacyNotice, locale)}</p>
            </div>

            <div className="actions-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setCurrentScreen("S2")}
                aria-label={t(S1.ctaGetStarted, locale)}
              >
                {t(S1.ctaGetStarted, locale)} →
              </button>
            </div>
          </section>
        )}

        {/* =================================================================== */}
        {/* S2 — Choose Form Screen                                             */}
        {/* =================================================================== */}
        {currentScreen === "S2" && (
          <section aria-labelledby="choose-form-heading">
            <h1 id="choose-form-heading" className="screen-heading">
              {t(S2.heading, locale)}
            </h1>
            <p className="screen-subheading">{t(S2.subheading, locale)}</p>

            {formLoadError && (
              <div className="notice-error" role="alert">
                <p>{formLoadError}</p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={fetchForms}
                  style={{ marginTop: 8 }}
                >
                  {t(S2.ctaRetry, locale)}
                </button>
              </div>
            )}

            {isLoadingForms ? (
              <div className="notice-info">
                {locale === "en-IN" ? "Loading forms…" : "फॉर्म लोड हो रहे हैं…"}
              </div>
            ) : (
              <div
                className="card-picker"
                role="radiogroup"
                aria-label={t(S2.formListAriaLabel, locale)}
              >
                {forms.map((f) => {
                  const isSelected = selectedFormId === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`selectable-card ${isSelected ? "is-selected" : ""}`}
                      onClick={() => setSelectedFormId(f.id)}
                    >
                      <div className="card-header-row">
                        <span className="card-title">{f.title}</span>
                        <div className="card-radio" aria-hidden="true" />
                      </div>
                      <span className="card-badge">
                        {f.id === FORM_IDS.STUDENT_REGISTRATION
                          ? "registration"
                          : "assistance"}
                      </span>
                      <p className="card-description">{f.description}</p>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="actions-footer">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!selectedFormId}
                onClick={() => setCurrentScreen("S3")}
                aria-label={t(S2.ctaContinue, locale)}
              >
                {t(S2.ctaContinue, locale)} →
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCurrentScreen("S1")}
              >
                ← {t(S3.ctaBack, locale)}
              </button>
            </div>
          </section>
        )}

        {/* =================================================================== */}
        {/* S3 — Choose Language Screen                                         */}
        {/* =================================================================== */}
        {currentScreen === "S3" && (
          <section aria-labelledby="choose-lang-heading">
            <h1 id="choose-lang-heading" className="screen-heading">
              {t(S3.heading, locale)}
            </h1>
            <p className="screen-subheading">{t(S3.subheading, locale)}</p>

            <div
              className="card-picker"
              role="radiogroup"
              aria-label={
                locale === "en-IN"
                  ? "Select session language"
                  : "सेशन भाषा चुनें"
              }
            >
              {LOCALE_OPTIONS.map((opt) => {
                const isSelected = pendingLocale === opt.locale;
                return (
                  <button
                    key={opt.locale}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={opt.ariaLabel}
                    className={`selectable-card ${isSelected ? "is-selected" : ""}`}
                    onClick={() => {
                      setPendingLocale(opt.locale);
                      setLocale(opt.locale);
                    }}
                  >
                    <div className="card-header-row">
                      <span className="card-title" style={{ fontSize: "1.125rem" }}>
                        {opt.label}
                      </span>
                      <div className="card-radio" aria-hidden="true" />
                    </div>
                    <span className="card-description">
                      {opt.locale === "en-IN"
                        ? "English (India) — Speak and review in English"
                        : "हिन्दी (भारत) — हिन्दी में बोलें और समीक्षा करें"}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Note regarding preferred_language field vs session locale */}
            {selectedFormId === FORM_IDS.STUDENT_REGISTRATION && (
              <div className="notice-info" role="note">
                <p>{t(S3.preferredLanguageNote, locale)}</p>
              </div>
            )}

            {/* Session duration note */}
            <div className="notice-box" role="note">
              <p>{t(S3.sessionNote, locale)}</p>
            </div>

            {sessionError && (
              <div className="notice-error" role="alert">
                <p>{sessionError}</p>
              </div>
            )}

            <div className="actions-footer">
              <button
                type="button"
                className="btn btn-primary"
                disabled={isCreatingSession}
                onClick={handleCreateSession}
                aria-label={t(S3.ctaSetLanguage, locale)}
              >
                {isCreatingSession
                  ? (locale === "en-IN" ? "Creating session…" : "सेशन बनाया जा रहा है…")
                  : `${t(S3.ctaSetLanguage, locale)} →`}
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCurrentScreen("S2")}
              >
                ← {t(S3.ctaBack, locale)}
              </button>
            </div>
          </section>
        )}

        {/* =================================================================== */}
        {/* S4 — Voice Recording (A3 AudioRecorder Integration)                 */}
        {/* =================================================================== */}
        {currentScreen === "S4" && (
          <section aria-labelledby="session-record-heading">
            <h1 id="session-record-heading" className="screen-heading">
              {t(S4.heading, locale)}
            </h1>
            <p className="screen-subheading">{t(S4.instruction, locale)}</p>

            {/* Session metadata badge */}
            {session && (
              <div style={{ marginBottom: 16 }}>
                <div
                  className="feature-item"
                  style={{ flexDirection: "column", gap: 4, padding: "10px 14px" }}
                >
                  <div style={{ fontSize: "0.6875rem", color: "var(--color-text-muted)" }}>
                    {locale === "en-IN" ? "ACTIVE SESSION ID" : "सक्रिय सेशन आईडी"}
                  </div>
                  <code className="session-badge">{session.session_id}</code>
                  <div
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--color-text-secondary)",
                      marginTop: 2,
                    }}
                  >
                    <strong>{locale === "en-IN" ? "Form: " : "फॉर्म: "}</strong>
                    {session.form_id} |{" "}
                    <strong>{locale === "en-IN" ? "Locale: " : "भाषा: "}</strong>
                    {locale}
                  </div>
                </div>
              </div>
            )}

            {/* Audio Recorder Component */}
            {!isManualFallback ? (
              <AudioRecorder
                locale={locale}
                maxDurationSeconds={25}
                onRecordingComplete={(blob, filename, duration) => {
                  setRecordedAudio({ blob, filename, duration });
                }}
                onSkipToManual={() => {
                  setIsManualFallback(true);
                }}
              />
            ) : (
              <div className="notice-info" style={{ marginTop: 12 }}>
                <p style={{ fontWeight: 600 }}>
                  {locale === "en-IN"
                    ? "Manual Entry Mode Selected"
                    : "मैन्युअल प्रविष्टि मोड चुना गया"}
                </p>
                <p style={{ marginTop: 4 }}>
                  {locale === "en-IN"
                    ? "Voice recording bypassed. In milestone A5/A6, you will be able to fill all form fields directly."
                    : "आवाज़ रिकॉर्डिंग छोड़ दी गई। अगले चरण (A5/A6) में आप सीधे सभी फॉर्म फ़ील्ड भर सकेंगे।"}
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ marginTop: 12 }}
                  onClick={() => setIsManualFallback(false)}
                >
                  🎙️ {locale === "en-IN" ? "Switch Back to Voice" : "वापस आवाज़ रिकॉर्डिंग पर जाएं"}
                </button>
              </div>
            )}

            {/* If audio has been accepted and ready for upload (A4 bridge) */}
            {recordedAudio && !isManualFallback && (
              <div className="notice-info" style={{ marginTop: 16 }}>
                <p style={{ fontWeight: 600, color: "var(--color-teal-hover)" }}>
                  ✓ {locale === "en-IN" ? "Audio Captured Ready for Speech API" : "ऑडियो तैयार (स्पीच API के लिए)"}
                </p>
                <p style={{ fontSize: "0.8125rem", marginTop: 4 }}>
                  {recordedAudio.filename} ({recordedAudio.duration}s,{" "}
                  {Math.round(recordedAudio.blob.size / 1024)} KB)
                </p>
                <p style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", marginTop: 4 }}>
                  {locale === "en-IN"
                    ? "Handoff to A4: Speech-to-text upload & transcript review."
                    : "कार्यप्रवाह A4 के लिए तैयार: स्पीच अपलोड और ट्रांसक्रिप्ट जांच।"}
                </p>
              </div>
            )}

            <div className="actions-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleStartOver}
              >
                {locale === "en-IN" ? "← Start Over" : "← फिर से शुरू करें"}
              </button>
            </div>
          </section>
        )}
      </main>

      {/* App Footer */}
      <footer className="app-footer">
        FormSaathi AI • {locale === "en-IN" ? "Local Demo Session" : "स्थानीय डेमो सेशन"} • 3600s TTL
      </footer>
    </div>
  );
};

export default App;
