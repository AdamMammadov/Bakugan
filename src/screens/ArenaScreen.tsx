import { Canvas } from '@react-three/fiber'
import { animate, AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { playSfx } from '../audio/sfx'
import {
  act,
  chooseAction,
  MAX_HP,
  startBattle,
  type Action,
  type BattleEvent,
  type BattleState,
  type Fighter,
} from '../battle/engine'
import { abilityLabel, BAKUGAN, battleEffect, formOf, type Ability, type Entrant } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { useGame } from '../store/useGame'
import { ACTION_DURATION, ArenaScene, IMPACT_AT } from '../three/ArenaScene'
import { preloadModels } from '../three/BakuganModels'

const INTRO_MS = 2000
const ENEMY_DELAY_MS = 700

const TYPE_ICON: Record<Ability['type'], string> = {
  attack: '⚔',
  boost: '▲',
  weaken: '▼',
  drain: '⇄',
  shield: '◆',
}

export function ArenaScreen() {
  const setup = useGame((s) => s.arena)!
  const go = useGame((s) => s.go)
  const left: Entrant = { bakugan: BAKUGAN.find((b) => b.id === setup.left.id)!, form: setup.left.form }
  const right: Entrant = { bakugan: BAKUGAN.find((b) => b.id === setup.right.id)!, form: setup.right.form }
  const leftName = formOf(left).name
  useEffect(() => {
    preloadModels(left.bakugan)
    preloadModels(right.bakugan)
  }, [left.bakugan, right.bakugan])
  const rightName = formOf(right).name

  const [battle, setBattle] = useState<BattleState>(() => startBattle(left, right, setup.gate))
  // What the HUD shows; lags `battle` until each hit lands.
  const [shown, setShown] = useState<BattleState>(battle)
  const [event, setEvent] = useState<{ event: BattleEvent; key: number } | null>(null)
  const [busy, setBusy] = useState(true)
  const [shout, setShout] = useState<{ text: string; sub?: string; key: number } | null>(null)
  const timers = useRef<number[]>([])

  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms))
  const say = (text: string, sub?: string) => setShout({ text, sub, key: Date.now() })

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const run = useCallback((state: BattleState, action: Action) => {
    const { state: next, event: ev } = act(state, action)
    setBusy(true)
    setEvent({ event: ev, key: Date.now() })
    if (action.kind === 'ability') {
      playSfx('ability')
      say('ABILITY ACTIVATE!', action.ability.name)
    } else {
      playSfx('gateCard')
    }
    later(IMPACT_AT * 1000, () => {
      if (ev.damage > 0 && !ev.blocked) playSfx('hit')
      if (ev.actorG || ev.targetG) playSfx('gPower')
      setShown(next)
    })
    later(ACTION_DURATION * 1000, () => {
      setBattle(next)
      if (next.winner !== null) {
        playSfx(next.winner === 0 ? 'victory' : 'defeat')
        return
      }
      if (next.turn === 1) later(ENEMY_DELAY_MS, () => run(next, chooseAction(next)))
      else {
        setBusy(false)
        say('YOUR TURN')
      }
    })
  }, [])

  useEffect(() => {
    playSfx('brawl')
    say('BAKUGAN, BRAWL!', `${leftName} vs ${rightName}`)
    later(INTRO_MS, () => {
      setBusy(false)
      say('YOUR TURN')
    })
  }, [])

  function rematch() {
    timers.current.forEach(clearTimeout)
    const fresh = startBattle(left, right, setup.gate)
    setBattle(fresh)
    setShown(fresh)
    setEvent(null)
    setBusy(true)
    say('BAKUGAN, BRAWL!', `${leftName} vs ${rightName}`)
    later(1200, () => {
      setBusy(false)
      say('YOUR TURN')
    })
  }

  const me = battle.fighters[0]
  const myTurn = !busy && battle.turn === 0 && battle.winner === null
  const element = ELEMENT_BY_ID[left.bakugan.element]

  return (
    <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Canvas shadows camera={{ position: [0, 7.5, 23], fov: 50 }} dpr={[1, 2]}>
        <ArenaScene
          fighters={[left, right]}
          gate={setup.gate}
          event={event}
          shields={[shown.fighters[0].shield, shown.fighters[1].shield]}
          defeated={shown.winner === null ? null : shown.winner === 0 ? 1 : 0}
        />
      </Canvas>

      {/* life bars */}
      <div className="pointer-events-none absolute inset-x-0 top-0 grid grid-cols-[1fr_auto_1fr] items-start gap-6 p-6">
        <LifePanel fighter={shown.fighters[0]} label="YOU" align="left" />
        <div className="pt-2 text-center">
          <p className="font-display text-xs tracking-[0.5em] text-white/40">ROUND</p>
          <p className="font-display text-3xl font-black">{battle.round}</p>
        </div>
        <LifePanel fighter={shown.fighters[1]} label="OPPONENT" align="right" />
      </div>

      <button
        onClick={() => go('compare')}
        className="font-display absolute top-28 left-6 text-xs tracking-[0.4em] text-white/40 transition hover:text-white"
      >
        ← LEAVE
      </button>

      {/* battle log */}
      <div className="pointer-events-none absolute top-28 right-6 w-80 space-y-1 text-right text-sm">
        {shown.log.slice(-4).map((line, i, arr) => (
          <p key={shown.log.length - arr.length + i} className={i === arr.length - 1 ? 'text-white/90' : 'text-white/40'}>
            {line}
          </p>
        ))}
      </div>

      {/* hand */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-center gap-3 px-28 pb-5">
        <HandButton
          disabled={!myTurn}
          onClick={() => run(battle, { kind: 'basic' })}
          color="#ffffff"
          title="ATTACK"
          tag="BASIC"
          text="A plain strike. Damage scales with your G-Power."
        />
        {left.bakugan.abilities.map((a) => {
          const used = me.used.includes(a.id)
          return (
            <HandButton
              key={a.id}
              disabled={!myTurn || used}
              used={used}
              onClick={() => run(battle, { kind: 'ability', ability: a })}
              color={element.color}
              title={a.name}
              tag={`${TYPE_ICON[a.type]} ${abilityLabel(a)}`}
              text={a.description}
              effect={battleEffect(a)}
            />
          )
        })}
      </div>

      <AnimatePresence>
        {shout && battle.winner === null && (
          <motion.div
            key={shout.key}
            className="pointer-events-none absolute inset-x-0 top-[24%] text-center"
            initial={{ opacity: 0, scale: 2 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            onAnimationComplete={() => window.setTimeout(() => setShout((s) => (s?.key === shout.key ? null : s)), 900)}
          >
            <p className="font-display text-5xl font-black tracking-wider italic" style={{ textShadow: `0 0 30px ${element.color}` }}>
              {shout.text}
            </p>
            {shout.sub && <p className="font-display mt-2 text-xl tracking-widest text-white/80">{shout.sub}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {battle.winner !== null && (
          <motion.div
            className="absolute inset-x-0 top-1/3 flex flex-col items-center bg-black/75 py-10 backdrop-blur"
            style={{ borderBlock: `2px solid ${battle.winner === 0 ? element.color : '#666'}` }}
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
          >
            <p className="font-display text-7xl font-black tracking-widest italic" style={{ textShadow: `0 0 40px ${element.color}` }}>
              {battle.winner === 0 ? 'VICTORY!' : 'DEFEAT'}
            </p>
            <p className="font-display mt-2 tracking-[0.3em] text-white/60">
              {battle.fighters[battle.winner].name.toUpperCase()} WINS IN {battle.round - (battle.winner === 1 ? 1 : 0)}{' '}
              ROUNDS
            </p>
            <div className="mt-6 flex gap-4">
              <button onClick={rematch} className="font-display border-2 border-white/70 px-8 py-3 tracking-[0.3em] hover:bg-white/10">
                REMATCH
              </button>
              <button
                onClick={() => go('compare')}
                className="font-display border-2 border-white/25 px-8 py-3 tracking-[0.3em] text-white/70 hover:bg-white/10"
              >
                NEW OPPONENT
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function LifePanel({ fighter, label, align }: { fighter: Fighter; label: string; align: 'left' | 'right' }) {
  const element = ELEMENT_BY_ID[fighter.bakugan.element]
  const pct = (fighter.hp / MAX_HP) * 100
  const right = align === 'right'
  const barColor = pct > 50 ? '#3ee07a' : pct > 25 ? '#f5c518' : '#ff3b2f'

  return (
    <div className={`flex items-center gap-4 ${right ? 'flex-row-reverse text-right' : ''}`}>
      <img src={element.icon} alt="" className="h-16 w-16" style={{ filter: `drop-shadow(0 0 12px ${element.glow})` }} />
      <div className="flex-1">
        <div className={`flex items-baseline gap-3 ${right ? 'flex-row-reverse' : ''}`}>
          <span className="font-display text-xs tracking-[0.4em] text-white/40">{label}</span>
          <span className="font-display text-2xl font-bold">{fighter.name}</span>
          {fighter.shield && (
            <span className="font-display text-xs tracking-widest" style={{ color: element.glow }}>
              ◆ SHIELD
            </span>
          )}
        </div>
        <div className="mt-2 h-4 overflow-hidden rounded-sm border border-white/15 bg-white/5">
          <motion.div
            className={`h-full ${right ? 'ml-auto' : ''}`}
            style={{ background: barColor, boxShadow: `0 0 12px ${barColor}` }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <div className={`mt-1 flex justify-between text-sm ${right ? 'flex-row-reverse' : ''}`}>
          <span className="text-white/60">
            LIFE <AnimatedNumber value={fighter.hp} />/{MAX_HP}
          </span>
          <span className="font-display font-bold" style={{ color: element.color }}>
            <AnimatedNumber value={fighter.g} />G
          </span>
        </div>
      </div>
    </div>
  )
}

function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value)
  const prev = useRef(value)
  useEffect(() => {
    const controls = animate(prev.current, value, { duration: 0.6, onUpdate: (v) => setShown(Math.round(v)) })
    prev.current = value
    return () => controls.stop()
  }, [value])
  return <>{shown}</>
}

function HandButton({
  title,
  tag,
  text,
  effect,
  color,
  disabled,
  used,
  onClick,
}: {
  title: string
  tag: string
  text: string
  /** Arena effect summary shown in the hover popover. */
  effect?: string
  color: string
  disabled: boolean
  used?: boolean
  onClick: () => void
}) {
  return (
    <div className="group relative flex min-w-0 flex-1 basis-0 [max-width:10rem]">
      <motion.button
        disabled={disabled}
        onClick={onClick}
        whileHover={disabled ? undefined : { y: -14 }}
        className="relative flex h-[clamp(6rem,24vh,11rem)] w-full flex-col rounded-lg border-2 bg-black/75 p-3 text-left backdrop-blur transition disabled:cursor-not-allowed"
        style={{
          borderColor: used ? 'rgba(255,255,255,0.1)' : `${color}aa`,
          opacity: used ? 0.3 : disabled ? 0.6 : 1,
          boxShadow: disabled ? 'none' : `0 0 18px ${color}44`,
        }}
      >
        <span className="font-display text-[11px] font-bold tracking-wider" style={{ color }}>
          {tag}
        </span>
        <span className="font-display mt-1 text-sm leading-tight font-bold">{title}</span>
        <span className="mt-1.5 line-clamp-2 text-xs leading-snug text-white/65 [@media(min-height:720px)]:line-clamp-4">
          {text}
        </span>
        {used && (
          <span className="font-display absolute inset-0 flex items-center justify-center rounded-lg bg-black/60 text-xs tracking-[0.3em] text-white/80">
            USED
          </span>
        )}
      </motion.button>

      {/* full card text on hover, even while it is not your turn */}
      <div
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-4 w-64 -translate-x-1/2 rounded-lg border bg-black/90 p-4 opacity-0 shadow-2xl backdrop-blur transition group-hover:opacity-100"
        style={{ borderColor: `${color}aa` }}
      >
        <p className="font-display text-[11px] font-bold tracking-wider" style={{ color }}>
          {tag}
        </p>
        <p className="font-display mt-1 text-base font-bold">{title}</p>
        <p className="mt-2 text-sm leading-snug text-white/80">{text}</p>
        {effect && (
          <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-snug text-white/60">
            <span className="font-display tracking-widest text-white/40">IN THE ARENA · </span>
            {effect}
          </p>
        )}
      </div>
    </div>
  )
}
