import { useCallback, useRef, useState } from 'react';
import { api, isNetworkOrServerUnavailable } from '../services/api';
import { FormSchema } from '../types/form';
import { resolveFormSchema } from '../services/schemaMapper';
import { ConfirmationRecord, FieldValidationStatus, ReviewResponse, SessionData } from '../types/session';

const MONTH_NAMES: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function isValidCalendarDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1000 || year > 9999) {
    return false;
  }
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  const daysInMonths = [31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= daysInMonths[month - 1];
}

/**
 * Validates date input per CONTRACT.md and backend validators.py:
 * - Strict ISO format (YYYY-MM-DD)
 * - Explicit English named month (e.g. 3 April 2006)
 * - Ambiguous slash dates (DD/MM/YYYY vs MM/DD/YYYY) require review
 * - Reject impossible calendar dates (e.g. 2001-02-30) without rollover
 * - Reject future dates
 * - Check age boundary 12–100 (explicit manual ISO/named-month acknowledges outlier)
 */
export function checkDate(
  value: string,
  today: Date = new Date(),
  manual: boolean = true
): { parsed: string | null; status: FieldValidationStatus; message: string } {
  const trimmed = value.trim();
  let parsedYear: number | null = null;
  let parsedMonth: number | null = null;
  let parsedDay: number | null = null;

  // 1. ISO format: YYYY-MM-DD
  const isoMatch = trimmed.match(/^([0-9]{4})-([0-9]{2})-([0-9]{2})$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (isValidCalendarDate(y, m, d)) {
      parsedYear = y;
      parsedMonth = m;
      parsedDay = d;
    }
  } else {
    // 2. Slash format: DD/MM/YYYY or MM/DD/YYYY
    const slashMatch = trimmed.match(/^([0-9]{1,2})\/([0-9]{1,2})\/([0-9]{4})$/);
    if (slashMatch) {
      const first = parseInt(slashMatch[1], 10);
      const second = parseInt(slashMatch[2], 10);
      const year = parseInt(slashMatch[3], 10);

      const validCombinations: { d: number; m: number }[] = [];
      if (isValidCalendarDate(year, second, first)) {
        validCombinations.push({ d: first, m: second });
      }
      if (first !== second && isValidCalendarDate(year, first, second)) {
        validCombinations.push({ d: second, m: first });
      }

      if (validCombinations.length === 0) {
        return {
          parsed: null,
          status: 'invalid',
          message: 'Enter a real date as YYYY-MM-DD or 3 April 2006.',
        };
      }
      if (validCombinations.length > 1) {
        return {
          parsed: null,
          status: 'needs_review',
          message: 'Ambiguous date. Enter an explicit day, month and year (YYYY-MM-DD).',
        };
      }
      parsedYear = year;
      parsedMonth = validCombinations[0].m;
      parsedDay = validCombinations[0].d;
    } else {
      // 3. Named month format: e.g. "3 April 2006" or "03 April 2006"
      const namedMatch = trimmed.match(/^([0-9]{1,2})\s+([A-Za-z]+)\s+([0-9]{4})$/);
      if (namedMatch) {
        const d = parseInt(namedMatch[1], 10);
        const monthKey = namedMatch[2].toLowerCase();
        const y = parseInt(namedMatch[3], 10);
        const m = MONTH_NAMES[monthKey];
        if (m && isValidCalendarDate(y, m, d)) {
          parsedYear = y;
          parsedMonth = m;
          parsedDay = d;
        }
      }
    }
  }

  if (parsedYear === null || parsedMonth === null || parsedDay === null) {
    return {
      parsed: null,
      status: 'invalid',
      message: 'Enter a real date as YYYY-MM-DD or 3 April 2006.',
    };
  }

  const isoFormatted = `${String(parsedYear).padStart(4, '0')}-${String(parsedMonth).padStart(2, '0')}-${String(parsedDay).padStart(2, '0')}`;

  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDay = today.getDate();

  // Check if date of birth is in the future
  if (
    parsedYear > todayYear ||
    (parsedYear === todayYear && parsedMonth > todayMonth) ||
    (parsedYear === todayYear && parsedMonth === todayMonth && parsedDay > todayDay)
  ) {
    return {
      parsed: isoFormatted,
      status: 'invalid',
      message: 'Date of birth cannot be in the future.',
    };
  }

  // Calculate age: today.year - parsed.year - ((today.month, today.day) < (parsed.month, parsed.day))
  let age = todayYear - parsedYear;
  if (todayMonth < parsedMonth || (todayMonth === parsedMonth && todayDay < parsedDay)) {
    age--;
  }

  if (age < 12 || age > 100) {
    if (!manual || trimmed.includes('/')) {
      return {
        parsed: isoFormatted,
        status: 'needs_review',
        message: 'Age is outside 12–100. Please explicitly check and enter the date.',
      };
    }
    return {
      parsed: isoFormatted,
      status: 'valid',
      message: 'Date explicitly checked; age is outside the typical student range.',
    };
  }

  return {
    parsed: isoFormatted,
    status: 'valid',
    message: 'Valid date of birth.',
  };
}

export function computeLocalValidation(
  schema: FormSchema,
  currentValues: Record<string, string | number | null>,
  today: Date = new Date(),
  manual: boolean = true
): {
  fieldStatuses: Record<string, FieldValidationStatus>;
  fieldMessages: Record<string, string>;
  missingFields: string[];
  invalidFields: string[];
  needsReviewFields: string[];
  canConfirm: boolean;
} {
  const fieldStatuses: Record<string, FieldValidationStatus> = {};
  const fieldMessages: Record<string, string> = {};
  const missingFields: string[] = [];
  const invalidFields: string[] = [];
  const needsReviewFields: string[] = [];

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

    // Check tel / mobile — supports optional explicit +91 without corrupting 10-digit numbers starting with 91
    if (field.type === 'tel' || field.id === 'mobile') {
      let clean = strVal.replace(/[\s\-()]/g, '');
      if (clean.startsWith('+91')) {
        clean = clean.slice(3);
      }
      if (!/^[6-9][0-9]{9}$/.test(clean)) {
        fieldStatuses[field.id] = 'invalid';
        fieldMessages[field.id] = 'Enter a valid 10-digit Indian mobile number beginning with 6–9.';
        invalidFields.push(field.id);
        continue;
      }
    }

    // Check date fields
    if (field.type === 'date' || field.id === 'date_of_birth') {
      const dateCheck = checkDate(strVal, today, manual);
      if (dateCheck.status === 'invalid') {
        fieldStatuses[field.id] = 'invalid';
        fieldMessages[field.id] = dateCheck.message;
        invalidFields.push(field.id);
        continue;
      }
      if (dateCheck.status === 'needs_review') {
        fieldStatuses[field.id] = 'needs_review';
        fieldMessages[field.id] = dateCheck.message;
        needsReviewFields.push(field.id);
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

  const canConfirm = missingFields.length === 0 && invalidFields.length === 0 && needsReviewFields.length === 0;

  return {
    fieldStatuses,
    fieldMessages,
    missingFields,
    invalidFields,
    needsReviewFields,
    canConfirm,
  };
}

export interface ConfirmationFlowParams {
  session: SessionData;
  values: Record<string, string | number | null>;
  schema: FormSchema;
  apiClient: {
    getReview: (sessionId: string) => Promise<ReviewResponse>;
    confirmSession: (sessionId: string, revision: number) => Promise<ConfirmationRecord>;
  };
  onRecordConfirmed?: (rec: ConfirmationRecord) => void;
}

/**
 * Executes confirmation with strict separation between authoritative backend rejections
 * and genuine network transport failures. Never converts 4xx or rejected reviews into local successes.
 */
export async function executeConfirmation({
  session,
  values,
  schema,
  apiClient,
  onRecordConfirmed,
}: ConfirmationFlowParams): Promise<ConfirmationRecord> {
  const isLocalSession = session.session_id.startsWith('local-session-');

  if (isLocalSession) {
    const validation = computeLocalValidation(schema, values);
    if (!validation.canConfirm) {
      const issues = [...validation.missingFields, ...validation.invalidFields, ...validation.needsReviewFields];
      throw new Error(
        `Cannot confirm local session: required field(s) missing or invalid (${issues.join(', ') || 'validation failed'}).`
      );
    }
    const localRec: ConfirmationRecord = {
      confirmation_id: `FS-LOCAL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      status: 'confirmed_local',
      form_id: session.form_id,
      revision: session.revision,
      confirmed_at: new Date().toISOString(),
      record: { ...values },
    };
    onRecordConfirmed?.(localRec);
    return localRec;
  }

  // Online backend confirmation path:
  // 1. Fetch authoritative fresh review snapshot
  let freshReview: ReviewResponse;
  try {
    freshReview = await apiClient.getReview(session.session_id);
  } catch (reviewErr: unknown) {
    if (isNetworkOrServerUnavailable(reviewErr)) {
      // Genuine network transport failure during review fetch
      const validation = computeLocalValidation(schema, values);
      if (!validation.canConfirm) {
        const issues = [...validation.missingFields, ...validation.invalidFields, ...validation.needsReviewFields];
        throw new Error(
          `Cannot confirm form: network unavailable and local validation failed (${issues.join(', ') || 'validation failed'}).`
        );
      }
      const localRec: ConfirmationRecord = {
        confirmation_id: `FS-LOCAL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        status: 'confirmed_local',
        form_id: session.form_id,
        revision: session.revision,
        confirmed_at: new Date().toISOString(),
        record: { ...values },
      };
      onRecordConfirmed?.(localRec);
      return localRec;
    }
    // Authoritative server error response (e.g. 404 session not found, 400) -> rethrow!
    throw reviewErr;
  }

  // 2. Authoritative check on review snapshot:
  if (!freshReview.can_confirm) {
    const missingInfo = freshReview.missing?.length ? ` (Missing: ${freshReview.missing.join(', ')})` : '';
    throw new Error(`Cannot confirm form: backend review rejected confirmation${missingInfo}.`);
  }

  // 3. Confirm with matching revision
  try {
    const record = await apiClient.confirmSession(session.session_id, freshReview.revision);
    onRecordConfirmed?.(record);
    return record;
  } catch (confirmErr: unknown) {
    // Authoritative server error response (e.g. 409 STALE_REVIEW, 400, 422) -> rethrow!
    if (!isNetworkOrServerUnavailable(confirmErr)) {
      throw confirmErr;
    }

    // Genuine network transport failure during confirmSession call
    const validation = computeLocalValidation(schema, values);
    if (!validation.canConfirm) {
      const issues = [...validation.missingFields, ...validation.invalidFields, ...validation.needsReviewFields];
      throw new Error(
        `Cannot confirm form: network unavailable and local validation failed (${issues.join(', ') || 'validation failed'}).`
      );
    }

    const localRec: ConfirmationRecord = {
      confirmation_id: `FS-LOCAL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      status: 'confirmed_local',
      form_id: session.form_id,
      revision: session.revision,
      confirmed_at: new Date().toISOString(),
      record: { ...values },
    };
    onRecordConfirmed?.(localRec);
    return localRec;
  }
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
        // Local validation fallback if network is unavailable
        if (isNetworkOrServerUnavailable(err)) {
          const currentSchema = schemaRef.current || resolveFormSchema(session.form_id);
          const validation = computeLocalValidation(currentSchema, nextValues);
          setFieldStatuses(validation.fieldStatuses);
          setFieldMessages(validation.fieldMessages);
          setMissingFields(validation.missingFields);
          setCanConfirm(validation.canConfirm);
        } else {
          // Authoritative server error response
          console.warn('Backend rejected field patch:', err);
        }
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
        if (isNetworkOrServerUnavailable(err)) {
          const currentSchema = schemaRef.current || resolveFormSchema(session.form_id);
          const validation = computeLocalValidation(currentSchema, nextValues);
          setFieldStatuses(validation.fieldStatuses);
          setFieldMessages(validation.fieldMessages);
          setMissingFields(validation.missingFields);
          setCanConfirm(validation.canConfirm);
        } else {
          console.warn('Backend rejected batch update:', err);
        }
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
      if (isNetworkOrServerUnavailable(err)) {
        console.warn('Review call fallback to local snapshot', err);
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
      throw err;
    }
  }, [session, values, revision]);

  const confirmLocal = useCallback(async (): Promise<ConfirmationRecord> => {
    if (!session) throw new Error('No active session');
    const currentSchema = schemaRef.current || resolveFormSchema(session.form_id);

    return executeConfirmation({
      session: { ...session, revision },
      values,
      schema: currentSchema,
      apiClient: api,
      onRecordConfirmed: (rec) => {
        setConfirmation(rec);
      },
    });
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
