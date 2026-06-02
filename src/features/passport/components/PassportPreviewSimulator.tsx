import React, { useMemo, useState } from 'react';
import type { PassportData } from '../passport.types';
import { buildPassportSimulation } from '../passportSimulator';

const SHELL: React.CSSProperties = {
  width: 'calc(100% - 32px)',
  maxWidth: '960px',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '18px',
  background: 'rgba(12, 16, 30, 0.96)',
  boxShadow:
    '0 24px 80px rgba(0,0,0,0.58), 0 0 0 1px rgba(245,158,11,0.05) inset',
  padding: '24px',
  animation: 'passport-slide-up 0.55s cubic-bezier(0.22, 1, 0.36, 1) both',
};

const HEADER: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '18px',
  alignItems: 'flex-start',
  marginBottom: '18px',
};

const EYEBROW: React.CSSProperties = {
  margin: '0 0 7px',
  color: 'rgba(245,158,11,0.62)',
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
};

const TITLE: React.CSSProperties = {
  margin: 0,
  color: '#f8fafc',
  fontSize: '24px',
  fontWeight: 800,
  letterSpacing: '-0.015em',
};

const SUBTITLE: React.CSSProperties = {
  margin: '8px 0 0',
  color: '#7aaacc',
  fontSize: '14px',
  lineHeight: 1.5,
};

const PROMPT: React.CSSProperties = {
  border: '1px solid rgba(122, 170, 204, 0.16)',
  borderRadius: '12px',
  background: 'rgba(122, 170, 204, 0.055)',
  color: '#d8e2f5',
  fontSize: '13px',
  lineHeight: 1.5,
  padding: '12px 14px',
  marginBottom: '16px',
};

const COMPARISON: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: '14px',
};

const RESPONSE_CARD: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '14px',
  background: 'rgba(255,255,255,0.025)',
  padding: '16px',
  minHeight: '260px',
};

const RESPONSE_TITLE: React.CSSProperties = {
  margin: '0 0 12px',
  color: '#f8fafc',
  fontSize: '15px',
  fontWeight: 800,
};

const RESPONSE_TEXT: React.CSSProperties = {
  margin: 0,
  color: '#c8daf0',
  fontSize: '13px',
  lineHeight: 1.55,
  whiteSpace: 'pre-wrap',
};

const SIMULATION_NOTE: React.CSSProperties = {
  margin: '14px 0 0',
  color: '#607080',
  fontSize: '11px',
  lineHeight: 1.5,
};

const ACTIONS: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  justifyContent: 'flex-end',
  marginTop: '18px',
};

const PRIMARY_BUTTON: React.CSSProperties = {
  minHeight: '40px',
  border: '1px solid rgba(217,119,6,0.5)',
  borderRadius: '10px',
  background: 'linear-gradient(135deg, #d97706, #b45309)',
  color: '#fff',
  font: 'inherit',
  fontSize: '13px',
  fontWeight: 800,
  padding: '0 16px',
  cursor: 'pointer',
};

const SECONDARY_BUTTON: React.CSSProperties = {
  minHeight: '40px',
  border: '1px solid #2a3a5a',
  borderRadius: '10px',
  background: 'transparent',
  color: '#8aa8cc',
  font: 'inherit',
  fontSize: '13px',
  fontWeight: 700,
  padding: '0 16px',
  cursor: 'pointer',
};

type PassportPreviewSimulatorProps = {
  passport: PassportData;
  onCopyPassport: () => Promise<void> | void;
  onBack: () => void;
};

export function PassportPreviewSimulator({
  passport,
  onCopyPassport,
  onBack,
}: PassportPreviewSimulatorProps) {
  const simulation = useMemo(() => buildPassportSimulation(passport), [passport]);
  const [copied, setCopied] = useState(false);

  async function handleCopyPassport() {
    await onCopyPassport();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  }

  async function handleTryInChatGPT() {
    await handleCopyPassport();
    window.open('https://chatgpt.com/', '_blank', 'noopener,noreferrer');
  }

  return (
    <section style={SHELL} aria-labelledby="passport-preview-title">
      <div style={HEADER}>
        <div>
          <p style={EYEBROW}>Working Style Preview</p>
          <h2 id="passport-preview-title" style={TITLE}>
            See how your profile changes the way AI responds.
          </h2>
          <p style={SUBTITLE}>
            This is a local template preview, not a real AI response.
          </p>
        </div>
      </div>

      <div style={PROMPT}>
        <strong>Example prompt:</strong> "{simulation.prompt}"
      </div>

      <div style={COMPARISON}>
        <article style={RESPONSE_CARD}>
          <h3 style={RESPONSE_TITLE}>Without Profile</h3>
          <p style={RESPONSE_TEXT}>{simulation.genericResponse}</p>
        </article>

        <article style={RESPONSE_CARD}>
          <h3 style={RESPONSE_TITLE}>With your Profile</h3>
          <p style={RESPONSE_TEXT}>{simulation.passportResponse}</p>
        </article>
      </div>

      <p style={SIMULATION_NOTE}>
        Nothing is sent anywhere. This preview uses only your local profile settings.
      </p>

      <div style={ACTIONS}>
        <button type="button" style={SECONDARY_BUTTON} onClick={onBack}>
          Back to Profile
        </button>
        <button type="button" style={SECONDARY_BUTTON} onClick={() => void handleTryInChatGPT()}>
          Try in ChatGPT
        </button>
        <button type="button" style={PRIMARY_BUTTON} onClick={() => void handleCopyPassport()}>
          {copied ? 'Copied' : 'Copy Profile'}
        </button>
      </div>
    </section>
  );
}
