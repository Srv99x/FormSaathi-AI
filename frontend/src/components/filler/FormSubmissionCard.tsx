import React from 'react';
import { AlertTriangle, Send } from 'lucide-react';
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
  missingRequiredCount,
  canConfirm,
  isConfirming,
  confirmError,
  onConfirm,
}) => {
  const isAllRequiredDone = missingRequiredCount === 0;

  return (
    <div className="fs-simple-submit-container">
      {confirmError && (
        <div className="fs-submission-error-alert" role="alert">
          <AlertTriangle size={18} />
          <span>{confirmError}</span>
        </div>
      )}

      <div className="fs-simple-submit-row">
        <Button
          type="button"
          variant="primary"
          size="lg"
          icon={<Send size={16} />}
          disabled={!isAllRequiredDone || isConfirming || !canConfirm}
          loading={isConfirming}
          onClick={onConfirm}
          className="fs-simple-submit-btn"
        >
          Submit
        </Button>
        {!isAllRequiredDone && (
          <span className="fs-simple-submit-hint">
            Please fill all required fields (*) to submit
          </span>
        )}
      </div>
    </div>
  );
};
