import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Share2,
  Eye,
  ArrowLeft,
} from 'lucide-react';
import { FormField, FormSchema, FormSettings } from '../types/form';
import { api } from '../services/api';
import {
  BUILTIN_STUDENT_REGISTRATION,
  BUILTIN_STUDENT_ASSISTANCE,
  createBlankForm,
  saveCustomForm,
  getCustomForm,
  formSchemaToJsonSchema,
} from '../services/schemaMapper';
import { Header } from '../components/common/Header';
import { Button } from '../components/common/Button';
import { Toast } from '../components/common/Toast';
import { FormHeaderEditor } from '../components/builder/FormHeaderEditor';
import { QuestionCard } from '../components/builder/QuestionCard';
import { BuilderToolbar } from '../components/builder/BuilderToolbar';
import { FormSettingsModal } from '../components/builder/FormSettingsModal';
import { PublishModal } from '../components/builder/PublishModal';

export const FormBuilderPage: React.FC = () => {
  const navigate = useNavigate();

  // Active form state — defaults to student_registration_v1 for instant full demo
  const [form, setForm] = useState<FormSchema>(() => {
    const saved = getCustomForm('active_draft');
    return saved || BUILTIN_STUDENT_REGISTRATION;
  });

  const [activeFieldId, setActiveFieldId] = useState<string | null>(
    form.fields[0]?.id || null
  );
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auto-save active draft under dedicated storage key and sync with backend registry
  useEffect(() => {
    saveCustomForm(form, 'active_draft');
    if (form.id && form.id !== 'active_draft') {
      saveCustomForm(form, form.id);
      if (!['student_registration_v1', 'student_assistance_v1'].includes(form.id)) {
        try {
          const jsonSchema = formSchemaToJsonSchema(form);
          api.registerForm(jsonSchema).catch(() => {});
        } catch {
          // ignore transient incomplete schema while typing
        }
      }
    }
  }, [form]);

  // Handlers for Header card
  const handleTitleChange = (title: string) => {
    setForm((prev) => ({ ...prev, title }));
  };

  const handleDescChange = (description: string) => {
    setForm((prev) => ({ ...prev, description }));
  };

  // Handlers for Questions
  const handleUpdateField = (fieldId: string, updates: Partial<FormField>) => {
    setForm((prev) => ({
      ...prev,
      fields: prev.fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)),
    }));
  };

  const handleAddField = () => {
    const newFieldId = `field_${Date.now()}`;
    const newField: FormField = {
      id: newFieldId,
      label: 'Untitled Question',
      type: 'text',
      required: false,
      placeholder: 'Your answer',
    };

    // Insert directly below active question or at the end
    const activeIndex = form.fields.findIndex((f) => f.id === activeFieldId);
    let updatedFields = [...form.fields];
    if (activeIndex > -1) {
      updatedFields.splice(activeIndex + 1, 0, newField);
    } else {
      updatedFields.push(newField);
    }

    setForm((prev) => ({ ...prev, fields: updatedFields }));
    setActiveFieldId(newFieldId);
    setToastMessage('New question added');
  };

  const handleDuplicateField = (fieldId: string) => {
    const target = form.fields.find((f) => f.id === fieldId);
    if (!target) return;

    const dupField: FormField = {
      ...target,
      id: `${target.id}_copy_${Date.now()}`,
      label: `${target.label} (Copy)`,
    };

    const idx = form.fields.findIndex((f) => f.id === fieldId);
    const updated = [...form.fields];
    updated.splice(idx + 1, 0, dupField);

    setForm((prev) => ({ ...prev, fields: updated }));
    setActiveFieldId(dupField.id);
    setToastMessage('Question duplicated');
  };

  const handleDeleteField = (fieldId: string) => {
    if (form.fields.length <= 1) {
      setToastMessage('Form must contain at least one question.');
      return;
    }
    const updated = form.fields.filter((f) => f.id !== fieldId);
    setForm((prev) => ({ ...prev, fields: updated }));
    setActiveFieldId(updated[0]?.id || null);
    setToastMessage('Question deleted');
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= form.fields.length) return;

    const nextFields = [...form.fields];
    const [moved] = nextFields.splice(index, 1);
    nextFields.splice(targetIdx, 0, moved);

    setForm((prev) => ({ ...prev, fields: nextFields }));
  };

  // Template switchers
  const loadTemplate = (schema: FormSchema) => {
    setForm(schema);
    setActiveFieldId(schema.fields[0]?.id || null);
    setToastMessage(`Loaded "${schema.title}" template`);
  };

  const handleSaveSettings = (newSettings: FormSettings) => {
    setForm((prev) => ({ ...prev, settings: newSettings }));
    setToastMessage('Settings updated');
  };

  return (
    <div className="fs-builder-page-wrapper">
      <Header formTitle={form.title} />

      {/* Top Template Selection & Quick Actions Bar */}
      <div className="fs-builder-subbar">
        <div className="fs-subbar-left">
          <span className="fs-template-label">Templates:</span>
          <button
            type="button"
            className={`fs-template-btn ${form.id === 'student_registration_v1' ? 'is-active' : ''}`}
            onClick={() => loadTemplate(BUILTIN_STUDENT_REGISTRATION)}
          >
            Student Registration
          </button>
          <button
            type="button"
            className={`fs-template-btn ${form.id === 'student_assistance_v1' ? 'is-active' : ''}`}
            onClick={() => loadTemplate(BUILTIN_STUDENT_ASSISTANCE)}
          >
            Student Assistance
          </button>
          <button
            type="button"
            className="fs-template-btn"
            onClick={() => loadTemplate(createBlankForm())}
          >
            + Blank Form
          </button>
        </div>

        <div className="fs-subbar-right">
          <Button
            variant="outline"
            size="sm"
            icon={<ArrowLeft size={15} />}
            onClick={() => navigate('/')}
            title="Return to active form"
          >
            Back to Form
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Eye size={15} />}
            onClick={() => navigate(`/fill/${encodeURIComponent(form.id)}`)}
          >
            Preview
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Share2 size={15} />}
            onClick={() => setIsPublishOpen(true)}
          >
            Publish Form
          </Button>
        </div>
      </div>

      {/* Main Form Canvas (Centered Google Forms layout) */}
      <main className="fs-builder-canvas" role="main">
        <div className="fs-builder-container">
          {/* Header Card (Title, Description, Banner) */}
          <FormHeaderEditor
            title={form.title}
            description={form.description}
            bannerColor={form.bannerColor}
            onChangeTitle={handleTitleChange}
            onChangeDescription={handleDescChange}
          />

          {/* Question Cards List */}
          <div className="fs-questions-list" role="list">
            {form.fields.map((field, idx) => (
              <QuestionCard
                key={field.id}
                field={field}
                index={idx}
                totalFields={form.fields.length}
                isActive={activeFieldId === field.id}
                onSelect={() => setActiveFieldId(field.id)}
                onUpdate={(updates) => handleUpdateField(field.id, updates)}
                onDuplicate={() => handleDuplicateField(field.id)}
                onDelete={() => handleDeleteField(field.id)}
                onMoveUp={() => handleMoveField(idx, 'up')}
                onMoveDown={() => handleMoveField(idx, 'down')}
              />
            ))}
          </div>
        </div>

        {/* Floating Side Action Palette */}
        <BuilderToolbar
          onAddQuestion={handleAddField}
          onAddTitleSection={() => setToastMessage('Section title added')}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onPreview={() => navigate(`/fill/${encodeURIComponent(form.id)}`)}
          onPublish={() => setIsPublishOpen(true)}
        />
      </main>

      {/* Form Settings Drawer / Modal */}
      <FormSettingsModal
        isOpen={isSettingsOpen}
        settings={form.settings}
        onClose={() => setIsSettingsOpen(false)}
        onSave={handleSaveSettings}
      />

      {/* Publish & Sharing Modal */}
      <PublishModal
        isOpen={isPublishOpen}
        formId={form.id}
        formTitle={form.title}
        onClose={() => setIsPublishOpen(false)}
      />

      {/* Toast notification */}
      {toastMessage && (
        <Toast
          type="info"
          message={toastMessage}
          onClose={() => setToastMessage(null)}
          duration={3000}
        />
      )}
    </div>
  );
};
