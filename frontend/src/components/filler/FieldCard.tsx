import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { FormField } from '../../types/form';
import { FieldValidationStatus } from '../../types/session';
import { Input } from '../common/Input';
import { Select } from '../common/Select';

export interface FieldCardProps {
  field: FormField;
  index: number;
  value: string | number | null | undefined;
  status?: FieldValidationStatus;
  errorMessage?: string;
  isPulsing?: boolean;
  onChange: (value: string | number | null) => void;
}

export const FieldCard: React.FC<FieldCardProps> = ({
  field,
  index,
  value,
  status = 'empty',
  errorMessage,
  isPulsing = false,
  onChange,
}) => {
  const isFilled = value !== undefined && value !== null && String(value).trim() !== '';

  const getStatusBadge = () => {
    if (status === 'valid' && isFilled) {
      return (
        <span className="fs-badge fs-badge-success">
          <CheckCircle2 size={13} />
          <span>Confirmed</span>
        </span>
      );
    }
    if (status === 'needs_review' || status === 'conflict') {
      return (
        <span className="fs-badge fs-badge-warning">
          <AlertTriangle size={13} />
          <span>Needs Review</span>
        </span>
      );
    }
    if (status === 'invalid' || errorMessage) {
      return (
        <span className="fs-badge fs-badge-danger">
          <AlertCircle size={13} />
          <span>Check Format</span>
        </span>
      );
    }
    return null;
  };

  const renderInput = () => {
    switch (field.type) {
      case 'textarea':
        return (
          <Input
            as="textarea"
            id={`field_${field.id}`}
            value={value !== null && value !== undefined ? String(value) : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || 'Type your response here...'}
            isPulsing={isPulsing}
            error={errorMessage}
            maxLength={field.maxLength}
          />
        );

      case 'select':
      case 'radio':
      case 'multiselect':
        return (
          <Select
            id={`field_${field.id}`}
            options={field.options || []}
            value={value !== null && value !== undefined ? (value as any) : ''}
            onChange={(val) => onChange(Array.isArray(val) ? val.join(', ') : val)}
            variant={field.type}
            hasOtherOption={field.hasOtherOption}
            isPulsing={isPulsing}
            error={errorMessage}
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            id={`field_${field.id}`}
            value={value !== null && value !== undefined ? String(value) : ''}
            onChange={(e) => onChange(e.target.value)}
            isPulsing={isPulsing}
            error={errorMessage}
          />
        );

      case 'integer':
        return (
          <Input
            type="number"
            id={`field_${field.id}`}
            value={value !== null && value !== undefined ? Number(value) : ''}
            onChange={(e) => onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))}
            min={field.minimum}
            max={field.maximum}
            placeholder={field.placeholder || 'Enter a number'}
            isPulsing={isPulsing}
            error={errorMessage}
          />
        );

      case 'tel':
        return (
          <Input
            type="tel"
            id={`field_${field.id}`}
            value={value !== null && value !== undefined ? String(value) : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || '10-digit mobile number'}
            maxLength={10}
            pattern={field.pattern}
            isPulsing={isPulsing}
            error={errorMessage}
          />
        );

      case 'email':
        return (
          <Input
            type="email"
            id={`field_${field.id}`}
            value={value !== null && value !== undefined ? String(value) : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || 'name@example.com'}
            maxLength={field.maxLength || 254}
            isPulsing={isPulsing}
            error={errorMessage}
          />
        );

      case 'text':
      default:
        return (
          <Input
            type="text"
            id={`field_${field.id}`}
            value={value !== null && value !== undefined ? String(value) : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder || 'Your answer'}
            maxLength={field.maxLength}
            minLength={field.minLength}
            isPulsing={isPulsing}
            error={errorMessage}
          />
        );
    }
  };

  return (
    <div
      className={`fs-card fs-field-card ${isPulsing ? 'is-pulse-border' : ''} ${
        status === 'valid' && isFilled ? 'is-field-valid' : ''
      }`}
      id={`card_${field.id}`}
    >
      <div className="fs-field-header">
        <div className="fs-field-title-wrap">
          <span className="fs-field-number">{index + 1}.</span>
          <h3 className="fs-field-label">
            {field.label}
            {field.required && <span className="fs-req-star"> *</span>}
          </h3>
        </div>
        {getStatusBadge()}
      </div>

      {field.description && (
        <p className="fs-field-desc">{field.description}</p>
      )}

      <div className="fs-field-input-container">{renderInput()}</div>
    </div>
  );
};
