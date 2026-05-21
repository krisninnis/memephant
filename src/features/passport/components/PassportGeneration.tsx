// ─────────────────────────────────────────────────────────────────────────────
// Memephant Passport — Generation Screen
// The intentional 2-second pause between submission and passport reveal.
// This beat is emotional, not technical. Do not skip it.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { GeneratingDots } from './PassportIcons'

// ─── Styles ───────────────────────────────────────────────────────────────────

const ROOT: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: '#080c1a',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '16px',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
}

const AMBIENT_TOP: React.CSSProperties = {
  position: 'absolute',
  top: '-10%',
  left: '50%',
  transform: 'translateX(-50%)',
  width: '800px',
  height: '400px',
  borderRadius: '50%',
  background:
    'radial-gradient(ellipse, rgba(245,158,11,0.04) 0%, transparent 60%)',
  pointerEvents: 'none',
  animation: 'passport-ambient-pulse 3s ease-in-out infinite',
}

const AMBIENT_BOT: React.CSSProperties = {
  position: 'absolute',
  bottom: '-10%',
  left: '50%',
  transform: 'translateX(-50%)',
  width: '600px',
  height: '300px',
  borderRadius: '50%',
  background:
    'radial-gradient(ellipse, rgba(124,58,237,0.05) 0%, transparent 60%)',
  pointerEvents: 'none',
  animation: 'passport-ambient-pulse 4s ease-in-out infinite 1s',
}

const LABEL: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 500,
  color: '#475569',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  animation: 'passport-fade-in 0.5s ease both',
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PassportGeneration() {
  return (
    <div style={ROOT} role="status" aria-live="polite" aria-label="Generating your passport">
      <div style={AMBIENT_TOP} />
      <div style={AMBIENT_BOT} />

      <GeneratingDots color="#f59e0b" />
      <p style={LABEL}>Calibrating your passport</p>
    </div>
  )
}
