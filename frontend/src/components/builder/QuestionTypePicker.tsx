import React from 'react';
import {
  AlignLeft,
  AlignJustify,
  ChevronDown,
  CheckCircle2,
  CheckSquare,
  Calendar,
  Hash,
  Phone,
  Mail,
} from 'lucide-react';
import { FieldType } from '../../types/form';

export interface QuestionTypePickerProps {
  value: FieldType;
  onChange: (type: FieldType) => void;
}

const TYPE_CONFIG: Record<
  FieldType,
  { label: string; icon: React.ReactNode; description: string }
> = {
  text: {
    label: 'Short answer',
    icon: <AlignLeft size={16} />,
    description: 'Single-line text',
  },
  textarea: {
    label: 'Paragraph',
    icon: <AlignJustify size={16} />,
    description: 'Multi-line text',
  },
  select: {
    label: 'Dropdown',
    icon: <ChevronDown size={16} />,
    description: 'Menu list',
  },
  radio: {
    label: 'Multiple choice',
    icon: <CheckCircle2 size={16} />,
    description: 'Single choice',
  },
  multiselect: {
    label: 'Checkboxes',
    icon: <CheckSquare size={16} />,
    description: 'Multi-selection',
  },
  date: {
    label: 'Date',
    icon: <Calendar size={16} />,
    description: 'Date selector',
  },
  integer: {
    label: 'Number',
    icon: <Hash size={16} />,
    description: 'Numeric integer',
  },
  tel: {
    label: 'Phone number',
    icon: <Phone size={16} />,
    description: '10-digit mobile',
  },
  email: {
    label: 'Email address',
    icon: <Mail size={16} />,
    description: 'Email format',
  },
};

export const QuestionTypePicker: React.FC<QuestionTypePickerProps> = ({
  value,
  onChange,
}) => {
  return (
    <div className="fs-type-picker-wrapper">
      <div className="fs-type-picker-icon">
        {TYPE_CONFIG[value]?.icon || <AlignLeft size={16} />}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as FieldType)}
        className="fs-type-picker-select"
        aria-label="Select Question Type"
      >
        {Object.entries(TYPE_CONFIG).map(([type, cfg]) => (
          <option key={type} value={type}>
            {cfg.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="fs-type-picker-arrow" />
    </div>
  );
};

