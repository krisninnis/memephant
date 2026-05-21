// ─────────────────────────────────────────────────────────────────────────────
// Memephant — Passport Badge Button + Panel
//
// Shows a compact passport entry point in the sidebar. Clicking opens a
// popover panel with profile details, a one-click "Copy Passport" action, and
// secondary actions for attaching/editing.
//
// Design rules:
//  - Copy uses the same Passport Attachment v0.1 text format as the export inspector.
//  - Does NOT sync to cloud. Does NOT silently attach.
//  - "Edit Passport" re-opens the creation flow via startPassportEdit().
//  - "Attach to next export" is disabled — users open Export Inspector manually.
//  - Only renders when a passport exists (null → returns null).
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePassportStore } from '../usePassportStore';
import { buildPassportAttachmentPreview } from '../passportAttachment';
import { loadPersonalMemoryVault } from '../../../services/personalMemoryVaultStorage';
import { COMMUNICATION_LABELS, FOCUS_LABELS, TONE_LABELS } from '../passport.utils';
import '../passport.badge.css';

export function PassportBadgeButton() {
  const passport         = usePassportStore((s) => s.passport);
  const startPassportEdit = usePassportStore((s) => s.startPassportEdit);

  const [panelOpen, setPanelOpen] = useState(false);
  const [copied, setCopied]       = useState(false);
  const [panelTop, setPanelTop]   = useState(120);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef   = useRef<HTMLDivElement>(null);

  // Position panel vertically next to the trigger button
  useLayoutEffect(() => {
    if (panelOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPanelTop(rect.top);
    }
  }, [panelOpen]);

  // Close on click-outside
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current  && !panelRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setPanelOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [panelOpen]);

  // Close on Escape
  useEffect(() => {
    if (!panelOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPanelOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [panelOpen]);

  // Only render when a passport has been created
  if (!passport) return null;

  const shortId = passport.id.split('-').slice(1, 3).join('-');

  const handleCopy = async () => {
    const vault      = loadPersonalMemoryVault();
    const attachment = buildPassportAttachmentPreview(passport, vault.frontalLobeProfile);
    try {
      await navigator.clipboard.writeText(attachment.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // Clipboard unavailable (e.g. in tests) — fail silently
    }
  };

  const handleEditPassport = () => {
    setPanelOpen(false);
    startPassportEdit();
  };

  return (
    <div className="passport-badge-root">
      {/* ── Trigger ──────────────────────────────────────────────────────── */}
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

      {/* ── Panel ────────────────────────────────────────────────────────── */}
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
              className="passport-panel__secondary-btn passport-panel__secondary-btn--disabled"
              disabled
              title="Open Export Inspector from any project export to attach your Passport"
              aria-disabled="true"
            >
              Attach to next export
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
              🔒 This is not a login credential. Your Passport stays on this device.
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
        </div>
      )}
    </div>
  );
}
