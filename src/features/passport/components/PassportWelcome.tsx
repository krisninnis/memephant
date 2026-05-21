// ─────────────────────────────────────────────────────────────────────────────
// Memephant Passport — Welcome Screen (Step 1)
// Full-screen, dark-mode, minimal. Single CTA. 90-second promise.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react'
import { usePassportStore } from '../usePassportStore'
import { ShieldIcon, ChevronRight } from './PassportIcons'
import passportShieldPrimary from '../../../assets/passport/hero/passport-shield-primary.png'

// ─── Styles ───────────────────────────────────────────────────────────────────

const ROOT: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: '#080c1a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
}

const BLOB_1: React.CSSProperties = {
  position: 'absolute',
  top: '-15%',
  right: '-8%',
  width: '520px',
  height: '520px',
  borderRadius: '50%',
  background:
    'radial-gradient(circle, rgba(124,58,237,0.09) 0%, transparent 65%)',
  pointerEvents: 'none',
  animation: 'passport-ambient-pulse 7s ease-in-out infinite',
}

const BLOB_2: React.CSSProperties = {
  position: 'absolute',
  bottom: '-20%',
  left: '-8%',
  width: '580px',
  height: '580px',
  borderRadius: '50%',
  background:
    'radial-gradient(circle, rgba(245,158,11,0.055) 0%, transparent 65%)',
  pointerEvents: 'none',
  animation: 'passport-ambient-pulse 9s ease-in-out infinite 2.5s',
}

const CONTENT: React.CSSProperties = {
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 0,
  textAlign: 'center',
  padding: '0 32px',
  maxWidth: '480px',
  width: '100%',
  animation: 'passport-fade-in 0.9s ease both',
}

const HERO_MARK_WRAP: React.CSSProperties = {
  width: 'min(220px, 58vw)',
  aspectRatio: '1',
  display: 'grid',
  placeItems: 'center',
  marginBottom: '28px',
}

const BRAND_ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '7px',
  marginBottom: '24px',
}

const BRAND_LABEL: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.2em',
  color: 'rgba(245,158,11,0.5)',
  textTransform: 'uppercase',
}

const HEADLINE: React.CSSProperties = {
  fontSize: '42px',
  fontWeight: 700,
  color: '#f1f5f9',
  lineHeight: 1.08,
  letterSpacing: '-0.025em',
  margin: 0,
}

const SUBHEADLINE: React.CSSProperties = {
  fontSize: '18px',
  fontWeight: 400,
  color: '#4b5563',
  marginTop: '12px',
  letterSpacing: '-0.01em',
}

const DIVIDER: React.CSSProperties = {
  width: '40px',
  height: '1px',
  background: 'rgba(255,255,255,0.07)',
  margin: '32px auto',
}

const PRIVACY_NOTE: React.CSSProperties = {
  marginTop: '18px',
  fontSize: '11px',
  fontWeight: 400,
  color: '#2d3748',
  letterSpacing: '0.01em',
  lineHeight: 1.6,
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PassportWelcome() {
  const setFlowStep = usePassportStore(s => s.setFlowStep)
  const [hovered, setHovered] = useState(false)
  const [heroHovered, setHeroHovered] = useState(false)

  function handleStart() {
    setFlowStep('q1')
  }

  const ctaStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '14px 32px',
    background: hovered
      ? 'rgba(245,158,11,0.15)'
      : 'rgba(245,158,11,0.08)',
    border: `1px solid ${hovered ? 'rgba(245,158,11,0.65)' : 'rgba(245,158,11,0.35)'}`,
    borderRadius: '9px',
    color: hovered ? '#fbbf24' : '#f59e0b',
    fontSize: '14px',
    fontWeight: 600,
    letterSpacing: '0.04em',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s ease',
    outline: 'none',
    animation: 'passport-pulse-amber 3.5s ease-in-out infinite 1.2s',
  }

  const heroImageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
    filter: heroHovered
      ? 'drop-shadow(0 0 34px rgba(245,158,11,0.26)) drop-shadow(0 0 70px rgba(56,189,248,0.12))'
      : 'drop-shadow(0 0 22px rgba(245,158,11,0.16))',
    opacity: 0.96,
    transform: heroHovered ? 'translateY(-2px) scale(1.015)' : 'translateY(0) scale(1)',
    transition: 'filter 260ms ease, transform 260ms ease, opacity 260ms ease',
  }

  return (
    <div style={ROOT}>
      {/* Ambient background glows */}
      <div style={BLOB_1} />
      <div style={BLOB_2} />

      <div style={CONTENT}>
        {/* Brand mark */}
        <div style={BRAND_ROW}>
          <ShieldIcon size={13} opacity={0.45} />
          <span style={BRAND_LABEL}>Memephant</span>
        </div>

        <div
          style={HERO_MARK_WRAP}
          onMouseEnter={() => setHeroHovered(true)}
          onMouseLeave={() => setHeroHovered(false)}
        >
          <img
            src={passportShieldPrimary}
            alt=""
            aria-hidden="true"
            decoding="async"
            fetchPriority="high"
            style={heroImageStyle}
          />
        </div>

        {/* Headline */}
        <h1 style={HEADLINE}>
          Create your<br />AI Passport
        </h1>

        <p style={SUBHEADLINE}>Teach AI how you work, once.</p>

        <div style={DIVIDER} />

        {/* CTA */}
        <button
          style={ctaStyle}
          onClick={handleStart}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          onFocus={() => setHovered(true)}
          onBlur={() => setHovered(false)}
        >
          Start Passport Setup
          <ChevronRight size={15} color="currentColor" />
        </button>

        <p style={PRIVACY_NOTE}>
          About 90 seconds &nbsp;·&nbsp; Stored locally on your device
          <br />
          Never transmitted without your consent
        </p>
      </div>
    </div>
  )
}
