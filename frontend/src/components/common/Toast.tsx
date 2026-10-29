import React, { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export interface ToastProps {
  type?: 'success' | 'warning' | 'error' | 'info';
  message: string;
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  type = 'info',
  message,
  onClose,
  duration = 4000,
}) => {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle2 size={18} className="fs-toast-icon success" />,
    warning: <AlertTriangle size={18} className="fs-toast-icon warning" />,
    error: <AlertCircle size={18} className="fs-toast-icon error" />,
    info: <Info size={18} className="fs-toast-icon info" />,
  };

  return (
    <div className={`fs-toast-container fs-toast-${type}`} role="status">
      <div className="fs-toast-content">
        {icons[type]}
        <span className="fs-toast-msg">{message}</span>
      </div>
      <button
        type="button"
        className="fs-toast-close"
        onClick={onClose}
        aria-label="Dismiss message"
      >
        <X size={16} />
      </button>
    </div>
  );
};

