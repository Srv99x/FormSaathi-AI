import { FieldType, FormField, FormSchema } from '../types/form';

export const BUILTIN_STUDENT_REGISTRATION: FormSchema = {
  id: 'student_registration_v1',
  title: 'Student Registration Form',
  description: 'National Student Enrolment and Verification Portal — Ministry of Education demo',
  bannerColor: '#1a73e8',
  settings: {
    defaultLocale: 'en-IN',
    enableBargeIn: true,
    requireSpellingVerification: true,
    restrictSingleSubmission: false,
    emailNotification: true,
    confirmationMessage: 'Your student registration record has been verified and registered locally.',
  },
  fields: [
    {
      id: 'full_name',
      label: 'Full Name',
      description: 'Official legal name as per secondary school certificate',
      type: 'text',
      required: true,
      placeholder: 'e.g. Rahul Sharma',
      minLength: 2,
      maxLength: 80,
    },
    {
      id: 'date_of_birth',
      label: 'Date of Birth',
      description: 'Applicant birth date (Age between 12 and 100)',
      type: 'date',
      required: true,
    },
    {
      id: 'mobile',
      label: 'Mobile Number',
      description: '10-digit Indian mobile number starting with 6, 7, 8, or 9',
      type: 'tel',
      required: true,
      placeholder: '9876543210',
      pattern: '^[6-9][0-9]{9}$',
    },
    {
      id: 'email',
      label: 'Email Address',
      description: 'Optional personal or academic contact email',
      type: 'email',
      required: false,
      placeholder: 'name@example.com',
      maxLength: 254,
    },
    {
      id: 'city',
      label: 'City or Town',
      description: 'Current town or district of residence',
      type: 'text',
      required: true,
      placeholder: 'e.g. Guwahati',
      minLength: 2,
      maxLength: 80,
    },
    {
      id: 'state',
      label: 'State or Union Territory',
      description: 'State of domicile',
      type: 'select',
      required: true,
      options: [
        'Assam',
        'Manipur',
        'Meghalaya',
        'Tripura',
        'Arunachal Pradesh',
        'Nagaland',
        'Mizoram',
        'Other Indian State/UT',
      ],
      hasOtherOption: true,
    },
    {
      id: 'programme',
      label: 'Course or Programme',
      description: 'Select your enrolled degree programme',
      type: 'select',
      required: true,
      options: ['BSc Physics', 'BCA', 'BA English', 'Other'],
      hasOtherOption: true,
    },
    {
      id: 'institution',
      label: 'Educational Institution',
      description: 'College, university, or polytechnic campus',
      type: 'text',
      required: false,
      placeholder: 'e.g. Cotton University',
      minLength: 2,
      maxLength: 120,
    },
    {
      id: 'guardian_name',
      label: 'Guardian or Parent Name',
      description: 'Name of parent or legal guardian',
      type: 'text',
      required: false,
      placeholder: 'e.g. Sunita Sharma',
      minLength: 2,
      maxLength: 80,
    },
    {
      id: 'preferred_language',
      label: 'Preferred Correspondence Language',
      description: 'Language for official notices',
      type: 'radio',
      required: false,
      options: ['English', 'Hindi'],
    },
  ],
};

export const BUILTIN_STUDENT_ASSISTANCE: FormSchema = {
  id: 'student_assistance_v1',
  title: 'Student Assistance & Grant Application',
  description: 'Application for educational grant, books, transport subsidy, or fee waiver',
  bannerColor: '#0d9488',
  settings: {
    defaultLocale: 'en-IN',
    enableBargeIn: true,
    requireSpellingVerification: true,
    restrictSingleSubmission: false,
    emailNotification: true,
    confirmationMessage: 'Your assistance application has been received and verified locally.',
  },
  fields: [
    {
      id: 'full_name',
      label: 'Applicant Name',
      description: 'Full name as per college identity card',
      type: 'text',
      required: true,
      placeholder: 'e.g. Priya Devi',
      minLength: 2,
      maxLength: 80,
    },
    {
      id: 'date_of_birth',
      label: 'Date of Birth',
      description: 'Date of birth of the student',
      type: 'date',
      required: true,
    },
    {
      id: 'mobile',
      label: 'Mobile Number',
      description: 'Primary active phone number',
      type: 'tel',
      required: true,
      placeholder: '9876543210',
      pattern: '^[6-9][0-9]{9}$',
    },
    {
      id: 'email',
      label: 'Email',
      description: 'Optional email address',
      type: 'email',
      required: false,
      placeholder: 'student@college.edu.in',
      maxLength: 254,
    },
    {
      id: 'institution',
      label: 'College or Institute',
      description: 'Name of your college/university',
      type: 'text',
      required: true,
      placeholder: 'e.g. Gauhati Commerce College',
      minLength: 2,
      maxLength: 120,
    },
    {
      id: 'programme',
      label: 'Course of Study',
      description: 'Degree or diploma currently pursued',
      type: 'select',
      required: true,
      options: ['BSc Physics', 'BCA', 'BA English', 'Other'],
      hasOtherOption: true,
    },
    {
      id: 'year_of_study',
      label: 'Study Year',
      description: 'Academic year (1 to 5)',
      type: 'integer',
      required: true,
      minimum: 1,
      maximum: 5,
      defaultValue: 1,
    },
    {
      id: 'city',
      label: 'City or District',
      description: 'City where institution or residence is located',
      type: 'text',
      required: true,
      placeholder: 'e.g. Imphal',
      minLength: 2,
      maxLength: 80,
    },
    {
      id: 'state',
      label: 'State',
      description: 'Home state',
      type: 'select',
      required: true,
      options: [
        'Assam',
        'Manipur',
        'Meghalaya',
        'Tripura',
        'Arunachal Pradesh',
        'Nagaland',
        'Mizoram',
        'Other Indian State/UT',
      ],
      hasOtherOption: true,
    },
    {
      id: 'assistance_type',
      label: 'Type of Help Needed',
      description: 'Select the primary assistance requested',
      type: 'radio',
      required: true,
      options: ['books', 'transport', 'fees', 'other'],
    },
    {
      id: 'support_reason',
      label: 'Short Reason for Support',
      description: 'Brief explanation of academic or financial need (max 240 chars)',
      type: 'textarea',
      required: false,
      placeholder: 'Explain why you are requesting this grant...',
      maxLength: 240,
    },
  ],
};

const LOCAL_STORAGE_PREFIX = 'formsaathi_custom_form_';
export const ACTIVE_DRAFT_KEY = 'active_draft';

export function getCustomForm(storageKeyOrId: string): FormSchema | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}${storageKeyOrId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Failed to parse custom form from localStorage', err);
  }
  return null;
}

export function saveCustomForm(form: FormSchema, storageKey?: string): void {
  try {
    const key = storageKey || form.id;
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}${key}`, JSON.stringify(form));
  } catch (err) {
    console.warn('Failed to save custom form to localStorage', err);
  }
}

export function saveDraftForm(form: FormSchema): void {
  saveCustomForm(form, ACTIVE_DRAFT_KEY);
}

export function getDraftForm(): FormSchema | null {
  return getCustomForm(ACTIVE_DRAFT_KEY);
}

/**
 * Resolves a FormSchema by id:
 * 1. Checks builtin student_registration_v1 / student_assistance_v1
 * 2. Checks localStorage custom forms
 * 3. Or maps from backend response
 */
export function resolveFormSchema(formId: string, backendData?: any): FormSchema {
  if (formId === 'student_registration_v1') {
    return BUILTIN_STUDENT_REGISTRATION;
  }
  if (formId === 'student_assistance_v1') {
    return BUILTIN_STUDENT_ASSISTANCE;
  }

  const custom = getCustomForm(formId);
  if (custom) {
    return custom;
  }

  if (backendData && Array.isArray(backendData.fields)) {
    return mapBackendFormToSchema(backendData);
  }

  return {
    ...BUILTIN_STUDENT_REGISTRATION,
    id: formId,
    title: backendData?.title || 'FormSaathi AI Form',
    description: backendData?.description || 'Assisted Form Completion',
  };
}

/**
 * Maps backend GET /api/forms/{id} schema response to FormSchema
 */
export function mapBackendFormToSchema(backendData: any): FormSchema {
  const fields: FormField[] = (backendData.fields || []).map((f: any) => {
    let type: FieldType = 'text';

    if (f.format === 'date') {
      type = 'date';
    } else if (f.format === 'email') {
      type = 'email';
    } else if (f.pattern && f.pattern.includes('6-9')) {
      type = 'tel';
    } else if (f.type === 'integer') {
      type = 'integer';
    } else if (Array.isArray(f.enum)) {
      type = f.enum.length <= 4 ? 'radio' : 'select';
    } else if (f.maxLength && f.maxLength > 150) {
      type = 'textarea';
    }

    const cleanOptions = Array.isArray(f.enum) ? f.enum.filter((o: any) => o !== null) : undefined;

    return {
      id: f.field_id,
      label: f.label || f.title || f.field_id,
      description: f.description,
      type,
      required: Boolean(f.required),
      placeholder: f.placeholder,
      options: cleanOptions,
      hasOtherOption: cleanOptions ? cleanOptions.some((o: string) => o.toLowerCase().includes('other')) : false,
      minLength: f.minLength,
      maxLength: f.maxLength,
      minimum: f.minimum,
      maximum: f.maximum,
      pattern: f.pattern,
    };
  });

  return {
    id: backendData.form_id || 'custom_form',
    title: backendData.title || 'Untitled Form',
    description: backendData.description || '',
    bannerColor: '#1a73e8',
    settings: {
      defaultLocale: 'en-IN',
      enableBargeIn: true,
      requireSpellingVerification: true,
      restrictSingleSubmission: false,
      emailNotification: false,
      confirmationMessage: 'Thank you! Your response has been recorded.',
    },
    fields,
  };
}

export function createBlankForm(id = `form_${Date.now()}`): FormSchema {
  return {
    id,
    title: 'Untitled Form',
    description: 'Enter your form instructions or description here.',
    bannerColor: '#1a73e8',
    settings: {
      defaultLocale: 'en-IN',
      enableBargeIn: true,
      requireSpellingVerification: true,
      restrictSingleSubmission: false,
      emailNotification: false,
      confirmationMessage: 'Your response has been confirmed and saved.',
    },
    fields: [
      {
        id: 'full_name',
        label: 'Full Name',
        type: 'text',
        required: true,
        placeholder: 'e.g. John Doe',
      },
      {
        id: 'email',
        label: 'Email Address',
        type: 'email',
        required: true,
        placeholder: 'name@example.com',
      },
      {
        id: 'mobile',
        label: 'Contact Number',
        type: 'tel',
        required: true,
        placeholder: '9876543210',
      },
    ],
  };
}



/**
 * Converts frontend FormSchema into standard JSON Schema object conforming to
 * backend registry.py validate_custom_schema
 */
export function formSchemaToJsonSchema(form: FormSchema): Record<string, any> {
  const properties: Record<string, any> = {};
  const required: string[] = [];

  form.fields.forEach((field) => {
    const fieldId = field.id.replace(/[^A-Za-z0-9_]/g, '_');
    const prop: Record<string, any> = {
      title: field.label || fieldId,
    };

    switch (field.type) {
      case 'integer':
        prop.type = 'integer';
        if (field.minimum !== undefined) prop.minimum = field.minimum;
        if (field.maximum !== undefined) prop.maximum = field.maximum;
        break;
      case 'date':
        prop.type = 'string';
        prop.format = 'date';
        break;
      case 'email':
        prop.type = ['string', 'null'];
        prop.format = 'email';
        if (field.maxLength) prop.maxLength = field.maxLength;
        break;
      case 'tel':
        prop.type = 'string';
        prop.pattern = '^[6-9][0-9]{9}$';
        break;
      case 'select':
      case 'radio':
        prop.type = 'string';
        if (field.options && field.options.length > 0) {
          prop.enum = [...field.options];
          if (field.hasOtherOption && !prop.enum.some((o: string) => o.toLowerCase() === 'other')) {
            prop.enum.push('Other');
          }
        }
        break;
      case 'textarea':
        prop.type = 'string';
        prop.maxLength = field.maxLength || 250;
        break;
      default:
        prop.type = 'string';
        if (field.minLength) prop.minLength = field.minLength;
        if (field.maxLength) prop.maxLength = field.maxLength;
        break;
    }

    properties[fieldId] = prop;
    if (field.required) {
      required.push(fieldId);
    }
  });

  return {
    $id: form.id.replace(/[^A-Za-z0-9_\-\.]/g, '_'),
    title: form.title || 'Untitled Form',
    description: form.description || '',
    type: 'object',
    additionalProperties: false,
    properties,
    required,
  };
}
