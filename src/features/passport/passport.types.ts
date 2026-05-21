// ─────────────────────────────────────────────────────────────────────────────
// Memephant Passport — Type Definitions
// Schema v1.0 — all fields optional-safe for future additions
// ─────────────────────────────────────────────────────────────────────────────

export type CommunicationStyle =
  | 'structured'
  | 'step-by-step'
  | 'concise'
  | 'collaborative'
  | 'technical'

export type WorkingTone =
  | 'friendly'
  | 'professional'
  | 'direct'
  | 'technical'
  | 'creative'

export type FocusArea =
  | 'startup'
  | 'app'
  | 'game'
  | 'research'
  | 'business'
  | 'writing'
  | 'other'

/** The six steps of the passport creation flow */
export type PassportFlowStep =
  | 'welcome'
  | 'q1'
  | 'q2'
  | 'q3'
  | 'generating'
  | 'complete'

/** The three calibration answers that form a passport */
export interface PassportProfile {
  communicationStyle: CommunicationStyle
  tone: WorkingTone
  focusArea: FocusArea
}

/** The complete, persisted passport record */
export interface PassportData {
  /** Branded ID — e.g. "MPH-A4F2-19C8-7BE1" */
  id: string
  /** 16-character uppercase hex, deterministic from profile */
  fingerprint: string
  /** The three calibration answers */
  profile: PassportProfile
  /** ISO 8601 creation timestamp */
  createdAt: string
  /** Schema version — increment on breaking changes */
  schemaVersion: '1.0'
}

// ─── Store shape ─────────────────────────────────────────────────────────────

export interface PassportStoreState {
  /** null = passport not yet created */
  passport: PassportData | null
  /** Current step in the creation flow (not persisted — restarts fresh) */
  flowStep: PassportFlowStep
  /** Partial answers accumulating during calibration */
  draft: Partial<PassportProfile>
  /** True during the artificial generation delay */
  isGenerating: boolean
}

export interface PassportStoreActions {
  setFlowStep: (step: PassportFlowStep) => void
  setDraftAnswer: <K extends keyof PassportProfile>(
    key: K,
    value: PassportProfile[K]
  ) => void
  generatePassport: () => void
  resetPassport: () => void
}

export type PassportStore = PassportStoreState & PassportStoreActions

// ─── Question data ────────────────────────────────────────────────────────────

export interface CalibrationOption<T extends string> {
  value: T
  label: string
  description?: string
}

export interface CalibrationQuestion<T extends string> {
  step: PassportFlowStep
  profileKey: keyof PassportProfile
  number: string
  prompt: string
  options: CalibrationOption<T>[]
}
