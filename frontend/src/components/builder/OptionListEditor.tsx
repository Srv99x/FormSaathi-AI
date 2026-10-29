import React from 'react';
import { X, Plus, Circle, Square } from 'lucide-react';
import { FieldType } from '../../types/form';

export interface OptionListEditorProps {
  type: FieldType;
  options: string[];
  hasOtherOption?: boolean;
  onOptionsChange: (options: string[]) => void;
  onToggleOtherOption: (enabled: boolean) => void;
}

export const OptionListEditor: React.FC<OptionListEditorProps> = ({
  type,
  options,
  hasOtherOption = false,
  onOptionsChange,
  onToggleOtherOption,
}) => {
  const handleOptionChange = (idx: number, newVal: string) => {
    const next = [...options];
    next[idx] = newVal;
    onOptionsChange(next);
  };

  const handleAddOption = () => {
    onOptionsChange([...options, `Option ${options.length + 1}`]);
  };

  const handleRemoveOption = (idx: number) => {
    if (options.length <= 1) return;
    const next = options.filter((_, i) => i !== idx);
    onOptionsChange(next);
  };

  const getPrefixIcon = (idx: number) => {
    if (type === 'radio') {
      return <Circle size={16} className="fs-opt-prefix-icon" />;
    }
    if (type === 'multiselect') {
      return <Square size={16} className="fs-opt-prefix-icon" />;
    }
    return <span className="fs-opt-prefix-num">{idx + 1}.</span>;
  };

  return (
    <div className="fs-option-list-editor">
      {options.map((opt, idx) => (
        <div key={idx} className="fs-option-editor-row">
          <div className="fs-opt-prefix">{getPrefixIcon(idx)}</div>

          <input
            type="text"
            className="fs-opt-input"
            value={opt}
            onChange={(e) => handleOptionChange(idx, e.target.value)}
            placeholder={`Option ${idx + 1}`}
          />

          {options.length > 1 && (
            <button
              type="button"
              className="fs-opt-remove-btn"
              onClick={() => handleRemoveOption(idx)}
              title="Remove option"
              aria-label="Remove option"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ))}

      {/* If "Other" option is active */}
      {hasOtherOption && (
        <div className="fs-option-editor-row fs-other-editor-row">
          <div className="fs-opt-prefix">{getPrefixIcon(options.length)}</div>
          <span className="fs-other-label">Other...</span>
          <button
            type="button"
            className="fs-opt-remove-btn"
            onClick={() => onToggleOtherOption(false)}
            title="Remove 'Other' option"
            aria-label="Remove 'Other' option"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Bottom controls: Add Option & Add "Other" */}
      <div className="fs-option-editor-actions">
        <button
          type="button"
          className="fs-add-opt-btn"
          onClick={handleAddOption}
        >
          <Plus size={14} />
          <span>Add option</span>
        </button>

        {!hasOtherOption && (
          <>
            <span className="fs-opt-action-sep">or</span>
            <button
              type="button"
              className="fs-add-other-btn"
              onClick={() => onToggleOtherOption(true)}
            >
              Add "Other"
            </button>
          </>
        )}
      </div>
    </div>
  );
};
