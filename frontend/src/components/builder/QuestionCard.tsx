import React from 'react';
import {
  GripVertical,
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { FieldType, FormField } from '../../types/form';
import { OptionListEditor } from './OptionListEditor';
import { QuestionTypePicker } from './QuestionTypePicker';

export interface QuestionCardProps {
  field: FormField;
  index: number;
  totalFields: number;
  isActive: boolean;
  onSelect: () => void;
  onUpdate: (updates: Partial<FormField>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  field,
  index,
  totalFields,
  isActive,
  onSelect,
  onUpdate,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
}) => {
  const isChoiceField =
    field.type === 'select' || field.type === 'radio' || field.type === 'multiselect';

  const handleTypeChange = (newType: FieldType) => {
    const updates: Partial<FormField> = { type: newType };
    if (
      (newType === 'select' || newType === 'radio' || newType === 'multiselect') &&
      (!field.options || field.options.length === 0)
    ) {
      updates.options = ['Option 1', 'Option 2', 'Option 3'];
    }
    onUpdate(updates);
  };

  return (
    <div
      className={`fs-card fs-builder-qcard ${isActive ? 'is-active-card' : ''}`}
      onClick={onSelect}
      id={`builder_field_${field.id}`}
    >
      {/* 6-dot drag / reorder bar */}
      <div className="fs-qcard-drag-bar">
        <GripVertical size={18} className="fs-drag-icon" />
      </div>

      <div className="fs-qcard-body">
        {isActive ? (
          /* Active State: Full editable inputs */
          <>
            <div className="fs-qcard-top-row">
              <input
                type="text"
                className="fs-qcard-title-input"
                value={field.label}
                onChange={(e) => onUpdate({ label: e.target.value })}
                placeholder="Question title..."
                aria-label="Question Title"
              />

              <QuestionTypePicker
                value={field.type}
                onChange={handleTypeChange}
              />
            </div>

            {/* Optional Description / Subtitle */}
            <input
              type="text"
              className="fs-qcard-desc-input"
              value={field.description || ''}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Description or hint for respondents (optional)"
              aria-label="Question Description"
            />

            {/* Choices list if applicable */}
            {isChoiceField && (
              <OptionListEditor
                type={field.type}
                options={field.options || ['Option 1', 'Option 2']}
                hasOtherOption={field.hasOtherOption}
                onOptionsChange={(options) => onUpdate({ options })}
                onToggleOtherOption={(hasOtherOption) => onUpdate({ hasOtherOption })}
              />
            )}

            {/* Preview placeholder for text / number / date fields */}
            {!isChoiceField && (
              <div className="fs-qcard-preview-placeholder">
                <span className="fs-placeholder-line">
                  {field.type === 'textarea'
                    ? 'Long-answer text'
                    : field.type === 'date'
                    ? 'Date (dd/mm/yyyy)'
                    : field.type === 'integer'
                    ? 'Number'
                    : field.type === 'tel'
                    ? '10-digit mobile number'
                    : field.type === 'email'
                    ? 'Email address'
                    : 'Short-answer text'}
                </span>
              </div>
            )}

            {/* Bottom Actions Toolbar */}
            <div className="fs-qcard-footer">
              <div className="fs-qcard-reorder-btns">
                {onMoveUp && index > 0 && (
                  <button
                    type="button"
                    className="fs-icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveUp();
                    }}
                    title="Move Question Up"
                  >
                    <ChevronUp size={16} />
                  </button>
                )}
                {onMoveDown && index < totalFields - 1 && (
                  <button
                    type="button"
                    className="fs-icon-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveDown();
                    }}
                    title="Move Question Down"
                  >
                    <ChevronDown size={16} />
                  </button>
                )}
              </div>

              <div className="fs-qcard-footer-right">
                <button
                  type="button"
                  className="fs-icon-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate();
                  }}
                  title="Duplicate Question"
                  aria-label="Duplicate question"
                >
                  <Copy size={16} />
                </button>

                <button
                  type="button"
                  className="fs-icon-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  title="Delete Question"
                  aria-label="Delete question"
                >
                  <Trash2 size={16} />
                </button>

                <span className="fs-footer-divider" />

                <label
                  className="fs-toggle-label"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="fs-toggle-text">Required</span>
                  <input
                    type="checkbox"
                    className="fs-toggle-checkbox"
                    checked={field.required}
                    onChange={(e) => onUpdate({ required: e.target.checked })}
                  />
                  <span className="fs-toggle-slider" />
                </label>
              </div>
            </div>
          </>
        ) : (
          /* Inactive / Collapsed State */
          <div className="fs-qcard-inactive-view">
            <div className="fs-inactive-title-row">
              <span className="fs-inactive-title">
                {field.label || 'Untitled Question'}
                {field.required && <span className="fs-req-star"> *</span>}
              </span>
              <span className="fs-inactive-type-badge">{field.type}</span>
            </div>

            {field.description && (
              <p className="fs-inactive-desc">{field.description}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
