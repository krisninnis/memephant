// ─────────────────────────────────────────────────────────────────────────────
// Memephant — Passport Badge Button + Panel
//
// Shows a compact Passport entry point in the sidebar. Clicking opens an inline
// panel with profile details, a one-click "Copy Passport" action, and secondary
// actions for attaching/editing.
//
// Design rules:
//  - Copy uses the identity-first AI Passport text format.
//  - Does NOT sync to cloud.
//  - Does NOT silently attach.
//  - "Edit Passport" re-opens the creation flow via startPassportEdit().
//  - "Attach to next export" is disabled — users open Export Inspector manually.
//  - If no Passport exists, renders a Create AI Passport CTA.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { usePassportStore } from "../usePassportStore";
import { buildPassportAttachmentPreview } from "../passportAttachment";
import { loadPersonalMemoryVault } from "../../../services/personalMemoryVaultStorage";
import {
  COMMUNICATION_LABELS,
  FOCUS_LABELS,
  TONE_LABELS,
} from "../passport.utils";
import passportStampBronze from "../../../assets/passport/tiers/passport-stamp-bronze.png";
import passportStampSilver from "../../../assets/passport/tiers/passport-stamp-silver.png";
import "../passport.badge.css";

export function PassportBadgeButton() {
  const passport = usePassportStore((s) => s.passport);
  const startPassportEdit = usePassportStore((s) => s.startPassportEdit);

  const [panelOpen, setPanelOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside.
  useEffect(() => {
    if (!panelOpen) return;

    const handler = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        panelRef.current &&
        !panelRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setPanelOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [panelOpen]);

  // Close on Escape.
  useEffect(() => {
    if (!panelOpen) return;

    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPanelOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [panelOpen]);

  if (!passport) {
    return (
      <div className="passport-badge-root">
        <button
          ref={triggerRef}
          type="button"
          className="passport-badge-btn"
          aria-label="Create AI Passport"
          onClick={startPassportEdit}
          title="Create AI Passport"
        >
          <img
            className="passport-badge-btn__seal"
            src={passportStampBronze}
            alt=""
            aria-hidden="true"
          />

          <span className="passport-badge-btn__body">
            <span className="passport-badge-btn__label">
              Create AI Passport
            </span>
            <span className="passport-badge-btn__id">
              Set your AI working style
            </span>
          </span>

          <span className="passport-badge-btn__chevron" aria-hidden="true">
            +
          </span>
        </button>
      </div>
    );
  }

  const shortId = passport.id.split("-").slice(1, 3).join("-");
  const hasConfiguration = Boolean(passport.configuration);
  const sealImage = hasConfiguration
    ? passportStampSilver
    : passportStampBronze;

  const handleCopy = async () => {
    const vault = loadPersonalMemoryVault();
    const attachment = buildPassportAttachmentPreview(
      passport,
      vault.frontalLobeProfile,
    );

    try {
      await navigator.clipboard.writeText(attachment.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      // Clipboard unavailable, for example in tests.
    }
  };

  const handleEditPassport = () => {
    setPanelOpen(false);
    startPassportEdit();
  };

  return (
    <div className="passport-badge-root">
      <button
        ref={triggerRef}
        type="button"
        className={`passport-badge-btn${
          panelOpen ? " passport-badge-btn--open" : ""
        }`}
        aria-label="Open AI Passport"
        aria-expanded={panelOpen}
        aria-haspopup="dialog"
        onClick={() => setPanelOpen((open) => !open)}
        title="Open AI Passport"
      >
        <img
          className="passport-badge-btn__seal"
          src={sealImage}
          alt=""
          aria-hidden="true"
        />

        <span className="passport-badge-btn__body">
          <span className="passport-badge-btn__label">AI Passport</span>
          <span className="passport-badge-btn__id">{shortId}</span>
        </span>

        <span className="passport-badge-btn__chevron" aria-hidden="true">
          ›
        </span>
      </button>

      {panelOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Your AI Passport"
          aria-modal="false"
          className="passport-panel"
          style={{
            position: "static",
            width: "100%",
            boxSizing: "border-box",
            marginTop: "10px",
            maxHeight: "70vh",
          }}
        >
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

          <button
            type="button"
            className={`passport-panel__copy-btn${
              copied ? " passport-panel__copy-btn--copied" : ""
            }`}
            onClick={() => void handleCopy()}
          >
            {copied ? "✓ Copied to clipboard" : "Copy Passport"}
          </button>

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

          <div className="passport-panel__notes">
            <p className="passport-panel__privacy-note">
              🔒 This is not a login credential. Your Passport stays on this
              device.
            </p>

            <p className="passport-panel__compat-note">
              Works by pasting into ChatGPT, Claude, Grok, Gemini, Perplexity,
              and local LLMs. Helps AI follow your preferences.
            </p>
          </div>

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
