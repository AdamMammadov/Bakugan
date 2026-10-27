import { AnimatePresence, motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import { ELEMENT_BY_ID, type ElementInfo } from '../data/elements'
import { useActiveProfile } from '../profile/useProfiles'
import { useGame, type Screen } from '../store/useGame'

/** What moves behind a page. */
type Motif = 'rays' | 'beams' | 'pillars' | 'bokeh' | 'streaks' | 'spot' | 'split' | 'hex' | 'rings'

interface Theme {
  /** Main and second colour; 'el' / 'glow' are the player's attribute colours. */
  a: string
  b: string
  motif: Motif
  /** The attribute emblem turning slowly at the side. */
  emblem?: boolean
}

const THEMES: Partial<Record<Screen, Theme>> = {
  hub: { a: 'el', b: 'glow', motif: 'rays', emblem: true },
  compare: { a: 'el', b: '#ef4444', motif: 'split' },
  profileEdit: { a: 'el', b: '#94a3b8', motif: 'streaks' },
  profile: { a: 'el', b: 'glow', motif: 'rings', emblem: true },
  inventory: { a: '#38bdf8', b: 'el', motif: 'hex' },
  pass: { a: '#fcd34d', b: 'el', motif: 'rays' },
  events: { a: '#a78bfa', b: '#fcd34d', motif: 'beams' },
  shop: { a: '#34d399', b: '#fcd34d', motif: 'bokeh' },
  rankings: { a: '#f5c518', b: 'el', motif: 'pillars' },
  clans: { a: 'el', b: '#ef4444', motif: 'hex', emblem: true },
  friends: { a: '#f472b6', b: '#fb923c', motif: 'bokeh' },
  encyclopedia: { a: '#60a5fa', b: '#22d3ee', motif: 'streaks' },
}

const pick = (c: string, el: ElementInfo) => (c === 'el' ? el.color : c === 'glow' ? el.glow : c)

/**
 * A themed, slowly moving background behind the pages (and the hub, face-off and editor), in the page's colours
 * and the player's attribute: drifting light, a motif of its own, a fine texture and darker edges for reading.
 * One fixed layer under every page, so switching tabs fades from one theme to the next.
 */
export function PageBackdrop({ screen }: { screen: Screen }) {
  const profile = useActiveProfile()
  const chosen = useGame((s) => s.element)
  const theme = THEMES[screen]
  const el = ELEMENT_BY_ID[profile?.element ?? chosen ?? 'pyrus']
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden bg-[#05060a]" aria-hidden>
      <AnimatePresence>
        {theme && (
          <motion.div
            key={`${screen}-${el.id}`}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
          >
            <Layers theme={theme} el={el} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Layers({ theme, el }: { theme: Theme; el: ElementInfo }) {
  const a = pick(theme.a, el)
  const b = pick(theme.b, el)
  const vars = { '--bd-a': a, '--bd-b': b } as CSSProperties
  return (
    <div className="absolute inset-0" style={vars}>
      {/* base: the two colours washing in from opposite corners */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 12% -5%, ${a}38, transparent 55%), radial-gradient(ellipse at 105% 105%, ${b}2e, transparent 55%), linear-gradient(180deg, #090b14, #05060a 70%)`,
        }}
      />
      <div
        className="menu-drift absolute -top-1/3 left-1/4 h-[75vh] w-[75vh] rounded-full opacity-[0.2] blur-3xl"
        style={{ background: `radial-gradient(circle, ${a}, transparent 65%)` }}
      />
      <div
        className="menu-drift absolute -right-1/4 bottom-[-30%] h-[80vh] w-[80vh] rounded-full opacity-[0.16] blur-3xl"
        style={{ background: `radial-gradient(circle, ${b}, transparent 65%)`, animationDelay: '-8s' }}
      />
      <Motif motif={theme.motif} a={a} b={b} />
      {theme.emblem && (
        <img
          src={el.icon}
          alt=""
          draggable={false}
          className="menu-spin-rev absolute top-1/2 -right-[12vh] h-[78vh] w-[78vh] -translate-y-1/2 opacity-[0.05]"
        />
      )}
      {/* a fine diagonal texture instead of squares, and darker edges */}
      <div className="bd-texture absolute inset-0" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,#05060ab3_100%)]" />
    </div>
  )
}

function Motif({ motif, a, b }: { motif: Motif; a: string; b: string }) {
  switch (motif) {
    case 'rays':
      return (
        <div className="absolute top-[-60vh] left-1/2 h-[140vh] w-[140vh] -translate-x-1/2 opacity-[0.11]">
          <div
            className="menu-spin h-full w-full rounded-full"
            style={{
              background: `repeating-conic-gradient(${a} 0deg 4deg, transparent 4deg 18deg)`,
              maskImage: 'radial-gradient(circle, #000 0%, transparent 62%)',
            }}
          />
        </div>
      )
    case 'beams':
      // stadium lights sweeping from below
      return (
        <>
          {[12, 36, 64, 88].map((left, i) => (
            <div
              key={left}
              className="bd-beam absolute bottom-[-10vh] h-[120vh] w-[14vh] origin-bottom opacity-[0.13] blur-sm"
              style={{
                left: `${left}%`,
                background: `linear-gradient(to top, ${i % 2 ? b : a}, transparent 85%)`,
                animationDelay: `${-i * 2.3}s`,
                animationDuration: `${9 + i * 1.5}s`,
              }}
            />
          ))}
        </>
      )
    case 'pillars':
      // light rising like a podium
      return (
        <div className="absolute inset-x-0 bottom-0 flex h-[70vh] items-end justify-around px-[6vw] opacity-[0.16]">
          {[0.55, 0.8, 1, 0.7, 0.45, 0.9, 0.6].map((h, i) => (
            <div
              key={i}
              className="bd-pillar w-[5vw] rounded-t-full blur-[2px]"
              style={{
                height: `${h * 100}%`,
                background: `linear-gradient(to top, ${i % 3 ? a : b}, transparent)`,
                animationDelay: `${-i * 0.9}s`,
              }}
            />
          ))}
        </div>
      )
    case 'bokeh':
      return (
        <>
          {Array.from({ length: 14 }, (_, i) => {
            const size = 30 + ((i * 47) % 110)
            return (
              <div
                key={i}
                className="bd-float absolute rounded-full blur-md"
                style={{
                  left: `${(i * 29 + 7) % 100}%`,
                  top: `${(i * 41 + 13) % 100}%`,
                  width: size,
                  height: size,
                  background: `radial-gradient(circle, ${i % 2 ? a : b}, transparent 70%)`,
                  opacity: 0.14 + (i % 3) * 0.05,
                  animationDuration: `${10 + (i % 5) * 3}s`,
                  animationDelay: `${-i * 1.7}s`,
                }}
              />
            )
          })}
        </>
      )
    case 'streaks':
      // fast light streaks crossing over faint moving lines
      return (
        <>
          <div className="bd-lines absolute inset-0 opacity-[0.07]" style={{ color: a }} />
          {[18, 42, 70].map((top, i) => (
            <div
              key={top}
              className="bd-streak absolute h-px w-[40vw]"
              style={{
                top: `${top}%`,
                background: `linear-gradient(90deg, transparent, ${i % 2 ? b : a}, transparent)`,
                boxShadow: `0 0 12px ${i % 2 ? b : a}`,
                animationDelay: `${-i * 2.6}s`,
                animationDuration: `${6 + i * 1.3}s`,
              }}
            />
          ))}
        </>
      )
    case 'spot':
      return (
        <div
          className="bd-pulse absolute top-[-20vh] left-1/2 h-[120vh] w-[90vw] -translate-x-1/2"
          style={{ background: `radial-gradient(ellipse at 50% 0%, ${a}40, transparent 60%)` }}
        />
      )
    case 'split':
      // the face-off: the player's colour against the opponent's, a glowing seam between
      return (
        <>
          <div
            className="absolute inset-0"
            style={{ background: `linear-gradient(105deg, ${a}26 0%, transparent 48%, transparent 52%, ${b}26 100%)` }}
          />
          <div
            className="bd-pulse absolute top-[-10%] left-1/2 h-[120%] w-[3px] rotate-[15deg]"
            style={{
              background: `linear-gradient(to bottom, transparent, #fff9, transparent)`,
              boxShadow: `0 0 40px 8px ${a}55`,
            }}
          />
          <div className="bd-lines absolute inset-0 opacity-[0.05]" style={{ color: '#fff' }} />
        </>
      )
    case 'hex':
      return <div className="bd-hex absolute inset-0 opacity-[0.1]" style={{ color: a }} />
    case 'rings':
      return (
        <div className="absolute top-[-35vh] left-[-25vh] h-[110vh] w-[110vh]">
          <div
            className="bd-breathe h-full w-full rounded-full"
            style={{
              background: `repeating-radial-gradient(circle, transparent 0 46px, ${a}55 47px 48px, transparent 49px 94px)`,
              maskImage: 'radial-gradient(circle, #000 20%, transparent 70%)',
              opacity: 0.35,
            }}
          />
        </div>
      )
  }
}
