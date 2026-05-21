// ─────────────────────────────────────────────────────────────────────────────
// Memephant Passport — Flow Orchestrator
// Routes between the 6 steps based on Zustand store state.
// Import this CSS here so it's loaded exactly once.
// ─────────────────────────────────────────────────────────────────────────────

import '../passport.animations.css'

import { usePassportStore } from '../usePassportStore'
import { PassportWelcome }    from './PassportWelcome'
import { PassportCalibration } from './PassportCalibration'
import { PassportGeneration }  from './PassportGeneration'
import { PassportCard }       from './PassportCard'

export function PassportFlow() {
  const flowStep = usePassportStore(s => s.flowStep)

  switch (flowStep) {
    case 'welcome':
      return <PassportWelcome />

    case 'q1':
      return <PassportCalibration questionIndex={0} />

    case 'q2':
      return <PassportCalibration questionIndex={1} />

    case 'q3':
      return <PassportCalibration questionIndex={2} />

    case 'generating':
      return <PassportGeneration />

    case 'complete':
      return <PassportCard />

    default:
      // Exhaustive check — TypeScript will warn if a case is missed
      return <PassportWelcome />
  }
}
