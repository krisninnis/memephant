/**
 * AddPlatformModal
 *
 * A focused inline form for creating a custom AI platform in the Memory Trail.
 * On save, calls onSave with a new CustomPlatform object.
 * Never mutates project data. Safe export rules always apply to output.
 */

import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { CustomPlatform, CustomBaseFormat } from '../../utils/passportGenerator';
import './ContextPassportModal.css';

interface AddPlatformModalProps {
  onSave: (platform: CustomPlatform) => void;
  onClose: () => void;
}

const BASE_FORMAT_OPTIONS: {
  value: CustomBaseFormat;
  label: string;
  description: string;
}[] = [
  {
    value: 'markdown',
    label: 'Markdown',
    description: 'Friendly sections with headers — works with most AI tools',
  },
  {
    value: 'xml-like',
    label: 'XML-like',
    description: 'Structured tags, great for precise context loading',
  },
  {
    value: 'compact',
    label: 'Compact',
    description: 'Single-line KEY: VALUE pairs — minimal and fast to read',
  },
  {
    value: 'developer-brief',
    label: 'Developer Brief',
    description: 'Technical focus: stack, rules, decisions, next steps',
  },
];

export function AddPlatformModal({ onSave, onClose }: AddPlatformModalProps) {
  const [name, setName] = useState('');
  const [baseFormat, setBaseFormat] = useState<CustomBaseFormat>('markdown');
  const [customInstruction, setCustomInstruction] = useState('');
  const [includeFiles, setIncludeFiles] = useState(true);
  const [includeRecentChanges, setIncludeRecentChanges] = useState(true);
  const [nameError, setNameError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  // Focus name field on mount
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError('Platform name is required.');
      nameRef.current?.focus();
      return;
    }
    const platform: CustomPlatform = {
      id: `custom_${Date.now()}`,
      name: trimmed,
      baseFormat,
      customInstruction: customInstruction.trim(),
      includeFiles,
      includeRecentChanges,
    };
    onSave(platform);
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && e.target instanceof HTMLInputElement) {
      handleSave();
    }
  };

  return (
    <div
      className="add-platform-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Add Custom Platform"
    >
      <div className="add-platform-modal" onKeyDown={handleKeyDown}>
        {/* Header */}
        <div className="add-platform-modal__header">
          <h3 className="add-platform-modal__title">✨ Add Custom Platform</h3>
          <button
            type="button"
            className="passport-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="add-platform-modal__body">
          {/* Platform name */}
          <div className="add-platform-modal__field">
            <label className="add-platform-modal__label" htmlFor="ap-name">
              Platform name
            </label>
            <input
              id="ap-name"
              ref={nameRef}
              type="text"
              className={`add-platform-modal__input${nameError ? ' add-platform-modal__input--error' : ''}`}
              placeholder="e.g. Grok, Gemini, Mistral, Copilot…"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameError('');
              }}
            />
            {nameError && (
              <span className="add-platform-modal__error" role="alert">
                {nameError}
              </span>
            )}
          </div>

          {/* Base format */}
          <div className="add-platform-modal__field">
            <label className="add-platform-modal__label" htmlFor="ap-format">
              Base format
            </label>
            <select
              id="ap-format"
              className="add-platform-modal__select"
              value={baseFormat}
              onChange={(e) => setBaseFormat(e.target.value as CustomBaseFormat)}
            >
              {BASE_FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} — {opt.description}
                </option>
              ))}
            </select>
          </div>

          {/* Custom instruction */}
          <div className="add-platform-modal__field">
            <label className="add-platform-modal__label" htmlFor="ap-instruction">
              Custom instruction{' '}
              <span className="add-platform-modal__optional">(optional)</span>
            </label>
            <textarea
              id="ap-instruction"
              className="add-platform-modal__textarea"
              placeholder="e.g. Focus on the backend only. Skip open questions."
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              rows={3}
            />
          </div>

          {/* Toggles */}
          <div className="add-platform-modal__toggles">
            <label className="add-platform-modal__toggle-label">
              <input
                type="checkbox"
                checked={includeFiles}
                onChange={(e) => setIncludeFiles(e.target.checked)}
              />
              <span>Include important files</span>
            </label>
            <label className="add-platform-modal__toggle-label">
              <input
                type="checkbox"
                checked={includeRecentChanges}
                onChange={(e) => setIncludeRecentChanges(e.target.checked)}
              />
              <span>Include recent changes</span>
            </label>
          </div>

          {/* Safety note */}
          <p className="add-platform-modal__safety-note">
            🔒 Safe export rules always apply — secrets and local paths are never included.
          </p>
        </div>

        {/* Footer */}
        <div className="add-platform-modal__footer">
          <button
            type="button"
            className="add-platform-modal__cancel-btn"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="add-platform-modal__save-btn"
            onClick={handleSave}
          >
            Save Platform
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddPlatformModal;
