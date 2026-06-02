// ─────────────────────────────────────────────────────────────────────────────
// Memephant Passport — Optional Configuration Wizard
// Appears after the 3-question calibration, before generation.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, type FormEvent } from 'react'
import { usePassportStore } from '../usePassportStore'
import { DEFAULT_PASSPORT_CONFIGURATION_V2 } from '../passport.types'

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
  maxWidth: '560px',
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

const QUESTION_CARD: React.CSSProperties = {
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: '14px',
  background: 'rgba(255,255,255,0.025)',
  padding: '20px',
  minHeight: '230px',
}

const STEP_META: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  marginBottom: '14px',
  color: '#607080',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const QUESTION_TITLE: React.CSSProperties = {
  margin: '0 0 6px',
  color: '#f8fafc',
  fontSize: '19px',
  fontWeight: 800,
  lineHeight: 1.2,
}

const QUESTION_HELP: React.CSSProperties = {
  margin: '0 0 18px',
  color: '#7aaacc',
  fontSize: '13px',
  lineHeight: 1.5,
}

const INPUT: React.CSSProperties = {
  width: '100%',
  minHeight: '46px',
  border: '1px solid #243a5a',
  borderRadius: '10px',
  background: '#071225',
  color: '#e2e8f0',
  font: 'inherit',
  fontSize: '14px',
  padding: '10px 12px',
  outline: 'none',
}

const OPTION_GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(142px, 1fr))',
  gap: '10px',
}

const NOT_SET: React.CSSProperties = {
  margin: '14px 0 0',
  color: '#607080',
  fontSize: '12px',
}

const ACTIONS: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: '10px',
  marginTop: '22px',
}

const ACTION_GROUP: React.CSSProperties = {
  display: 'flex',
  gap: '10px',
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
  languagePreference: string
  dateFormat: string
  currency: string
  directness: string
  technicalLevel: string
  riskTolerance: string
  roleContext: string
}

type OptionField = Exclude<keyof ConfigFormState, 'preferredName'>

type WizardStep =
  | {
      field: 'preferredName'
      title: string
      help: string
      kind: 'text'
      placeholder: string
    }
  | {
      field: OptionField
      title: string
      help: string
      kind: 'options'
      options: string[]
    }

const DEFAULT_FORM_STATE: ConfigFormState = {
  preferredName: DEFAULT_PASSPORT_CONFIGURATION_V2.preferredName,
  region: DEFAULT_PASSPORT_CONFIGURATION_V2.region,
  languagePreference: DEFAULT_PASSPORT_CONFIGURATION_V2.languagePreference,
  dateFormat: DEFAULT_PASSPORT_CONFIGURATION_V2.dateFormat,
  currency: DEFAULT_PASSPORT_CONFIGURATION_V2.currency,
  directness: DEFAULT_PASSPORT_CONFIGURATION_V2.directness,
  technicalLevel: DEFAULT_PASSPORT_CONFIGURATION_V2.technicalLevel,
  riskTolerance: DEFAULT_PASSPORT_CONFIGURATION_V2.riskTolerance,
  roleContext: DEFAULT_PASSPORT_CONFIGURATION_V2.roleContext,
}

const WIZARD_STEPS: WizardStep[] = [
  {
    field: 'preferredName',
    title: 'Preferred name',
    help: 'What should AI call you in working sessions?',
    kind: 'text',
    placeholder: 'Kris',
  },
  {
    field: 'region',
    title: 'Region',
    help: 'This helps with spelling, examples, services, and local assumptions.',
    kind: 'options',
    options: [
      'United Kingdom',
      'United States',
      'Canada',
      'Australia',
      'New Zealand',
      'Ireland',
      'Europe',
      'Other',
    ],
  },
  {
    field: 'languagePreference',
    title: 'Language / spelling preference',
    help: 'Choose the English variant AI should use by default.',
    kind: 'options',
    options: [
      'British English',
      'American English',
      'Canadian English',
      'Australian English',
      'Neutral English',
    ],
  },
  {
    field: 'dateFormat',
    title: 'Date format',
    help: 'Pick the date style you expect in plans, notes, and handoffs.',
    kind: 'options',
    options: [
      'DD/MM/YYYY',
      'MM/DD/YYYY',
      'YYYY-MM-DD',
      '21 May 2026',
      'May 21, 2026',
    ],
  },
  {
    field: 'currency',
    title: 'Currency',
    help: 'Useful for pricing, budgets, invoices, and product examples.',
    kind: 'options',
    options: [
      'GBP / \u00a3',
      'USD / $',
      'EUR / \u20ac',
      'CAD / C$',
      'AUD / A$',
      'NZD / NZ$',
      'Other',
    ],
  },
  {
    field: 'directness',
    title: 'Directness',
    help: 'How direct should AI be when giving advice or feedback?',
    kind: 'options',
    options: [
      'Gentle',
      'Balanced',
      'Honest but supportive',
      'Blunt',
      'Challenge me hard',
    ],
  },
  {
    field: 'technicalLevel',
    title: 'Technical level',
    help: 'Set the baseline for explanations and implementation detail.',
    kind: 'options',
    options: [
      'Beginner',
      'Learning builder',
      'Intermediate',
      'Advanced',
      'Expert',
    ],
  },
  {
    field: 'riskTolerance',
    title: 'Risk tolerance',
    help: 'This guides whether AI suggests careful patches or faster experiments.',
    kind: 'options',
    options: [
      'Prefer small safe patches',
      'Balanced',
      'Move fast',
      'Experimental',
      'High risk / high speed',
    ],
  },
  {
    field: 'roleContext',
    title: 'Role / working context',
    help: 'Tell AI the perspective you are usually working from.',
    kind: 'options',
    options: [
      'Student',
      'Solo founder',
      'Developer',
      'Designer',
      'Freelancer',
      'Small business owner',
      'Career changer',
      'Other',
    ],
  },
]

interface OptionButtonProps {
  option: string
  selected: boolean
  onToggle: () => void
}

function OptionButton({ option, selected, onToggle }: OptionButtonProps) {
  const style: React.CSSProperties = {
    minHeight: '42px',
    border: selected ? '1px solid rgba(245,158,11,0.7)' : '1px solid rgba(255,255,255,0.09)',
    borderRadius: '10px',
    background: selected ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.035)',
    color: selected ? '#fbbf24' : '#c8daf0',
    font: 'inherit',
    fontSize: '13px',
    fontWeight: selected ? 800 : 650,
    padding: '9px 12px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease',
  }

  return (
    <button
      type="button"
      style={style}
      aria-pressed={selected}
      onClick={onToggle}
    >
      {option}
    </button>
  )
}

export function PassportConfigurationStep() {
  const generatePassport = usePassportStore(s => s.generatePassport)
  const setFlowStep = usePassportStore(s => s.setFlowStep)
  const [form, setForm] = useState<ConfigFormState>(DEFAULT_FORM_STATE)
  const [stepIndex, setStepIndex] = useState(0)
  const step = WIZARD_STEPS[stepIndex]
  const finalStep = stepIndex === WIZARD_STEPS.length - 1

  function updateField(field: keyof ConfigFormState, value: string) {
    setForm(current => ({ ...current, [field]: value }))
  }

  function toggleOption(field: OptionField, option: string) {
    setForm(current => ({
      ...current,
      [field]: current[field] === option ? '' : option,
    }))
  }

  function normalisedConfiguration() {
    return {
      preferredName: form.preferredName.trim(),
      region: form.region.trim(),
      languagePreference: form.languagePreference.trim(),
      timezone: DEFAULT_PASSPORT_CONFIGURATION_V2.timezone,
      dateFormat: form.dateFormat.trim(),
      currency: form.currency.trim(),
      directness: form.directness.trim(),
      technicalLevel: form.technicalLevel.trim(),
      riskTolerance: form.riskTolerance.trim(),
      roleContext: form.roleContext.trim(),
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!finalStep) {
      setStepIndex(current => current + 1)
      return
    }

    generatePassport(normalisedConfiguration())
  }

  function handleBack() {
    if (stepIndex === 0) {
      setFlowStep('q3')
      return
    }

    setStepIndex(current => current - 1)
  }

  function handleSkip() {
    generatePassport()
  }

  return (
    <div style={ROOT}>
      <div style={AMBIENT} />
      <form style={PANEL} onSubmit={handleSubmit} aria-labelledby="passport-complete-title">
        <p style={EYEBROW}>Optional details</p>
        <h2 id="passport-complete-title" style={TITLE}>Complete your Passport</h2>
        <p style={SUBTITLE}>
          Add the details AI tools need to work with you properly.
        </p>

        <section style={QUESTION_CARD} aria-labelledby={`passport-config-${step.field}`}>
          <div style={STEP_META}>
            <span>Step {stepIndex + 1} of {WIZARD_STEPS.length}</span>
            <span>{form[step.field] ? 'Set' : 'Not set yet'}</span>
          </div>

          <h3 id={`passport-config-${step.field}`} style={QUESTION_TITLE}>
            {step.title}
          </h3>
          <p style={QUESTION_HELP}>{step.help}</p>

          {step.kind === 'text' ? (
            <input
              style={INPUT}
              type="text"
              value={form.preferredName}
              onChange={(event) => updateField('preferredName', event.target.value)}
              placeholder={step.placeholder}
              aria-label={step.title}
              autoFocus
            />
          ) : (
            <>
              <div style={OPTION_GRID}>
                {step.options.map((option) => (
                  <OptionButton
                    key={option}
                    option={option}
                    selected={form[step.field] === option}
                    onToggle={() => toggleOption(step.field, option)}
                  />
                ))}
              </div>

              {!form[step.field] && (
                <p style={NOT_SET}>Not set yet. You can leave this blank and continue.</p>
              )}
            </>
          )}
        </section>

        <div style={ACTIONS}>
          <button type="button" style={SECONDARY_BUTTON} onClick={handleBack}>
            Back
          </button>
          <div style={ACTION_GROUP}>
            <button type="button" style={SECONDARY_BUTTON} onClick={handleSkip}>
              Skip for now
            </button>
            <button type="submit" style={PRIMARY_BUTTON}>
              {finalStep ? 'Complete Passport' : 'Next'}
            </button>
          </div>
        </div>

        <p style={PRIVACY_NOTE}>
          These working preferences stay local and can be edited later from your Working Style Profile.
        </p>
      </form>
    </div>
  )
}
