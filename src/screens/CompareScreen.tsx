import { motion } from 'framer-motion'
import { useState } from 'react'
import { playSfx } from '../audio/sfx'
import { GRID, GRID_SIZE } from '../components/grid'
import { abilityLabel, BAKUGAN, formOf, type Entrant } from '../data/bakugan'
import { GATE_BONUS, startingPower } from '../data/battle'
import { ELEMENT_BY_ID, ELEMENTS, type ElementId } from '../data/elements'
import { useGame } from '../store/useGame'

export function CompareScreen() {
  const bakuganId = useGame((s) => s.bakuganId)
  const compareForm = useGame((s) => s.compareForm)
  const go = useGame((s) => s.go)
  const enterArena = useGame((s) => s.enterArena)
  const mine = BAKUGAN.find((b) => b.id === bakuganId) ?? BAKUGAN[0]

  const [left, setLeft] = useState<Entrant>({ bakugan: mine, form: compareForm })
  const [right, setRight] = useState<Entrant>({ bakugan: BAKUGAN.find((b) => b.element !== mine.element)!, form: 0 })
  const [gate, setGate] = useState<ElementId | null>(mine.element)

  const lp = startingPower(left, gate)
  const rp = startingPower(right, gate)
  const max = Math.max(lp.total, rp.total, 1)

  function brawl() {
    playSfx('brawl')
    enterArena({
      left: { id: left.bakugan.id, form: left.form },
      right: { id: right.bakugan.id, form: right.form },
      gate,
    })
  }

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
        Pick an opponent and set the Gate Card. A Bakugan on a Gate Card of its own attribute starts with +{GATE_BONUS}
        G. Then fight it out in the arena.
      </p>

      <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-start gap-8">
        <SideCard entrant={left} power={lp} max={max} onChange={setLeft} label="YOU" />
        <div className="font-display mt-40 text-5xl font-black text-white/30 italic">VS</div>
        <SideCard entrant={right} power={rp} max={max} onChange={setRight} label="OPPONENT" />
      </div>

      <div className="mt-10 flex flex-col items-center gap-4">
        <p className="font-display text-xs tracking-[0.5em] text-white/40">GATE CARD ON THE FIELD</p>
        <div className="flex gap-3">
          <GateOption active={gate === null} onClick={() => setGate(null)}>
            <span className="font-display text-xs text-white/60">NONE</span>
          </GateOption>
          {ELEMENTS.map((e) => (
            <GateOption key={e.id} active={gate === e.id} color={e.color} onClick={() => setGate(e.id)}>
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
          ENTER THE ARENA
        </motion.button>
      </div>

    </motion.div>
  )
}

function SideCard({
  entrant,
  power,
  max,
  onChange,
  label,
}: {
  entrant: Entrant
  power: ReturnType<typeof startingPower>
  max: number
  onChange: (entrant: Entrant) => void
  label: string
}) {
  const { bakugan } = entrant
  const element = ELEMENT_BY_ID[bakugan.element]

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-6 backdrop-blur">
      <p className="font-display text-xs tracking-[0.5em] text-white/40">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {BAKUGAN.map((b) => (
          <button
            key={b.id}
            title={b.name}
            onClick={() => onChange({ bakugan: b, form: 0 })}
            className={`rounded-full transition ${b.id === bakugan.id ? 'scale-110' : 'opacity-40 hover:opacity-80'}`}
          >
            <img src={ELEMENT_BY_ID[b.element].icon} alt={b.name} className="h-9 w-9" />
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-4">
        <img src={element.icon} alt="" className="h-16 w-16" style={{ filter: `drop-shadow(0 0 14px ${element.glow})` }} />
        <div>
          <h2 className="font-display text-3xl font-bold">{formOf(entrant).name}</h2>
          <p className="text-white/50">
            {element.name} · {bakugan.brawler}
          </p>
        </div>
      </div>

      <p className="font-display mt-5 text-xs tracking-[0.4em] text-white/40">FORM</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {bakugan.evolutions.map((evo, i) => {
          const on = i === entrant.form
          return (
            <button
              key={`${evo.name}-${evo.series}`}
              onClick={() => onChange({ bakugan, form: i })}
              className="rounded-md border px-3 py-1.5 text-left text-sm transition"
              style={{
                borderColor: on ? element.color : 'rgba(255,255,255,0.15)',
                background: on ? `${element.color}33` : 'transparent',
                color: on ? '#fff' : 'rgba(255,255,255,0.6)',
              }}
            >
              <span className="font-semibold">{evo.name}</span>
              <span className="ml-2 text-xs text-white/50">
                {evo.series === 'Battle Brawlers' ? '' : `${evo.series} · `}
                {evo.gPower}G
              </span>
            </button>
          )
        })}
      </div>

      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <span className="font-display text-xs tracking-[0.4em] text-white/40">STARTING G-POWER</span>
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
          Base {power.base}G{power.gateBonus > 0 && <span className="text-white/80"> · Gate +{power.gateBonus}G</span>}
        </p>
      </div>

      <p className="font-display mt-6 text-xs tracking-[0.4em] text-white/40">ABILITY CARDS ({bakugan.abilities.length})</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {bakugan.abilities.map((a) => (
          <span key={a.id} className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/70" title={a.description}>
            {a.name} <span style={{ color: element.color }}>{abilityLabel(a)}</span>
          </span>
        ))}
      </div>
    </div>
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
