//
// Replaces the cramped sidebar dropdown panel with a calm, full-width page
// that surfaces the user's AI working identity, the three primary actions
// (Copy Passport / Edit Passport / See the Difference) and a clear privacy
// callout.
//
// Routing: rendered by AppShell when projectStore.currentView === 'passport'.
// have a passport AND are in a steady state (flowStep === 'welcome',
// isReeditingPassport === false). The "See the Difference" sub-view is purely
// local state so flowStep is never touched from here.
//
// No cloud sync. No silent attachment.

import React, { useState } from "react";
import { usePassportStore } from "../usePassportStore";
import { buildPassportAttachmentPreview } from "../passportAttachment";
import { loadPersonalMemoryVault } from "../../../services/personalMemoryVaultStorage";
import {
  COMMUNICATION_LABELS,
  FOCUS_LABELS,
  TONE_LABELS,
  formatPassportDate,
  getPassportConfiguration,
} from "../passport.utils";
import { PassportPreviewSimulator } from "./PassportPreviewSimulator";
import passportStampBronze from "../../../assets/passport/tiers/passport-stamp-bronze.png";
import passportStampSilver from "../../../assets/passport/tiers/passport-stamp-silver.png";

const PAGE: React.CSSProperties = {
  width: "100%",
  display: "flex",
  flexDirection: "column",
  gap: "1.25rem",
  padding: "0 1rem 2rem",
  boxSizing: "border-box",
  color: "#e2e8f0",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
};

const HERO: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "1.25rem",
  padding: "1.4rem 1.4rem",
  borderRadius: "18px",
  border: "1px solid rgba(255,255,255,0.08)",
  background:
    "linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(124,58,237,0.05) 100%)",
  boxShadow: "0 0 0 1px rgba(245,158,11,0.05) inset",
};

const HERO_STAMP_COLUMN: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "0.85rem",
  flex: "0 0 260px",
};

const STAMP: React.CSSProperties = {
  width: "220px",
  height: "220px",
  objectFit: "contain",
  flexShrink: 0,
  transform: "scale(1.75)",
  transformOrigin: "center",
  margin: "0.5rem 0 0.85rem",
  cursor: "pointer",
  filter: "drop-shadow(0 0 42px rgba(245,158,11,0.38))",
};

const HERO_TEXT: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.45rem",
  minWidth: 0,
  flex: "1 1 360px",
};
const HERO_ACTION_TITLE: React.CSSProperties = {
  margin: "0.25rem 0 0",
  color: "#f8fafc",
  fontSize: "0.9rem",
  fontWeight: 800,
  letterSpacing: "-0.01em",
  textAlign: "center",
};

const HERO_ACTIONS_VERTICAL: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.55rem",
  width: "100%",
  maxWidth: "220px",
};
const EYEBROW: React.CSSProperties = {
  margin: 0,
  color: "rgba(245,158,11,0.7)",
  fontSize: "11px",
  fontWeight: 800,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
};

const TITLE: React.CSSProperties = {
  margin: 0,
  color: "#f8fafc",
  fontSize: "1.75rem",
  fontWeight: 800,
  letterSpacing: "-0.02em",
  lineHeight: 1.15,
};

const SUBTITLE: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "0.95rem",
  lineHeight: 1.5,
};

const META_ROW: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.5rem 1rem",
  marginTop: "0.4rem",
  fontSize: "11.5px",
  color: "#94a3b8",
  fontFamily:
    'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace',
  letterSpacing: "0.04em",
};

const SECTION: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  padding: "1.2rem",
  borderRadius: "16px",
  border: "1px solid rgba(255,255,255,0.06)",
  background: "rgba(255,255,255,0.025)",
};

const DANGER_SECTION: React.CSSProperties = {
  ...SECTION,
  border: "1px solid rgba(248,113,113,0.18)",
  background:
    "linear-gradient(135deg, rgba(127,29,29,0.16), rgba(255,255,255,0.018))",
};

const SECTION_HEADER: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "0.5rem",
};

const SECTION_TITLE: React.CSSProperties = {
  margin: 0,
  color: "#f1f5f9",
  fontSize: "0.95rem",
  fontWeight: 800,
  letterSpacing: "-0.005em",
};

const SECTION_HELP: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "0.82rem",
  lineHeight: 1.5,
};

const FACET_GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "0.6rem",
};

const FACET: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.25rem",
  padding: "0.7rem 0.9rem",
  borderRadius: "10px",
  background: "rgba(0,0,0,0.18)",
  border: "1px solid rgba(255,255,255,0.04)",
};

const FACET_LABEL: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  letterSpacing: "0.12em",
  color: "rgba(245,158,11,0.55)",
  textTransform: "uppercase",
};

const FACET_VALUE: React.CSSProperties = {
  fontSize: "0.95rem",
  fontWeight: 600,
  color: "#e2e8f0",
};

const ACTIONS: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: "0.6rem",
  alignItems: "center",
};

const BTN_BASE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.4rem",
  minHeight: "42px",
  padding: "0 1.05rem",
  borderRadius: "10px",
  fontSize: "13px",
  fontWeight: 800,
  letterSpacing: "0.01em",
  cursor: "pointer",
  fontFamily: "inherit",
  transition:
    "transform 0.12s ease, background 0.18s ease, border-color 0.18s ease",
  outline: "none",
};

const BTN_PRIMARY: React.CSSProperties = {
  ...BTN_BASE,
  border: "1px solid rgba(217,119,6,0.55)",
  background: "linear-gradient(135deg, #d97706, #b45309)",
  color: "#fff",
};

const BTN_PRIMARY_COPIED: React.CSSProperties = {
  ...BTN_PRIMARY,
  background: "linear-gradient(135deg, #059669, #047857)",
  cursor: "default",
};

const BTN_SECONDARY: React.CSSProperties = {
  ...BTN_BASE,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "rgba(255,255,255,0.03)",
  color: "#cbd5e1",
};

const BTN_DANGER: React.CSSProperties = {
  ...BTN_BASE,
  border: "1px solid rgba(248,113,113,0.35)",
  background: "rgba(127,29,29,0.12)",
  color: "#fecaca",
};

const BTN_DANGER_SOLID: React.CSSProperties = {
  ...BTN_BASE,
  border: "1px solid rgba(248,113,113,0.55)",
  background: "linear-gradient(135deg, #dc2626, #991b1b)",
  color: "#fff",
};

const PRIVACY_NOTE: React.CSSProperties = {
  margin: 0,
  color: "#94a3b8",
  fontSize: "0.82rem",
  lineHeight: 1.55,
};

const WARNING_TEXT: React.CSSProperties = {
  margin: 0,
  color: "#fca5a5",
  fontSize: "0.82rem",
  lineHeight: 1.55,
};

const STAMP_BUTTON: React.CSSProperties = {
  appearance: "none",
  border: "none",
  padding: 0,
  margin: 0,
  background: "transparent",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const STAMP_SHOWCASE: React.CSSProperties = {
  width: "100%",
  minHeight: "calc(100vh - 120px)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "1.5rem",
  padding: "2rem 1rem",
  boxSizing: "border-box",
  color: "#e2e8f0",
  textAlign: "center",
};

const STAMP_SHOWCASE_FRAME: React.CSSProperties = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "min(76vw, 620px)",
  height: "min(76vw, 620px)",
  borderRadius: "999px",
  background:
    "radial-gradient(circle, rgba(245,158,11,0.20) 0%, rgba(124,58,237,0.10) 38%, rgba(15,23,42,0) 72%)",
  animation: "passportStampGlow 1.15s ease-out both",
};

const STAMP_SHOWCASE_IMAGE: React.CSSProperties = {
  width: "min(64vw, 520px)",
  height: "min(64vw, 520px)",
  objectFit: "contain",
  filter: "drop-shadow(0 0 70px rgba(245,158,11,0.55))",
  animation: "passportStampRise 1.15s ease-out both",
};

const STAMP_SHOWCASE_TITLE: React.CSSProperties = {
  margin: 0,
  color: "#f8fafc",
  fontSize: "1.35rem",
  fontWeight: 900,
  letterSpacing: "-0.02em",
};
const STAMP_SHOWCASE_SUBTITLE: React.CSSProperties = {
  margin: "-0.8rem 0 0",
  color: "#94a3b8",
  fontSize: "0.95rem",
  lineHeight: 1.45,
};

const EMPTY_HERO: React.CSSProperties = {
  ...HERO,
  flexDirection: "column",
  alignItems: "flex-start",
  background:
    "linear-gradient(135deg, rgba(217,119,6,0.10) 0%, rgba(124,58,237,0.05) 100%)",
};

export function PassportPage() {
  const passport = usePassportStore((s) => s.passport);
  const startPassportEdit = usePassportStore((s) => s.startPassportEdit);
  const resetPassport = usePassportStore((s) => s.resetPassport);

  const [copied, setCopied] = useState(false);
  const [subview, setSubview] = useState<"details" | "simulator" | "stamp">("details");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!passport) {
    return (
      <div className="workspace-scroll">
        <div className="workspace-main">
          <section style={PAGE} aria-label="Working Style Profile page">
            <div style={EMPTY_HERO}>
              <img
                src={passportStampBronze}
                alt=""
                aria-hidden="true"
                style={STAMP}
              />
              <div style={HERO_TEXT}>
                <p style={EYEBROW}>Working Style Profile</p>
                <h1 style={TITLE}>Set your AI working style</h1>
                <p style={SUBTITLE}>
                  Tell AI tools how you work once. Then carry that identity
                  conversation without re-explaining yourself.
                </p>
              </div>
            </div>

            <div style={ACTIONS}>
              <button
                type="button"
                style={BTN_PRIMARY}
                onClick={startPassportEdit}
                aria-label="Create your Working Style Profile"
              >
                Create Working Style Profile
              </button>
            </div>

            <p style={PRIVACY_NOTE}>
              Your Passport stays on this device. Nothing is shared until you
              copy it into an AI tool yourself.
            </p>
          </section>
        </div>
      </div>
    );
  }

  if (subview === "simulator") {
    return (
      <div className="workspace-scroll">
        <div
          className="workspace-main"
          style={{ display: "flex", justifyContent: "center" }}
        >
          <PassportPreviewSimulator
            passport={passport}
            onCopyPassport={() => void handleCopy()}
            onBack={() => setSubview("details")}
          />
        </div>
      </div>
    );
  }

  const hasConfiguration = Boolean(passport.configuration);
  const sealImage = hasConfiguration
    ? passportStampSilver
    : passportStampBronze;
  const config = getPassportConfiguration(passport);
  if (subview === "stamp") {
    return (
      <div className="workspace-scroll">
        <style>
          {`
            @keyframes passportStampGlow {
              0% {
                opacity: 0;
                transform: scale(0.82);
                box-shadow: 0 0 0 rgba(245, 158, 11, 0);
              }
              45% {
                opacity: 1;
                transform: scale(1.04);
                box-shadow: 0 0 120px rgba(245, 158, 11, 0.38);
              }
              100% {
                opacity: 1;
                transform: scale(1);
                box-shadow: 0 0 52px rgba(245, 158, 11, 0.18);
              }
            }

            @keyframes passportStampRise {
              0% {
                opacity: 0;
                transform: translateY(18px) scale(0.78);
              }
              55% {
                opacity: 1;
                transform: translateY(-4px) scale(1.06);
              }
              100% {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
          `}
        </style>

        <div className="workspace-main">
          <section style={STAMP_SHOWCASE} aria-label="Working Style Profile stamp showcase">
            <div style={STAMP_SHOWCASE_FRAME}>
              <img
                src={sealImage}
                alt="Working Style Profile stamp"
                style={STAMP_SHOWCASE_IMAGE}
              />
            </div>

            <h1 style={STAMP_SHOWCASE_TITLE}>
              {hasConfiguration
                ? "Silver Profile Activated"
                : "Bronze Profile Activated"}
            </h1>

            <p style={STAMP_SHOWCASE_SUBTITLE}>
              Your AI working style is ready.
            </p>

            <button
              type="button"
              style={BTN_SECONDARY}
              onClick={() => setSubview("details")}
              aria-label="Back to Working Style Profile"
            >
              Back to Profile
            </button>
          </section>
        </div>
      </div>
    );
  }


  async function handleCopy() {
    if (!passport) return;
    const vault = loadPersonalMemoryVault();
    const attachment = buildPassportAttachmentPreview(
      passport,
      vault.frontalLobeProfile,
    );

    try {
      await navigator.clipboard.writeText(attachment.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      // Clipboard may be unavailable in tests or restricted browser contexts.
    }
  }

  function handleEdit() {
    startPassportEdit();
  }

  function handleSeeTheDifference() {
    setSubview("simulator");
  }

  function handleDeletePassport() {
    resetPassport();
    setConfirmingDelete(false);
    setSubview("details");
  }

  return (
    <div className="workspace-scroll">
      <div className="workspace-main">
        <section style={PAGE} aria-label="Working Style Profile page">
          {/* Hero */}
          <header style={HERO} aria-label="Working Style Profile">
            <div style={HERO_STAMP_COLUMN}>
              <button
                type="button"
                style={STAMP_BUTTON}
                onClick={() => setSubview("stamp")}
                aria-label="Open Working Style Profile stamp showcase"
                title="Open Working Style Profile stamp"
              >
                <img src={sealImage} alt="" aria-hidden="true" style={STAMP} />
              </button>

              <h2 style={HERO_ACTION_TITLE}>Use your profile</h2>

              <div
                style={HERO_ACTIONS_VERTICAL}
                role="group"
                aria-label="Profile actions"
              >
                <button
                  type="button"
                  style={copied ? BTN_PRIMARY_COPIED : BTN_PRIMARY}
                  onClick={() => void handleCopy()}
                  aria-label="Copy Working Style Profile to clipboard"
                >
                  {copied ? "Copied to clipboard" : "Copy Profile"}
                </button>

                <button
                  type="button"
                  style={BTN_SECONDARY}
                  onClick={handleEdit}
                  aria-label="Edit your Working Style Profile"
                >
                  Edit Profile
                </button>

                <button
                  type="button"
                  style={BTN_SECONDARY}
                  onClick={handleSeeTheDifference}
                  aria-label="See the difference your Working Style Profile makes"
                >
                  See the Difference
                </button>
              </div>
            </div>
            <div style={HERO_TEXT}>
              <p style={EYEBROW}>Working Style Profile</p>
              <h1 style={TITLE}>Your AI working style</h1>
              <p style={SUBTITLE}>
                Carry your style, tone, and preferences into every AI
                conversation without re-explaining yourself.
              </p>
              <div style={META_ROW}>
                <span>ID | {passport.id}</span>
                <span>
                  Calibrated | {formatPassportDate(passport.createdAt)}
                </span>
                <span>{hasConfiguration ? "Tier | Silver" : "Tier | Bronze"}</span>
              </div>
            </div>
          </header>

          <section style={SECTION} aria-label="Working style">
            <div style={SECTION_HEADER}>
              <h2 style={SECTION_TITLE}>Working style</h2>
            </div>
            <div style={FACET_GRID}>
              <div style={FACET}>
                <span style={FACET_LABEL}>Style</span>
                <span style={FACET_VALUE}>
                  {COMMUNICATION_LABELS[passport.profile.communicationStyle]}
                </span>
              </div>
              <div style={FACET}>
                <span style={FACET_LABEL}>Tone</span>
                <span style={FACET_VALUE}>
                  {TONE_LABELS[passport.profile.tone]}
                </span>
              </div>
              <div style={FACET}>
                <span style={FACET_LABEL}>Focus</span>
                <span style={FACET_VALUE}>
                  {FOCUS_LABELS[passport.profile.focusArea]}
                </span>
              </div>
            </div>
          </section>

          <section style={SECTION} aria-label="Identity preferences">
            <div style={SECTION_HEADER}>
              <h2 style={SECTION_TITLE}>Identity preferences</h2>
              <p style={SECTION_HELP}>Edit Profile to refine these.</p>
            </div>
            <div style={FACET_GRID}>
              {config.preferredName.trim() && (
                <div style={FACET}>
                  <span style={FACET_LABEL}>Preferred name</span>
                  <span style={FACET_VALUE}>{config.preferredName}</span>
                </div>
              )}
              {config.roleContext.trim() && (
                <div style={FACET}>
                  <span style={FACET_LABEL}>Role / context</span>
                  <span style={FACET_VALUE}>{config.roleContext}</span>
                </div>
              )}
              <div style={FACET}>
                <span style={FACET_LABEL}>Region</span>
                <span style={FACET_VALUE}>{config.region}</span>
              </div>
              <div style={FACET}>
                <span style={FACET_LABEL}>Language</span>
                <span style={FACET_VALUE}>{config.languagePreference}</span>
              </div>
              <div style={FACET}>
                <span style={FACET_LABEL}>Directness</span>
                <span style={FACET_VALUE}>{config.directness}</span>
              </div>
              <div style={FACET}>
                <span style={FACET_LABEL}>Technical level</span>
                <span style={FACET_VALUE}>{config.technicalLevel}</span>
              </div>
              <div style={FACET}>
                <span style={FACET_LABEL}>Risk tolerance</span>
                <span style={FACET_VALUE}>{config.riskTolerance}</span>
              </div>
            </div>
          </section>

          {/* Privacy */}
          <section style={SECTION} aria-label="Passport privacy">
            <div style={SECTION_HEADER}>
              <h2 style={SECTION_TITLE}>Local-first by design</h2>
            </div>
            <p style={PRIVACY_NOTE}>
              Your Working Style Profile is stored on this device only. It stays
              local unless you copy it into an AI tool yourself.
            </p>
            <p style={PRIVACY_NOTE}>
              Project state lives in <strong>Context Passport</strong>, not here.
              Working Style Profile is personal preference; Context Passport is
              the project handoff.
            </p>
          </section>
          <section style={DANGER_SECTION} aria-label="Delete Working Style Profile">
            <div style={SECTION_HEADER}>
              <h2 style={SECTION_TITLE}>Delete Profile</h2>
            </div>

            {!confirmingDelete ? (
              <>
                <p style={PRIVACY_NOTE}>
                  Remove your local Working Style Profile from this device. This does not
                  delete projects, Context Passport exports, or your Memory Vault.
                </p>

                <div style={ACTIONS}>
                  <button
                    type="button"
                    style={BTN_DANGER}
                    onClick={() => setConfirmingDelete(true)}
                    aria-label="Delete Working Style Profile"
                  >
                    Delete Profile
                  </button>
                </div>
              </>
            ) : (
              <>
                <p style={WARNING_TEXT}>
                  Are you sure? This removes your local profile and you will
                  need to create it again before copying it into AI tools.
                </p>

                <div style={ACTIONS}>
                  <button
                    type="button"
                    style={BTN_SECONDARY}
                    onClick={() => setConfirmingDelete(false)}
                    aria-label="Cancel deleting Working Style Profile"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    style={BTN_DANGER_SOLID}
                    onClick={handleDeletePassport}
                    aria-label="Confirm delete Working Style Profile"
                  >
                    Yes, delete Profile
                  </button>
                </div>
              </>
            )}
          </section>
        </section>
      </div>
    </div>
  );
}

export default PassportPage;
