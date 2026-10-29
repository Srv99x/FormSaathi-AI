import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import { FormSchema } from '../types/form';
import { api } from '../services/api';
import { resolveFormSchema } from '../services/schemaMapper';
import { useFormSession } from '../hooks/useFormSession';
import { useVoiceCall } from '../hooks/useVoiceCall';
import { Header } from '../components/common/Header';
import { Toast } from '../components/common/Toast';
import { FieldCard } from '../components/filler/FieldCard';
import { FormSubmissionCard } from '../components/filler/FormSubmissionCard';
import { ConfirmationReceipt } from '../components/filler/ConfirmationReceipt';
import { NameSpellingModal } from '../components/filler/NameSpellingModal';
import { VoiceAgentBar } from '../components/voice/VoiceAgentBar';

export const FormFillerPage: React.FC = () => {
  const { formId = 'student_registration_v1' } = useParams<{ formId: string }>();
  const navigate = useNavigate();

  const [formSchema, setFormSchema] = useState<FormSchema | null>(null);
  const [isLoadingForm, setIsLoadingForm] = useState(true);
  const [locale, setLocale] = useState<'en-IN' | 'hi-IN'>('en-IN');
  const [pulsingFieldIds, setPulsingFieldIds] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Form session hook
  const {
    session,
    values,
    fieldStatuses,
    fieldMessages,
    canConfirm,
    confirmation,
    initSession,
    updateField,
    batchUpdateValues,
    confirmLocal,
  } = useFormSession();

  // Load form schema & initialize session
  useEffect(() => {
    let mounted = true;

    async function load() {
      setIsLoadingForm(true);
      let backendForm = null;
      try {
        backendForm = await api.getForm(formId);
      } catch (err) {
        console.warn('Backend getForm unavailable, falling back to local schema', err);
      }

      if (!mounted) return;

      const resolved = resolveFormSchema(formId, backendForm);
      setFormSchema(resolved);
      setLocale(resolved.settings?.defaultLocale || 'en-IN');

      // Initialize session (online backend with fallback to local verification)
      await initSession(formId, resolved.settings?.defaultLocale || 'en-IN', resolved);
      setIsLoadingForm(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [formId, initSession]);

  // Flash highlight animation for auto-filled fields
  const triggerFieldPulse = (fieldId: string) => {
    setPulsingFieldIds((prev) => new Set(prev).add(fieldId));
    setTimeout(() => {
      setPulsingFieldIds((prev) => {
        const next = new Set(prev);
        next.delete(fieldId);
        return next;
      });
    }, 2400);

    // Scroll field into view gently if needed
    const elem = document.getElementById(`card_${fieldId}`);
    if (elem) {
      elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Real-time Voice Call hook
  const {
    isCallActive,
    isPaused,
    orbState,
    callDurationSeconds,
    volumeLevel,
    pendingSpellingVerification,
    startCall,
    endCall,
    togglePause,
    interruptAssistant,
    resolveSpelling,
    skipOptionalAndFinalize,
  } = useVoiceCall({
    formSchema,
    sessionId: session?.session_id || null,
    locale,
    currentValues: values,
    enableBargeIn: formSchema?.settings?.enableBargeIn ?? true,
    onValuesExtracted: (newVals) => {
      batchUpdateValues(newVals);
      Object.keys(newVals).forEach((k) => triggerFieldPulse(k));
      setToastMessage('Voice assistant updated form fields');
    },
    onFieldHighlighted: (fId) => {
      triggerFieldPulse(fId);
    },
  });

  const handleToggleLocale = () => {
    const nextLocale = locale === 'en-IN' ? 'hi-IN' : 'en-IN';
    setLocale(nextLocale);
    if (session) {
      initSession(formId, nextLocale, formSchema);
    }
  };

  const handleFieldChange = (fieldId: string, val: string | number | null) => {
    updateField(fieldId, val, 'manual');
  };

  // Submit / Confirm
  const handleConfirmForm = async () => {
    setIsConfirming(true);
    setConfirmError(null);
    try {
      await confirmLocal();
      setToastMessage('Form confirmed successfully!');
    } catch (err: any) {
      setConfirmError(err?.message || 'Could not confirm form. Please check all required fields.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleResetForm = () => {
    window.location.reload();
  };

  if (isLoadingForm || !formSchema) {
    return (
      <div className="fs-filler-page-wrapper">
        <Header locale={locale} onToggleLocale={handleToggleLocale} />
        <div className="fs-loading-screen">
          <div className="fs-loading-spinner" />
          <p>Loading form schema...</p>
        </div>
      </div>
    );
  }

  // Count required fields completed vs total
  const requiredFields = formSchema.fields.filter((f) => f.required);
  const completedRequiredCount = requiredFields.filter((f) => {
    const val = values[f.id];
    return val !== undefined && val !== null && String(val).trim() !== '';
  }).length;
  const missingCount = Math.max(0, requiredFields.length - completedRequiredCount);

  const optionalFields = formSchema.fields.filter((f) => !f.required);
  const hasRemainingOptional = optionalFields.some((f) => {
    const val = values[f.id];
    return val === undefined || val === null || String(val).trim() === '';
  });

  return (
    <div className="fs-filler-page-wrapper">
      <Header
        locale={locale}
        onToggleLocale={handleToggleLocale}
        formTitle={formSchema.title}
      />

      <main className="fs-filler-main" role="main">
        <div className="fs-filler-container">
          {/* Back to Builder button */}
          <div className="fs-filler-nav-bar no-print">
            <button
              type="button"
              className="fs-back-btn"
              onClick={() => navigate('/create')}
            >
              <ArrowLeft size={16} />
              <span>Back to Form Builder</span>
            </button>

            <span className="fs-filler-mode-badge">
              <Shield size={14} />
              <span>Assisted Verification Mode</span>
            </span>
          </div>

          {/* If form has already been confirmed, display printable receipt */}
          {confirmation ? (
            <ConfirmationReceipt
              confirmation={confirmation}
              formTitle={formSchema.title}
              onReset={handleResetForm}
            />
          ) : (
            <>
              {/* Form Header Card */}
              <div className="fs-card fs-filler-header-card">
                <div
                  className="fs-builder-banner-strip"
                  style={{ backgroundColor: formSchema.bannerColor || '#1a73e8' }}
                />
                <div className="fs-filler-header-content">
                  <h1 className="fs-filler-title">{formSchema.title}</h1>
                  {formSchema.description && (
                    <p className="fs-filler-desc">{formSchema.description}</p>
                  )}
                  <div className="fs-filler-req-note">
                    * Indicates mandatory question
                  </div>
                </div>
              </div>

              {/* Questionnaire Cards */}
              <div className="fs-filler-questions-list">
                {formSchema.fields.map((field, idx) => (
                  <FieldCard
                    key={field.id}
                    field={field}
                    index={idx}
                    value={values[field.id]}
                    status={fieldStatuses[field.id]}
                    errorMessage={fieldMessages[field.id]}
                    isPulsing={pulsingFieldIds.has(field.id)}
                    onChange={(val) => handleFieldChange(field.id, val)}
                  />
                ))}
              </div>

              {/* Pre-submission Summary & Confirmation Card */}
              <FormSubmissionCard
                totalRequired={requiredFields.length}
                completedRequired={completedRequiredCount}
                missingRequiredCount={missingCount}
                canConfirm={canConfirm}
                isConfirming={isConfirming}
                confirmError={confirmError}
                onConfirm={handleConfirmForm}
                onSkipOptional={skipOptionalAndFinalize}
                hasOptionalRemaining={hasRemainingOptional}
              />
            </>
          )}
        </div>
      </main>

      {/* Persistent Floating Real-time Voice Assistant Dock */}
      {!confirmation && (
        <VoiceAgentBar
          isCallActive={isCallActive}
          isPaused={isPaused}
          orbState={orbState}
          callDurationSeconds={callDurationSeconds}
          volumeLevel={volumeLevel}
          locale={locale}
          onStartCall={startCall}
          onEndCall={endCall}
          onTogglePause={togglePause}
          onInterrupt={interruptAssistant}
        />
      )}

      {/* Phonetic Spelling Verification Modal */}
      {pendingSpellingVerification && (
        <NameSpellingModal
          isOpen={true}
          candidateName={pendingSpellingVerification.name}
          spellingHint={pendingSpellingVerification.spelling}
          onConfirm={(confirmed) => resolveSpelling(confirmed)}
          onClose={() => resolveSpelling(pendingSpellingVerification.name)}
        />
      )}

      {/* Toast */}
      {toastMessage && (
        <Toast
          type="info"
          message={toastMessage}
          onClose={() => setToastMessage(null)}
          duration={3000}
        />
      )}
    </div>
  );
};
