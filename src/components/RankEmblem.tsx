import { useId } from 'react'
import type { Division } from '../profile/useProfiles'

/** Chevrons per division: III is the first step of a tier, I the last. */
const CHEVRONS: Record<Division, number> = { III: 1, II: 2, I: 3 }

/**
 * A rank's badge: a shield in the tier's colour with one to three chevrons for the division, and a crown for the
 * top rank. `tier` (0–5) adds wings from Ace Brawler up.
 */
export function RankEmblem({
  color,
  tier,
  division,
  size = 64,
}: {
  color: string
  tier: number
  division: Division | null
  size?: number
}) {
  const id = useId()
  const chevrons = division ? CHEVRONS[division] : 0
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
      style={{ filter: `drop-shadow(0 0 ${size / 8}px ${color}88)` }}
    >
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} />
          <stop offset="1" stopColor="#0b0c12" />
        </linearGradient>
      </defs>
      {/* wings for the higher tiers */}
      {tier >= 3 && (
        <g fill={color} opacity="0.75">
          <path d="M14 22 2 18l5 10-4 2 9 4z" />
          <path d="M50 22l12-4-5 10 4 2-9 4z" />
        </g>
      )}
      <path d="M32 4 52 12v18c0 14-9 24-20 30C21 54 12 44 12 30V12z" fill={`url(#${id}f)`} stroke={color} strokeWidth="2.5" />
      <path d="M32 10 46 16v14c0 10-6 18-14 23-8-5-14-13-14-23V16z" fill="none" stroke="#ffffff" strokeOpacity="0.25" />
      {division === null ? (
        // the top rank: a crown
        <path d="M21 36l2-12 5 6 4-9 4 9 5-6 2 12z" fill="#fff" />
      ) : (
        Array.from({ length: chevrons }, (_, i) => (
          <path
            key={i}
            d={`M22 ${24 + i * 8}l10 6 10-6`}
            fill="none"
            stroke="#fff"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))
      )}
    </svg>
  )
}
