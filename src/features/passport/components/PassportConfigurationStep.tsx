// ─────────────────────────────────────────────────────────────────────────────
// Memephant Passport — Optional Configuration Step
// Appears after the 3-question calibration, before generation.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, type FormEvent } from 'react'
import { usePassportStore } from '../usePassportStore'
import { DEFAULT_PASSPORT_CONFIGURATION_V2 } from '../passport.types'
import { loadPersonalMemoryVault } from '../../../services/personalMemoryVaultStorage'
import {
  DEFAULT_FRONTAL_LOBE_PROFILE,
  getFrontalLobeLanguageLabel,
} from '../../../types/personalMemoryVault'

const ROOT: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: '#080c1a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflowX: 'hidden',
  overflowY: 'auto',
  padding: '32px 16px',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
}

const AMBIENT: React.CSSProperties = {
  position: 'absolute',
  top: '-20%',
  left: '50%',
  transform: 'translateX(-50%)',
  width: '680px',
  height: '340px',
  borderRadius: '50%',
  background:
    'radial-gradient(ellipse, rgba(245,158,11,0.055) 0%, transparent 68%)',
  pointerEvents: 'none',
  animation: 'passport-ambient-pulse 8s ease-in-out infinite',
}

const PANEL: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  maxWidth: '620px',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '18px',
  background: 'rgba(12, 16, 30, 0.96)',
  boxShadow:
    '0 24px 80px rgba(0,0,0,0.58), 0 0 0 1px rgba(245,158,11,0.05) inset',
  padding: '28px',
  animation: 'passport-slide-up 0.55s cubic-bezier(0.22, 1, 0.36, 1) both',
}

const EYEBROW: React.CSSProperties = {
  margin: '0 0 8px',
  color: 'rgba(245,158,11,0.55)',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
}

const TITLE: React.CSSProperties = {
  margin: 0,
  color: '#f1f5f9',
  fontSize: '28px',
  fontWeight: 700,
  letterSpacing: '-0.018em',
  lineHeight: 1.15,
}

const SUBTITLE: React.CSSProperties = {
  margin: '10px 0 22px',
  color: '#7aaacc',
  fontSize: '14px',
  lineHeight: 1.5,
}

const GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '12px',
}

const FIELD: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  color: '#8aa8cc',
  fontSize: '11px',
  fontWeight: 700,
}

const INPUT: React.CSSProperties = {
  width: '100%',
  minHeight: '42px',
  border: '1px solid #243a5a',
  borderRadius: '10px',
  background: '#071225',
  color: '#e2e8f0',
  font: 'inherit',
  fontSize: '13px',
  padding: '9px 11px',
  outline: 'none',
}

const READONLY_VALUE: React.CSSProperties = {
  ...INPUT,
  display: 'flex',
  alignItems: 'center',
  color: '#c8daf0',
  background: 'rgba(122, 170, 204, 0.055)',
}

const ACTIONS: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '10px',
  marginTop: '24px',
}

const PRIMARY_BUTTON: React.CSSProperties = {
  minHeight: '42px',
  border: '1px solid rgba(217,119,6,0.5)',
  borderRadius: '10px',
  background: 'linear-gradient(135deg, #d97706, #b45309)',
  color: '#fff',
  font: 'inherit',
  fontSize: '13px',
  fontWeight: 800,
  padding: '0 18px',
  cursor: 'pointer',
}

const SECONDARY_BUTTON: React.CSSProperties = {
  minHeight: '42px',
  border: '1px solid #2a3a5a',
  borderRadius: '10px',
  background: 'transparent',
  color: '#8aa8cc',
  font: 'inherit',
  fontSize: '13px',
  fontWeight: 700,
  padding: '0 16px',
  cursor: 'pointer',
}

const PRIVACY_NOTE: React.CSSProperties = {
  margin: '18px 0 0',
  color: '#607080',
  fontSize: '11px',
  lineHeight: 1.5,
}

type ConfigFormState = {
  preferredName: string
  region: string
  timezone: string
  dateFormat: string
  currency: string
  directness: string
  technicalLevel: string
  riskTolerance: string
}

const DEFAULT_FORM_STATE: ConfigFormState = {
  preferredName: DEFAULT_PASSPORT_CONFIGURATION_V2.preferredName,
  region: DEFAULT_PASSPORT_CONFIGURATION_V2.region,
  timezone: DEFAULT_PASSPORT_CONFIGURATION_V2.timezone,
  dateFormat: DEFAULT_PASSPORT_CONFIGURATION_V2.dateFormat,
  currency: DEFAULT_PASSPORT_CONFIGURATION_V2.currency,
  directness: DEFAULT_PASSPORT_CONFIGURATION_V2.directness,
  technicalLevel: DEFAULT_PASSPORT_CONFIGURATION_V2.technicalLevel,
  riskTolerance: DEFAULT_PASSPORT_CONFIGURATION_V2.riskTolerance,
}

export function PassportConfigurationStep() {
  const generatePassport = usePassportStore(s => s.generatePassport)
  const setFlowStep = usePassportStore(s => s.setFlowStep)
  const [form, setForm] = useState<ConfigFormState>(DEFAULT_FORM_STATE)
  const [vaultSnapshot] = useState(() => loadPersonalMemoryVault())
  const languageLabel = getFrontalLobeLanguageLabel(
    vaultSnapshot.frontalLobeProfile?.languagePreference
      ?? DEFAULT_FRONTAL_LOBE_PROFILE.languagePreference,
  )

  function updateField(field: keyof ConfigFormState, value: string) {
    setForm(current => ({ ...current, [field]: value }))
  }

  function handleComplete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    generatePassport({
      ...form,
      preferredName: form.preferredName.trim(),
      region: form.region.trim() || DEFAULT_PASSPORT_CONFIGURATION_V2.region,
      timezone: form.timezone.trim() || DEFAULT_PASSPORT_CONFIGURATION_V2.timezone,
      dateFormat: form.dateFormat.trim() || DEFAULT_PASSPORT_CONFIGURATION_V2.dateFormat,
      currency: form.currency.trim() || DEFAULT_PASSPORT_CONFIGURATION_V2.currency,
      directness: form.directness.trim() || DEFAULT_PASSPORT_CONFIGURATION_V2.directness,
      technicalLevel: form.technicalLevel.trim() || DEFAULT_PASSPORT_CONFIGURATION_V2.technicalLevel,
      riskTolerance: form.riskTolerance.trim() || DEFAULT_PASSPORT_CONFIGURATION_V2.riskTolerance,
    })
  }

  function handleSkip() {
    generatePassport()
  }

  function handleBack() {
    setFlowStep('q3')
  }

  return (
    <div style={ROOT}>
      <div style={AMBIENT} />
      <form style={PANEL} onSubmit={handleComplete} aria-labelledby="passport-complete-title">
        <p style={EYEBROW}>Optional details</p>
        <h2 id="passport-complete-title" style={TITLE}>Complete your Passport</h2>
        <p style={SUBTITLE}>
          Add the details AI tools need to work with you properly.
        </p>

        <div style={GRID} className="passport-config-step-grid">
          <label style={FIELD}>
            Preferred name
            <input
              style={INPUT}
              type="text"
              value={form.preferredName}
              onChange={(event) => updateField('preferredName', event.target.value)}
              placeholder="Kris"
            />
          </label>

          <label style={FIELD}>
            Region
            <input
              style={INPUT}
              type="text"
              value={form.region}
              onChange={(event) => updateField('region', event.target.value)}
            />
          </label>

          <div style={FIELD}>
            Language / spelling preference
            <div style={READONLY_VALUE} aria-label="Language / spelling preference">
              {languageLabel}
            </div>
          </div>

          <label style={FIELD}>
            Date format
            <input
              style={INPUT}
              type="text"
              value={form.dateFormat}
              onChange={(event) => updateField('dateFormat', event.target.value)}
            />
          </label>

          <label style={FIELD}>
            Currency
            <input
              style={INPUT}
              type="text"
              value={form.currency}
              onChange={(event) => updateField('currency', event.target.value)}
            />
          </label>

          <label style={FIELD}>
            Directness
            <input
              style={INPUT}
              type="text"
              value={form.directness}
              onChange={(event) => updateField('directness', event.target.value)}
            />
          </label>

          <label style={FIELD}>
            Technical level
            <input
              style={INPUT}
              type="text"
              value={form.technicalLevel}
              onChange={(event) => updateField('technicalLevel', event.target.value)}
            />
          </label>

          <label style={FIELD}>
            Risk tolerance
            <input
              style={INPUT}
              type="text"
              value={form.riskTolerance}
              onChange={(event) => updateField('riskTolerance', event.target.value)}
            />
          </label>
        </div>

        <div style={ACTIONS}>
          <button type="button" style={SECONDARY_BUTTON} onClick={handleBack}>
            Back
          </button>
          <button type="button" style={SECONDARY_BUTTON} onClick={handleSkip}>
            Skip for now
          </button>
          <button type="submit" style={PRIMARY_BUTTON}>
            Complete Passport
          </button>
        </div>

        <p style={PRIVACY_NOTE}>
          These working preferences stay local and can be edited later from your AI Passport.
        </p>
      </form>
    </div>
  )
}
