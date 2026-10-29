import React, { useState } from 'react';
import { SpellCheck, Check, Edit2 } from 'lucide-react';
import { Button } from '../common/Button';
import { Modal } from '../common/Modal';

export interface NameSpellingModalProps {
  isOpen: boolean;
  candidateName: string;
  spellingHint?: string; // e.g. "R-A-H-U-L S-H-A-R-M-A"
  onConfirm: (finalName: string) => void;
  onClose: () => void;
}

export const NameSpellingModal: React.FC<NameSpellingModalProps> = ({
  isOpen,
  candidateName,
  spellingHint,
  onConfirm,
  onClose,
}) => {
  const [editedName, setEditedName] = useState(candidateName);
  const [isEditing, setIsEditing] = useState(false);

  // Compute character tiles for phonetic display
  const words = (editedName || candidateName).trim().split(/\s+/);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Verify Name Spelling" maxWidth="sm">
      <div className="fs-spelling-modal-content">
        <div className="fs-spelling-icon-badge">
          <SpellCheck size={28} className="fs-spelling-svg" />
        </div>

        <p className="fs-spelling-prompt">
          I heard your name as <strong>"{editedName || candidateName}"</strong>. Please verify the
          exact character spelling before we record it:
        </p>

        {/* Phonetic letter tiles */}
        <div className="fs-phonetic-tiles-container" aria-label="Phonetic letter tiles">
          {words.map((word, wIdx) => (
            <div key={wIdx} className="fs-phonetic-word-row">
              {word.split('').map((char, cIdx) => (
                <span key={cIdx} className="fs-phonetic-letter-tile">
                  {char.toUpperCase()}
                </span>
              ))}
            </div>
          ))}
        </div>

        {spellingHint && (
          <div className="fs-spelling-hint-text">
            Pronounced: <code>{spellingHint}</code>
          </div>
        )}

        {isEditing ? (
          <div className="fs-spelling-edit-box">
            <label className="fs-input-label" htmlFor="corrected-name">
              Correct Spelling Inline:
            </label>
            <input
              id="corrected-name"
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className="fs-input-field"
              autoFocus
            />
          </div>
        ) : (
          <button
            type="button"
            className="fs-text-action-link"
            onClick={() => setIsEditing(true)}
          >
            <Edit2 size={13} />
            <span>Spelling looks different? Click to edit characters</span>
          </button>
        )}

        <div className="fs-spelling-actions">
          <Button
            variant="primary"
            icon={<Check size={16} />}
            onClick={() => onConfirm(editedName || candidateName)}
          >
            Yes, Confirm Spelling
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Modal>
  );
};

