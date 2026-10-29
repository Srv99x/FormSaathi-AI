import React from 'react';
import { Mic, Bell, Check } from 'lucide-react';
import { FormSettings } from '../../types/form';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

export interface FormSettingsModalProps {
  isOpen: boolean;
  settings: FormSettings;
  onClose: () => void;
  onSave: (newSettings: FormSettings) => void;
}

export const FormSettingsModal: React.FC<FormSettingsModalProps> = ({
  isOpen,
  settings,
  onClose,
  onSave,
}) => {
  const [localSettings, setLocalSettings] = React.useState<FormSettings>(settings);

  React.useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = () => {
    onSave(localSettings);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Form & Voice Agent Settings" maxWidth="md">
      <div className="fs-settings-modal-body">
        {/* Section 1: Voice Assistant Configuration */}
        <div className="fs-settings-section">
          <div className="fs-section-header">
            <Mic size={18} className="fs-section-icon" />
            <h4>Real-time Voice Assistant Settings</h4>
          </div>

          <div className="fs-setting-item">
            <div className="fs-setting-info">
              <label htmlFor="settings-locale" className="fs-setting-title">
                Default Voice Locale
              </label>
              <p className="fs-setting-desc">
                Primary conversational dialect spoken by FormSaathi when call begins.
              </p>
            </div>
            <select
              id="settings-locale"
              className="fs-select-field"
              style={{ width: '160px' }}
              value={localSettings.defaultLocale}
              onChange={(e) =>
                setLocalSettings({
                  ...localSettings,
                  defaultLocale: e.target.value as 'en-IN' | 'hi-IN',
                })
              }
            >
              <option value="en-IN">English (India)</option>
              <option value="hi-IN">हिन्दी (Hindi)</option>
            </select>
          </div>

          <div className="fs-setting-item">
            <div className="fs-setting-info">
              <span className="fs-setting-title">Sub-100ms Voice Barge-in</span>
              <p className="fs-setting-desc">
                Allow user to interrupt assistant speech anytime by speaking or clicking interrupt.
              </p>
            </div>
            <label className="fs-toggle-label">
              <input
                type="checkbox"
                className="fs-toggle-checkbox"
                checked={localSettings.enableBargeIn}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, enableBargeIn: e.target.checked })
                }
              />
              <span className="fs-toggle-slider" />
            </label>
          </div>

          <div className="fs-setting-item">
            <div className="fs-setting-info">
              <span className="fs-setting-title">Phonetic Spelling Verification</span>
              <p className="fs-setting-desc">
                Present letter-by-letter confirmation modal (R-A-H-U-L) when name candidate is extracted.
              </p>
            </div>
            <label className="fs-toggle-label">
              <input
                type="checkbox"
                className="fs-toggle-checkbox"
                checked={localSettings.requireSpellingVerification}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    requireSpellingVerification: e.target.checked,
                  })
                }
              />
              <span className="fs-toggle-slider" />
            </label>
          </div>
        </div>

        {/* Section 2: Submission & Notifications */}
        <div className="fs-settings-section">
          <div className="fs-section-header">
            <Bell size={18} className="fs-section-icon" />
            <h4>Submission Rules</h4>
          </div>

          <div className="fs-setting-item">
            <div className="fs-setting-info">
              <span className="fs-setting-title">Email Notification on Completion</span>
              <p className="fs-setting-desc">
                Send submission summary to form creator when respondent confirms.
              </p>
            </div>
            <label className="fs-toggle-label">
              <input
                type="checkbox"
                className="fs-toggle-checkbox"
                checked={localSettings.emailNotification}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    emailNotification: e.target.checked,
                  })
                }
              />
              <span className="fs-toggle-slider" />
            </label>
          </div>

          <div className="fs-setting-field-group">
            <label htmlFor="settings-conf-msg" className="fs-input-label">
              Confirmation Message:
            </label>
            <input
              id="settings-conf-msg"
              type="text"
              className="fs-input-field"
              value={localSettings.confirmationMessage}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, confirmationMessage: e.target.value })
              }
              placeholder="Your response has been confirmed and saved."
            />
          </div>
        </div>

        <div className="fs-settings-footer">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" icon={<Check size={16} />} onClick={handleSave}>
            Save Changes
          </Button>
        </div>
      </div>
    </Modal>
  );
};
