import { useId } from 'react'
import type { Reward } from '../season/season'

export type IconKind = Reward['kind']

/**
 * Drawn icons for everything the Season Pass and the Shop hand out: a BP coin, an XP Boost
 * canister, a Card Key (an ability card with a key), a title ribbon, a portrait frame, a skin
 * swatch, an outfit, an accessory crown, a Bakugan ball and a bundle chest.
 * `accent` tints the Bakugan ball (e.g. its attribute colour).
 */
export function RewardIcon({ kind, size = 44, accent }: { kind: IconKind; size?: number; accent?: string }) {
  const uid = useId().replace(/:/g, '')
  const id = (name: string) => `${uid}-${name}`
  const url = (name: string) => `url(#${id(name)})`
  const body = ICONS[kind](id, url, accent)
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className="shrink-0 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">
      {body}
    </svg>
  )
}

/** The Battle Points coin on its own, for prices and balances next to text. */
export function BpIcon({ size = 16 }: { size?: number }) {
  return <RewardIcon kind="bp" size={size} />
}

type Draw = (id: (n: string) => string, url: (n: string) => string, accent?: string) => React.ReactNode

const ICONS: Record<IconKind, Draw> = {
  bp: (id, url) => (
    <>
      <defs>
        <radialGradient id={id('face')} cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#fff6c4" />
          <stop offset="0.45" stopColor="#f5c84a" />
          <stop offset="1" stopColor="#b7791f" />
        </radialGradient>
        <linearGradient id={id('rim')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe28a" />
          <stop offset="1" stopColor="#8a5410" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill={url('rim')} stroke="#4a2c06" strokeWidth="2" />
      <circle cx="32" cy="32" r="22.5" fill={url('face')} stroke="#a86b14" strokeWidth="1.5" />
      <circle
        cx="32"
        cy="32"
        r="18.5"
        fill="none"
        stroke="#fff3b0"
        strokeOpacity="0.55"
        strokeWidth="1"
        strokeDasharray="2 2.6"
      />
      <text
        x="32"
        y="38.5"
        textAnchor="middle"
        fontSize="17"
        fontWeight="900"
        fontFamily="Arial Black, Arial, sans-serif"
        fill="#5a3606"
      >
        BP
      </text>
      <path d="M17 22 Q22 13 32 12" fill="none" stroke="#fffbe0" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.8" />
    </>
  ),
  boost: (id, url) => (
    <>
      <defs>
        <linearGradient id={id('glass')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7ef0ff" />
          <stop offset="0.55" stopColor="#3a8cff" />
          <stop offset="1" stopColor="#6a2cff" />
        </linearGradient>
        <linearGradient id={id('cap')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8edf5" />
          <stop offset="1" stopColor="#6b7385" />
        </linearGradient>
      </defs>
      {/* an energy canister with a lightning bolt */}
      <rect x="18" y="4" width="28" height="9" rx="3" fill={url('cap')} stroke="#1a1f2b" strokeWidth="1.5" />
      <rect x="14" y="12" width="36" height="44" rx="9" fill={url('glass')} stroke="#0d1430" strokeWidth="2" />
      <rect x="18" y="16" width="6" height="34" rx="3" fill="#ffffff" opacity="0.35" />
      <path d="M36 17 L24 36 H32 L28 51 L41 30 H33 Z" fill="#fff38a" stroke="#7a4a00" strokeWidth="1.5" strokeLinejoin="round" />
      <rect x="18" y="55" width="28" height="6" rx="2" fill={url('cap')} stroke="#1a1f2b" strokeWidth="1.5" />
    </>
  ),
  cardKey: (id, url) => (
    <>
      <defs>
        <linearGradient id={id('card')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9b6bff" />
          <stop offset="1" stopColor="#3b1a8a" />
        </linearGradient>
        <linearGradient id={id('gold')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1a8" />
          <stop offset="0.5" stopColor="#f2b93b" />
          <stop offset="1" stopColor="#a8650f" />
        </linearGradient>
      </defs>
      {/* an ability card, tilted, with a golden key across it */}
      <g transform="rotate(-10 32 32)">
        <rect x="12" y="6" width="34" height="48" rx="5" fill={url('card')} stroke="#160a3a" strokeWidth="2" />
        <rect x="16" y="10" width="26" height="40" rx="3" fill="none" stroke="#d9c8ff" strokeOpacity="0.6" strokeWidth="1.2" />
        <path d="M29 16 l5 8 l-5 8 l-5 -8 z" fill="#efe6ff" opacity="0.8" />
      </g>
      <circle cx="40" cy="38" r="9" fill="none" stroke={url('gold')} strokeWidth="5" />
      <circle cx="40" cy="38" r="9" fill="none" stroke="#5a3606" strokeWidth="1" />
      <path d="M33.5 44.5 L18 60 M22 56 l4 4 M26 52 l3 3" stroke={url('gold')} strokeWidth="5" strokeLinecap="round" />
    </>
  ),
  title: (id, url) => (
    <>
      <defs>
        <linearGradient id={id('band')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff6a6a" />
          <stop offset="1" stopColor="#a3122a" />
        </linearGradient>
      </defs>
      {/* a ribbon banner with a star on top */}
      <path d="M3 30 L13 26 L13 46 L3 42 L8 36 Z" fill="#7a0e20" stroke="#3a0610" strokeWidth="1.5" />
      <path d="M61 30 L51 26 L51 46 L61 42 L56 36 Z" fill="#7a0e20" stroke="#3a0610" strokeWidth="1.5" />
      <path d="M10 24 Q32 18 54 24 L54 44 Q32 38 10 44 Z" fill={url('band')} stroke="#3a0610" strokeWidth="2" />
      <path d="M16 31 Q32 27 48 31 M16 36 Q32 32 48 36" stroke="#ffd6d6" strokeOpacity="0.7" strokeWidth="1.6" fill="none" />
      <path
        d="M32 3 L35 10 L42 10.5 L36.5 15 L38.5 22 L32 18 L25.5 22 L27.5 15 L22 10.5 L29 10 Z"
        fill="#ffd34a"
        stroke="#7a4a00"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </>
  ),
  frame: (id, url) => (
    <>
      <defs>
        <linearGradient id={id('ring')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff1a8" />
          <stop offset="0.5" stopColor="#e2a634" />
          <stop offset="1" stopColor="#8a5410" />
        </linearGradient>
        <radialGradient id={id('inside')} cx="50%" cy="40%" r="60%">
          <stop offset="0" stopColor="#3a4a78" />
          <stop offset="1" stopColor="#141a2e" />
        </radialGradient>
      </defs>
      {/* a portrait frame: gold ring, gems, a head and shoulders inside */}
      <circle cx="32" cy="32" r="26" fill={url('inside')} />
      <circle cx="32" cy="27" r="7.5" fill="#a9b6d8" />
      <path d="M17 50 Q32 34 47 50 Z" fill="#a9b6d8" />
      <circle cx="32" cy="32" r="26" fill="none" stroke={url('ring')} strokeWidth="7" />
      <circle cx="32" cy="32" r="29.5" fill="none" stroke="#4a2c06" strokeWidth="1.2" />
      <circle cx="32" cy="32" r="22.5" fill="none" stroke="#4a2c06" strokeWidth="1.2" />
      {[
        [32, 6, '#4fd1ff'],
        [58, 32, '#ff5a7a'],
        [32, 58, '#4fd1ff'],
        [6, 32, '#ff5a7a'],
      ].map(([x, y, c]) => (
        <path
          key={`${x}-${y}`}
          d={`M${x} ${Number(y) - 5} l5 5 l-5 5 l-5 -5 z`}
          fill={c as string}
          stroke="#2a1a04"
          strokeWidth="1.2"
        />
      ))}
    </>
  ),
  skin: (id, url) => (
    <>
      <defs>
        <linearGradient id={id('swirl')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff4d6d" />
          <stop offset="0.35" stopColor="#ffb703" />
          <stop offset="0.65" stopColor="#3ddc97" />
          <stop offset="1" stopColor="#4361ee" />
        </linearGradient>
        <radialGradient id={id('shine')} cx="35%" cy="30%" r="60%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* a ball in new colours, and the brush that painted it */}
      <circle cx="28" cy="34" r="22" fill={url('swirl')} stroke="#141018" strokeWidth="2" />
      <path d="M6 34 Q28 42 50 34" stroke="#141018" strokeWidth="2.5" fill="none" />
      <circle cx="28" cy="34" r="22" fill={url('shine')} />
      <path d="M44 22 L58 6" stroke="#8a5a2b" strokeWidth="5" strokeLinecap="round" />
      <path d="M40 26 l6 -6 l4 4 l-6 6 q-6 4 -8 2 q-2 -2 4 -6 z" fill="#ff4d6d" stroke="#141018" strokeWidth="1.5" />
    </>
  ),
  outfit: (id, url) => (
    <>
      <defs>
        <linearGradient id={id('cloth')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5ab0ff" />
          <stop offset="1" stopColor="#1d4fa8" />
        </linearGradient>
      </defs>
      {/* a brawler's jacket */}
      <path
        d="M22 6 L32 12 L42 6 L56 14 L60 30 L50 32 L50 58 L14 58 L14 32 L4 30 L8 14 Z"
        fill={url('cloth')}
        stroke="#0b1a3a"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M32 12 L32 58" stroke="#0b1a3a" strokeWidth="1.8" />
      <path d="M22 6 L28 22 L32 12 L36 22 L42 6" fill="#e8eef8" stroke="#0b1a3a" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 46 H50" stroke="#ffd34a" strokeWidth="3" />
    </>
  ),
  accessory: (id, url) => (
    <>
      <defs>
        <linearGradient id={id('crown')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff1a8" />
          <stop offset="0.55" stopColor="#f2b93b" />
          <stop offset="1" stopColor="#9a5c0e" />
        </linearGradient>
      </defs>
      <path
        d="M6 22 L18 34 L32 10 L46 34 L58 22 L52 50 H12 Z"
        fill={url('crown')}
        stroke="#4a2c06"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <rect x="11" y="48" width="42" height="9" rx="2.5" fill={url('crown')} stroke="#4a2c06" strokeWidth="2" />
      <circle cx="32" cy="38" r="4.5" fill="#ff4d6d" stroke="#4a0a14" strokeWidth="1.2" />
      <circle cx="20" cy="42" r="3" fill="#4fd1ff" stroke="#08324a" strokeWidth="1" />
      <circle cx="44" cy="42" r="3" fill="#4fd1ff" stroke="#08324a" strokeWidth="1" />
      {[6, 32, 58].map((x, i) => (
        <circle key={x} cx={x} cy={i === 1 ? 10 : 22} r="3.5" fill="#fff6c4" stroke="#4a2c06" strokeWidth="1.2" />
      ))}
    </>
  ),
  seasonBakugan: (id, url, accent = '#e04848') => (
    <>
      <defs>
        <radialGradient id={id('shell')} cx="36%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.9" />
          <stop offset="0.25" stopColor={accent} />
          <stop offset="1" stopColor="#0a0a10" />
        </radialGradient>
      </defs>
      {/* a closed Bakugan ball: three shell plates around a gold centre ring */}
      <circle cx="32" cy="32" r="27" fill={url('shell')} stroke="#08080c" strokeWidth="2.5" />
      <path d="M5.5 30 Q32 40 58.5 30" stroke="#08080c" strokeWidth="2.5" fill="none" />
      <path d="M32 5 Q26 18 32 30 M32 35 Q38 48 32 59" stroke="#08080c" strokeWidth="2.2" fill="none" />
      <path d="M12 16 Q22 26 18 40 M52 16 Q42 26 46 40" stroke="#08080c" strokeWidth="1.6" fill="none" opacity="0.7" />
      <circle cx="32" cy="33" r="8" fill="#f5c84a" stroke="#5a3606" strokeWidth="2" />
      <circle cx="32" cy="33" r="3.5" fill={accent} stroke="#2a0606" strokeWidth="1.2" />
    </>
  ),
  bundle: (id, url) => (
    <>
      <defs>
        <linearGradient id={id('wood')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#c27a3a" />
          <stop offset="1" stopColor="#6b3a14" />
        </linearGradient>
        <linearGradient id={id('band')} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#fff1a8" />
          <stop offset="1" stopColor="#b7791f" />
        </linearGradient>
      </defs>
      {/* a treasure chest with light spilling out */}
      <path d="M14 22 L22 4 M32 20 V2 M50 22 L42 4" stroke="#fff3b0" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      <path d="M6 30 Q32 12 58 30 Z" fill={url('wood')} stroke="#2e1606" strokeWidth="2" strokeLinejoin="round" />
      <rect x="6" y="30" width="52" height="28" rx="3" fill={url('wood')} stroke="#2e1606" strokeWidth="2" />
      <rect x="6" y="30" width="52" height="6" fill={url('band')} stroke="#2e1606" strokeWidth="1.5" />
      <rect x="27" y="32" width="10" height="13" rx="2" fill={url('band')} stroke="#2e1606" strokeWidth="1.5" />
      <circle cx="32" cy="40" r="2" fill="#2e1606" />
      <path d="M14 30 V58 M50 30 V58" stroke={url('band')} strokeWidth="4" />
    </>
  ),
}
