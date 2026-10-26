import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import type { SideIndex } from '../battle/engine'
import { ELEMENT_BY_ID } from '../data/elements'
import { listenFx } from '../three/fx'

/**
 * Screen-space effects over the arena for the big battle moments (fx.ts): the anime call-outs ("ABILITY ACTIVATE!"
 * and the card's name sliding in on the brawler's side, "GATE CARD, OPEN!", "NULLIFIED!"), a brief flash of the
 * attribute's colour, and the G-Power changes popping up by each side's G display. Mounted by the battle screens;
 * draws nothing until a moment happens, and never takes a click.
 */

const GOLD = '#ffc94a'
const GOLD_GLOW = '#fff0b0'

type Variant = 'ability' | 'gate' | 'close' | 'nullify'

interface Caption {
  id: number
  variant: Variant
  /** The brawler it comes from: it slides in from their side. */
  side: SideIndex
  kicker: string
  title: string
  color: string
  glow: string
  badge?: string
}

interface Pop {
  id: number
  side: SideIndex
  value: number
  delay: number
}

interface Flash {
  id: number
  color: string
  /** Where it centres (0–1 across the screen). */
  at: number
  strength: number
}

const HOLD: Record<Variant, number> = { ability: 1500, gate: 1750, close: 1450, nullify: 1450 }

let ids = 1

export function FxOverlay() {
  const reduced = useReducedMotion() ?? false
  const [caption, setCaption] = useState<Caption | null>(null)
  const [pops, setPops] = useState<Pop[]>([])
  const [flash, setFlash] = useState<Flash | null>(null)
  // who opened the Gate Card last: opening it after the other side held it turns it around
  const holder = useRef<SideIndex | null>(null)

  useEffect(() => {
    const timers: number[] = []
    const later = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms))
    const show = (c: Omit<Caption, 'id'>) => {
      const id = ids++
      setCaption({ ...c, id })
      later(HOLD[c.variant], () => setCaption((now) => (now?.id === id ? null : now)))
    }
    const pop = (delta: [number, number], delay: number) => {
      const added = ([0, 1] as const).filter((s) => delta[s]).map((s) => ({ id: ids++, side: s, value: delta[s], delay }))
      if (!added.length) return
      setPops((list) => [...list, ...added])
      later((delay + 1.6) * 1000, () => setPops((list) => list.filter((p) => !added.includes(p))))
    }
    const flashOf = (color: string, at: number, strength = 1) => {
      const id = ids++
      setFlash({ id, color, at, strength })
      later(450, () => setFlash((f) => (f?.id === id ? null : f)))
    }
    const stop = listenFx((call) => {
      switch (call.kind) {
        case 'ability': {
          const el = ELEMENT_BY_ID[call.element]
          show({
            variant: 'ability',
            side: call.side,
            kicker: 'ABILITY ACTIVATE!',
            title: call.name,
            color: el.color,
            glow: el.glow,
          })
          flashOf(el.glow, call.side === 0 ? 0.3 : 0.7)
          pop(call.delta, 0.55)
          break
        }
        case 'gateOpen': {
          const el = call.element ? ELEMENT_BY_ID[call.element] : null
          const turned = holder.current !== null && holder.current !== call.by
          holder.current = call.by
          show({
            variant: 'gate',
            side: call.by,
            kicker: 'GATE CARD, OPEN!',
            title: call.name,
            color: el?.color ?? GOLD,
            glow: el?.glow ?? GOLD_GLOW,
            badge: turned ? 'REVERSED!' : undefined,
          })
          flashOf(el?.glow ?? GOLD_GLOW, 0.5, 0.8)
          pop(call.delta, 0.95)
          break
        }
        case 'gateClose':
          holder.current = null
          show({
            variant: 'close',
            side: call.by,
            kicker: 'GATE CARD, CLOSE!',
            title: call.name,
            color: '#9aa6c4',
            glow: '#dfe6ff',
          })
          break
        case 'nullify':
          if (call.target === 'gate') holder.current = null
          // `name` is the cancelled card's
          show({ variant: 'nullify', side: call.by, kicker: call.name, title: 'NULLIFIED!', color: '#bfeaff', glow: '#ffffff' })
          flashOf('#e6f6ff', call.by === 0 ? 0.7 : 0.3, 0.9)
          break
        case 'defeat':
          holder.current = null
          flashOf('#ffffff', call.side === 0 ? 0.3 : 0.7, 0.45)
          break
      }
    })
    return () => {
      stop()
      timers.forEach(clearTimeout)
    }
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden" aria-hidden>
      <AnimatePresence>
        {flash && !reduced && (
          <motion.div
            key={flash.id}
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 70% 80% at ${flash.at * 100}% 55%, ${flash.color} 0%, ${flash.color}55 35%, transparent 75%)`,
              mixBlendMode: 'screen',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.55 * flash.strength, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.42, times: [0, 0.15, 1], ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>{caption && <CaptionView key={caption.id} c={caption} reduced={reduced} />}</AnimatePresence>
      <AnimatePresence>
        {pops.map((p) => (
          <PopView key={p.id} p={p} reduced={reduced} />
        ))}
      </AnimatePresence>
    </div>
  )
}

/** The call-out band: slides in from the brawler's side, holds, and speeds off. */
function CaptionView({ c, reduced }: { c: Caption; reduced: boolean }) {
  const left = c.side === 0
  const dir = left ? -1 : 1
  const centred = c.variant === 'gate' || c.variant === 'close'
  const big = c.variant === 'nullify'
  const kicker = big ? 'text-[clamp(13px,1.35vw,19px)] tracking-[0.3em]' : 'text-[clamp(17px,2.1vw,30px)] tracking-[0.06em]'
  const title = big ? 'text-[clamp(34px,5.4vw,78px)]' : 'text-[clamp(24px,3.7vw,54px)]'
  const place = centred
    ? // between the two G-Power cards and the announcer's band, clear of both
      'top-[40%] left-1/2 w-[min(640px,56vw)] -translate-x-1/2 items-center text-center'
    : // under the brawler's G-Power card (which ends about 30% down), above the announcer and the hand
      `top-[38%] w-[min(560px,46vw)] ${left ? 'left-0 items-start text-left' : 'right-0 items-end text-right'}`
  const skew = left || centred ? -12 : 12
  return (
    <motion.div
      className={`absolute flex flex-col ${place}`}
      initial={reduced ? { opacity: 0 } : { x: `${dir * 110}%`, opacity: 1 }}
      animate={{ x: 0, opacity: 1 }}
      exit={reduced ? { opacity: 0 } : { x: `${-dir * 18}%`, opacity: 0 }}
      transition={reduced ? { duration: 0.2 } : { type: 'spring', stiffness: 520, damping: 34, mass: 0.7 }}
    >
      {/* the band: dark glass with the attribute's colour along its edges, speed lines and a sheen */}
      <div
        className="absolute inset-y-[-6px] inset-x-0 overflow-hidden"
        style={{
          transform: `skewX(${skew}deg)`,
          background: centred
            ? 'linear-gradient(90deg, transparent, rgba(6,7,14,.86) 14%, rgba(6,7,14,.86) 86%, transparent)'
            : `linear-gradient(${left ? 90 : 270}deg, rgba(6,7,14,.9) 0%, rgba(6,7,14,.84) 70%, transparent 100%)`,
          borderTop: `3px solid ${c.color}`,
          borderBottom: `3px solid ${c.color}`,
          boxShadow: `0 0 26px ${c.glow}55, inset 0 0 40px ${c.color}33`,
        }}
      >
        <div
          className="absolute inset-0 opacity-25"
          style={{ background: `repeating-linear-gradient(${left ? 90 : 270}deg, ${c.glow} 0 2px, transparent 2px 26px)` }}
        />
        {!reduced && (
          <motion.div
            className="absolute inset-y-0 w-1/3"
            style={{ background: `linear-gradient(90deg, transparent, ${c.glow}77, transparent)` }}
            initial={{ left: left || centred ? '-35%' : '110%' }}
            animate={{ left: left || centred ? '110%' : '-35%' }}
            transition={{ duration: 0.55, delay: 0.12, ease: 'easeOut' }}
          />
        )}
      </div>
      {c.variant === 'nullify' && !reduced && <GlassCrack color={c.glow} />}
      <div className={`relative px-[clamp(20px,4vw,56px)] py-2 ${centred ? '' : left ? 'pr-16' : 'pl-16'}`}>
        {c.badge && (
          <motion.div
            className="font-display mb-1 inline-block rounded-sm px-2 py-0.5 text-[clamp(10px,1vw,13px)] font-black tracking-[0.3em] text-black"
            style={{ background: c.glow, boxShadow: `0 0 14px ${c.glow}` }}
            initial={reduced ? false : { scale: 1.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.18, duration: 0.2 }}
          >
            {c.badge}
          </motion.div>
        )}
        <div
          // the nullified card's name is struck out
          className={`font-display leading-tight font-black whitespace-nowrap text-white italic ${kicker} ${big ? 'line-through decoration-2' : ''}`}
          style={{ textShadow: `0 0 16px ${c.glow}, 0 0 4px ${c.color}, 2px 2px 0 #000` }}
        >
          {c.kicker}
        </div>
        <motion.div
          className={`font-display leading-[1.02] font-black uppercase italic ${title} ${c.variant === 'close' ? 'line-through decoration-[3px]' : ''}`}
          style={{
            color: c.variant === 'close' ? '#aeb6cc' : c.color,
            backgroundImage:
              c.variant === 'close' ? undefined : `linear-gradient(180deg, #ffffff 0%, ${c.glow} 45%, ${c.color} 100%)`,
            WebkitBackgroundClip: c.variant === 'close' ? undefined : 'text',
            backgroundClip: c.variant === 'close' ? undefined : 'text',
            WebkitTextFillColor: c.variant === 'close' ? undefined : 'transparent',
            filter: `drop-shadow(0 0 10px ${c.color}aa) drop-shadow(3px 3px 0 #000)`,
            overflowWrap: 'anywhere',
          }}
          initial={reduced ? false : { x: dir * 60, opacity: 0, scale: big ? 1.6 : 1 }}
          animate={{ x: 0, opacity: 1, scale: 1 }}
          transition={reduced ? { duration: 0 } : { delay: 0.07, type: 'spring', stiffness: 420, damping: 26 }}
        >
          {c.title}
        </motion.div>
      </div>
    </motion.div>
  )
}

/** Crack lines shooting out from the middle (SVG points, 0–100), and shards flying off. */
function makeCrack() {
  const lines = Array.from({ length: 11 }, (_, i) => {
    const a = (i / 11) * Math.PI * 2 + Math.random() * 0.4
    let x = 50
    let y = 50
    const pts = [`${x},${y}`]
    for (let k = 0; k < 4; k++) {
      const r = 7 + Math.random() * 9
      const b = a + (Math.random() - 0.5) * 0.7
      x += Math.cos(b) * r
      y += Math.sin(b) * r * 0.55
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`)
    }
    return pts.join(' ')
  })
  const shards = Array.from({ length: 9 }, () => ({
    a: Math.random() * Math.PI * 2,
    d: 90 + Math.random() * 140,
    r: (Math.random() - 0.5) * 540,
    s: 8 + Math.random() * 14,
  }))
  return { lines, shards }
}

/** Glass breaking behind "NULLIFIED!": cracks shooting out from the middle and a few shards flying off. */
function GlassCrack({ color }: { color: string }) {
  const [{ lines, shards }] = useState(makeCrack)
  return (
    <div className="absolute inset-[-30%] flex items-center justify-center">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        {lines.map((pts, i) => (
          <motion.polyline
            key={i}
            points={pts}
            fill="none"
            stroke={color}
            strokeWidth={0.45}
            vectorEffect="non-scaling-stroke"
            style={{ filter: `drop-shadow(0 0 3px ${color})` }}
            initial={{ pathLength: 0, opacity: 1 }}
            animate={{ pathLength: 1, opacity: [1, 1, 0] }}
            transition={{ pathLength: { duration: 0.16, delay: i * 0.008 }, opacity: { duration: 1.3, times: [0, 0.6, 1] } }}
          />
        ))}
      </svg>
      {shards.map((s, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            width: s.s,
            height: s.s * 1.6,
            background: `linear-gradient(135deg, #ffffff, ${color}66)`,
            clipPath: 'polygon(50% 0, 100% 100%, 0 70%)',
          }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{ x: Math.cos(s.a) * s.d, y: Math.sin(s.a) * s.d * 0.6 + 40, rotate: s.r, opacity: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}

/** "+100 G" / "−300 G" by a side's G display. */
function PopView({ p, reduced }: { p: Pop; reduced: boolean }) {
  const gain = p.value > 0
  const color = gain ? '#ffe45c' : '#ff4a3d'
  const left = p.side === 0
  return (
    <motion.div
      className={`font-display absolute top-[124px] text-[clamp(22px,2.5vw,36px)] font-black italic ${left ? 'left-[300px]' : 'right-[300px]'}`}
      style={{
        color,
        textShadow: `0 0 14px ${color}, 0 0 2px #000, 2px 2px 0 #000`,
        WebkitTextStroke: '1px rgba(0,0,0,.6)',
      }}
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.4, y: 10 }}
      animate={
        reduced
          ? { opacity: [0, 1, 1, 0] }
          : { opacity: [0, 1, 1, 0], scale: [0.4, 1.3, 1, 1], y: [10, 0, -10, -26], x: gain ? 0 : [0, -6, 6, -3, 0] }
      }
      transition={{
        delay: p.delay,
        duration: 1.35,
        times: [0, 0.14, 0.7, 1],
        ease: 'easeOut',
        x: { delay: p.delay + 0.12, duration: 0.35 },
      }}
      exit={{ opacity: 0 }}
    >
      {gain ? '+' : '−'}
      {Math.abs(p.value)} G
    </motion.div>
  )
}
