/**
 * Session, validation, review, and confirmation types aligned with docs/CONTRACT.md
 */

export type FieldValidationStatus = 'empty' | 'valid' | 'invalid' | 'needs_review' | 'conflict';

export interface SessionData {
  session_id: string;
  form_id: string;
  revision: number;
  expires_in_seconds: number;
  locale?: 'en-IN' | 'hi-IN';
}

export interface Issue {
  field_id: string | null;
  type: string;
  message: string;
  candidates?: any[] | null;
}

export interface ValidationSnapshot {
  values: Record<string, string | number | null>;
  statuses: Record<string, FieldValidationStatus>;
  messages: Record<string, string>;
  missing: string[];
  invalid: (string | Issue)[];
  conflicts: (string | Issue)[];
  revision: number;
  can_confirm: boolean;
}

export interface ReviewResponse {
  values: Record<string, string | number | null>;
  field_statuses: Record<string, FieldValidationStatus>;
  messages: Record<string, string>;
  missing: string[];
  invalid: (string | Issue)[];
  conflicts: (string | Issue)[];
  can_confirm: boolean;
  revision: number;
}

export interface PatchResponse {
  revision: number;
  status: FieldValidationStatus;
  field: {
    field_id: string;
    value: string | number | null;
    status: FieldValidationStatus;
    message: string;
  };
}

export interface ConfirmationRecord {
  confirmation_id: string;
  status: 'confirmed_local';
  form_id: string;
  revision: number;
  confirmed_at: string;
  record: Record<string, string | number | null>;
}
