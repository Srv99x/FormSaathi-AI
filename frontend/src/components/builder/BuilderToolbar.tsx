import React from 'react';
import { PlusCircle, Type, Settings, Eye, Share2 } from 'lucide-react';

export interface BuilderToolbarProps {
  onAddQuestion: () => void;
  onAddTitleSection: () => void;
  onOpenSettings: () => void;
  onPreview: () => void;
  onPublish: () => void;
}

export const BuilderToolbar: React.FC<BuilderToolbarProps> = ({
  onAddQuestion,
  onAddTitleSection,
  onOpenSettings,
  onPreview,
  onPublish,
}) => {
  return (
    <aside className="fs-builder-toolbar" aria-label="Form Builder Actions">
      <div className="fs-toolbar-inner">
        <button
          type="button"
          className="fs-toolbar-btn fs-btn-primary-action"
          onClick={onAddQuestion}
          title="Add Question (+)"
          aria-label="Add Question"
        >
          <PlusCircle size={20} />
          <span className="fs-toolbar-tooltip">Add Question</span>
        </button>

        <button
          type="button"
          className="fs-toolbar-btn"
          onClick={onAddTitleSection}
          title="Add Title & Description (T)"
          aria-label="Add Title and Description"
        >
          <Type size={18} />
          <span className="fs-toolbar-tooltip">Add Title</span>
        </button>

        <span className="fs-toolbar-sep" />

        <button
          type="button"
          className="fs-toolbar-btn"
          onClick={onOpenSettings}
          title="Form & Voice Settings"
          aria-label="Open Form Settings"
        >
          <Settings size={18} />
          <span className="fs-toolbar-tooltip">Voice Settings</span>
        </button>

        <button
          type="button"
          className="fs-toolbar-btn"
          onClick={onPreview}
          title="Preview Respondent Form"
          aria-label="Preview Form"
        >
          <Eye size={18} />
          <span className="fs-toolbar-tooltip">Preview</span>
        </button>

        <button
          type="button"
          className="fs-toolbar-btn fs-btn-publish"
          onClick={onPublish}
          title="Publish & Share Form"
          aria-label="Publish Form"
        >
          <Share2 size={18} />
          <span className="fs-toolbar-tooltip">Publish</span>
        </button>
      </div>
    </aside>
  );
};

