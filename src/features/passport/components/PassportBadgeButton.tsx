// ─────────────────────────────────────────────────────────────────────────────
// Memephant -- Passport Badge Button + Panel
//
// Two render states:
//
//   PASSPORT EXISTS  -> compact badge in sidebar, click opens the detail panel
//                       with "Copy Passport", "Edit Passport", Pro teaser.
//
//   NO PASSPORT YET  -> "Create AI Passport" CTA that launches the creation
//                       flow via startPassportEdit() / PassportGate.
//
// Design rules:
//  - Copy uses the same Passport Attachment v0.1 text as the export inspector.
//  - Does NOT sync to cloud. Does NOT silently attach.
//  - "Attach to next export" is intentionally disabled -- users open Export
//    Inspector from the project workspace.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { usePassportStore } from '../usePassportStore';
import { buildPassportAttachmentPreview } from '../passportAttachment';
import { loadPersonalMemoryVault } from '../../../services/personalMemoryVaultStorage';
import {
  COMMUNICATION_LABELS,
  FOCUS_LABELS,
  TONE_LABELS,
  getPassportConfiguration,
} from '../passport.utils';
import { PassportPreviewSimulator } from './PassportPreviewSimulator';
import '../passport.badge.css';

type PassportConfigDraft = {
  preferredName: string;
  roleContext: string;
  region: string;
  languagePreference: string;
  timezone: string;
  dateFormat: string;
  currency: string;
  directness: string;
  technicalLevel: string;
  riskTolerance: string;
  alwaysRulesText: string;
  neverRulesText: string;
};

function rulesToText(rules: string[]): string {
  return rules.join('\n');
}

function textToRules(value: string): string[] {
  return value
    .split('\n')
    .map((rule) => rule.trim())
    .filter(Boolean);
}

function toConfigDraft(
  configuration: ReturnType<typeof getPassportConfiguration>,
): PassportConfigDraft {
  return {
    preferredName: configuration.preferredName,
    roleContext: configuration.roleContext,
    region: configuration.region,
    languagePreference: configuration.languagePreference,
    timezone: configuration.timezone,
    dateFormat: configuration.dateFormat,
    currency: configuration.currency,
    directness: configuration.directness,
    technicalLevel: configuration.technicalLevel,
    riskTolerance: configuration.riskTolerance,
    alwaysRulesText: rulesToText(configuration.alwaysRules),
    neverRulesText: rulesToText(configuration.neverRules),
  };
}

export function PassportBadgeButton() {
  const passport          = usePassportStore((s) => s.passport);
  const startPassportEdit = usePassportStore((s) => s.startPassportEdit);
  const updatePassportConfiguration = usePassportStore((s) => s.updatePassportConfiguration);
  const configuration = getPassportConfiguration(passport);

  const [panelOpen, setPanelOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [configDraft, setConfigDraft] = useState(() => toConfigDraft(configuration));
  const [copied, setCopied]       = useState(false);
  const [panelTop, setPanelTop]   = useState(120);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  // Position panel vertically beside the trigger button
  useLayoutEffect(() => {
    if (panelOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPanelTop(rect.top);
    }
  }, [panelOpen]);

  // Close panel on click-outside
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current   && !panelRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [panelOpen]);

  // Close panel on Escape
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (configOpen) {
          setConfigOpen(false);
        } else if (simulatorOpen) {
          setSimulatorOpen(false);
        } else {
          setPanelOpen(false);
          triggerRef.current?.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [configOpen, panelOpen, simulatorOpen]);

  useEffect(() => {
    if (!panelOpen || configOpen) return;
    setConfigDraft(toConfigDraft(getPassportConfiguration(passport)));
  }, [configOpen, panelOpen, passport]);

  // ── No passport: show a CTA that launches the creation flow ──────────────

  if (!passport) {
    return (
      <button
        type="button"
        className="passport-create-cta"
        onClick={startPassportEdit}
        title="Set up your AI working identity"
        aria-label="Create AI Passport"
      >
        <span className="passport-create-cta__icon" aria-hidden="true">🛂</span>
        <span className="passport-create-cta__body">
          <span className="passport-create-cta__label">Create AI Passport</span>
          <span className="passport-create-cta__hint">Set your AI working style</span>
        </span>
        <span className="passport-create-cta__arrow" aria-hidden="true">+</span>
      </button>
    );
  }

  // ── Passport exists: show badge + detail panel ────────────────────────────

  const shortId = passport.id.split('-').slice(1, 3).join('-');

  const handleCopy = async () => {
    const vault      = loadPersonalMemoryVault();
    const attachment = buildPassportAttachmentPreview(passport, vault.frontalLobeProfile);
    try {
      await navigator.clipboard.writeText(attachment.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // Clipboard unavailable (e.g. in tests) -- fail silently
    }
  };

  const handleEditPassport = () => {
    setPanelOpen(false);
    setConfigOpen(false);
    setSimulatorOpen(false);
    startPassportEdit();
  };

  const handleOpenConfiguration = () => {
    setConfigDraft(toConfigDraft(getPassportConfiguration(passport)));
    setConfigOpen(true);
    setSimulatorOpen(false);
    setCopied(false);
  };

  const handleCancelConfiguration = () => {
    setConfigDraft(toConfigDraft(getPassportConfiguration(passport)));
    setConfigOpen(false);
  };

  const handleConfigFieldChange = (
    field: keyof PassportConfigDraft,
    value: string,
  ) => {
    setConfigDraft((draft) => ({ ...draft, [field]: value }));
  };

  const handleSaveConfiguration = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updatePassportConfiguration({
      preferredName: configDraft.preferredName.trim(),
      roleContext: configDraft.roleContext.trim(),
      region: configDraft.region.trim() || configuration.region,
      languagePreference: configDraft.languagePreference.trim() || configuration.languagePreference,
      timezone: configDraft.timezone.trim() || configuration.timezone,
      dateFormat: configDraft.dateFormat.trim() || configuration.dateFormat,
      currency: configDraft.currency.trim() || configuration.currency,
      directness: configDraft.directness.trim() || configuration.directness,
      technicalLevel: configDraft.technicalLevel.trim() || configuration.technicalLevel,
      riskTolerance: configDraft.riskTolerance.trim() || configuration.riskTolerance,
      alwaysRules: textToRules(configDraft.alwaysRulesText),
      neverRules: textToRules(configDraft.neverRulesText),
    });
    setConfigOpen(false);
    setCopied(false);
  };

  return (
    <div className="passport-badge-root">

      {/* ── Trigger ────────────────────────────────────────────────────────── */}
      <button
        ref={triggerRef}
        type="button"
        className={`passport-badge-btn${panelOpen ? ' passport-badge-btn--open' : ''}`}
        aria-label="Open AI Passport"
        aria-expanded={panelOpen}
        aria-haspopup="dialog"
        onClick={() => setPanelOpen((o) => !o)}
        title="Open AI Passport"
      >
        <span className="passport-badge-btn__stamp" aria-hidden="true">🛂</span>
        <span className="passport-badge-btn__body">
          <span className="passport-badge-btn__label">AI Passport</span>
          <span className="passport-badge-btn__id">{shortId}</span>
        </span>
        <span className="passport-badge-btn__chevron" aria-hidden="true">›</span>
      </button>

      {/* ── Panel ──────────────────────────────────────────────────────────── */}
      {panelOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Your AI Passport"
          aria-modal="false"
          className="passport-panel"
          style={{ top: panelTop }}
        >
          {/* Header */}
          <div className="passport-panel__header">
            <div className="passport-panel__header-text">
              <p className="passport-panel__title">Your AI Passport</p>
              <p className="passport-panel__subtitle">
                Copy your AI working identity into any AI tool.
              </p>
            </div>
            <button
              type="button"
              className="passport-panel__close"
              aria-label="Close passport panel"
              onClick={() => setPanelOpen(false)}
            >
              ×
            </button>
          </div>

          {configOpen ? (
            <form className="passport-config" onSubmit={handleSaveConfiguration}>
              <section className="passport-config__section" aria-labelledby="passport-config-identity">
                <h4 id="passport-config-identity">Identity</h4>
                <label>
                  Preferred name
                  <input
                    type="text"
                    value={configDraft.preferredName}
                    onChange={(event) => handleConfigFieldChange('preferredName', event.target.value)}
                    placeholder="Kris"
                  />
                </label>
                <label>
                  Role / working context
                  <input
                    type="text"
                    value={configDraft.roleContext}
                    onChange={(event) => handleConfigFieldChange('roleContext', event.target.value)}
                    placeholder="Solo founder"
                  />
                </label>
              </section>

              <section className="passport-config__section" aria-labelledby="passport-config-region">
                <h4 id="passport-config-region">Region & language</h4>
                <div className="passport-config__grid">
                  <label>
                    Region
                    <input
                      type="text"
                      value={configDraft.region}
                      onChange={(event) => handleConfigFieldChange('region', event.target.value)}
                    />
                  </label>
                  <label>
                    Language preference
                    <input
                      type="text"
                      value={configDraft.languagePreference}
                      onChange={(event) => handleConfigFieldChange('languagePreference', event.target.value)}
                    />
                  </label>
                  <label>
                    Timezone
                    <input
                      type="text"
                      value={configDraft.timezone}
                      onChange={(event) => handleConfigFieldChange('timezone', event.target.value)}
                    />
                  </label>
                  <label>
                    Date format
                    <input
                      type="text"
                      value={configDraft.dateFormat}
                      onChange={(event) => handleConfigFieldChange('dateFormat', event.target.value)}
                    />
                  </label>
                  <label>
                    Currency
                    <input
                      type="text"
                      value={configDraft.currency}
                      onChange={(event) => handleConfigFieldChange('currency', event.target.value)}
                    />
                  </label>
                </div>
              </section>

              <section className="passport-config__section" aria-labelledby="passport-config-style">
                <h4 id="passport-config-style">Answer style</h4>
                <label>
                  Directness
                  <input
                    type="text"
                    value={configDraft.directness}
                    onChange={(event) => handleConfigFieldChange('directness', event.target.value)}
                  />
                </label>
              </section>

              <section className="passport-config__section" aria-labelledby="passport-config-technical">
                <h4 id="passport-config-technical">Technical help</h4>
                <label>
                  Technical level
                  <input
                    type="text"
                    value={configDraft.technicalLevel}
                    onChange={(event) => handleConfigFieldChange('technicalLevel', event.target.value)}
                  />
                </label>
                <label>
                  Risk tolerance
                  <input
                    type="text"
                    value={configDraft.riskTolerance}
                    onChange={(event) => handleConfigFieldChange('riskTolerance', event.target.value)}
                  />
                </label>
              </section>

              <section className="passport-config__section" aria-labelledby="passport-config-boundaries">
                <h4 id="passport-config-boundaries">Boundaries</h4>
                <label>
                  Always
                  <textarea
                    value={configDraft.alwaysRulesText}
                    onChange={(event) => handleConfigFieldChange('alwaysRulesText', event.target.value)}
                    rows={3}
                  />
                </label>
                <label>
                  Never
                  <textarea
                    value={configDraft.neverRulesText}
                    onChange={(event) => handleConfigFieldChange('neverRulesText', event.target.value)}
                    rows={3}
                  />
                </label>
              </section>

              <div className="passport-config__actions">
                <button type="button" onClick={handleCancelConfiguration}>
                  Cancel
                </button>
                <button type="submit">
                  Save Passport
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Profile fields */}
              <div className="passport-panel__fields">
                <div className="passport-panel__field">
                  <span className="passport-panel__field-label">Style</span>
                  <span className="passport-panel__field-value">
                    {COMMUNICATION_LABELS[passport.profile.communicationStyle]}
                  </span>
                </div>
                <div className="passport-panel__field">
                  <span className="passport-panel__field-label">Tone</span>
                  <span className="passport-panel__field-value">
                    {TONE_LABELS[passport.profile.tone]}
                  </span>
                </div>
                <div className="passport-panel__field">
                  <span className="passport-panel__field-label">Focus</span>
                  <span className="passport-panel__field-value">
                    {FOCUS_LABELS[passport.profile.focusArea]}
                  </span>
                </div>
                <div className="passport-panel__field">
                  <span className="passport-panel__field-label">Region</span>
                  <span className="passport-panel__field-value">{configuration.region}</span>
                </div>
                <div className="passport-panel__field">
                  <span className="passport-panel__field-label">Language</span>
                  <span className="passport-panel__field-value">{configuration.languagePreference}</span>
                </div>
                {configuration.roleContext && (
                  <div className="passport-panel__field">
                    <span className="passport-panel__field-label">Context</span>
                    <span className="passport-panel__field-value">{configuration.roleContext}</span>
                  </div>
                )}
              </div>

              <div className="passport-panel__guidance">
                <span>{configuration.directness}</span>
                <span>{configuration.technicalLevel}</span>
                <span>{configuration.riskTolerance}</span>
              </div>

              {/* Primary action */}
              <button
                type="button"
                className={`passport-panel__copy-btn${copied ? ' passport-panel__copy-btn--copied' : ''}`}
                onClick={() => void handleCopy()}
              >
                {copied ? '✓ Copied to clipboard' : 'Copy Passport'}
              </button>

              {/* Secondary actions */}
              <div className="passport-panel__secondary-actions">
                <button
                  type="button"
                  className="passport-panel__secondary-btn"
                  onClick={() => {
                    setConfigOpen(false);
                    setSimulatorOpen(true);
                  }}
                >
                  Preview Passport
                </button>
                <button
                  type="button"
                  className="passport-panel__secondary-btn"
                  onClick={handleOpenConfiguration}
                >
                  Configure Passport
                </button>
                <button
                  type="button"
                  className="passport-panel__secondary-btn"
                  onClick={handleEditPassport}
                >
                  Edit Passport
                </button>
              </div>

              {/* Notes */}
              <div className="passport-panel__notes">
                <p className="passport-panel__privacy-note">
                  Your Passport stays on this device and is shared only when you copy or attach it.
                </p>
                <p className="passport-panel__compat-note">
                  Works by pasting into ChatGPT, Claude, Grok, Gemini, Perplexity, and local LLMs.
                  Helps AI follow your preferences.
                </p>
              </div>

              {/* Pro teaser */}
              <div className="passport-panel__pro-teaser">
                <span className="passport-panel__pro-label">Pro idea</span>
                <span>
                  Auto-attach Passport through the Memephant browser extension —
                  always with your approval.
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {simulatorOpen && (
        <div
          className="passport-simulator-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Passport preview simulator"
        >
          <PassportPreviewSimulator
            passport={passport}
            onCopyPassport={handleCopy}
            onBack={() => setSimulatorOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
