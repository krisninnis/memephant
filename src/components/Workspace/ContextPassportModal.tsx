/**
 * Memory Trail Modal
 *
 * Previews the generated Memory Trail and lets the user copy it
 * in four built-in formats (Markdown, ChatGPT, Claude, Codex) plus any
 * custom platforms the user has defined.
 *
 * READ-ONLY — never mutates project data.
 * Custom platforms are persisted to localStorage only (settings data, not project data).
 */

import type { MouseEvent as ReactMouseEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { ProjectMemory } from '../../types/memphant-types';
import {
  generateContextPassport,
  generateCustomPassportText,
  type PassportFormat,
  type CustomPlatform,
} from '../../utils/passportGenerator';
import { defaultPassportStyleSettings } from '../../utils/passportStyleSettings';
import { applyPassportStyleSettings } from '../../utils/passportStyleTransform';
import { AddPlatformModal } from './AddPlatformModal';
import './ContextPassportModal.css';

// ─── Constants ──────────────────────────────────────────────────────────────

const CUSTOM_PLATFORMS_KEY = 'memphant_custom_platforms';

// ─── Helpers ────────────────────────────────────────────────────────────────

function loadCustomPlatforms(): CustomPlatform[] {
  try {
    const stored = localStorage.getItem(CUSTOM_PLATFORMS_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as CustomPlatform[];
  } catch {
    return [];
  }
}

function saveCustomPlatforms(platforms: CustomPlatform[]): void {
  try {
    localStorage.setItem(CUSTOM_PLATFORMS_KEY, JSON.stringify(platforms));
  } catch {
    // localStorage unavailable in some contexts — fail silently
  }
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface ContextPassportModalProps {
  project: ProjectMemory;
  onClose: () => void;
}

// ─── Built-in tab definitions ────────────────────────────────────────────────

const FORMAT_TABS: { id: PassportFormat; label: string; icon: string; description: string }[] = [
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    icon: '🤖',
    description: 'Markdown with a clear "continue from here" instruction.',
  },
  {
    id: 'claude',
    label: 'Claude',
    icon: '🟠',
    description: 'Structured XML-style sections for precise context loading.',
  },
  {
    id: 'codex',
    label: 'Codex',
    icon: '⚡',
    description: 'Implementation-focused: status, rules, files, and next steps.',
  },
  {
    id: 'markdown',
    label: 'Markdown',
    icon: '📄',
    description: 'Plain portable Markdown. Works with any AI tool.',
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function ContextPassportModal({ project, onClose }: ContextPassportModalProps) {
  const [activeTabKey, setActiveTabKey] = useState<string>('chatgpt');
  const [copied, setCopied] = useState(false);
  const [showAddPlatform, setShowAddPlatform] = useState(false);
  const [customPlatforms, setCustomPlatforms] = useState<CustomPlatform[]>(loadCustomPlatforms);
  const [styleSettings, setStyleSettings] = useState(defaultPassportStyleSettings);
  const [writingOptionsOpen, setWritingOptionsOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Generate built-in passport once — pure, deterministic
  const passport = generateContextPassport(project);

  // Resolve active tab info
  const builtinTab = FORMAT_TABS.find((t) => t.id === activeTabKey);
  const customTab = customPlatforms.find((p) => p.id === activeTabKey);

  const rawCurrentText: string = builtinTab
    ? passport.formats[activeTabKey as PassportFormat]
    : customTab
    ? generateCustomPassportText(project, customTab)
    : '';
  const currentText = applyPassportStyleSettings(rawCurrentText, styleSettings);

  const activeTabLabel = builtinTab?.label ?? customTab?.name ?? '';
  const activeTabDescription =
    builtinTab?.description ??
    (customTab
      ? `Custom format: ${customTab.baseFormat.replace(/-/g, ' ')}`
      : '');

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showAddPlatform) onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, showAddPlatform]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may not be available in some contexts
    }
  };

  const handleOverlayClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleSavePlatform = (platform: CustomPlatform) => {
    const updated = [...customPlatforms, platform];
    setCustomPlatforms(updated);
    saveCustomPlatforms(updated);
    setActiveTabKey(platform.id);
    setCopied(false);
    setShowAddPlatform(false);
  };

  const handleDeletePlatform = (id: string) => {
    const updated = customPlatforms.filter((p) => p.id !== id);
    setCustomPlatforms(updated);
    saveCustomPlatforms(updated);
    if (activeTabKey === id) {
      setActiveTabKey('chatgpt');
      setCopied(false);
    }
  };

  const switchTab = (key: string) => {
    setActiveTabKey(key);
    setCopied(false);
  };

  const toggleAvoidEmDashes = () => {
    setStyleSettings((current) => ({
      ...current,
      avoidEmDashes: !current.avoidEmDashes,
    }));
    setCopied(false);
  };

  const toggleReduceAiPhrases = () => {
    setStyleSettings((current) => ({
      ...current,
      reduceAiPhrases: !current.reduceAiPhrases,
    }));
    setCopied(false);
  };

  return (
    <>
      <div
        className="passport-overlay"
        ref={overlayRef}
        onClick={handleOverlayClick}
        role="dialog"
        aria-modal="true"
        aria-label="Memory Trail"
      >
        <div className="passport-modal" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="passport-modal__header">
            <div className="passport-modal__title-row">
              <span className="passport-modal__emoji">🗺️</span>
              <div>
                <h2 className="passport-modal__title">Memory Trail</h2>
                <p className="passport-modal__help">
                  Memory Trail helps another AI continue your project from where you left off.
                </p>
                <p className="passport-modal__subtitle">{passport.projectName}</p>
              </div>
            </div>
            <button
              type="button"
              className="passport-modal__close"
              onClick={onClose}
              aria-label="Close passport preview"
              title="Close"
            >
              ✕
            </button>
          </div>

          {/* Format tabs */}
          <div className="passport-modal__tabs" role="tablist" aria-label="Memory Trail format">
            {/* Built-in tabs */}
            {FORMAT_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTabKey === tab.id}
                className={`passport-modal__tab${activeTabKey === tab.id ? ' passport-modal__tab--active' : ''}`}
                onClick={() => switchTab(tab.id)}
                title={tab.description}
              >
                <span className="passport-modal__tab-icon">{tab.icon}</span>
                <span className="passport-modal__tab-label">{tab.label}</span>
              </button>
            ))}

            {/* Custom platform tabs */}
            {customPlatforms.map((cp) => (
              <div key={cp.id} className="passport-modal__tab-wrapper">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTabKey === cp.id}
                  className={`passport-modal__tab passport-modal__tab--custom${activeTabKey === cp.id ? ' passport-modal__tab--active' : ''}`}
                  onClick={() => switchTab(cp.id)}
                  title={`Custom format: ${cp.baseFormat.replace(/-/g, ' ')}`}
                >
                  <span className="passport-modal__tab-icon">✨</span>
                  <span className="passport-modal__tab-label">{cp.name}</span>
                </button>
                <button
                  type="button"
                  className="passport-modal__tab-delete"
                  onClick={() => handleDeletePlatform(cp.id)}
                  title={`Remove ${cp.name}`}
                  aria-label={`Remove ${cp.name} custom platform`}
                >
                  ×
                </button>
              </div>
            ))}

            {/* Add Platform button */}
            <button
              type="button"
              className="passport-modal__tab passport-modal__tab--add"
              onClick={() => setShowAddPlatform(true)}
              title="Add a custom AI platform"
            >
              <span className="passport-modal__tab-icon">＋</span>
              <span className="passport-modal__tab-label">Add Platform</span>
            </button>
          </div>

          {/* Format description */}
          {(builtinTab || customTab) && (
            <p className="passport-modal__format-desc">{activeTabDescription}</p>
          )}

          <section className="passport-modal__writing-options">
            <button
              type="button"
              className="passport-modal__writing-options-summary"
              aria-expanded={writingOptionsOpen}
              aria-controls="passport-writing-options-panel"
              onClick={() => setWritingOptionsOpen((open) => !open)}
            >
              <span>Advanced writing options</span>
              <span className="passport-modal__writing-options-state">
                {writingOptionsOpen ? 'Hide options ▴' : 'Show options ▾'}
              </span>
            </button>
            {writingOptionsOpen && (
              <div id="passport-writing-options-panel">
                <p className="passport-modal__writing-options-help">
                  Control how AI-generated exports communicate and feel.
                </p>
                <label className="passport-modal__writing-option">
                  <input
                    type="checkbox"
                    checked={styleSettings.avoidEmDashes}
                    onChange={toggleAvoidEmDashes}
                  />
                  <span>Avoid em dashes</span>
                </label>
                <label className="passport-modal__writing-option">
                  <input
                    type="checkbox"
                    checked={styleSettings.reduceAiPhrases}
                    onChange={toggleReduceAiPhrases}
                  />
                  <span>Simplify polished wording</span>
                </label>
                <p className="passport-modal__writing-option-help">
                  Remove or simplify common over-polished AI wording in copied passports.
                </p>
              </div>
            )}
          </section>

          {/* Memory Trail preview */}
          <textarea
            className="passport-modal__preview"
            value={currentText}
            readOnly
            spellCheck={false}
            aria-label={`Memory Trail for ${activeTabLabel}`}
            title="Memory Trail preview - copy using the button below"
          />

          {/* Footer actions */}
          <div className="passport-modal__footer">
            <p className="passport-modal__safe-note">
              🔒 Secrets, API keys, and local paths are excluded.
            </p>
            <button
              type="button"
              className={`passport-modal__copy-btn${copied ? ' passport-modal__copy-btn--copied' : ''}`}
              onClick={() => void handleCopy()}
              title={`Copy ${activeTabLabel} Memory Trail to clipboard`}
            >
              {copied
                ? `✅ Copied for ${activeTabLabel}!`
                : `Copy for ${activeTabLabel}`}
            </button>
          </div>
        </div>
      </div>

      {/* Add Platform sub-modal — rendered outside main modal to stack correctly */}
      {showAddPlatform && (
        <AddPlatformModal
          onSave={handleSavePlatform}
          onClose={() => setShowAddPlatform(false)}
        />
      )}
    </>
  );
}

export default ContextPassportModal;
