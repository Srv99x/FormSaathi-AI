import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'voice';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      className={`fs-btn fs-btn-${variant} fs-btn-${size} ${loading ? 'is-loading' : ''} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="fs-btn-spinner" aria-hidden="true" />
      ) : (
        icon && <span className="fs-btn-icon">{icon}</span>
      )}
      <span className="fs-btn-label">{children}</span>
    </button>
  );
};

