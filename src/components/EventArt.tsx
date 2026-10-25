import { useId } from 'react'

const METALS = {
  gold: ['#fff4b8', '#f5c518', '#a8760f', '#5c3d05'],
  silver: ['#ffffff', '#cdd6e0', '#7d8a99', '#3a434e'],
  bronze: ['#ffd7a8', '#d08a45', '#8a4f1c', '#4a2508'],
} as const

/** A drawn cup trophy for the Bakugan Cup and the trophy cabinet. */
export function Trophy({ size = 64, metal = 'gold' }: { size?: number; metal?: keyof typeof METALS }) {
  const uid = useId().replace(/:/g, '')
  const [hi, mid, low, dark] = METALS[metal]
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0 drop-shadow-[0_3px_8px_rgba(0,0,0,0.7)]">
      <defs>
        <linearGradient id={`${uid}-m`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={low} />
          <stop offset="0.35" stopColor={hi} />
          <stop offset="0.6" stopColor={mid} />
          <stop offset="1" stopColor={low} />
        </linearGradient>
      </defs>
      {/* handles */}
      <path d="M17 14 C5 14 5 30 20 32" fill="none" stroke={`url(#${uid}-m)`} strokeWidth="4" strokeLinecap="round" />
      <path d="M47 14 C59 14 59 30 44 32" fill="none" stroke={`url(#${uid}-m)`} strokeWidth="4" strokeLinecap="round" />
      {/* bowl */}
      <path d="M15 8 H49 V18 C49 30 41 37 32 37 C23 37 15 30 15 18 Z" fill={`url(#${uid}-m)`} stroke={dark} strokeWidth="1.5" />
      <ellipse cx="32" cy="8" rx="17" ry="3" fill={hi} stroke={dark} strokeWidth="1.2" />
      {/* a Bakugan ball on the cup's face */}
      <circle cx="32" cy="21" r="6.5" fill={dark} opacity="0.55" />
      <path d="M25.5 21 H38.5" stroke={hi} strokeWidth="1.4" />
      <circle cx="32" cy="21" r="2.2" fill={hi} />
      {/* stem and base */}
      <path d="M28 37 H36 L35 45 H29 Z" fill={`url(#${uid}-m)`} stroke={dark} strokeWidth="1.2" />
      <rect x="21" y="45" width="22" height="5" rx="1.5" fill={`url(#${uid}-m)`} stroke={dark} strokeWidth="1.2" />
      <rect x="17" y="50" width="30" height="7" rx="2" fill={low} stroke={dark} strokeWidth="1.2" />
      <rect x="25" y="52" width="14" height="3" rx="1" fill={hi} opacity="0.7" />
    </svg>
  )
}

/** A row of life balls (filled = lives a side starts with). */
export function LifeBalls({ lives, color, size = 12 }: { lives: number; color: string; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      {Array.from({ length: lives }, (_, i) => (
        <span
          key={i}
          className="inline-block rounded-full border"
          style={{ width: size, height: size, background: color, borderColor: '#0008', boxShadow: `0 0 6px ${color}` }}
        />
      ))}
    </span>
  )
}

/** A difficulty or a defeated stamp: a small diamond with a letter. */
export function Stamp({ letter, color, on, title }: { letter: string; color: string; on: boolean; title?: string }) {
  return (
    <span
      title={title}
      className="font-display inline-flex h-6 w-6 rotate-45 items-center justify-center rounded-[4px] border text-[10px] font-black"
      style={{
        borderColor: on ? color : 'rgba(255,255,255,0.2)',
        background: on ? `${color}33` : 'rgba(0,0,0,0.4)',
        color: on ? color : 'rgba(255,255,255,0.3)',
        boxShadow: on ? `0 0 10px ${color}66` : 'none',
      }}
    >
      <span className="-rotate-45">{letter}</span>
    </span>
  )
}
