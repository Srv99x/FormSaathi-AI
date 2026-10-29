/**
 * Types for Voice Call, Barge-in, Orb states, and Assistant Turn results.
 */

export type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking';

export interface TurnCandidate {
  field_id: string;
  value: string | number | null;
  evidence_text: string;
  uncertain: boolean;
  ambiguity_reason: string | null;
}

export interface AssistantTurnResponse {
  user_transcript: string;
  candidates: TurnCandidate[];
  updated_values: Record<string, string | number | null>;
  missing_required: string[];
  missing_optional: string[];
  assistant_message: string;
  assistant_audio_base64: string | null;
  name_candidate?: string | null;
  name_spelling?: string | null;
  is_complete: boolean;
}

export interface PhoneticVerification {
  name: string;
  spelling: string;
  fieldId: string;
}

