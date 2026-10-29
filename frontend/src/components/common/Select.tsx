import React, { useState } from 'react';

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps {
  id?: string;
  label?: string;
  required?: boolean;
  options: (string | SelectOption)[];
  value?: string | string[] | null;
  onChange: (value: string | string[]) => void;
  variant?: 'select' | 'radio' | 'multiselect';
  helperText?: string;
  error?: string;
  hasOtherOption?: boolean;
  isPulsing?: boolean;
}

export const Select: React.FC<SelectProps> = ({
  id,
  label,
  required,
  options,
  value,
  onChange,
  variant = 'select',
  helperText,
  error,
  hasOtherOption = false,
  isPulsing = false,
}) => {
  const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '_') : 'select-field');
  const [otherText, setOtherText] = useState('');

  const normalizedOptions: SelectOption[] = options.map((opt) =>
    typeof opt === 'string' ? { label: opt, value: opt } : opt
  );

  // If hasOtherOption is requested and "Other" is not already in options, add it
  if (
    hasOtherOption &&
    !normalizedOptions.some((o) => o.value.toLowerCase() === 'other')
  ) {
    normalizedOptions.push({ label: 'Other', value: 'Other' });
  }

  const currentValue = typeof value === 'string' ? value : '';
  const isOtherSelected =
    currentValue === 'Other' ||
    (currentValue !== '' && !normalizedOptions.some((o) => o.value === currentValue));

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onChange(val);
  };

  const handleRadioChange = (val: string) => {
    onChange(val);
  };

  const handleCheckboxToggle = (val: string) => {
    const arr = Array.isArray(value) ? [...value] : [];
    const idx = arr.indexOf(val);
    if (idx > -1) {
      arr.splice(idx, 1);
    } else {
      arr.push(val);
    }
    onChange(arr);
  };

  const handleOtherTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const txt = e.target.value;
    setOtherText(txt);
    onChange(txt || 'Other');
  };

  return (
    <div className={`fs-select-group ${error ? 'has-error-group' : ''}`}>
      {label && (
        <label className="fs-input-label" htmlFor={variant === 'select' ? selectId : undefined}>
          {label}
          {required && <span className="fs-req-star"> *</span>}
        </label>
      )}

      {variant === 'select' && (
        <div className="fs-select-wrapper">
          <select
            id={selectId}
            value={currentValue}
            onChange={handleSelectChange}
            className={`fs-select-field ${isPulsing ? 'is-pulse-green' : ''} ${error ? 'has-error' : ''}`}
            required={required}
          >
            <option value="">-- Choose an option --</option>
            {normalizedOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {variant === 'radio' && (
        <div className={`fs-options-container ${isPulsing ? 'is-pulse-green' : ''}`}>
          {normalizedOptions.map((opt) => {
            const isChecked = currentValue === opt.value;
            return (
              <label key={opt.value} className={`fs-option-row ${isChecked ? 'is-checked' : ''}`}>
                <input
                  type="radio"
                  name={selectId}
                  value={opt.value}
                  checked={isChecked}
                  onChange={() => handleRadioChange(opt.value)}
                  className="fs-radio-input"
                />
                <span className="fs-option-label">{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}

      {variant === 'multiselect' && (
        <div className={`fs-options-container ${isPulsing ? 'is-pulse-green' : ''}`}>
          {normalizedOptions.map((opt) => {
            const isChecked = Array.isArray(value) && value.includes(opt.value);
            return (
              <label key={opt.value} className={`fs-option-row ${isChecked ? 'is-checked' : ''}`}>
                <input
                  type="checkbox"
                  name={selectId}
                  value={opt.value}
                  checked={isChecked}
                  onChange={() => handleCheckboxToggle(opt.value)}
                  className="fs-checkbox-input"
                />
                <span className="fs-option-label">{opt.label}</span>
              </label>
            );
          })}
        </div>
      )}

      {/* If "Other" is chosen, reveal custom text input */}
      {isOtherSelected && (
        <div className="fs-other-input-wrap">
          <input
            type="text"
            placeholder="Please specify other..."
            value={otherText || (currentValue !== 'Other' ? currentValue : '')}
            onChange={handleOtherTextChange}
            className="fs-input-field fs-other-field"
          />
        </div>
      )}

      {error ? (
        <p className="fs-input-error" role="alert">
          {error}
        </p>
      ) : helperText ? (
        <p className="fs-input-helper">{helperText}</p>
      ) : null}
    </div>
  );
};

