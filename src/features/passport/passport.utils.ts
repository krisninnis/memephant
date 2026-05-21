// ─────────────────────────────────────────────────────────────────────────────
// Memephant Passport — Utilities
// Pure functions. No side-effects. No imports from React or Zustand.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  PassportProfile,
  PassportData,
  CommunicationStyle,
  WorkingTone,
  FocusArea,
  CalibrationQuestion,
} from './passport.types'

// ─── Fingerprint derivation ───────────────────────────────────────────────────

/**
 * Derives a deterministic 16-character uppercase hex string from the passport
 * profile choices. NOT cryptographically secure — for display/identity only.
 *
 * Uses a MurmurHash3-inspired mixing algorithm for good distribution.
 * Same inputs always produce the same fingerprint (content-addressed identity).
 */
export function deriveFingerprint(profile: PassportProfile): string {
  const seed = `${profile.communicationStyle}|${profile.tone}|${profile.focusArea}`

  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57

  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507)
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507)
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909)

  const a = (h1 >>> 0).toString(16).padStart(8, '0').toUpperCase()
  const b = (h2 >>> 0).toString(16).padStart(8, '0').toUpperCase()

  return `${a}${b}`
}

/**
 * Formats a 16-char fingerprint as a readable branded Passport ID.
 * e.g. "MPH-A4F2-19C8-7BE1"
 */
export function formatPassportId(fingerprint: string): string {
  const f = fingerprint.slice(0, 12)
  return `MPH-${f.slice(0, 4)}-${f.slice(4, 8)}-${f.slice(8, 12)}`
}

/**
 * Derives 8 numeric values (0–15) from the fingerprint hex chars.
 * Used by PassportSeal to generate unique, deterministic shapes.
 */
export function getFingerprintValues(fingerprint: string): number[] {
  return fingerprint.slice(0, 8).split('').map(c => parseInt(c, 16))
}

// ─── Passport creation ────────────────────────────────────────────────────────

/**
 * Creates a complete PassportData record from a finished profile.
 * The only place PassportData is instantiated.
 */
export function createPassportData(profile: PassportProfile): PassportData {
  const fingerprint = deriveFingerprint(profile)
  return {
    id: formatPassportId(fingerprint),
    fingerprint,
    profile,
    createdAt: new Date().toISOString(),
    schemaVersion: '1.0',
  }
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Formats an ISO date string to passport-style display.
 * e.g. "21 MAY 2026"
 */
export function formatPassportDate(isoString: string): string {
  const date = new Date(isoString)
  const day = date.getDate().toString().padStart(2, '0')
  const month = date
    .toLocaleString('en-GB', { month: 'short' })
    .toUpperCase()
  const year = date.getFullYear()
  return `${day} ${month} ${year}`
}

// ─── Question definitions ─────────────────────────────────────────────────────

export const CALIBRATION_QUESTIONS: [
  CalibrationQuestion<CommunicationStyle>,
  CalibrationQuestion<WorkingTone>,
  CalibrationQuestion<FocusArea>,
] = [
  {
    step: 'q1',
    profileKey: 'communicationStyle',
    number: '01 / 03',
    prompt: 'How should AI communicate with you?',
    options: [
      { value: 'structured',    label: 'Structured' },
      { value: 'step-by-step',  label: 'Step-by-step' },
      { value: 'concise',       label: 'Concise' },
      { value: 'collaborative', label: 'Collaborative' },
      { value: 'technical',     label: 'Technical' },
    ],
  },
  {
    step: 'q2',
    profileKey: 'tone',
    number: '02 / 03',
    prompt: 'What tone fits you best?',
    options: [
      { value: 'friendly',     label: 'Friendly' },
      { value: 'professional', label: 'Professional' },
      { value: 'direct',       label: 'Direct' },
      { value: 'technical',    label: 'Technical' },
      { value: 'creative',     label: 'Creative' },
    ],
  },
  {
    step: 'q3',
    profileKey: 'focusArea',
    number: '03 / 03',
    prompt: 'What are you building right now?',
    options: [
      { value: 'startup',  label: 'Startup' },
      { value: 'app',      label: 'App' },
      { value: 'game',     label: 'Game' },
      { value: 'research', label: 'Research' },
      { value: 'business', label: 'Business' },
      { value: 'writing',  label: 'Writing' },
      { value: 'other',    label: 'Other' },
    ],
  },
]

// ─── Display label maps ───────────────────────────────────────────────────────

export const COMMUNICATION_LABELS: Record<CommunicationStyle, string> = {
  'structured':    'Structured',
  'step-by-step':  'Step-by-step',
  'concise':       'Concise',
  'collaborative': 'Collaborative',
  'technical':     'Technical',
}

export const TONE_LABELS: Record<WorkingTone, string> = {
  'friendly':     'Friendly',
  'professional': 'Professional',
  'direct':       'Direct',
  'technical':    'Technical',
  'creative':     'Creative',
}

export const FOCUS_LABELS: Record<FocusArea, string> = {
  'startup':  'Startup',
  'app':      'App',
  'game':     'Game',
  'research': 'Research',
  'business': 'Business',
  'writing':  'Writing',
  'other':    'Other',
}
