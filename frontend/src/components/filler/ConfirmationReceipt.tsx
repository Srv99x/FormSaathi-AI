import React from 'react';
import { CheckCircle, Printer, RotateCcw, ShieldCheck } from 'lucide-react';
import { ConfirmationRecord } from '../../types/session';
import { Button } from '../common/Button';

export interface ConfirmationReceiptProps {
  confirmation: ConfirmationRecord;
  formTitle: string;
  onReset: () => void;
}

export const ConfirmationReceipt: React.FC<ConfirmationReceiptProps> = ({
  confirmation,
  formTitle,
  onReset,
}) => {
  const handlePrint = () => {
    window.print();
  };

  const formattedDate = new Date(confirmation.confirmed_at).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });

  return (
    <div className="fs-receipt-card fs-card" id="printable-receipt">
      <div className="fs-receipt-header">
        <div className="fs-receipt-icon-wrap">
          <CheckCircle size={36} className="fs-receipt-check" />
        </div>
        <h2 className="fs-receipt-heading">Form Confirmed Locally</h2>
        <p className="fs-receipt-subheading">
          Your response for <strong>{formTitle}</strong> has been successfully verified and saved
          in this active session.
        </p>

        <div className="fs-receipt-meta-grid">
          <div className="fs-receipt-meta-item">
            <span className="fs-meta-label">Confirmation ID</span>
            <code className="fs-meta-code">{confirmation.confirmation_id}</code>
          </div>
          <div className="fs-receipt-meta-item">
            <span className="fs-meta-label">Status</span>
            <span className="fs-status-confirmed">
              <ShieldCheck size={14} />
              confirmed_local
            </span>
          </div>
          <div className="fs-receipt-meta-item">
            <span className="fs-meta-label">Timestamp</span>
            <span className="fs-meta-val">{formattedDate}</span>
          </div>
          <div className="fs-receipt-meta-item">
            <span className="fs-meta-label">Revision</span>
            <span className="fs-meta-val">Rev #{confirmation.revision}</span>
          </div>
        </div>
      </div>

      <div className="fs-receipt-body">
        <h3 className="fs-receipt-table-title">Confirmed Record Summary</h3>
        <div className="fs-receipt-table-wrap">
          <table className="fs-receipt-table">
            <thead>
              <tr>
                <th>Field Name</th>
                <th>Recorded Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(confirmation.record).map(([key, val]) => (
                <tr key={key}>
                  <td className="fs-key-cell">{key.replace(/_/g, ' ')}</td>
                  <td className="fs-val-cell">
                    {val !== null && val !== undefined && String(val) !== '' ? (
                      String(val)
                    ) : (
                      <span className="fs-val-empty">— Not provided —</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="fs-receipt-footer no-print">
        <Button variant="secondary" icon={<Printer size={16} />} onClick={handlePrint}>
          Print Slip
        </Button>
        <Button variant="primary" icon={<RotateCcw size={16} />} onClick={onReset}>
          Fill Another Response
        </Button>
      </div>
    </div>
  );
};
