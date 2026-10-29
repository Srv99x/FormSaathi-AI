import React from 'react';

export interface FormHeaderEditorProps {
  title: string;
  description: string;
  bannerColor?: string;
  onChangeTitle: (title: string) => void;
  onChangeDescription: (desc: string) => void;
}

export const FormHeaderEditor: React.FC<FormHeaderEditorProps> = ({
  title,
  description,
  bannerColor = '#1a73e8',
  onChangeTitle,
  onChangeDescription,
}) => {
  return (
    <div className="fs-builder-header-card fs-card">
      {/* Top Accent Strip (Google Forms style) */}
      <div
        className="fs-builder-banner-strip"
        style={{ backgroundColor: bannerColor }}
      />

      <div className="fs-builder-header-content">
        <input
          type="text"
          className="fs-header-title-input"
          value={title}
          onChange={(e) => onChangeTitle(e.target.value)}
          placeholder="Untitled Form"
          aria-label="Form Title"
        />

        <textarea
          className="fs-header-desc-input"
          value={description}
          onChange={(e) => onChangeDescription(e.target.value)}
          placeholder="Form description or instructions for respondents..."
          rows={2}
          aria-label="Form Description"
        />
      </div>
    </div>
  );
};

