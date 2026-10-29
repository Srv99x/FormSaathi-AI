import { useCallback, useRef, useState } from 'react';
import { api } from '../services/api';
import { FormSchema } from '../types/form';
import { resolveFormSchema } from '../services/schemaMapper';
import { ConfirmationRecord, FieldValidationStatus, ReviewResponse, SessionData } from '../types/session';

export function computeLocalValidation(
  schema: FormSchema,
  currentValues: Record<string, string | number | null>
): {
  fieldStatuses: Record<string, FieldValidationStatus>;
  fieldMessages: Record<string, string>;
  missingFields: string[];
  invalidFields: string[];
  canConfirm: boolean;
} {
  const fieldStatuses: Record<string, FieldValidationStatus> = {};
  const fieldMessages: Record<string, string> = {};
  const missingFields: string[] = [];
  const invalidFields: string[] = [];

  for (const field of schema.fields) {
    const rawVal = currentValues[field.id];
    const hasValue = rawVal !== undefined && rawVal !== null && String(rawVal).trim() !== '';

    if (!hasValue) {
      if (field.required) {
        fieldStatuses[field.id] = 'empty';
        fieldMessages[field.id] = `${field.label} is required.`;
        missingFields.push(field.id);
      } else {
        fieldStatuses[field.id] = 'empty';
      }
      continue;
    }

    const strVal = String(rawVal).trim();

    // Check integer fields (e.g. year_of_study)
    if (field.type === 'integer' || field.id === 'year_of_study') {
      const num = Number(rawVal);
      if (isNaN(num) || !Number.isInteger(num)) {
        fieldStatuses[field.id] = 'invalid';
        fieldMessages[field.id] = `${field.label} must be a valid integer.`;
        invalidFields.push(field.id);
        continue;
      }
      if (field.minimum !== undefined && num < field.minimum) {
        fieldStatuses[field.id] = 'invalid';
        fieldMessages[field.id] = `${field.label} must be at least ${field.minimum}.`;
        invalidFields.push(field.id);
        continue;
      }
      if (field.maximum !== undefined && num > field.maximum) {
        fieldStatuses[field.id] = 'invalid';
        fieldMessages[field.id] = `${field.label} must not exceed ${field.maximum}.`;
        invalidFields.push(field.id);
        continue;
      }
    }

    // Check tel / mobile
    if (field.type === 'tel' || field.id === 'mobile') {
      const digits = strVal.replace(/[\s\-+]/g, '').replace(/^91/, '');
      if (!/^[6-9]\d{9}$/.test(digits)) {
        fieldStatuses[field.id] = 'invalid';
        fieldMessages[field.id] = 'Must be a valid 10-digit Indian mobile number starting with 6-9.';
        invalidFields.push(field.id);
        continue;
      }
    }

    // Check email
    if (field.type === 'email' || field.id === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal) || strVal.length > 254) {
        fieldStatuses[field.id] = 'invalid';
        fieldMessages[field.id] = 'Must be a valid email address.';
        invalidFields.push(field.id);
        continue;
      }
    }

    // Check minLength / maxLength
    if (field.minLength && strVal.length < field.minLength) {
      fieldStatuses[field.id] = 'invalid';
      fieldMessages[field.id] = `${field.label} must be at least ${field.minLength} characters.`;
      invalidFields.push(field.id);
      continue;
    }
    if (field.maxLength && strVal.length > field.maxLength) {
      fieldStatuses[field.id] = 'invalid';
      fieldMessages[field.id] = `${field.label} must not exceed ${field.maxLength} characters.`;
      invalidFields.push(field.id);
      continue;
    }

    // Check options / enum
    if ((field.type === 'select' || field.type === 'radio') && field.options && field.options.length > 0) {
      const matched = field.options.some((opt) => opt.toLowerCase() === strVal.toLowerCase());
      if (!matched && !field.hasOtherOption) {
        fieldStatuses[field.id] = 'invalid';
        fieldMessages[field.id] = 'Must be one of the listed options.';
        invalidFields.push(field.id);
        continue;
      }
    }

    fieldStatuses[field.id] = 'valid';
  }

  const canConfirm = missingFields.length === 0 && invalidFields.length === 0;

  return {
    fieldStatuses,
    fieldMessages,
    missingFields,
    invalidFields,
    canConfirm,
  };
}

export function useFormSession(initialSchema?: FormSchema | null) {
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

  const schemaRef = useRef<FormSchema | null>(initialSchema || null);
  if (initialSchema && schemaRef.current !== initialSchema) {
    schemaRef.current = initialSchema;
  }

  const initSession = useCallback(
    async (
      formId: string,
      locale: 'en-IN' | 'hi-IN' = 'en-IN',
      providedSchema?: FormSchema | null
    ) => {
      setIsLoading(true);
      setError(null);

      const activeSchema = providedSchema || schemaRef.current || resolveFormSchema(formId);
      schemaRef.current = activeSchema;

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
        setRevision(0);

        // Initial validation of local fallback session
        const initialVals: Record<string, string | number | null> = {};
        const validation = computeLocalValidation(activeSchema, initialVals);
        setValues(initialVals);
        setFieldStatuses(validation.fieldStatuses);
        setFieldMessages(validation.fieldMessages);
        setMissingFields(validation.missingFields);
        setCanConfirm(validation.canConfirm);

        return fallbackSession;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const updateField = useCallback(
    async (fieldId: string, value: string | number | null, source: 'manual' = 'manual') => {
      // Normalize strict integer for year_of_study
      const cleanValue =
        fieldId === 'year_of_study' && value !== null && value !== ''
          ? parseInt(String(value), 10)
          : value;

      const nextValues = { ...values, [fieldId]: cleanValue };
      setValues(nextValues);

      if (!session) return;

      const isLocalSession = session.session_id.startsWith('local-session-');

      if (isLocalSession) {
        const nextRev = revision + 1;
        setRevision(nextRev);

        const currentSchema = schemaRef.current || resolveFormSchema(session.form_id);
        const validation = computeLocalValidation(currentSchema, nextValues);
        setFieldStatuses(validation.fieldStatuses);
        setFieldMessages(validation.fieldMessages);
        setMissingFields(validation.missingFields);
        setCanConfirm(validation.canConfirm);
        return;
      }

      // Online backend session
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
        // Local validation fallback if online call fails
        const currentSchema = schemaRef.current || resolveFormSchema(session.form_id);
        const validation = computeLocalValidation(currentSchema, nextValues);
        setFieldStatuses(validation.fieldStatuses);
        setFieldMessages(validation.fieldMessages);
        setMissingFields(validation.missingFields);
        setCanConfirm(validation.canConfirm);
      }
    },
    [session, values, revision]
  );

  const batchUpdateValues = useCallback(
    async (newValues: Record<string, string | number | null>) => {
      const nextValues = { ...values, ...newValues };
      setValues(nextValues);

      if (!session) return;

      const isLocalSession = session.session_id.startsWith('local-session-');

      if (isLocalSession) {
        const nextRev = revision + 1;
        setRevision(nextRev);

        const currentSchema = schemaRef.current || resolveFormSchema(session.form_id);
        const validation = computeLocalValidation(currentSchema, nextValues);
        setFieldStatuses(validation.fieldStatuses);
        setFieldMessages(validation.fieldMessages);
        setMissingFields(validation.missingFields);
        setCanConfirm(validation.canConfirm);
        return;
      }

      // Online backend session
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
        const currentSchema = schemaRef.current || resolveFormSchema(session.form_id);
        const validation = computeLocalValidation(currentSchema, nextValues);
        setFieldStatuses(validation.fieldStatuses);
        setFieldMessages(validation.fieldMessages);
        setMissingFields(validation.missingFields);
        setCanConfirm(validation.canConfirm);
      }
    },
    [session, values, revision]
  );

  const fetchReview = useCallback(async (): Promise<ReviewResponse | null> => {
    if (!session) return null;

    if (session.session_id.startsWith('local-session-')) {
      const currentSchema = schemaRef.current || resolveFormSchema(session.form_id);
      const validation = computeLocalValidation(currentSchema, values);
      return {
        values,
        field_statuses: validation.fieldStatuses,
        messages: validation.fieldMessages,
        missing: validation.missingFields,
        invalid: validation.invalidFields,
        conflicts: [],
        can_confirm: validation.canConfirm,
        revision,
      };
    }

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
      const currentSchema = schemaRef.current || resolveFormSchema(session.form_id);
      const validation = computeLocalValidation(currentSchema, values);
      return {
        values,
        field_statuses: validation.fieldStatuses,
        messages: validation.fieldMessages,
        missing: validation.missingFields,
        invalid: validation.invalidFields,
        conflicts: [],
        can_confirm: validation.canConfirm,
        revision,
      };
    }
  }, [session, values, revision]);

  const confirmLocal = useCallback(async (): Promise<ConfirmationRecord> => {
    if (!session) throw new Error('No active session');

    const isLocalSession = session.session_id.startsWith('local-session-');

    if (isLocalSession) {
      const currentSchema = schemaRef.current || resolveFormSchema(session.form_id);
      const validation = computeLocalValidation(currentSchema, values);

      if (!validation.canConfirm) {
        const missingList = validation.missingFields.join(', ');
        throw new Error(
          `Cannot confirm local session: required field(s) missing or invalid (${missingList || 'validation failed'}).`
        );
      }

      const localRec: ConfirmationRecord = {
        confirmation_id: `FS-LOCAL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        status: 'confirmed_local',
        form_id: session.form_id,
        revision,
        confirmed_at: new Date().toISOString(),
        record: { ...values },
      };
      setConfirmation(localRec);
      return localRec;
    }

    // Online backend confirmation path
    try {
      // Pre-confirm review snapshot sets session.reviewed_revision = session.revision
      // on the backend, ensuring full compliance with CONTRACT.md against 409 STALE_REVIEW.
      const freshReview = await api.getReview(session.session_id);
      setRevision(freshReview.revision);
      setCanConfirm(freshReview.can_confirm);

      if (!freshReview.can_confirm) {
        throw new Error(
          'Cannot confirm form: required fields are missing or invalid according to backend review.'
        );
      }

      const record = await api.confirmSession(session.session_id, freshReview.revision);
      setConfirmation(record);
      return record;
    } catch (err: any) {
      // If backend network call failed, verify local validation before issuing fallback local receipt
      const currentSchema = schemaRef.current || resolveFormSchema(session.form_id);
      const validation = computeLocalValidation(currentSchema, values);
      if (!validation.canConfirm) {
        throw err;
      }

      const localRec: ConfirmationRecord = {
        confirmation_id: `FS-LOCAL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        status: 'confirmed_local',
        form_id: session.form_id,
        revision,
        confirmed_at: new Date().toISOString(),
        record: { ...values },
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
