// ─────────────────────────────────────────────────────────────────────────────
// Memephant Passport -- The Generated Passport Card
// This is the hero moment. Everything in the flow leads here.
// Design goal: screenshot-worthy, premium, unmistakably yours.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react'
import {
  COMMUNICATION_LABELS,
  TONE_LABELS,
  FOCUS_LABELS,
  formatPassportDate,
} from '../passport.utils'
import { PassportSeal } from './PassportSeal'
import { ShieldIcon } from './PassportIcons'
import { usePassportStore } from '../usePassportStore'
import passportShieldIntegrity from '../../../assets/passport/hero/passport-shield-integrity.png'
import passportStampBronze from '../../../assets/passport/tiers/passport-stamp-bronze.png'
import passportStampGold from '../../../assets/passport/tiers/passport-stamp-gold.png'
import passportStampSilver from '../../../assets/passport/tiers/passport-stamp-silver.png'

// ── Styles ────────────────────────────────────────────────────────────────────

const STAGE: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: '#080c1a',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '28px',
  overflowX: 'hidden',
  overflowY: 'auto',
  padding: '32px 0',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
  animation: 'passport-fade-in 0.4s ease both',
}

const AMBIENT_1: React.CSSProperties = {
  position: 'absolute',
  top: '-5%',
  right: '-10%',
  width: '700px',
  height: '500px',
  borderRadius: '50%',
  background: 'radial-gradient(ellipse, rgba(124,58,237,0.07) 0%, transparent 65%)',
  pointerEvents: 'none',
  animation: 'passport-ambient-pulse 8s ease-in-out infinite',
}

const AMBIENT_2: React.CSSProperties = {
  position: 'absolute',
  bottom: '0',
  left: '-5%',
  width: '600px',
  height: '400px',
  borderRadius: '50%',
  background: 'radial-gradient(ellipse, rgba(245,158,11,0.045) 0%, transparent 65%)',
  pointerEvents: 'none',
  animation: 'passport-ambient-pulse 10s ease-in-out infinite 3s',
}

const CARD: React.CSSProperties = {
  position: 'relative',
  width: 'calc(100% - 48px)',
  maxWidth: '560px',
  minHeight: '330px',
  borderRadius: '16px',
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(12, 16, 30, 0.95)',
  backdropFilter: 'blur(20px)',
  overflow: 'hidden',
  animation: 'passport-slide-up 0.75s cubic-bezier(0.22, 1, 0.36, 1) both',
  boxShadow:
    '0 0 0 1px rgba(245,158,11,0.06) inset, 0 24px 80px rgba(0,0,0,0.6), 0 2px 0 rgba(255,255,255,0.04) inset',
  margin: '0 auto',
}

const CARD_OVERLAY: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background:
    'linear-gradient(135deg, rgba(124,58,237,0.035) 0%, transparent 50%, rgba(245,158,11,0.03) 100%)',
  pointerEvents: 'none',
}

const INTEGRITY_WATERMARK: React.CSSProperties = {
  position: 'absolute',
  right: '-32px',
  bottom: '-42px',
  width: '190px',
  maxWidth: '42%',
  height: 'auto',
  objectFit: 'contain',
  opacity: 0.12,
  pointerEvents: 'none',
  filter: 'drop-shadow(0 0 42px rgba(56,189,248,0.2))',
}

const CARD_HEADER: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '18px 24px 14px',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
}

const HEADER_LEFT: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
}

const PASSPORT_WORDMARK: React.CSSProperties = {
  fontSize: '10.5px',
  fontWeight: 700,
  letterSpacing: '0.22em',
  color: 'rgba(245,158,11,0.65)',
  textTransform: 'uppercase',
}

const PASSPORT_ID_CONTAINER: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
}

const PASSPORT_ID_LABEL: React.CSSProperties = {
  fontSize: '9px',
  fontWeight: 600,
  letterSpacing: '0.18em',
  color: 'rgba(255,255,255,0.18)',
  textTransform: 'uppercase',
}

const CARD_BODY: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '120px 1fr',
  gap: 0,
  padding: '24px 24px 20px',
  alignItems: 'start',
}

const SEAL_COLUMN: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '12px',
  paddingRight: '20px',
  borderRight: '1px solid rgba(255,255,255,0.05)',
  animation: 'passport-section-in 0.6s ease both 0.35s',
}

const STAMP_ROW: React.CSSProperties = {
  display: 'flex',
  gap: '8px',
  justifyContent: 'center',
  marginTop: '2px',
}

const STAMP_IMAGE_BASE: React.CSSProperties = {
  width: '30px',
  height: '30px',
  objectFit: 'contain',
  transition: 'filter 220ms ease, opacity 220ms ease, transform 220ms ease',
}

const FACETS_COLUMN: React.CSSProperties = {
  paddingLeft: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
}

interface FacetRowProps {
  label: string
  value: string
  delay: number
}

function FacetRow({ label, value, delay }: FacetRowProps) {
  return (
    <div style={{ animation: `passport-section-in 0.5s ease both ${delay}ms` }}>
      <div
        style={{
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '0.18em',
          color: 'rgba(245,158,11,0.45)',
          textTransform: 'uppercase',
          marginBottom: '3px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '16px',
          fontWeight: 500,
          color: '#e2e8f0',
          letterSpacing: '-0.005em',
        }}
      >
        {value}
      </div>
    </div>
  )
}

function AnimatedHash({ hash, style }: { hash: string; style?: React.CSSProperties }) {
  const [revealed, setRevealed] = useState(0)

  useEffect(() => {
    let i = 0
    const interval = setInterval(() => {
      i++
      setRevealed(i)
      if (i >= hash.length) clearInterval(interval)
    }, 38)
    return () => clearInterval(interval)
  }, [hash])

  return (
    <span
      style={{
        fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", "Consolas", monospace',
        fontSize: '12px',
        fontWeight: 500,
        letterSpacing: '0.12em',
        color: 'rgba(245,158,11,0.75)',
        ...style,
      }}
      aria-label={`Passport ID: ${hash}`}
    >
      {hash.slice(0, revealed)}
      {revealed < hash.length && (
        <span style={{ color: 'rgba(245,158,11,0.3)', animation: 'passport-dot-bounce 0.8s ease infinite' }}>
          _
        </span>
      )}
    </span>
  )
}

const CARD_FOOTER: React.CSSProperties = {
  borderTop: '1px solid rgba(255,255,255,0.05)',
  padding: '13px 24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  animation: 'passport-section-in 0.5s ease both 0.65s',
}

const FOOTER_TAGS: React.CSSProperties = {
  display: 'flex',
  gap: '14px',
  alignItems: 'center',
}

function FooterTag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: '9px',
        fontWeight: 600,
        letterSpacing: '0.15em',
        color: 'rgba(255,255,255,0.22)',
        textTransform: 'uppercase',
      }}
    >
      {children}
    </span>
  )
}

function FooterDot() {
  return (
    <span
      style={{
        width: '2px',
        height: '2px',
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.12)',
        display: 'inline-block',
      }}
    />
  )
}

function ProgressStamp({ src, alt, active }: { src: string; alt: string; active: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...STAMP_IMAGE_BASE,
        opacity: active ? 0.92 : 0.28,
        filter: active
          ? hovered
            ? 'drop-shadow(0 0 18px rgba(245,158,11,0.3))'
            : 'drop-shadow(0 0 10px rgba(245,158,11,0.18))'
          : 'grayscale(0.35)',
        transform: hovered ? 'translateY(-1px) scale(1.04)' : 'translateY(0) scale(1)',
      }}
    />
  )
}

const DONE_BUTTON_BASE: React.CSSProperties = {
  padding: '11px 28px',
  borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'transparent',
  color: '#94a3b8',
  fontSize: '13px',
  fontWeight: 500,
  letterSpacing: '0.02em',
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'all 0.2s ease',
  animation: 'passport-section-in 0.5s ease both 0.85s',
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function PassportCard() {
  const passport           = usePassportStore(s => s.passport)
  const finishPassportFlow = usePassportStore(s => s.finishPassportFlow)
  const [doneHovered, setDoneHovered] = useState(false)

  // "Enter Memephant" -- releases the gate and clears any re-editing flag so
  // PassportGate switches back to the main app. The persisted passport is intact.
  function handleEnter() {
    finishPassportFlow()
  }

  if (!passport) return null

  const { id, fingerprint, profile, createdAt } = passport

  const doneStyle: React.CSSProperties = {
    ...DONE_BUTTON_BASE,
    borderColor: doneHovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
    color: doneHovered ? '#e2e8f0' : '#94a3b8',
    background: doneHovered ? 'rgba(255,255,255,0.04)' : 'transparent',
  }

  return (
    <div style={STAGE}>
      <div style={AMBIENT_1} />
      <div style={AMBIENT_2} />

      <div style={CARD}>
        <div style={CARD_OVERLAY} />
        <img
          src={passportShieldIntegrity}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          style={INTEGRITY_WATERMARK}
        />

        <div style={CARD_HEADER}>
          <div style={HEADER_LEFT}>
            <ShieldIcon size={14} opacity={0.65} />
            <span style={PASSPORT_WORDMARK}>Memephant Passport</span>
          </div>
          <div style={PASSPORT_ID_CONTAINER}>
            <span style={PASSPORT_ID_LABEL}>ID</span>
            <AnimatedHash hash={id} />
          </div>
        </div>

        <div style={CARD_BODY}>
          <div style={SEAL_COLUMN}>
            <PassportSeal fingerprint={fingerprint} size={80} />
            <div style={STAMP_ROW} aria-label="Passport progression">
              <ProgressStamp src={passportStampBronze} alt="Starter mark" active />
              <ProgressStamp src={passportStampSilver} alt="Calibrated mark" active />
              <ProgressStamp src={passportStampGold} alt="Trusted mark" active={false} />
            </div>
            <div
              style={{
                fontSize: '8.5px',
                fontWeight: 600,
                letterSpacing: '0.12em',
                color: 'rgba(245,158,11,0.35)',
                textTransform: 'uppercase',
                textAlign: 'center',
              }}
            >
              Calibrated
            </div>
          </div>

          <div style={FACETS_COLUMN}>
            <FacetRow label="Communication" value={COMMUNICATION_LABELS[profile.communicationStyle]} delay={200} />
            <FacetRow label="Tone" value={TONE_LABELS[profile.tone]} delay={300} />
            <FacetRow label="Focus" value={FOCUS_LABELS[profile.focusArea]} delay={400} />
          </div>
        </div>

        <div style={CARD_FOOTER}>
          <div style={FOOTER_TAGS}>
            <FooterTag>Local-first</FooterTag>
            <FooterDot />
            <FooterTag>Integrity protected</FooterTag>
            <FooterDot />
            <FooterTag>AI-ready</FooterTag>
          </div>
          <span
            style={{
              fontSize: '9px',
              fontWeight: 500,
              letterSpacing: '0.08em',
              color: 'rgba(255,255,255,0.15)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatPassportDate(createdAt)}
          </span>
        </div>
      </div>

      <p
        style={{
          fontSize: '11px',
          color: '#1e293b',
          letterSpacing: '0.02em',
          textAlign: 'center',
          padding: '0 24px',
          animation: 'passport-section-in 0.5s ease both 0.9s',
        }}
      >
        Stored locally on your device · Never shared without your consent
      </p>

      <button
        style={doneStyle}
        onMouseEnter={() => setDoneHovered(true)}
        onMouseLeave={() => setDoneHovered(false)}
        onFocus={() => setDoneHovered(true)}
        onBlur={() => setDoneHovered(false)}
        onClick={handleEnter}
      >
        Enter Memephant
      </button>
    </div>
  )
}
