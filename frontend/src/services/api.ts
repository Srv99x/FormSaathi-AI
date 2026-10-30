import { FormCatalogItem } from '../types/form';
import { ConfirmationRecord, PatchResponse, ReviewResponse, SessionData, ValidationSnapshot } from '../types/session';
import { AssistantTurnResponse } from '../types/voice';

// Resolve API base URL: Use VITE_API_BASE_URL when provided (e.g. deployed on Vercel),
// falling back to local proxy path '/api' in development. Safely handles Node.js test runner environments.
const rawEnvUrl = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.VITE_API_BASE_URL : '';
const envBase = (rawEnvUrl || '').replace(/\/+$/, '');
const API_BASE_URL = envBase
  ? (envBase.endsWith('/api') ? envBase : `${envBase}/api`)
  : '/api';

/**
 * Custom error class for API responses that preserves HTTP status and error payload
 */
export class ApiError extends Error {
  status: number;
  code?: string;
  data?: any;

  constructor(message: string, status: number, code?: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

/**
 * Distinguishes genuine transport/network failures (e.g. backend offline, DNS, timeout)
 * from authoritative HTTP error responses returned by the backend server.
 */
export function isNetworkOrServerUnavailable(err: unknown): boolean {
  if (!err) return false;
  // If it's an ApiError with an HTTP status code, the server was reached and answered authoritatively
  if (err instanceof ApiError && typeof err.status === 'number' && err.status >= 400) {
    return false;
  }
  if (typeof (err as any).status === 'number' && (err as any).status >= 400) {
    return false;
  }
  // Native fetch network errors throw TypeError
  if (err instanceof TypeError) {
    return true;
  }
  const msg = (err as Error).message || '';
  if (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('fetch failed') ||
    msg.includes('network')
  ) {
    return true;
  }
  return false;
}

/**
 * Low-level API client proxying to FastAPI backend
 */
class ApiService {
  private baseUrl = API_BASE_URL;

  async getHealth(): Promise<{ status: string; speech_provider: string; extraction_provider: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      if (!res.ok) throw new ApiError(`HTTP ${res.status}`, res.status);
      return await res.json();
    } catch {
      return { status: 'offline', speech_provider: 'unavailable', extraction_provider: 'unavailable' };
    }
  }

  async getForms(): Promise<FormCatalogItem[]> {
    const res = await fetch(`${this.baseUrl}/forms`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err?.error?.message || `Failed to get forms (HTTP ${res.status})`, res.status, err?.error?.code, err);
    }
    const data = await res.json();
    return data.forms || [];
  }

  async registerForm(schemaDefinition: any): Promise<any> {
    const res = await fetch(`${this.baseUrl}/forms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schema_definition: schemaDefinition }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err?.error?.message || `Failed to register form (HTTP ${res.status})`, res.status, err?.error?.code, err);
    }
    return await res.json();
  }

  async getForm(formId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/forms/${encodeURIComponent(formId)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err?.error?.message || `Failed to get form (HTTP ${res.status})`, res.status, err?.error?.code, err);
    }
    return await res.json();
  }

  async createSession(
    formId: string,
    locale: 'en-IN' | 'hi-IN',
    customSchema?: any
  ): Promise<SessionData> {
    const payload: Record<string, any> = { form_id: formId, locale };
    if (customSchema) {
      payload.custom_schema = customSchema;
    }
    const res = await fetch(`${this.baseUrl}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err?.error?.message || `Failed to create session (HTTP ${res.status})`, res.status, err?.error?.code, err);
    }
    const data = await res.json();
    return { ...data, locale };
  }

  async getSession(sessionId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/sessions/${encodeURIComponent(sessionId)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err?.error?.message || `Failed to get session (HTTP ${res.status})`, res.status, err?.error?.code, err);
    }
    return await res.json();
  }

  async updateSessionLocale(
    sessionId: string,
    locale: 'en-IN' | 'hi-IN'
  ): Promise<SessionData> {
    const res = await fetch(`${this.baseUrl}/sessions/${encodeURIComponent(sessionId)}/locale`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err?.error?.message || `Failed to update locale (HTTP ${res.status})`, res.status, err?.error?.code, err);
    }
    const data = await res.json();
    return { ...data, locale };
  }

  async validateSession(
    sessionId: string,
    proposedValues: Record<string, string | number | null>
  ): Promise<ValidationSnapshot> {
    const res = await fetch(`${this.baseUrl}/sessions/${encodeURIComponent(sessionId)}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposed_values: proposedValues }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err?.error?.message || `Validation failed (HTTP ${res.status})`, res.status, err?.error?.code, err);
    }
    return await res.json();
  }

  async patchField(
    sessionId: string,
    fieldId: string,
    value: string | number | null,
    // source: 'manual' = 'manual'
    source: 'manual' | 'voice' = 'manual'
  ): Promise<PatchResponse> {
    const res = await fetch(`${this.baseUrl}/sessions/${encodeURIComponent(sessionId)}/fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field_id: fieldId, value, source }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err?.error?.message || `Patch failed (HTTP ${res.status})`, res.status, err?.error?.code, err);
    }
    return await res.json();
  }

  async getReview(sessionId: string): Promise<ReviewResponse> {
    const res = await fetch(`${this.baseUrl}/sessions/${encodeURIComponent(sessionId)}/review`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err?.error?.message || `Review failed (HTTP ${res.status})`, res.status, err?.error?.code, err);
    }
    return await res.json();
  }

  async confirmSession(sessionId: string, revision: number): Promise<ConfirmationRecord> {
    const res = await fetch(`${this.baseUrl}/sessions/${encodeURIComponent(sessionId)}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewed: true, revision }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err?.error?.message || `Confirmation failed (HTTP ${res.status})`, res.status, err?.error?.code, err);
    }
    return await res.json();
  }

  async sendAssistantTurn(
    sessionId: string,
    payload: {
      audioBlob?: Blob;
      filename?: string;
      transcript?: string;
      locale?: string;
      currentValues?: Record<string, any>;
    }
  ): Promise<AssistantTurnResponse> {
    let res: Response;

    if (payload.audioBlob) {
      const formData = new FormData();
      formData.append('audio', payload.audioBlob, payload.filename || 'voice_recording.webm');
      if (payload.transcript) {
        formData.append('transcript', payload.transcript);
      }
      if (payload.locale) {
        formData.append('locale', payload.locale);
      }
      if (payload.currentValues) {
        formData.append('current_values', JSON.stringify(payload.currentValues));
      }
      res = await fetch(`${this.baseUrl}/sessions/${encodeURIComponent(sessionId)}/assistant`, {
        method: 'POST',
        body: formData,
      });
    } else {
      res = await fetch(`${this.baseUrl}/sessions/${encodeURIComponent(sessionId)}/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: payload.transcript || '',
          current_values: payload.currentValues,
        }),
      });
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new ApiError(err?.error?.message || `Assistant error (HTTP ${res.status})`, res.status, err?.error?.code, err);
    }
    return await res.json();
  }

  async synthesizeTTS(text: string, locale: 'en-IN' | 'hi-IN' = 'en-IN'): Promise<string | null> {
    try {
      const res = await fetch(`${this.baseUrl}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, locale }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data.audio_base64 || null;
    } catch {
      return null;
    }
  }
}

export const api = new ApiService();
