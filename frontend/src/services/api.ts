import { FormCatalogItem } from '../types/form';
import { ConfirmationRecord, PatchResponse, ReviewResponse, SessionData, ValidationSnapshot } from '../types/session';
import { AssistantTurnResponse } from '../types/voice';

/**
 * Low-level API client proxying to FastAPI backend on /api
 */
class ApiService {
  private baseUrl = '/api';

  async getHealth(): Promise<{ status: string; speech_provider: string; extraction_provider: string }> {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return { status: 'offline', speech_provider: 'unavailable', extraction_provider: 'unavailable' };
    }
  }

  async getForms(): Promise<FormCatalogItem[]> {
    const res = await fetch(`${this.baseUrl}/forms`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.forms || [];
  }

  async getForm(formId: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}/forms/${encodeURIComponent(formId)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  async createSession(formId: string, locale: 'en-IN' | 'hi-IN'): Promise<SessionData> {
    const res = await fetch(`${this.baseUrl}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ form_id: formId, locale }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Failed to create session (HTTP ${res.status})`);
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
      throw new Error(err?.error?.message || `Validation failed (HTTP ${res.status})`);
    }
    return await res.json();
  }

  async patchField(
    sessionId: string,
    fieldId: string,
    value: string | number | null,
    source: 'manual' = 'manual'
  ): Promise<PatchResponse> {
    const res = await fetch(`${this.baseUrl}/sessions/${encodeURIComponent(sessionId)}/fields`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field_id: fieldId, value, source }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Patch failed (HTTP ${res.status})`);
    }
    return await res.json();
  }

  async getReview(sessionId: string): Promise<ReviewResponse> {
    const res = await fetch(`${this.baseUrl}/sessions/${encodeURIComponent(sessionId)}/review`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Review failed (HTTP ${res.status})`);
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
      throw new Error(err?.error?.message || `Confirmation failed (HTTP ${res.status})`);
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
      res = await fetch(`${this.baseUrl}/sessions/${encodeURIComponent(sessionId)}/assistant`, {
        method: 'POST',
        body: formData,
      });
    } else {
      res = await fetch(`${this.baseUrl}/sessions/${encodeURIComponent(sessionId)}/assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: payload.transcript || '' }),
      });
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Assistant error (HTTP ${res.status})`);
    }
    return await res.json();
  }
}

export const api = new ApiService();
