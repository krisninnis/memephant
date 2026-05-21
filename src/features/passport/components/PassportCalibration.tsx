// ─────────────────────────────────────────────────────────────────────────────
// Memephant Passport — Calibration Screen (Steps Q1 → Q2 → Q3)
// Handles all three questions in one component with animated transitions.
// One screen = one decision, with safe back/cancel controls.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect, useRef } from 'react'
import { usePassportStore } from '../usePassportStore'
import { CALIBRATION_QUESTIONS } from '../passport.utils'
import type { PassportProfile, PassportFlowStep } from '../passport.types'
import { ProgressDots } from './PassportIcons'

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

const AMBIENT: React.CSSProperties = {
  position: 'absolute',
  top: '-20%',
  left: '50%',
  transform: 'translateX(-50%)',
  width: '600px',
  height: '300px',
  borderRadius: '50%',
  background:
    'radial-gradient(ellipse, rgba(124,58,237,0.06) 0%, transparent 70%)',
  pointerEvents: 'none',
  animation: 'passport-ambient-pulse 8s ease-in-out infinite',
}

const PANEL: React.CSSProperties = {
  position: 'relative',
  width: '100%',
  maxWidth: '520px',
  padding: '0 32px',
}

const TOP_ROW: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: '40px',
}

const STEP_LABEL: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  letterSpacing: '0.15em',
  color: 'rgba(245,158,11,0.5)',
  textTransform: 'uppercase',
  fontVariantNumeric: 'tabular-nums',
}

const QUESTION_TEXT: React.CSSProperties = {
  fontSize: '28px',
  fontWeight: 600,
  color: '#f1f5f9',
  lineHeight: 1.2,
  letterSpacing: '-0.015em',
  margin: '0 0 28px 0',
}

const OPTIONS_GRID: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
}

const NAV_ACTIONS: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  gap: '12px',
  marginTop: '28px',
}

const SECONDARY_BUTTON: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(255, 170, 40, 0.25)',
  color: 'rgba(255, 255, 255, 0.8)',
  borderRadius: '12px',
  padding: '10px 16px',
  fontSize: '14px',
  fontFamily: 'inherit',
  cursor: 'pointer',
  transition: 'border-color 160ms ease, background 160ms ease, color 160ms ease',
}

// ─── Sub-component: Option Pill ───────────────────────────────────────────────

interface OptionPillProps {
  label: string
  selected: boolean
  onSelect: () => void
  animDelay?: number
}

function OptionPill({ label, selected, onSelect, animDelay = 0 }: OptionPillProps) {
  const [hovered, setHovered] = useState(false)
  const [popped, setPopped] = useState(false)

  function handleClick() {
    if (selected) return
    setPopped(true)
    setTimeout(() => setPopped(false), 220)
    onSelect()
  }

  const style: React.CSSProperties = {
    padding: '10px 18px',
    borderRadius: '8px',
    border: selected
      ? '1px solid rgba(245,158,11,0.65)'
      : hovered
        ? '1px solid rgba(255,255,255,0.2)'
        : '1px solid rgba(255,255,255,0.08)',
    background: selected
      ? 'rgba(245,158,11,0.1)'
      : hovered
        ? 'rgba(255,255,255,0.05)'
        : 'rgba(255,255,255,0.03)',
    color: selected ? '#fbbf24' : hovered ? '#e2e8f0' : '#94a3b8',
    fontSize: '14px',
    fontWeight: selected ? 600 : 400,
    letterSpacing: '0.01em',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'border-color 0.18s ease, background 0.18s ease, color 0.18s ease',
    outline: 'none',
    transform: popped ? 'scale(1.035)' : 'scale(1)',
    animation: `passport-section-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) both ${animDelay}ms`,
  }

  return (
    <button
      style={style}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      role="radio"
      aria-checked={selected}
      aria-label={label}
    >
      {label}
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface PassportCalibrationProps {
  /** Which of the 3 questions to show (0-indexed) */
  questionIndex: 0 | 1 | 2
}

export function PassportCalibration({ questionIndex }: PassportCalibrationProps) {
  const setFlowStep = usePassportStore(s => s.setFlowStep)
  const setDraftAnswer = usePassportStore(s => s.setDraftAnswer)
  const finishPassportFlow = usePassportStore(s => s.finishPassportFlow)
  const isReeditingPassport = usePassportStore(s => s.isReeditingPassport)
  const draft = usePassportStore(s => s.draft)

  const question = CALIBRATION_QUESTIONS[questionIndex]
  const currentValue = draft[question.profileKey as keyof PassportProfile] as string | undefined

  const [navHovered, setNavHovered] = useState<'back' | 'cancel' | null>(null)

  // Animate in when question changes
  const [animKey, setAnimKey] = useState(0)
  const prevIndex = useRef(questionIndex)

  useEffect(() => {
    if (prevIndex.current !== questionIndex) {
      setAnimKey(k => k + 1)
      prevIndex.current = questionIndex
    }
  }, [questionIndex])

  function handleSelect(value: string) {
    setDraftAnswer(
      question.profileKey as keyof PassportProfile,
      value as PassportProfile[keyof PassportProfile]
    )

    // Small delay so user sees the selection before transition
    setTimeout(() => {
      if (questionIndex < 2) {
        const next = (['q1', 'q2', 'q3'] as PassportFlowStep[])[questionIndex + 1]
        setFlowStep(next)
      } else {
        // Final calibration question -- optional Passport details come next.
        setFlowStep('configure')
      }
    }, 380)
  }

  function handleBack() {
    const previous = (['q1', 'q2', 'q3'] as PassportFlowStep[])[Math.max(0, questionIndex - 1)]
    setFlowStep(previous)
  }

  function handleCancel() {
    finishPassportFlow()
  }

  function getSecondaryButtonStyle(kind: 'back' | 'cancel'): React.CSSProperties {
    const hovered = navHovered === kind

    return {
      ...SECONDARY_BUTTON,
      borderColor: hovered ? 'rgba(255, 170, 40, 0.5)' : 'rgba(255, 170, 40, 0.25)',
      background: hovered ? 'rgba(255, 170, 40, 0.08)' : SECONDARY_BUTTON.background,
      color: hovered ? '#f8fafc' : SECONDARY_BUTTON.color,
    }
  }

  const currentStep = questionIndex + 1
  const showBack = questionIndex > 0
  const showCancel = questionIndex === 0 && isReeditingPassport

  return (
    <div style={ROOT}>
      <div style={AMBIENT} />

      <div style={PANEL}>
        {/* Top row: step counter + progress dots */}
        <div style={TOP_ROW}>
          <span style={STEP_LABEL}>{question.number}</span>
          <ProgressDots total={3} current={currentStep} />
        </div>

        {/* Question + options — keyed to re-animate on question change */}
        <div
          key={animKey}
          className="passport-slide-in-right"
          role="group"
          aria-labelledby={`passport-q-${questionIndex}`}
        >
          <h2 id={`passport-q-${questionIndex}`} style={QUESTION_TEXT}>
            {question.prompt}
          </h2>

          <div style={OPTIONS_GRID} role="radiogroup" aria-required="true">
            {question.options.map((opt, i) => (
              <OptionPill
                key={opt.value}
                label={opt.label}
                selected={currentValue === opt.value}
                onSelect={() => handleSelect(opt.value)}
                animDelay={i * 40}
              />
            ))}
          </div>
        </div>

        {(showBack || showCancel) && (
          <div style={NAV_ACTIONS}>
            {showBack && (
              <button
                type="button"
                style={getSecondaryButtonStyle('back')}
                onClick={handleBack}
                onMouseEnter={() => setNavHovered('back')}
                onMouseLeave={() => setNavHovered(null)}
                onFocus={() => setNavHovered('back')}
                onBlur={() => setNavHovered(null)}
              >
                Back
              </button>
            )}

            {showCancel && (
              <button
                type="button"
                style={getSecondaryButtonStyle('cancel')}
                onClick={handleCancel}
                onMouseEnter={() => setNavHovered('cancel')}
                onMouseLeave={() => setNavHovered(null)}
                onFocus={() => setNavHovered('cancel')}
                onBlur={() => setNavHovered(null)}
              >
                Return to app
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
