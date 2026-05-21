// ─────────────────────────────────────────────────────────────────────────────
// Memephant Passport — Public API
// Import from this file, not from individual modules.
// ─────────────────────────────────────────────────────────────────────────────

// Gate — the only component you need to touch App.tsx for
export { PassportGate } from './components/PassportGate'

// Full flow — used internally by PassportGate
export { PassportFlow } from './components/PassportFlow'

// Individual screens — export for deep-linking if needed later
export { PassportWelcome }    from './components/PassportWelcome'
export { PassportCalibration } from './components/PassportCalibration'
export { PassportCard }       from './components/PassportCard'
export { PassportSeal }       from './components/PassportSeal'

// Store — export for reading passport data from other parts of the app
export { usePassportStore, selectPassport, selectPassportExists } from './usePassportStore'

// Types — export all for use across the codebase
export type {
  PassportData,
  PassportProfile,
  PassportFlowStep,
  CommunicationStyle,
  WorkingTone,
  FocusArea,
} from './passport.types'

// Utils — export for reading passport data in other components
export {
  formatPassportDate,
  formatPassportId,
  COMMUNICATION_LABELS,
  TONE_LABELS,
  FOCUS_LABELS,
} from './passport.utils'
