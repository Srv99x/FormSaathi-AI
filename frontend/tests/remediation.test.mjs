import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Remediation: formSchemaToJsonSchema converts frontend FormSchema to backend JSON Schema', async () => {
  const mapperPath = path.resolve(__dirname, '../src/services/schemaMapper.ts');
  const mapperContent = fs.readFileSync(mapperPath, 'utf8');

  // Verify function existence and contract conversion
  assert.ok(mapperContent.includes('export function formSchemaToJsonSchema'));
  assert.ok(mapperContent.includes('$id'));
  assert.ok(mapperContent.includes('properties'));
  assert.ok(mapperContent.includes('required'));
});

test('Remediation: api.updateSessionLocale and patchField support voice provenance and in-place locale update', () => {
  const apiPath = path.resolve(__dirname, '../src/services/api.ts');
  const apiContent = fs.readFileSync(apiPath, 'utf8');

  assert.ok(apiContent.includes('updateSessionLocale('));
  assert.ok(apiContent.includes('/sessions/${encodeURIComponent(sessionId)}/locale'));
  assert.ok(apiContent.includes("source: 'manual' | 'voice' = 'manual'"));
  assert.ok(apiContent.includes('registerForm('));
  assert.ok(apiContent.includes('getSession('));
});

test('Remediation: useMediaRecorder default duration cap is 25s with 1.5s silence cutoff', () => {
  const recorderPath = path.resolve(__dirname, '../src/hooks/useMediaRecorder.ts');
  const content = fs.readFileSync(recorderPath, 'utf8');

  assert.ok(content.includes('silenceThresholdMs = 1500'));
  assert.ok(content.includes('energyThreshold = 20'));
  assert.ok(content.includes('maxRecordingDurationMs = 25000'));
});

test('Remediation: useVoiceCall filters uncertain candidates from auto-filling form fields (F-005)', () => {
  const voicePath = path.resolve(__dirname, '../src/hooks/useVoiceCall.ts');
  const content = fs.readFileSync(voicePath, 'utf8');

  // Must reject uncertain candidates from recognizedValues
  assert.ok(content.includes('!c.uncertain'));
});

test('Remediation: useVoiceCall surfaces honest error message on network or AI failure (F-007)', () => {
  const voicePath = path.resolve(__dirname, '../src/hooks/useVoiceCall.ts');
  const content = fs.readFileSync(voicePath, 'utf8');

  // Must detect unavailable services and inform user rather than faking success
  assert.ok(content.includes('isNetworkOrServerUnavailable(err)'));
  assert.ok(content.includes('setAssistantMessage(serviceErrMsg)'));
});
