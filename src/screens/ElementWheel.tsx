import { AnimatePresence, motion, useSpring } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { playSfx } from '../audio/sfx'
import { ELEMENTS, type ElementInfo } from '../data/elements'
import { GRID, GRID_SIZE } from '../components/grid'
import { useGame } from '../store/useGame'

const ART = 640 // size of the wheel art in source pixels
const ICON = 118
const DEAD_ZONE = 0.12 // fraction of the radius where the cursor keeps the current pick

/** Signed shortest difference between two angles in degrees. */
const angleDelta = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180

function elementAt(angle: number): ElementInfo {
  return ELEMENTS.reduce((best, e) =>
    Math.abs(angleDelta(angle, e.wheelAngle)) < Math.abs(angleDelta(angle, best.wheelAngle)) ? e : best,
  )
}

export function ElementWheel() {
  const chooseElement = useGame((s) => s.chooseElement)
  const wheelRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState<ElementInfo>(ELEMENTS[0])
  const [chosen, setChosen] = useState<ElementInfo | null>(null)
  const [size, setSize] = useState(640)

  // Continuous (unwrapped) angles so the springs never spin the long way round.
  const cursorAngle = useRef(0)
  const runeRotation = useSpring(0, { stiffness: 60, damping: 18 })
  const pointerRotation = useSpring(0, { stiffness: 260, damping: 26 })
  const wedgeAngle = useRef(0)
  const wedgeRotation = useSpring(0, { stiffness: 320, damping: 28 })

  useEffect(() => {
    const resize = () => setSize(Math.min(window.innerHeight * 0.86, window.innerWidth * 0.55, 760))
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    if (chosen) return

    const pick = (next: ElementInfo) => {
      // The highlight wedge snaps to the sector; the needle follows the cursor freely.
      wedgeAngle.current += angleDelta(wedgeAngle.current, next.wheelAngle)
      wedgeRotation.set(wedgeAngle.current)
      setHovered((prev) => {
        if (prev.id !== next.id) playSfx('tick')
        return next
      })
    }

    const onMove = (ev: PointerEvent) => {
      const rect = wheelRef.current?.getBoundingClientRect()
      if (!rect) return
      const dx = ev.clientX - (rect.left + rect.width / 2)
      const dy = ev.clientY - (rect.top + rect.height / 2)
      if (Math.hypot(dx, dy) < (rect.width / 2) * DEAD_ZONE) return
      const angle = (Math.atan2(dx, -dy) * 180) / Math.PI
      cursorAngle.current += angleDelta(cursorAngle.current, angle)
      runeRotation.set(cursorAngle.current * 0.6)
      pointerRotation.set(cursorAngle.current)
      pick(elementAt(angle))
    }

    const onKey = (ev: KeyboardEvent) => {
      const i = ELEMENTS.indexOf(hovered)
      let next: ElementInfo | null = null
      if (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') next = ELEMENTS[(i + 1) % ELEMENTS.length]
      if (ev.key === 'ArrowLeft' || ev.key === 'ArrowUp') next = ELEMENTS[(i + ELEMENTS.length - 1) % ELEMENTS.length]
      if (next) {
        cursorAngle.current += angleDelta(cursorAngle.current, next.wheelAngle)
        runeRotation.set(cursorAngle.current * 0.6)
        pointerRotation.set(cursorAngle.current)
        pick(next)
      }
      if (ev.key === 'Enter' || ev.key === ' ') confirm(hovered)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('keydown', onKey)
    }
  })

  function confirm(element: ElementInfo) {
    if (chosen) return
    setChosen(element)
    playSfx('select')
    window.setTimeout(() => chooseElement(element.id), 1800)
  }

  const scale = size / ART
  const active = chosen ?? hovered

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center gap-16 px-12"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      style={{
        backgroundImage: `radial-gradient(circle at 60% 50%, ${active.color}33 0%, transparent 55%), ${GRID}`,
        backgroundSize: `100% 100%, ${GRID_SIZE}`,
      }}
    >
      <InfoPanel element={active} />

      <div
        ref={wheelRef}
        className="relative shrink-0 cursor-pointer"
        style={{ width: size, height: size }}
        onClick={() => confirm(hovered)}
      >
        {/* glow behind the disk */}
        <div
          className="absolute inset-0 rounded-full transition-shadow duration-300"
          style={{ boxShadow: `0 0 ${size * 0.12}px ${active.color}66, inset 0 0 ${size * 0.05}px ${active.color}55` }}
        />
        <img src="/wheel/inner.webp" alt="" className="absolute inset-0 h-full w-full" draggable={false} />
        <motion.img
          src="/wheel/runes.webp"
          alt=""
          className="absolute inset-0 h-full w-full"
          style={{ rotate: runeRotation }}
          draggable={false}
        />

        {/* selection wedge (snaps to the sector) and needle (follows the cursor) */}
        <motion.svg viewBox="-320 -320 640 640" className="pointer-events-none absolute inset-0 h-full w-full" style={{ rotate: wedgeRotation }}>
          <defs>
            <radialGradient id="wedge" r="0.5">
              <stop offset="0.25" stopColor={active.color} stopOpacity="0" />
              <stop offset="1" stopColor={active.color} stopOpacity="0.45" />
            </radialGradient>
          </defs>
          <path d={wedgePath(296, 30)} fill="url(#wedge)" />
        </motion.svg>
        <motion.svg viewBox="-320 -320 640 640" className="pointer-events-none absolute inset-0 h-full w-full" style={{ rotate: pointerRotation }}>
          <line x1="0" y1="-40" x2="0" y2="-296" stroke={active.glow} strokeWidth="3" strokeLinecap="round" opacity="0.9" />
          <polygon points="0,-318 -10,-300 10,-300" fill={active.glow} />
        </motion.svg>

        {ELEMENTS.map((e) => {
          const isActive = e.id === active.id
          return (
            <motion.img
              key={e.id}
              src={e.icon}
              alt={e.name}
              draggable={false}
              className="absolute rounded-full"
              style={{
                width: ICON * scale,
                height: ICON * scale,
                left: (ART / 2 + e.wheelPos.x - ICON / 2) * scale,
                top: (ART / 2 + e.wheelPos.y - ICON / 2) * scale,
              }}
              animate={{
                scale: isActive ? (chosen ? 1.5 : 1.3) : 1,
                opacity: chosen && !isActive ? 0.15 : isActive ? 1 : 0.55,
                filter: isActive ? `drop-shadow(0 0 ${18 * scale}px ${e.glow})` : 'drop-shadow(0 0 0px transparent)',
                zIndex: isActive ? 2 : 1,
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            />
          )
        })}
      </div>

      <AnimatePresence>{chosen && <ChosenBanner element={chosen} />}</AnimatePresence>
    </motion.div>
  )
}

function wedgePath(r: number, halfAngle: number) {
  const a = (halfAngle * Math.PI) / 180
  const x = Math.sin(a) * r
  const y = -Math.cos(a) * r
  return `M0,0 L${-x},${y} A${r},${r} 0 0 1 ${x},${y} Z`
}

function InfoPanel({ element }: { element: ElementInfo }) {
  return (
    <div className="w-80 shrink-0">
      <p className="font-display text-xs tracking-[0.5em] text-white/40">CHOOSE YOUR ATTRIBUTE</p>
      <AnimatePresence mode="wait">
        <motion.div
          key={element.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.18 }}
        >
          <h2
            className="font-display mt-4 text-6xl font-black tracking-wider"
            style={{ color: element.color, textShadow: `0 0 30px ${element.glow}88` }}
          >
            {element.name.toUpperCase()}
          </h2>
          <p className="font-display mt-1 text-lg tracking-[0.4em] text-white/70">{element.attribute.toUpperCase()}</p>
          <p className="mt-6 text-2xl font-medium text-white/90">{element.tagline}</p>
          <p className="mt-6 text-base text-white/50">
            Legendary brawler: <span className="font-semibold text-white/80">{element.brawler}</span>
          </p>
        </motion.div>
      </AnimatePresence>
      <p className="mt-12 text-sm tracking-widest text-white/35">MOVE THE MOUSE TO ROTATE · CLICK TO CHOOSE</p>
    </div>
  )
}

function ChosenBanner({ element }: { element: ElementInfo }) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ background: element.color }}
        initial={{ opacity: 0.8 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.6 }}
      />
      <motion.div
        className="bg-black/70 px-16 py-8 text-center backdrop-blur"
        style={{ borderTop: `2px solid ${element.color}`, borderBottom: `2px solid ${element.color}` }}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.15, duration: 0.35, ease: 'easeOut' }}
      >
        <p className="font-display text-sm tracking-[0.6em] text-white/60">YOU ARE NOW A</p>
        <p className="font-display mt-2 text-5xl font-black tracking-widest" style={{ color: element.color }}>
          {element.name.toUpperCase()} BRAWLER
        </p>
      </motion.div>
    </motion.div>
  )
}
