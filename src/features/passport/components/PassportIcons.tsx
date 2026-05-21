// ─────────────────────────────────────────────────────────────────────────────
// Memephant Passport — Shared SVG Icons
// Pure SVG components. No dependencies.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'

interface IconProps {
  size?: number
  color?: string
  opacity?: number
  className?: string
  style?: React.CSSProperties
}

/** Shield mark — the Memephant passport identity symbol */
export function ShieldIcon({
  size = 24,
  color = '#f59e0b',
  opacity = 1,
  style,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ opacity, flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path
        d="M12 2L3 6v6c0 5.25 3.75 10.15 9 11.25C17.25 22.15 21 17.25 21 12V6L12 2z"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill={`${color}12`}
      />
      <path
        d="M9 12l2 2 4-4"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Three horizontal dots — progress indicator */
export function ProgressDots({
  total = 3,
  current,
  color = '#f59e0b',
  style,
}: {
  total?: number
  current: number
  color?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '7px',
        alignItems: 'center',
        ...style,
      }}
      role="progressbar"
      aria-valuenow={current}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Step ${current} of ${total}`}
    >
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: i + 1 === current ? '18px' : '6px',
            height: '6px',
            borderRadius: '3px',
            background: i + 1 === current
              ? color
              : i + 1 < current
              ? `${color}70`
              : 'rgba(255,255,255,0.12)',
            transition: 'width 0.3s ease, background 0.3s ease',
          }}
        />
      ))}
    </div>
  )
}

/** Animated three dots — generating loader */
export function GeneratingDots({ color = '#f59e0b' }: { color?: string }) {
  return (
    <div
      style={{ display: 'flex', gap: '6px', alignItems: 'center' }}
      aria-hidden="true"
    >
      {[0, 1, 2].map(i => (
        <div
          key={i}
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: color,
            animation: `passport-dot-bounce 1.2s ease-in-out infinite`,
            animationDelay: `${i * 160}ms`,
          }}
        />
      ))}
    </div>
  )
}

/** Chevron right — used in CTA */
export function ChevronRight({
  size = 16,
  color = 'currentColor',
  style,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path
        d="M6 3l5 5-5 5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Checkmark — for confirmed selections */
export function CheckIcon({
  size = 14,
  color = '#f59e0b',
  style,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path
        d="M2.5 7l3.5 3.5 5.5-6"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
