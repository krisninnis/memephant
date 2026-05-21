// ─────────────────────────────────────────────────────────────────────────────
// Memephant Passport — Generative Seal SVG
// Produces a unique, deterministic geometric seal for each passport.
// The seal is content-addressed: same profile always generates same seal.
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react'
import { getFingerprintValues } from '../passport.utils'

interface PassportSealProps {
  fingerprint: string
  size?: number
  /** 'card' renders full colour; 'ghost' renders with low opacity for backgrounds */
  variant?: 'card' | 'ghost'
  style?: React.CSSProperties
}

/** Generates an SVG hexagon path centred at (cx, cy) with radius r */
function hexPath(cx: number, cy: number, r: number, rotationDeg = 0): string {
  const rot = (rotationDeg * Math.PI) / 180
  const points = Array.from({ length: 6 }).map((_, i) => {
    const angle = (i * Math.PI) / 3 + rot
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
  })
  return `M ${points.join(' L ')} Z`
}

export function PassportSeal({
  fingerprint,
  size = 88,
  variant = 'card',
  style,
}: PassportSealProps) {
  const vals = getFingerprintValues(fingerprint) // 8 values, each 0–15
  const cx = size / 2
  const cy = size / 2

  // Deterministic radii — vary slightly based on fingerprint
  const outerR  = size * 0.44 + vals[0] * 0.3
  const middleR = size * 0.31 + vals[1] * 0.25
  const innerR  = size * 0.18 + vals[2] * 0.2

  // Rotation offsets for each hex ring
  const outerRot  = vals[3] * 3.75        // 0°–56.25°
  const middleRot = 30 + vals[4] * 2.5    // 30°–67.5° (offset from outer)
  const innerRot  = vals[5] * 5           // 0°–75°

  // Number of radial spokes (4 or 6 depending on fingerprint)
  const spokeCount = vals[6] > 8 ? 6 : 4
  const spokeLength = size * 0.18 + vals[7] * 0.8

  const alpha = variant === 'card' ? 1 : 0.15

  const amberFull   = `rgba(245,158,11,${alpha})`
  const amberMid    = `rgba(245,158,11,${alpha * 0.45})`
  const amberDim    = `rgba(245,158,11,${alpha * 0.2})`
  const amberFill   = `rgba(245,158,11,${alpha * 0.07})`
  const centerFill  = `rgba(245,158,11,${alpha * 0.85})`

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      style={{ display: 'block', ...style }}
      aria-hidden="true"
    >
      {/* Outer hexagon ring */}
      <path
        d={hexPath(cx, cy, outerR, outerRot)}
        stroke={amberDim}
        strokeWidth="0.75"
        fill="none"
      />

      {/* Middle hexagon ring */}
      <path
        d={hexPath(cx, cy, middleR, middleRot)}
        stroke={amberMid}
        strokeWidth="0.85"
        fill={amberFill}
      />

      {/* Inner hexagon — filled */}
      <path
        d={hexPath(cx, cy, innerR, innerRot)}
        stroke={amberFull}
        strokeWidth="1"
        fill={amberFill}
      />

      {/* Radial spokes from center to inner hex boundary */}
      {Array.from({ length: spokeCount }).map((_, i) => {
        const angle = ((i * 360) / spokeCount + vals[i % 8] * 1.5) * (Math.PI / 180)
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={cx + Math.cos(angle) * spokeLength}
            y2={cy + Math.sin(angle) * spokeLength}
            stroke={amberDim}
            strokeWidth="0.6"
          />
        )
      })}

      {/* Outer ring dots at hexagon vertices */}
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (i * Math.PI) / 3 + (outerRot * Math.PI) / 180
        const dotR  = vals[i % 8] > 10 ? 1.5 : 1
        return (
          <circle
            key={i}
            cx={cx + outerR * Math.cos(angle)}
            cy={cy + outerR * Math.sin(angle)}
            r={dotR}
            fill={amberMid}
          />
        )
      })}

      {/* Centre dot */}
      <circle cx={cx} cy={cy} r={3} fill={centerFill} />

      {/* Centre micro ring */}
      <circle
        cx={cx}
        cy={cy}
        r={7}
        stroke={amberMid}
        strokeWidth="0.6"
        fill="none"
      />
    </svg>
  )
}
