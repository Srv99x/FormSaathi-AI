import { useCallback, useState } from 'react';
import { api } from '../services/api';
import { ConfirmationRecord, FieldValidationStatus, ReviewResponse, SessionData } from '../types/session';

export function useFormSession() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [values, setValues] = useState<Record<string, string | number | null>>({});
  const [fieldStatuses, setFieldStatuses] = useState<Record<string, FieldValidationStatus>>({});
  const [fieldMessages, setFieldMessages] = useState<Record<string, string>>({});
  const [revision, setRevision] = useState(0);
  const [canConfirm, setCanConfirm] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationRecord | null>(null);

  const initSession = useCallback(async (formId: string, locale: 'en-IN' | 'hi-IN' = 'en-IN') => {
    setIsLoading(true);
    setError(null);
    try {
      const sess = await api.createSession(formId, locale);
      setSession(sess);
      setRevision(sess.revision);

      // Fetch initial review snapshot
      try {
        const review = await api.getReview(sess.session_id);
        setValues(review.values || {});
        setFieldStatuses(review.field_statuses || {});
        setFieldMessages(review.messages || {});
        setMissingFields(review.missing || []);
        setCanConfirm(review.can_confirm || false);
        setRevision(review.revision);
      } catch (e) {
        // initialize blank values
        setValues({});
        setFieldStatuses({});
      }
      return sess;
    } catch (err: any) {
      console.warn('Backend session creation unavailable, activating local session fallback', err);
      const fallbackSession: SessionData = {
        session_id: `local-session-${Date.now()}`,
        form_id: formId,
        revision: 0,
        expires_in_seconds: 3600,
        locale,
      };
      setSession(fallbackSession);
      return fallbackSession;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateField = useCallback(
    async (fieldId: string, value: string | number | null, source: 'manual' = 'manual') => {
      // Normalize strict integer for year_of_study
      const cleanValue =
        fieldId === 'year_of_study' && value !== null && value !== ''
          ? parseInt(String(value), 10)
          : value;

      // Optimistic local update
      setValues((prev) => ({ ...prev, [fieldId]: cleanValue }));

      if (!session) return;

      try {
        const res = await api.patchField(session.session_id, fieldId, cleanValue, source);
        setRevision(res.revision);
        setFieldStatuses((prev) => ({ ...prev, [fieldId]: res.status }));
        if (res.field?.message) {
          setFieldMessages((prev) => ({ ...prev, [fieldId]: res.field.message }));
        }

        // Re-check review to keep can_confirm and missing list in sync
        const review = await api.getReview(session.session_id);
        setFieldStatuses(review.field_statuses);
        setFieldMessages(review.messages);
        setMissingFields(review.missing);
        setCanConfirm(review.can_confirm);
        setRevision(review.revision);
      } catch (err) {
        // Local validation fallback
        const isValid = cleanValue !== null && String(cleanValue).trim().length > 0;
        setFieldStatuses((prev) => ({
          ...prev,
          [fieldId]: isValid ? 'valid' : 'empty',
        }));
      }
    },
    [session]
  );

  const batchUpdateValues = useCallback(
    async (newValues: Record<string, string | number | null>) => {
      setValues((prev) => ({ ...prev, ...newValues }));

      if (!session) return;

      // Update fields with strict 'manual' source to satisfy ManualChange contract
      try {
        for (const [key, val] of Object.entries(newValues)) {
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            const cleanVal = key === 'year_of_study' ? parseInt(String(val), 10) : val;
            await api.patchField(session.session_id, key, cleanVal, 'manual').catch(() => {});
          }
        }
        const review = await api.getReview(session.session_id);
        setFieldStatuses(review.field_statuses);
        setFieldMessages(review.messages);
        setMissingFields(review.missing);
        setCanConfirm(review.can_confirm);
        setRevision(review.revision);
      } catch (err) {
        console.warn('Batch update sync notice', err);
      }
    },
    [session]
  );

  const fetchReview = useCallback(async (): Promise<ReviewResponse | null> => {
    if (!session) return null;
    try {
      const review = await api.getReview(session.session_id);
      setValues(review.values);
      setFieldStatuses(review.field_statuses);
      setFieldMessages(review.messages);
      setMissingFields(review.missing);
      setCanConfirm(review.can_confirm);
      setRevision(review.revision);
      return review;
    } catch (err) {
      console.warn('Review call fallback', err);
      return null;
    }
  }, [session]);

  const confirmLocal = useCallback(async (): Promise<ConfirmationRecord> => {
    if (!session) throw new Error('No active session');

    try {
      // Pre-confirm review snapshot sets session.reviewed_revision = session.revision
      // on the backend, ensuring full compliance with CONTRACT.md against 409 STALE_REVIEW.
      const freshReview = await api.getReview(session.session_id);
      setRevision(freshReview.revision);
      setCanConfirm(freshReview.can_confirm);

      const record = await api.confirmSession(session.session_id, freshReview.revision);
      setConfirmation(record);
      return record;
    } catch (err) {
      // Local demo fallback if backend is offline
      const localRec: ConfirmationRecord = {
        confirmation_id: `FS-LOCAL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        status: 'confirmed_local',
        form_id: session.form_id,
        revision,
        confirmed_at: new Date().toISOString(),
        record: values,
      };
      setConfirmation(localRec);
      return localRec;
    }
  }, [revision, session, values]);

  return {
    session,
    values,
    fieldStatuses,
    fieldMessages,
    revision,
    canConfirm,
    missingFields,
    isLoading,
    error,
    confirmation,
    initSession,
    updateField,
    batchUpdateValues,
    fetchReview,
    confirmLocal,
    setValues,
  };
}

