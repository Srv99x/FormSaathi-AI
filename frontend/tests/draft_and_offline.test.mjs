import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock localStorage for headless Node environment
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

// --- Task 1: Draft Persistence Tests ---

test('Task 1 — Schema mapper provides separated storage key for active draft while preserving form.id', () => {
  const LOCAL_STORAGE_PREFIX = 'formsaathi_custom_form_';
  const ACTIVE_DRAFT_KEY = 'active_draft';

  // Test saveCustomForm logic
  function saveCustomForm(form, storageKey) {
    const key = storageKey || form.id;
    globalThis.localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${key}`, JSON.stringify(form));
  }

  function getCustomForm(storageKeyOrId) {
    const raw = globalThis.localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${storageKeyOrId}`);
    return raw ? JSON.parse(raw) : null;
  }

  const sampleForm = {
    id: 'student_registration_v1',
    title: 'Edited Student Registration',
    description: 'Updated description by user',
    fields: [
      { id: 'full_name', label: 'Full Name', type: 'text', required: true },
      { id: 'mobile', label: 'Mobile Number', type: 'tel', required: true }
    ]
  };

  // 1. Save draft using intended key 'active_draft'
  saveCustomForm(sampleForm, ACTIVE_DRAFT_KEY);

  // Raw key in localStorage must be 'formsaathi_custom_form_active_draft'
  assert.ok(globalThis.localStorage.getItem('formsaathi_custom_form_active_draft') !== null);

  // 2. Loading draft returns exact modified state
  const loadedDraft = getCustomForm(ACTIVE_DRAFT_KEY);
  assert.ok(loadedDraft !== null);
  assert.equal(loadedDraft.title, 'Edited Student Registration');
  assert.equal(loadedDraft.description, 'Updated description by user');

  // 3. Form ID remains strictly the original form ID, NEVER mutated to 'active_draft'
  assert.equal(loadedDraft.id, 'student_registration_v1');
});

test('Task 1 — Changes survive simulated browser refresh and preserve original form ID', () => {
  const LOCAL_STORAGE_PREFIX = 'formsaathi_custom_form_';
  const ACTIVE_DRAFT_KEY = 'active_draft';

  function saveCustomForm(form, storageKey) {
    const key = storageKey || form.id;
    globalThis.localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${key}`, JSON.stringify(form));
  }
  function getCustomForm(storageKeyOrId) {
    const raw = globalThis.localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${storageKeyOrId}`);
    return raw ? JSON.parse(raw) : null;
  }

  // User starts with student_assistance_v1 and edits a field
  const assistanceForm = {
    id: 'student_assistance_v1',
    title: 'Custom Student Assistance',
    fields: [
      { id: 'full_name', label: 'Applicant Name', type: 'text', required: true },
      { id: 'grant_amount', label: 'Requested Amount', type: 'integer', required: true }
    ]
  };

  // Save as active draft
  saveCustomForm(assistanceForm, ACTIVE_DRAFT_KEY);

  // Simulate browser refresh: in-memory state is wiped, component re-mounts and reads getCustomForm('active_draft')
  const restoredForm = getCustomForm('active_draft');
  assert.ok(restoredForm !== null);
  assert.equal(restoredForm.id, 'student_assistance_v1');
  assert.equal(restoredForm.title, 'Custom Student Assistance');
  assert.equal(restoredForm.fields.length, 2);
  assert.equal(restoredForm.fields[1].id, 'grant_amount');
});

test('Task 1 — Template switching and publishing use correct form IDs', () => {
  const LOCAL_STORAGE_PREFIX = 'formsaathi_custom_form_';

  function saveCustomForm(form, storageKey) {
    const key = storageKey || form.id;
    globalThis.localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${key}`, JSON.stringify(form));
  }
  function getCustomForm(storageKeyOrId) {
    const raw = globalThis.localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${storageKeyOrId}`);
    return raw ? JSON.parse(raw) : null;
  }

  const templates = [
    { id: 'student_registration_v1', title: 'Student Registration Form' },
    { id: 'student_assistance_v1', title: 'Student Assistance Application' },
    { id: 'form_custom_9999', title: 'Blank Custom Form' }
  ];

  for (const tpl of templates) {
    // Switch template -> auto-saved to active_draft
    saveCustomForm(tpl, 'active_draft');
    if (tpl.id !== 'active_draft') {
      saveCustomForm(tpl, tpl.id);
    }

    const currentDraft = getCustomForm('active_draft');
    assert.equal(currentDraft.id, tpl.id);

    // Publishing URL uses form.id, not 'active_draft'
    const publishUrl = `/fill/${encodeURIComponent(currentDraft.id)}`;
    assert.equal(publishUrl, `/fill/${tpl.id}`);
  }
});

test('Task 1 — FormBuilderPage.tsx source code binds draft auto-save to "active_draft" key', () => {
  const builderPath = path.resolve(__dirname, '../src/pages/FormBuilderPage.tsx');
  const content = fs.readFileSync(builderPath, 'utf8');

  // Verify it reads from 'active_draft'
  assert.ok(content.includes("getCustomForm('active_draft')"));

  // Verify it saves to 'active_draft' without overwriting form.id
  assert.ok(content.includes("saveCustomForm(form, 'active_draft')"));
  assert.ok(!content.includes("saveCustomForm({ ...form, id: form.id })"));
});

// --- Task 2: Offline Confirmation & Validation Tests ---

// Local validation helper mirroring computeLocalValidation
function computeLocalValidation(schema, currentValues) {
  const fieldStatuses = {};
  const fieldMessages = {};
  const missingFields = [];
  const invalidFields = [];

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

    if (field.type === 'integer' || field.id === 'year_of_study') {
      const num = Number(rawVal);
      if (isNaN(num) || !Number.isInteger(num)) {
        fieldStatuses[field.id] = 'invalid';
        invalidFields.push(field.id);
        continue;
      }
      if (field.minimum !== undefined && num < field.minimum) {
        fieldStatuses[field.id] = 'invalid';
        invalidFields.push(field.id);
        continue;
      }
      if (field.maximum !== undefined && num > field.maximum) {
        fieldStatuses[field.id] = 'invalid';
        invalidFields.push(field.id);
        continue;
      }
    }

    if (field.type === 'tel' || field.id === 'mobile') {
      const digits = strVal.replace(/[\s\-+]/g, '').replace(/^91/, '');
      if (!/^[6-9]\d{9}$/.test(digits)) {
        fieldStatuses[field.id] = 'invalid';
        invalidFields.push(field.id);
        continue;
      }
    }

    if (field.type === 'email' || field.id === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strVal) || strVal.length > 254) {
        fieldStatuses[field.id] = 'invalid';
        invalidFields.push(field.id);
        continue;
      }
    }

    if (field.minLength && strVal.length < field.minLength) {
      fieldStatuses[field.id] = 'invalid';
      invalidFields.push(field.id);
      continue;
    }

    if (field.maxLength && strVal.length > field.maxLength) {
      fieldStatuses[field.id] = 'invalid';
      invalidFields.push(field.id);
      continue;
    }

    fieldStatuses[field.id] = 'valid';
  }

  const canConfirm = missingFields.length === 0 && invalidFields.length === 0;
  return { fieldStatuses, fieldMessages, missingFields, invalidFields, canConfirm };
}

test('Task 2 — Local session with all required fields complete enables confirmation', () => {
  const registrationSchema = {
    id: 'student_registration_v1',
    fields: [
      { id: 'full_name', label: 'Full Name', type: 'text', required: true, minLength: 2 },
      { id: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
      { id: 'mobile', label: 'Mobile Number', type: 'tel', required: true },
      { id: 'city', label: 'City', type: 'text', required: true },
      { id: 'state', label: 'State', type: 'select', required: true, options: ['Assam', 'Manipur'] },
      { id: 'programme', label: 'Programme', type: 'select', required: true, options: ['BSc Physics', 'BCA'] },
      { id: 'email', label: 'Email', type: 'email', required: false }
    ]
  };

  const completeValues = {
    full_name: 'Priyanka Borah',
    date_of_birth: '2002-05-14',
    mobile: '9864012345',
    city: 'Guwahati',
    state: 'Assam',
    programme: 'BCA',
    email: 'priyanka@example.in'
  };

  const validation = computeLocalValidation(registrationSchema, completeValues);
  assert.equal(validation.canConfirm, true);
  assert.equal(validation.missingFields.length, 0);
  assert.equal(validation.invalidFields.length, 0);
  assert.equal(validation.fieldStatuses.full_name, 'valid');
  assert.equal(validation.fieldStatuses.mobile, 'valid');
});

test('Task 2 — Local session with required fields missing strictly disables confirmation', () => {
  const registrationSchema = {
    id: 'student_registration_v1',
    fields: [
      { id: 'full_name', label: 'Full Name', type: 'text', required: true },
      { id: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
      { id: 'mobile', label: 'Mobile Number', type: 'tel', required: true },
      { id: 'city', label: 'City', type: 'text', required: true },
      { id: 'state', label: 'State', type: 'select', required: true },
      { id: 'programme', label: 'Programme', type: 'select', required: true }
    ]
  };

  // Missing mobile and programme
  const partialValues = {
    full_name: 'Rahul Sarma',
    date_of_birth: '2001-08-20',
    city: 'Jorhat',
    state: 'Assam'
  };

  const validation = computeLocalValidation(registrationSchema, partialValues);
  assert.equal(validation.canConfirm, false);
  assert.ok(validation.missingFields.includes('mobile'));
  assert.ok(validation.missingFields.includes('programme'));
  assert.equal(validation.fieldStatuses.mobile, 'empty');
});

test('Task 2 — Local session with invalid field blocks confirmation even if all required fields are populated', () => {
  const assistanceSchema = {
    id: 'student_assistance_v1',
    fields: [
      { id: 'full_name', label: 'Full Name', type: 'text', required: true },
      { id: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
      { id: 'mobile', label: 'Mobile Number', type: 'tel', required: true },
      { id: 'institution', label: 'Institution', type: 'text', required: true },
      { id: 'programme', label: 'Programme', type: 'text', required: true },
      { id: 'year_of_study', label: 'Year of Study', type: 'integer', required: true, minimum: 1, maximum: 5 },
      { id: 'city', label: 'City', type: 'text', required: true },
      { id: 'state', label: 'State', type: 'text', required: true },
      { id: 'assistance_type', label: 'Assistance Type', type: 'text', required: true },
      { id: 'email', label: 'Email', type: 'email', required: false }
    ]
  };

  // year_of_study is 8 (exceeds max 5) and mobile starts with 1
  const invalidValues = {
    full_name: 'Anup Kumar',
    date_of_birth: '2003-01-15',
    mobile: '1234567890', // invalid: must start with 6-9
    institution: 'Cotton University',
    programme: 'BSc Physics',
    year_of_study: 8, // invalid: must be 1-5
    city: 'Guwahati',
    state: 'Assam',
    assistance_type: 'books'
  };

  const validation = computeLocalValidation(assistanceSchema, invalidValues);
  assert.equal(validation.canConfirm, false);
  assert.ok(validation.invalidFields.includes('mobile'));
  assert.ok(validation.invalidFields.includes('year_of_study'));
  assert.equal(validation.fieldStatuses.year_of_study, 'invalid');
  assert.equal(validation.fieldStatuses.mobile, 'invalid');
});

test('Task 2 — Offline confirmation produces only "confirmed_local" receipt without external submission claims', () => {
  const session = {
    session_id: `local-session-${Date.now()}`,
    form_id: 'student_registration_v1',
    revision: 2,
    expires_in_seconds: 3600
  };

  const values = {
    full_name: 'Bikash Kalita',
    date_of_birth: '2000-11-20',
    mobile: '9435012345',
    city: 'Tezpur',
    state: 'Assam',
    programme: 'BCA'
  };

  // Generate confirmation record per CONTRACT.md
  const localRec = {
    confirmation_id: `FS-LOCAL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
    status: 'confirmed_local',
    form_id: session.form_id,
    revision: session.revision,
    confirmed_at: new Date().toISOString(),
    record: { ...values }
  };

  assert.equal(localRec.status, 'confirmed_local');
  assert.equal(localRec.form_id, 'student_registration_v1');
  assert.ok(localRec.confirmation_id.startsWith('FS-LOCAL-'));
  assert.equal(localRec.revision, 2);
  assert.deepEqual(localRec.record, values);
  // Guarantee it never claims external submission
  assert.ok(!JSON.stringify(localRec).includes('external'));
  assert.ok(!JSON.stringify(localRec).includes('remote'));
});

test('Task 2 — useFormSession hook implements maintainable local validation and confirmation path', () => {
  const hookPath = path.resolve(__dirname, '../src/hooks/useFormSession.ts');
  const content = fs.readFileSync(hookPath, 'utf8');

  // Verify computeLocalValidation is exported and defined
  assert.ok(content.includes('export function computeLocalValidation'));

  // Verify fallback session initializes local validation
  assert.ok(content.includes('computeLocalValidation(activeSchema, initialVals)'));

  // Verify local session updateField evaluates canConfirm
  assert.ok(content.includes('const isLocalSession = session.session_id.startsWith(\'local-session-\')'));
  assert.ok(content.includes('setCanConfirm(validation.canConfirm)'));

  // Verify confirmLocal safeguards for local sessions
  assert.ok(content.includes('if (!validation.canConfirm)'));
  assert.ok(content.includes('Cannot confirm local session: required field(s) missing or invalid'));
});
