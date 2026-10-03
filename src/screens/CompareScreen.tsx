import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { playSfx } from '../audio/sfx'
import { GRID, GRID_SIZE } from '../components/grid'
import { BAKUGAN, type Bakugan } from '../data/bakugan'
import { brawlPower, GATE_BONUS, type BrawlSide } from '../data/battle'
import { ELEMENT_BY_ID, ELEMENTS, type ElementId } from '../data/elements'
import { useGame } from '../store/useGame'

type Result = 'left' | 'right' | 'draw'

export function CompareScreen() {
  const bakuganId = useGame((s) => s.bakuganId)
  const go = useGame((s) => s.go)
  const mine = BAKUGAN.find((b) => b.id === bakuganId) ?? BAKUGAN[0]

  const [left, setLeft] = useState<BrawlSide>({ bakugan: mine, abilities: [] })
  const [right, setRight] = useState<BrawlSide>({
    bakugan: BAKUGAN.find((b) => b.element !== mine.element)!,
    abilities: [],
  })
  const [gate, setGate] = useState<ElementId | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const lp = brawlPower(left, gate)
  const rp = brawlPower(right, gate)
  const max = Math.max(lp.total, rp.total, 1)

  const change = (fn: () => void) => {
    setResult(null)
    fn()
  }

  function brawl() {
    playSfx('brawl')
    setResult(null)
    window.setTimeout(() => {
      setResult(lp.total === rp.total ? 'draw' : lp.total > rp.total ? 'left' : 'right')
      playSfx('select')
    }, 1300)
  }

  const winner = result === 'left' ? left.bakugan : result === 'right' ? right.bakugan : null

  return (
    <motion.div
      className="absolute inset-0 overflow-y-auto px-16 py-10"
      style={{ backgroundImage: GRID, backgroundSize: GRID_SIZE }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        onClick={() => go('viewer')}
        className="font-display text-xs tracking-[0.4em] text-white/50 transition hover:text-white"
      >
        ← BACK
      </button>
      <h1 className="font-display mt-4 text-4xl font-black tracking-wider">G-POWER FACE-OFF</h1>
      <p className="mt-1 text-white/50">
        Pick an opponent, set a Gate Card and choose abilities. A Bakugan on a Gate Card of its own attribute gains +
        {GATE_BONUS}G.
      </p>

      <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-start gap-8">
        <SideCard side={left} power={lp} max={max} onChange={(s) => change(() => setLeft(s))} label="YOU" winner={result === 'left'} />
        <div className="font-display mt-40 text-5xl font-black text-white/30 italic">VS</div>
        <SideCard side={right} power={rp} max={max} onChange={(s) => change(() => setRight(s))} label="OPPONENT" winner={result === 'right'} />
      </div>

      <div className="mt-10 flex flex-col items-center gap-4">
        <p className="font-display text-xs tracking-[0.5em] text-white/40">GATE CARD ON THE FIELD</p>
        <div className="flex gap-3">
          <GateOption active={gate === null} onClick={() => change(() => setGate(null))}>
            <span className="font-display text-xs text-white/60">NONE</span>
          </GateOption>
          {ELEMENTS.map((e) => (
            <GateOption key={e.id} active={gate === e.id} color={e.color} onClick={() => change(() => setGate(e.id))}>
              <img src={e.icon} alt={e.name} className="h-10 w-10" />
            </GateOption>
          ))}
        </div>
        <motion.button
          onClick={brawl}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.96 }}
          className="font-display mt-4 skew-x-[-12deg] border-2 border-white/70 bg-white/10 px-12 py-4 text-xl font-black tracking-[0.3em]"
        >
          BAKUGAN, BRAWL!
        </motion.button>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            className="pointer-events-none fixed inset-x-0 top-1/3 text-center"
            initial={{ opacity: 0, scale: 2 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 22 }}
          >
            <div
              className="bg-black/80 py-8 backdrop-blur"
              style={{ borderBlock: `2px solid ${winner ? ELEMENT_BY_ID[winner.element].color : '#fff'}` }}
            >
              <p
                className="font-display text-6xl font-black tracking-wider italic"
                style={{ textShadow: `0 0 40px ${winner ? ELEMENT_BY_ID[winner.element].color : '#fff'}` }}
              >
                {winner ? `${winner.name.toUpperCase()} WINS!` : 'DRAW!'}
              </p>
              <p className="font-display mt-2 text-lg tracking-[0.3em] text-white/60">
                {lp.total}G VS {rp.total}G
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function SideCard({
  side,
  power,
  max,
  onChange,
  label,
  winner,
}: {
  side: BrawlSide
  power: ReturnType<typeof brawlPower>
  max: number
  onChange: (side: BrawlSide) => void
  label: string
  winner: boolean
}) {
  const element = ELEMENT_BY_ID[side.bakugan.element]
  const pick = (bakugan: Bakugan) => onChange({ bakugan, abilities: [] })
  const toggle = (id: string) =>
    onChange({
      ...side,
      abilities: side.abilities.includes(id) ? side.abilities.filter((a) => a !== id) : [...side.abilities, id],
    })

  return (
    <motion.div
      className="rounded-xl border bg-black/40 p-6 backdrop-blur"
      animate={{
        borderColor: winner ? element.color : 'rgba(255,255,255,0.1)',
        boxShadow: winner ? `0 0 40px ${element.color}88` : '0 0 0px transparent',
      }}
    >
      <p className="font-display text-xs tracking-[0.5em] text-white/40">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {BAKUGAN.map((b) => (
          <button
            key={b.id}
            title={b.name}
            onClick={() => pick(b)}
            className={`rounded-full transition ${b.id === side.bakugan.id ? 'scale-110' : 'opacity-40 hover:opacity-80'}`}
          >
            <img src={ELEMENT_BY_ID[b.element].icon} alt={b.name} className="h-9 w-9" />
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-4">
        <img src={element.icon} alt="" className="h-16 w-16" style={{ filter: `drop-shadow(0 0 14px ${element.glow})` }} />
        <div>
          <h2 className="font-display text-3xl font-bold">{side.bakugan.name}</h2>
          <p className="text-white/50">
            {element.name} · {side.bakugan.brawler}
          </p>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-xs tracking-[0.4em] text-white/40">G-POWER</span>
          <span className="font-display text-4xl font-black" style={{ color: element.color }}>
            {power.total}G
          </span>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${element.color}, ${element.glow})` }}
            animate={{ width: `${(power.total / max) * 100}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          />
        </div>
        <p className="mt-2 text-sm text-white/50">
          Base {power.base}G
          {power.gateBonus > 0 && <span className="text-white/80"> · Gate +{power.gateBonus}G</span>}
          {power.abilityBonus > 0 && <span className="text-white/80"> · Abilities +{power.abilityBonus}G</span>}
        </p>
      </div>

      <p className="font-display mt-6 text-xs tracking-[0.4em] text-white/40">ABILITIES</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {side.bakugan.abilities.map((a) => {
          const on = side.abilities.includes(a.id)
          return (
            <button
              key={a.id}
              onClick={() => toggle(a.id)}
              className="rounded-md border px-3 py-1.5 text-sm transition"
              style={{
                borderColor: on ? element.color : 'rgba(255,255,255,0.15)',
                background: on ? `${element.color}33` : 'transparent',
                color: on ? '#fff' : 'rgba(255,255,255,0.6)',
              }}
            >
              {a.name} +{a.gBoost}G
            </button>
          )
        })}
      </div>
    </motion.div>
  )
}

function GateOption({
  active,
  color = '#ffffff',
  onClick,
  children,
}: {
  active: boolean
  color?: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-20 w-14 items-center justify-center rounded-md border-2 bg-black/50 transition"
      style={{
        borderColor: active ? color : 'rgba(255,255,255,0.12)',
        boxShadow: active ? `0 0 18px ${color}88` : 'none',
        opacity: active ? 1 : 0.6,
      }}
    >
      {children}
    </button>
  )
}
