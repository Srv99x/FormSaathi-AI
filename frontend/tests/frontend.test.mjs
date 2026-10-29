import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test('Form schemas: student_registration_v1 matches CONTRACT.md', () => {
  const schemaPath = path.resolve(__dirname, '../../backend/app/schemas/forms/student_registration_v1.json');
  const raw = fs.readFileSync(schemaPath, 'utf8');
  const schema = JSON.parse(raw);

  assert.equal(schema.$id, 'student_registration_v1');
  assert.equal(schema.title, 'Student Registration');

  const requiredFields = schema.required;
  assert.deepEqual(requiredFields, [
    'full_name',
    'date_of_birth',
    'mobile',
    'city',
    'state',
    'programme',
  ]);

  const props = Object.keys(schema.properties);
  assert.ok(props.includes('guardian_name'));
  assert.ok(props.includes('preferred_language'));
  assert.ok(props.includes('institution'));
  assert.ok(props.includes('email'));
});

test('Form schemas: student_assistance_v1 matches CONTRACT.md', () => {
  const schemaPath = path.resolve(__dirname, '../../backend/app/schemas/forms/student_assistance_v1.json');
  const raw = fs.readFileSync(schemaPath, 'utf8');
  const schema = JSON.parse(raw);

  assert.equal(schema.$id, 'student_assistance_v1');
  assert.equal(schema.title, 'Student Assistance Request');

  const requiredFields = schema.required;
  assert.deepEqual(requiredFields, [
    'full_name',
    'date_of_birth',
    'mobile',
    'institution',
    'programme',
    'year_of_study',
    'city',
    'state',
    'assistance_type',
  ]);

  const props = schema.properties;
  assert.equal(props.year_of_study.type, 'integer');
  assert.equal(props.year_of_study.minimum, 1);
  assert.equal(props.year_of_study.maximum, 5);
  assert.deepEqual(props.assistance_type.enum, ['books', 'transport', 'fees', 'other']);
});

test('State & Programme options match CONTRACT.md exactly', () => {
  const schemaPath = path.resolve(__dirname, '../../backend/app/schemas/forms/student_registration_v1.json');
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));

  const expectedStates = [
    'Assam',
    'Manipur',
    'Meghalaya',
    'Tripura',
    'Arunachal Pradesh',
    'Nagaland',
    'Mizoram',
    'Other Indian State/UT',
  ];
  assert.deepEqual(schema.properties.state.enum, expectedStates);

  const expectedProgrammes = ['BSc Physics', 'BCA', 'BA English', 'Other'];
  assert.deepEqual(schema.properties.programme.enum, expectedProgrammes);
});

test('Frontend UI copy and Field IDs match backend properties', async () => {
  const uiCopyPath = path.resolve(__dirname, '../src/data/uiCopy.ts');
  const content = fs.readFileSync(uiCopyPath, 'utf8');

  // Verify field constants are defined
  assert.ok(content.includes('full_name: "full_name"'));
  assert.ok(content.includes('date_of_birth: "date_of_birth"'));
  assert.ok(content.includes('mobile: "mobile"'));
  assert.ok(content.includes('year_of_study: "year_of_study"'));
  assert.ok(content.includes('assistance_type: "assistance_type"'));
});

test('API client contract conformance: PATCH uses strict source: "manual"', () => {
  const apiPath = path.resolve(__dirname, '../src/services/api.ts');
  const apiContent = fs.readFileSync(apiPath, 'utf8');

  // Must ensure source is 'manual' per backend ManualChange model
  assert.ok(apiContent.includes("source: 'manual' = 'manual'"));
  assert.ok(apiContent.includes("body: JSON.stringify({ field_id: fieldId, value, source })"));
});

test('ConfirmSession payload conformance: reviewed=true and revision integer', () => {
  const apiPath = path.resolve(__dirname, '../src/services/api.ts');
  const apiContent = fs.readFileSync(apiPath, 'utf8');

  assert.ok(apiContent.includes("body: JSON.stringify({ reviewed: true, revision })"));
});
