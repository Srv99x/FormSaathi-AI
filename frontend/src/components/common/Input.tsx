import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> {
  as?: 'input' | 'textarea';
  label?: string;
  helperText?: string;
  error?: string;
  isPulsing?: boolean; // Green flash when auto-filled by Voice Assistant
  statusBadge?: string;
}

export const Input = React.forwardRef<HTMLInputElement & HTMLTextAreaElement, InputProps>(
  (
    {
      as = 'input',
      label,
      helperText,
      error,
      isPulsing = false,
      statusBadge,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '_') : undefined);

    const inputClasses = [
      'fs-input-field',
      as === 'textarea' ? 'fs-textarea' : '',
      error ? 'has-error' : '',
      isPulsing ? 'is-pulse-green' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={`fs-input-group ${error ? 'has-error-group' : ''}`}>
        {(label || statusBadge) && (
          <div className="fs-input-label-row">
            {label && (
              <label htmlFor={inputId} className="fs-input-label">
                {label}
                {props.required && <span className="fs-req-star"> *</span>}
              </label>
            )}
            {statusBadge && <span className="fs-status-tag">{statusBadge}</span>}
          </div>
        )}

        {as === 'textarea' ? (
          <textarea
            id={inputId}
            ref={ref as any}
            className={inputClasses}
            rows={3}
            {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <input
            id={inputId}
            ref={ref as any}
            className={inputClasses}
            {...(props as React.InputHTMLAttributes<HTMLInputElement>)}
          />
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
  }
);

Input.displayName = 'Input';

