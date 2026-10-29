import React from 'react';
import { CheckCircle2, FastForward, AlertTriangle } from 'lucide-react';
import { Button } from '../common/Button';

export interface FormSubmissionCardProps {
  totalRequired: number;
  completedRequired: number;
  missingRequiredCount: number;
  canConfirm: boolean;
  isConfirming: boolean;
  confirmError?: string | null;
  onConfirm: () => void;
  onSkipOptional?: () => void;
  hasOptionalRemaining?: boolean;
}

export const FormSubmissionCard: React.FC<FormSubmissionCardProps> = ({
  totalRequired,
  completedRequired,
  missingRequiredCount,
  canConfirm,
  isConfirming,
  confirmError,
  onConfirm,
  onSkipOptional,
  hasOptionalRemaining = false,
}) => {
  const isAllRequiredDone = missingRequiredCount === 0;

  return (
    <div className="fs-card fs-submission-card">
      <div className="fs-submission-header">
        <div className="fs-submission-title-group">
          <h3 className="fs-submission-title">Pre-Submission Verification</h3>
          <p className="fs-submission-subtitle">
            {isAllRequiredDone
              ? 'All required fields are successfully filled and ready for local confirmation.'
              : `Please fill the remaining ${missingRequiredCount} required field(s) before confirming.`}
          </p>
        </div>

        <div className="fs-req-counter-pill">
          <span className="fs-counter-num">
            {completedRequired} / {totalRequired}
          </span>
          <span className="fs-counter-label">Required Fields</span>
        </div>
      </div>

      {confirmError && (
        <div className="fs-submission-error-alert" role="alert">
          <AlertTriangle size={18} />
          <span>{confirmError}</span>
        </div>
      )}

      <div className="fs-submission-actions">
        {hasOptionalRemaining && isAllRequiredDone && onSkipOptional && (
          <Button
            type="button"
            variant="outline"
            icon={<FastForward size={16} />}
            onClick={onSkipOptional}
            title="Bypass optional fields and submit now"
          >
            Skip Optional & Finalize
          </Button>
        )}

        <Button
          type="button"
          variant="primary"
          size="lg"
          icon={<CheckCircle2 size={18} />}
          disabled={!isAllRequiredDone || isConfirming || !canConfirm}
          loading={isConfirming}
          onClick={onConfirm}
        >
          Review & Confirm Form
        </Button>
      </div>

      <p className="fs-submission-notice">
        Notice: Confirmation generates a verified local receipt for this demo session. FormSaathi
        does not submit private data to third-party endpoints.
      </p>
    </div>
  );
};
