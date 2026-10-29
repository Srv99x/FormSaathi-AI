import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'md',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fs-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className={`fs-modal-dialog fs-modal-${maxWidth}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="fs-modal-header">
          {title ? <h3 className="fs-modal-title">{title}</h3> : <div />}
          <button
            type="button"
            className="fs-modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>
        <div className="fs-modal-body">{children}</div>
      </div>
    </div>
  );
};

