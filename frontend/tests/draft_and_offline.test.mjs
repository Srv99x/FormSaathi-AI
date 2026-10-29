import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);
const esbuild = require('esbuild');

// Mock localStorage for Node test environment
class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  setItem(key, value) {
    this.store.set(key, String(value));
  }
  removeItem(key) {
    this.store.delete(key);
  }
  clear() {
    this.store.clear();
  }
}

globalThis.localStorage = new MockLocalStorage();

// Helper to bundle and import production TS modules directly into tests
const cacheDir = path.resolve(__dirname, '../node_modules/.cache/test_bundle');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

async function loadProductionModule(srcRelPath) {
  const fullPath = path.resolve(__dirname, '../src', srcRelPath);
  const outFileName = srcRelPath.replace(/[\/\\]/g, '_').replace(/\.tsx?$/, '') + '.mjs';
  const outPath = path.join(cacheDir, outFileName);

  esbuild.buildSync({
    entryPoints: [fullPath],
    bundle: true,
    outfile: outPath,
    format: 'esm',
    packages: 'external',
  });

  const fileUrl = 'file:///' + outPath.replace(/\\/g, '/');
  return await import(fileUrl);
}

// Pre-load production modules
const schemaMapper = await loadProductionModule('services/schemaMapper.ts');
const sessionHook = await loadProductionModule('hooks/useFormSession.ts');
const apiModule = await loadProductionModule('services/api.ts');

const {
  saveCustomForm,
  getCustomForm,
  saveDraftForm,
  getDraftForm,
  ACTIVE_DRAFT_KEY,
  BUILTIN_STUDENT_REGISTRATION,
  BUILTIN_STUDENT_ASSISTANCE,
} = schemaMapper;

const {
  checkDate,
  computeLocalValidation,
  executeConfirmation,
} = sessionHook;

const {
  ApiError,
} = apiModule;

// ============================================================================
// PART 1: Task 1 Draft Persistence Tests (Exercising Production Functions Directly)
// ============================================================================

test('Task 1 — Production schemaMapper provides separated storage key for active draft while preserving form.id', () => {
  globalThis.localStorage.clear();

  const sampleForm = {
    ...BUILTIN_STUDENT_REGISTRATION,
    title: 'Edited Student Registration',
    description: 'Updated description by user',
  };

  // 1. Save draft using production saveDraftForm / saveCustomForm
  saveDraftForm(sampleForm);

  // Raw key in localStorage must be 'formsaathi_custom_form_active_draft'
  const rawKey = `formsaathi_custom_form_${ACTIVE_DRAFT_KEY}`;
  assert.ok(globalThis.localStorage.getItem(rawKey) !== null);

  // 2. Loading draft returns exact modified state
  const loadedDraft = getDraftForm();
  assert.ok(loadedDraft !== null);
  assert.equal(loadedDraft.title, 'Edited Student Registration');
  assert.equal(loadedDraft.description, 'Updated description by user');

  // 3. Form ID remains strictly the original form ID, NEVER mutated to 'active_draft'
  assert.equal(loadedDraft.id, 'student_registration_v1');
});

test('Task 1 — Changes survive simulated browser refresh and preserve original form ID', () => {
  globalThis.localStorage.clear();

  const assistanceForm = {
    ...BUILTIN_STUDENT_ASSISTANCE,
    title: 'Custom Student Assistance Title',
  };

  // Save active draft
  saveCustomForm(assistanceForm, ACTIVE_DRAFT_KEY);

  // Simulate browser refresh: read from storage
  const restoredForm = getCustomForm(ACTIVE_DRAFT_KEY);
  assert.ok(restoredForm !== null);
  assert.equal(restoredForm.id, 'student_assistance_v1');
  assert.equal(restoredForm.title, 'Custom Student Assistance Title');
  assert.equal(restoredForm.fields.length, BUILTIN_STUDENT_ASSISTANCE.fields.length);
});

test('Task 1 — Template switching and publishing use correct form IDs', () => {
  globalThis.localStorage.clear();

  const templates = [
    BUILTIN_STUDENT_REGISTRATION,
    BUILTIN_STUDENT_ASSISTANCE,
    { id: 'form_custom_9999', title: 'Blank Custom Form', fields: [] },
  ];

  for (const tpl of templates) {
    // Switch template -> auto-saved to active_draft
    saveCustomForm(tpl, ACTIVE_DRAFT_KEY);
    if (tpl.id !== ACTIVE_DRAFT_KEY) {
      saveCustomForm(tpl, tpl.id);
    }

    const currentDraft = getCustomForm(ACTIVE_DRAFT_KEY);
    assert.equal(currentDraft.id, tpl.id);

    // Publishing URL uses form.id, not 'active_draft'
    const publishUrl = `/fill/${encodeURIComponent(currentDraft.id)}`;
    assert.equal(publishUrl, `/fill/${tpl.id}`);
  }
});

// ============================================================================
// PART 2: Issue 1 — Mobile-number Validation Tests (Production computeLocalValidation)
// ============================================================================

test('Issue 1 — Mobile: Valid 10-digit number beginning with "91" is accepted', () => {
  const schema = {
    id: 'test_mobile_form',
    fields: [{ id: 'mobile', label: 'Mobile Number', type: 'tel', required: true }],
  };

  // A 10-digit number starting with 91 (e.g. 9123456789)
  const res = computeLocalValidation(schema, { mobile: '9123456789' });
  assert.equal(res.canConfirm, true);
  assert.equal(res.invalidFields.length, 0);
  assert.equal(res.fieldStatuses.mobile, 'valid');
});

test('Issue 1 — Mobile: Valid 10-digit numbers beginning with other allowed digits (6, 7, 8, 9) are accepted', () => {
  const schema = {
    id: 'test_mobile_form',
    fields: [{ id: 'mobile', label: 'Mobile Number', type: 'tel', required: true }],
  };

  const validNumbers = [
    '9876543210',
    '8765432109',
    '7012345678',
    '6987654321',
  ];

  for (const num of validNumbers) {
    const res = computeLocalValidation(schema, { mobile: num });
    assert.equal(res.canConfirm, true, `Number ${num} should be valid`);
    assert.equal(res.fieldStatuses.mobile, 'valid');
  }
});

test('Issue 1 — Mobile: Valid numbers with explicit "+91" prefix (with or without spaces/hyphens) are accepted', () => {
  const schema = {
    id: 'test_mobile_form',
    fields: [{ id: 'mobile', label: 'Mobile Number', type: 'tel', required: true }],
  };

  const prefixedNumbers = [
    '+91 9123456789', // +91 followed by number starting with 91
    '+919876543210',
    '+91-8765432109',
    '+91 (7012345678)',
  ];

  for (const num of prefixedNumbers) {
    const res = computeLocalValidation(schema, { mobile: num });
    assert.equal(res.canConfirm, true, `Prefixed number ${num} should be valid`);
    assert.equal(res.fieldStatuses.mobile, 'valid');
  }
});

test('Issue 1 — Mobile: Invalid length and invalid starting digits are rejected', () => {
  const schema = {
    id: 'test_mobile_form',
    fields: [{ id: 'mobile', label: 'Mobile Number', type: 'tel', required: true }],
  };

  const invalidNumbers = [
    '987654321',      // 9 digits (too short)
    '987654321012',   // 12 digits without prefix (too long)
    '1234567890',     // 10 digits starting with 1 (invalid start digit)
    '5987654321',     // 10 digits starting with 5 (invalid start digit)
    '+91 1234567890', // +91 prefix with invalid starting digit
    'abcdefghij',     // letters
  ];

  for (const num of invalidNumbers) {
    const res = computeLocalValidation(schema, { mobile: num });
    assert.equal(res.canConfirm, false, `Number ${num} should be rejected`);
    assert.ok(res.invalidFields.includes('mobile'));
    assert.equal(res.fieldStatuses.mobile, 'invalid');
    assert.equal(res.fieldMessages.mobile, 'Enter a valid 10-digit Indian mobile number beginning with 6–9.');
  }
});

// ============================================================================
// PART 3: Issue 2 — Date Validation Tests (Production checkDate and computeLocalValidation)
// ============================================================================

test('Issue 2 — Date: Valid ISO date and valid English named-month date are accepted', () => {
  const fixedToday = new Date('2026-10-29T12:00:00Z');

  // Valid ISO
  const isoRes = checkDate('2002-05-14', fixedToday, true);
  assert.equal(isoRes.status, 'valid');
  assert.equal(isoRes.parsed, '2002-05-14');
  assert.equal(isoRes.message, 'Valid date of birth.');

  // Valid English named month
  const namedRes = checkDate('3 April 2006', fixedToday, true);
  assert.equal(namedRes.status, 'valid');
  assert.equal(namedRes.parsed, '2006-04-03');
});

test('Issue 2 — Date: Malformed date strings are rejected', () => {
  const fixedToday = new Date('2026-10-29T12:00:00Z');
  const malformedInputs = ['not-a-date', '2002-99-99', '2002/13/45', 'invalid'];

  for (const input of malformedInputs) {
    const res = checkDate(input, fixedToday, true);
    assert.equal(res.status, 'invalid', `Input "${input}" should be invalid`);
    assert.equal(res.message, 'Enter a real date as YYYY-MM-DD or 3 April 2006.');
  }
});

test('Issue 2 — Date: Impossible calendar dates (such as 2001-02-30 or 2023-02-29) are strictly rejected without silent rollover', () => {
  const fixedToday = new Date('2026-10-29T12:00:00Z');

  // 1. Feb 30 in any year does not exist
  const feb30 = checkDate('2001-02-30', fixedToday, true);
  assert.equal(feb30.status, 'invalid');
  assert.equal(feb30.message, 'Enter a real date as YYYY-MM-DD or 3 April 2006.');

  // 2. Feb 29 in a non-leap year (2023) does not exist
  const feb29NonLeap = checkDate('2023-02-29', fixedToday, true);
  assert.equal(feb29NonLeap.status, 'invalid');

  // 3. Feb 29 in a leap year (2024) DOES exist
  const feb29Leap = checkDate('2004-02-29', fixedToday, true);
  assert.equal(feb29Leap.status, 'valid');

  // 4. April 31 does not exist (April has 30 days)
  const apr31 = checkDate('2002-04-31', fixedToday, true);
  assert.equal(apr31.status, 'invalid');
});

test('Issue 2 — Date: Future dates of birth are rejected', () => {
  const fixedToday = new Date('2026-10-29T12:00:00Z');

  const future1 = checkDate('2099-01-01', fixedToday, true);
  assert.equal(future1.status, 'invalid');
  assert.equal(future1.message, 'Date of birth cannot be in the future.');

  const tomorrow = checkDate('2026-10-30', fixedToday, true);
  assert.equal(tomorrow.status, 'invalid');
  assert.equal(tomorrow.message, 'Date of birth cannot be in the future.');
});

test('Issue 2 — Date: Supported age boundaries (12 to 100) and outlier semantics per backend contract', () => {
  const fixedToday = new Date('2026-10-29T12:00:00Z');

  // Exact lower boundary: exactly 12 years old today (born 2014-10-29)
  const age12 = checkDate('2014-10-29', fixedToday, true);
  assert.equal(age12.status, 'valid');

  // Exact upper boundary: exactly 100 years old today (born 1926-10-29)
  const age100 = checkDate('1926-10-29', fixedToday, true);
  assert.equal(age100.status, 'valid');

  // Typical college student age: 20 years old
  const age20 = checkDate('2006-10-29', fixedToday, true);
  assert.equal(age20.status, 'valid');

  // Outlier age (< 12):
  // When entered in slash format, slash is never an explicit acknowledgement -> needs_review per CONTRACT.md
  const slashOutlier = checkDate('01/01/2020', fixedToday, true);
  assert.equal(slashOutlier.status, 'needs_review');
  assert.equal(slashOutlier.message, 'Age is outside 12–100. Please explicitly check and enter the date.');

  // When manually entered in explicit ISO format, age outlier is acknowledged per backend validators.py
  const manualIsoOutlier = checkDate('2020-01-01', fixedToday, true);
  assert.equal(manualIsoOutlier.status, 'valid');
  assert.equal(manualIsoOutlier.message, 'Date explicitly checked; age is outside the typical student range.');
});

test('Issue 2 — Offline validation rejects form confirmation when date is impossible or needs review', () => {
  const schema = {
    id: 'test_date_form',
    fields: [
      { id: 'full_name', label: 'Full Name', type: 'text', required: true },
      { id: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
    ],
  };

  // Impossible date
  const resImpossible = computeLocalValidation(schema, {
    full_name: 'Amit Sharma',
    date_of_birth: '2001-02-30',
  });
  assert.equal(resImpossible.canConfirm, false);
  assert.ok(resImpossible.invalidFields.includes('date_of_birth'));

  // Ambiguous slash date
  const resAmbiguous = computeLocalValidation(schema, {
    full_name: 'Amit Sharma',
    date_of_birth: '03/04/2006', // Could be March 4 or April 3 -> needs_review
  });
  assert.equal(resAmbiguous.canConfirm, false);
  assert.ok(resAmbiguous.needsReviewFields.includes('date_of_birth'));
});

// ============================================================================
// PART 4: Issue 3 — Online Confirmation Decision Path & Fallback Safety Tests
// ============================================================================

test('Issue 3 — Scenario 1: Backend review rejects confirmation (can_confirm: false) → NO local receipt produced', async () => {
  const session = {
    session_id: 'sess_live_123',
    form_id: 'student_registration_v1',
    revision: 3,
    expires_in_seconds: 3600,
  };

  const values = {
    full_name: 'Suman Roy',
    date_of_birth: '2002-05-14',
    mobile: '9864012345',
    city: 'Guwahati',
    state: 'Assam',
    programme: 'BCA',
  };

  // Mock API where backend review explicitly says can_confirm: false
  const mockApiClient = {
    getReview: async () => ({
      values,
      field_statuses: { mobile: 'conflict' },
      messages: { mobile: 'Contradictory values detected' },
      missing: [],
      invalid: [],
      conflicts: ['mobile'],
      can_confirm: false,
      revision: 3,
    }),
    confirmSession: async () => {
      throw new Error('Should not be called when can_confirm is false');
    },
  };

  let localReceiptEmitted = false;
  await assert.rejects(
    async () => {
      await executeConfirmation({
        session,
        values,
        schema: BUILTIN_STUDENT_REGISTRATION,
        apiClient: mockApiClient,
        onRecordConfirmed: () => {
          localReceiptEmitted = true;
        },
      });
    },
    /backend review rejected confirmation/
  );

  assert.equal(localReceiptEmitted, false, 'No local receipt must be generated when backend review rejects confirmation');
});

test('Issue 3 — Scenario 2: Backend returns 409 STALE_REVIEW → NO local receipt produced', async () => {
  const session = {
    session_id: 'sess_live_123',
    form_id: 'student_registration_v1',
    revision: 2,
    expires_in_seconds: 3600,
  };

  const values = {
    full_name: 'Suman Roy',
    date_of_birth: '2002-05-14',
    mobile: '9864012345',
    city: 'Guwahati',
    state: 'Assam',
    programme: 'BCA',
  };

  // Backend review allowed confirmation, but confirm call returned 409 STALE_REVIEW
  const mockApiClient = {
    getReview: async () => ({
      values,
      field_statuses: {},
      messages: {},
      missing: [],
      invalid: [],
      conflicts: [],
      can_confirm: true,
      revision: 2,
    }),
    confirmSession: async () => {
      throw new ApiError('Review snapshot is stale (revision changed on server)', 409, 'STALE_REVIEW');
    },
  };

  let localReceiptEmitted = false;
  await assert.rejects(
    async () => {
      await executeConfirmation({
        session,
        values,
        schema: BUILTIN_STUDENT_REGISTRATION,
        apiClient: mockApiClient,
        onRecordConfirmed: () => {
          localReceiptEmitted = true;
        },
      });
    },
    (err) => err instanceof ApiError && err.status === 409
  );

  assert.equal(localReceiptEmitted, false, 'No local receipt must be generated on 409 STALE_REVIEW');
});

test('Issue 3 — Scenario 3: Backend returns validation / client error (HTTP 4xx) → NO local receipt produced', async () => {
  const session = {
    session_id: 'sess_live_123',
    form_id: 'student_registration_v1',
    revision: 2,
    expires_in_seconds: 3600,
  };

  const values = {
    full_name: 'Suman Roy',
    date_of_birth: '2002-05-14',
    mobile: '9864012345',
    city: 'Guwahati',
    state: 'Assam',
    programme: 'BCA',
  };

  // Server rejected confirm with 422 Unprocessable Entity
  const mockApiClient = {
    getReview: async () => ({
      values,
      field_statuses: {},
      messages: {},
      missing: [],
      invalid: [],
      conflicts: [],
      can_confirm: true,
      revision: 2,
    }),
    confirmSession: async () => {
      throw new ApiError('Unprocessable payload rejected by server', 422, 'VALIDATION_ERROR');
    },
  };

  let localReceiptEmitted = false;
  await assert.rejects(
    async () => {
      await executeConfirmation({
        session,
        values,
        schema: BUILTIN_STUDENT_REGISTRATION,
        apiClient: mockApiClient,
        onRecordConfirmed: () => {
          localReceiptEmitted = true;
        },
      });
    },
    (err) => err instanceof ApiError && err.status === 422
  );

  assert.equal(localReceiptEmitted, false, 'No local receipt must be generated on 422 validation error');
});

test('Issue 3 — Scenario 4: Genuine network/backend unavailability with valid local data → local receipt is allowed', async () => {
  const session = {
    session_id: 'sess_live_123',
    form_id: 'student_registration_v1',
    revision: 1,
    expires_in_seconds: 3600,
  };

  const validValues = {
    full_name: 'Bikash Kalita',
    date_of_birth: '2002-05-14',
    mobile: '9123456789',
    city: 'Tezpur',
    state: 'Assam',
    programme: 'BCA',
  };

  // Mock API throwing genuine network TypeError: Failed to fetch
  const mockApiClient = {
    getReview: async () => {
      throw new TypeError('Failed to fetch');
    },
    confirmSession: async () => {
      throw new TypeError('Failed to fetch');
    },
  };

  let localReceiptEmitted = false;
  const receipt = await executeConfirmation({
    session,
    values: validValues,
    schema: BUILTIN_STUDENT_REGISTRATION,
    apiClient: mockApiClient,
    onRecordConfirmed: () => {
      localReceiptEmitted = true;
    },
  });

  assert.equal(localReceiptEmitted, true);
  assert.equal(receipt.status, 'confirmed_local');
  assert.equal(receipt.form_id, 'student_registration_v1');
  assert.ok(receipt.confirmation_id.startsWith('FS-LOCAL-'));
  assert.deepEqual(receipt.record, validValues);
  // Guarantee receipt never claims external government or remote submission
  assert.ok(!JSON.stringify(receipt).includes('external'));
});

test('Issue 3 — Scenario 5: Genuine network/backend unavailability with missing or invalid local data → confirmation is strictly rejected', async () => {
  const session = {
    session_id: 'sess_live_123',
    form_id: 'student_registration_v1',
    revision: 1,
    expires_in_seconds: 3600,
  };

  // Missing mobile and state, invalid date
  const invalidValues = {
    full_name: 'Bikash Kalita',
    date_of_birth: '2001-02-30', // impossible date
    city: 'Tezpur',
  };

  const mockApiClient = {
    getReview: async () => {
      throw new TypeError('Failed to fetch');
    },
    confirmSession: async () => {
      throw new TypeError('Failed to fetch');
    },
  };

  let localReceiptEmitted = false;
  await assert.rejects(
    async () => {
      await executeConfirmation({
        session,
        values: invalidValues,
        schema: BUILTIN_STUDENT_REGISTRATION,
        apiClient: mockApiClient,
        onRecordConfirmed: () => {
          localReceiptEmitted = true;
        },
      });
    },
    /network unavailable and local validation failed/
  );

  assert.equal(localReceiptEmitted, false, 'No local receipt must be generated when local validation fails');
});

test('Issue 3 — Local fallback session (local-session-*) confirms valid data and blocks invalid data', async () => {
  const localSession = {
    session_id: `local-session-${Date.now()}`,
    form_id: 'student_registration_v1',
    revision: 0,
    expires_in_seconds: 3600,
  };

  const completeValues = {
    full_name: 'Pranab Das',
    date_of_birth: '2000-11-20',
    mobile: '9864012345',
    city: 'Nagaon',
    state: 'Assam',
    programme: 'BSc Physics',
  };

  const dummyApiClient = {
    getReview: async () => { throw new Error('Must not be called'); },
    confirmSession: async () => { throw new Error('Must not be called'); },
  };

  // Complete data -> succeeds with confirmed_local
  const receipt = await executeConfirmation({
    session: localSession,
    values: completeValues,
    schema: BUILTIN_STUDENT_REGISTRATION,
    apiClient: dummyApiClient,
  });

  assert.equal(receipt.status, 'confirmed_local');
  assert.ok(receipt.confirmation_id.startsWith('FS-LOCAL-'));
  assert.equal(receipt.record.full_name, 'Pranab Das');

  // Incomplete data -> rejected
  await assert.rejects(
    async () => {
      await executeConfirmation({
        session: localSession,
        values: { full_name: 'Incomplete' },
        schema: BUILTIN_STUDENT_REGISTRATION,
        apiClient: dummyApiClient,
      });
    },
    /Cannot confirm local session: required field\(s\) missing or invalid/
  );
});
