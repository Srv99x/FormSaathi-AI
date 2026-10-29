/**
 * Types defining Form definitions, field types, and form builder configurations.
 */

export type FieldType =
  | 'text'        // Short answer
  | 'textarea'    // Paragraph
  | 'select'      // Dropdown
  | 'radio'       // Multiple Choice
  | 'multiselect' // Checkboxes
  | 'date'        // Date picker
  | 'integer'     // Number
  | 'tel'         // Phone / Mobile number
  | 'email';      // Email address

export interface FormField {
  id: string;
  label: string;
  description?: string;
  type: FieldType;
  required: boolean;
  placeholder?: string;
  options?: string[]; // for select, radio, multiselect
  hasOtherOption?: boolean; // includes "Other" choice
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  defaultValue?: string | number | null;
}

export interface FormSettings {
  defaultLocale: 'en-IN' | 'hi-IN';
  enableBargeIn: boolean;
  requireSpellingVerification: boolean;
  restrictSingleSubmission: boolean;
  emailNotification: boolean;
  confirmationMessage: string;
}

export interface FormSchema {
  id: string;
  title: string;
  description: string;
  bannerColor?: string;
  fields: FormField[];
  settings: FormSettings;
  createdAt?: string;
  updatedAt?: string;
}

export interface FormCatalogItem {
  id: string;
  title: string;
  description: string;
}

