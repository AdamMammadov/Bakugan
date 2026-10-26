import { animate, AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  canOpenGate,
  gapOf,
  leaderOf,
  LIVES,
  other,
  powerOf,
  type BattleState,
  type Duel,
  type Effect,
  type SideIndex,
} from '../battle/engine'
import { Avatar, AvatarDrawing, CharacterPortrait } from '../components/Avatar'
import { BakuganPortrait } from '../components/BakuganPortrait'
import { TYPE_ICON } from '../battle/labels'
import type { Entrant } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { gateElementOf, gateKindLabel, gateLabel, type GateCard } from '../data/gates'
import { CHARACTER_BY_ID, DEFAULT_PARTS, photoOf, type Avatar as AvatarValue, type AvatarParts } from '../profile/avatar'

/**
 * The battle HUD, after the anime's brawl screen: on each side the brawler's face, under it a card with the Bakugan
 * on the field, its attribute and its G-Power in big digits, then the brawler's HSP. At the top each brawler's
 * lives (three balls; a lost battle greys one out) and the turn counter in the middle, with whose move it is and who
 * is ahead under it.
 */

/** Ahead or behind at a glance. */
export const AHEAD = '#3ee07a'
export const BEHIND = '#ff5a4f'

export interface HudBrawler {
  name: string
  tag: string
  avatar: AvatarValue
  parts: AvatarParts
  /** Holo-Sector Points: the brawler's ranking score. */
  hsp?: number
}

/** The lives at the top: a glossy ball per life (`max` of them), a lost one greyed out with a cross. */
export function LifeBalls({
  lives,
  color,
  right,
  max = LIVES,
  small,
}: {
  lives: number
  color: string
  right?: boolean
  max?: number
  small?: boolean
}) {
  return (
    <div className={`flex ${small ? 'gap-1' : 'gap-2'} ${right ? 'flex-row-reverse' : ''}`}>
      {Array.from({ length: max }, (_, i) => {
        // the lost ones are the inner balls, towards the middle
        const lost = i >= lives
        return (
          <div key={i} className={`relative ${small ? 'h-3.5 w-3.5' : 'h-7 w-7'}`}>
            <motion.div
              className="absolute inset-0 rounded-full border-2"
              animate={
                lost
                  ? { scale: [1, 1.5, 1], filter: 'grayscale(1) brightness(0.45)' }
                  : { scale: 1, filter: 'grayscale(0) brightness(1)' }
              }
              transition={{ duration: 0.7 }}
              style={{
                borderColor: lost ? '#555' : '#fff',
                background: `radial-gradient(circle at 35% 30%, #fff 0 12%, ${color} 38%, #120a0a 100%)`,
                boxShadow: lost ? 'none' : `0 0 12px ${color}`,
              }}
            />
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-black/60" />
            <AnimatePresence>
              {lost && (
                <motion.span
                  className={`font-display absolute inset-0 flex items-center justify-center font-black text-[#ff4a3d] ${small ? 'text-[9px]' : 'text-lg'}`}
                  style={{ textShadow: '0 0 8px #000' }}
                  initial={{ opacity: 0, scale: 2.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.25, type: 'spring', stiffness: 400, damping: 18 }}
                >
                  ✕
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

/** "05T": the match's turn counter, and the battle (or a tag match's round) under it. */
export function TurnCounter({ turn, battle, label = 'BATTLE' }: { turn: number; battle: number; label?: string }) {
  return (
    <div className="flex flex-col items-center leading-none">
      <p
        className="font-display text-4xl font-black tabular-nums italic"
        style={{ textShadow: '0 0 18px rgba(255,255,255,.35)' }}
      >
        {String(Math.max(1, turn)).padStart(2, '0')}
        <span className="text-2xl">T</span>
      </p>
      <p className="font-display mt-1 text-[10px] tracking-[0.45em] text-white/50">
        {label} {battle}
      </p>
    </div>
  )
}

/** The brawler's face in a square frame (their own photo, if they added one, round as everywhere else). */
export function BrawlerFace({
  avatar,
  parts,
  color,
  size,
}: {
  avatar: AvatarValue
  parts: AvatarParts
  color: string
  size: number
}) {
  if (photoOf(avatar)) return <Avatar avatar={avatar} color={color} size={size} />
  const character = avatar.kind === 'preset' ? CHARACTER_BY_ID[avatar.id] : undefined
  return (
    <div
      className="shrink-0 overflow-hidden rounded-md border-2"
      style={{ width: size, height: size, borderColor: color, boxShadow: `0 0 16px ${color}66` }}
    >
      {character?.image ? (
        <CharacterPortrait src={character.image} color={color} />
      ) : (
        <AvatarDrawing
          parts={avatar.kind === 'custom' ? avatar.parts : (character?.parts ?? parts ?? DEFAULT_PARTS)}
          color={color}
        />
      )}
    </div>
  )
}

/**
 * One brawler's column: face and name, the card of the Bakugan on the field (picture, attribute, G-Power) and the
 * HSP, then what changed its G-Power in this battle.
 */
export function BrawlerHud({
  state,
  side,
  brawler,
  teams,
  color,
  badge,
  boost,
}: {
  state: BattleState
  side: SideIndex
  brawler: HudBrawler
  teams: readonly [Entrant[], Entrant[]]
  /** The brawler's colour (their first Bakugan's attribute). */
  color: string
  badge?: ReactNode
  /** A boss's extra G-Power on every Bakugan (already in their G): shown as a boss boost. */
  boost?: number
}) {
  const right = side === 1
  const s = state.sides[side]
  const d = state.duel
  // the Bakugan on the field, or the one picked and about to be thrown
  const index = d ? s.active : state.thrown[side]
  const entrant = index === null ? null : teams[side][index]
  const fighter = index === null ? null : s.team[index]
  const g = d ? powerOf(d, side) : (fighter?.g ?? 0)
  const el = entrant ? ELEMENT_BY_ID[entrant.bakugan.element] : null
  // whose move it is lights up their card
  const moving = !!d && !d.done && state.phase === 'battle' && d.turn === side
  return (
    <div className={`flex w-[17rem] flex-col gap-2 ${right ? 'items-end text-right' : ''}`}>
      <LifeBalls lives={s.lives} max={s.maxLives} color={color} right={right} />
      <div className={`flex items-center gap-3 ${right ? 'flex-row-reverse' : ''}`}>
        <BrawlerFace avatar={brawler.avatar} parts={brawler.parts} color={color} size={64} />
        <div className="min-w-0">
          {badge}
          <p className="font-display truncate text-lg leading-tight font-black tracking-wider">{brawler.name.toUpperCase()}</p>
          <p className="font-display truncate text-[10px] tracking-[0.3em] text-white/50">{brawler.tag}</p>
          {!!boost && (
            <p
              className="font-display mt-1 inline-block rounded border border-[#ff4a3d]/80 bg-[#ff4a3d]/20 px-1.5 text-[10px] font-bold tracking-[0.2em] text-[#ff8a7d]"
              title={`Boss boost: every Bakugan of ${brawler.name} has ${boost} extra G-Power`}
            >
              ☠ BOSS BOOST +{boost}G
            </p>
          )}
        </div>
      </div>

      {/* the Bakugan card */}
      <motion.div
        className={`relative flex w-full items-stretch overflow-hidden rounded-lg border-2 bg-black/70 backdrop-blur ${right ? 'flex-row-reverse' : ''}`}
        style={{ borderColor: el ? (moving ? '#fff' : `${el.color}cc`) : 'rgba(255,255,255,0.15)' }}
        animate={{
          boxShadow:
            el && moving
              ? [`0 0 14px ${el.color}88`, `0 0 34px ${el.color}`, `0 0 14px ${el.color}88`]
              : el
                ? `0 0 22px ${el.color}44`
                : 'none',
        }}
        transition={moving ? { repeat: Infinity, duration: 1.2 } : { duration: 0.3 }}
      >
        <div className="h-[5.5rem] w-[5.5rem] shrink-0 border-white/10">
          {entrant ? (
            <BakuganPortrait entrant={entrant} mirror={right} />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-white/5 text-3xl text-white/25">?</div>
          )}
        </div>
        <div className={`flex min-w-0 flex-1 flex-col justify-center px-3 py-1.5 ${right ? 'items-end' : ''}`}>
          {fighter && el ? (
            <>
              <div className={`flex w-full items-center gap-1.5 ${right ? 'flex-row-reverse' : ''}`}>
                <img src={el.icon} alt={el.name} className="h-5 w-5" style={{ filter: `drop-shadow(0 0 6px ${el.glow})` }} />
                <p className="font-display truncate text-xs font-bold tracking-wider">{fighter.name.toUpperCase()}</p>
              </div>
              <GPower value={g} color={el.color} glow={el.glow} right={right} />
              {d ? (
                <LeadTag duel={d} side={side} />
              ) : (
                <p className="text-[10px] tracking-wider text-white/45">
                  {state.phase === 'throw' ? 'ON THE GATE CARD' : `${fighter.g} G`}
                </p>
              )}
              {d && (
                <p className="text-[9px] tracking-wider text-white/40">{`BASE ${fighter.g}${boost ? ` · BOSS +${boost}` : ''}`}</p>
              )}
            </>
          ) : (
            <p className="font-display text-[10px] tracking-[0.3em] text-white/45">
              {state.phase === 'throw' || state.phase === 'set' ? 'CHOOSING A BAKUGAN…' : ''}
            </p>
          )}
        </div>
        {moving && (
          <span
            className={`font-display absolute top-1 rounded-sm bg-white px-1.5 text-[9px] font-black tracking-[0.2em] text-black ${right ? 'left-1' : 'right-1'}`}
          >
            MOVE
          </span>
        )}
      </motion.div>

      <div className={`flex items-baseline gap-2 ${right ? 'flex-row-reverse' : ''}`}>
        <span className="font-display rounded-sm bg-white/90 px-1.5 text-[10px] font-black tracking-widest text-black">HSP</span>
        <span className="font-display text-lg font-black tabular-nums">{(brawler.hsp ?? 0).toLocaleString('en')}</span>
      </div>

      {d && <EffectChips effects={d.effects.filter((e) => e.side === side)} state={state} side={side} right={right} />}
    </div>
  )
}

/** Under the G-Power: ahead or behind, by how much, or defeated at 0 G. */
function LeadTag({ duel, side }: { duel: Duel; side: SideIndex }) {
  const gap = Math.abs(gapOf(duel, side))
  const ahead = leaderOf(duel) === side
  let text = ahead ? `▲ AHEAD +${gap} G` : `▼ BEHIND −${gap} G`
  if (gap === 0) text = ahead ? '▲ TIED · WINS TIES' : '▼ TIED · LOSES TIES'
  if (powerOf(duel, side) === 0) text = '✕ 0 G · DEFEATED'
  else if (duel.done) text = duel.winner === side ? '★ WINS THE BATTLE' : '✕ LOSES THE BATTLE'
  return (
    <p className="font-display text-[11px] font-black tracking-wider" style={{ color: ahead ? AHEAD : BEHIND }}>
      {text}
    </p>
  )
}

/** The G-Power in big digits; each change pops up beside it for a moment. */
function GPower({ value, color, glow, right }: { value: number; color: string; glow: string; right: boolean }) {
  const [shown, setShown] = useState(value)
  const [pops, setPops] = useState<{ key: number; amount: number }[]>([])
  const prev = useRef(value)
  const seq = useRef(0)
  useEffect(() => {
    const from = prev.current
    prev.current = value
    if (from === value) return
    const key = ++seq.current
    setPops((p) => [...p.slice(-2), { key, amount: value - from }])
    const t = window.setTimeout(() => setPops((p) => p.filter((x) => x.key !== key)), 1800)
    const controls = animate(from, value, { duration: 0.7, onUpdate: (v) => setShown(Math.round(v)) })
    return () => {
      controls.stop()
      clearTimeout(t)
    }
  }, [value])
  return (
    <div className={`relative flex items-baseline gap-1 ${right ? 'flex-row-reverse' : ''}`}>
      <span
        className="font-display text-5xl leading-none font-black tabular-nums"
        style={{ color: '#fff', textShadow: `0 0 4px ${color}, 0 0 18px ${glow}, 0 2px 0 ${color}` }}
      >
        {shown}
      </span>
      <span className="font-display text-xl font-black" style={{ color }}>
        G
      </span>
      <AnimatePresence>
        {pops.map((p) => (
          <motion.span
            key={p.key}
            className={`font-display absolute -top-3 text-xl font-black ${right ? 'left-0' : 'right-0'}`}
            style={{
              color: p.amount > 0 ? '#3ee07a' : '#ff4a3d',
              textShadow: `0 0 10px ${p.amount > 0 ? '#3ee07a' : '#ff4a3d'}`,
            }}
            initial={{ opacity: 0, y: 8, scale: 1.6 }}
            animate={{ opacity: 1, y: -6, scale: 1 }}
            exit={{ opacity: 0, y: -18 }}
          >
            {p.amount > 0 ? '+' : '−'}
            {Math.abs(p.amount)}
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  )
}

/** What a side did in this battle: its cards (crossed out when nullified) and its opened gate. */
function EffectChips({
  effects,
  state,
  side,
  right,
}: {
  effects: Effect[]
  state: BattleState
  side: SideIndex
  right: boolean
}) {
  const foe = other(side)
  return (
    <div className={`flex max-w-full flex-wrap gap-1 ${right ? 'justify-end' : ''}`}>
      {effects.map((e) => {
        const mine = e.delta[side]
        const theirs = e.delta[foe]
        const amount = [mine && `${mine > 0 ? '+' : ''}${mine}`, theirs && `foe ${theirs > 0 ? '+' : ''}${theirs}`]
          .filter(Boolean)
          .join(' · ')
        let label = ''
        if (e.kind === 'gate') label = `▣ ${state.duel?.gate?.card.name ?? 'GATE'} ${amount}`
        else if (e.card) {
          const a = e.card.ability
          label = a.type === 'shield' ? `⊘ ${a.name}` : `${TYPE_ICON[a.type]} ${a.name} ${a.type === 'finisher' ? 'KO' : amount}`
        }
        return (
          <motion.span
            key={e.id}
            initial={{ opacity: 0, scale: 1.4 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${e.nullified ? 'text-white/35 line-through' : ''}`}
            style={{ borderColor: 'rgba(255,255,255,0.25)', background: 'rgba(0,0,0,0.6)' }}
            title={e.nullified ? 'Nullified' : (e.card?.ability.description ?? '')}
          >
            {label}
            {e.nullified && <span className="ml-1 text-[#ff4a3d] no-underline">NULLIFIED</span>}
          </motion.span>
        )
      })}
    </div>
  )
}

/**
 * The Gate Card in the middle: face-down until its owner opens it (its owner sees what it is), then its name and
 * effect; a nullified one is stamped.
 */
export function GateSlot({ state, ownerName, mine }: { state: BattleState; ownerName: string; mine: boolean }) {
  const card = state.duel?.gate?.card ?? state.gate
  if (!card) return null
  const open = !!state.duel?.gate?.open
  const nullified = !!state.duel?.gate?.nullified
  if (!open)
    return (
      <motion.div
        key="down"
        className="mt-2 flex flex-col items-center"
        initial={{ opacity: 0, y: -10, rotateX: 60 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
      >
        <div
          className="flex h-16 w-12 items-center justify-center rounded-md border-2 border-[#ffc94a]/70 shadow-[0_0_16px_#ffc94a55]"
          style={{ background: 'repeating-linear-gradient(45deg,#2a1d4a 0 6px,#1a1230 6px 12px)' }}
        >
          <span className="font-display text-2xl font-black text-[#ffc94a]">?</span>
        </div>
        <p className="font-display mt-1 text-[9px] tracking-[0.3em] text-white/55">GATE CARD · {ownerName.toUpperCase()}</p>
        {mine && <p className="text-[10px] text-white/45">yours: {gateLabel(card)}</p>}
      </motion.div>
    )
  return <OpenGate card={card} nullified={nullified} ownerName={ownerName} />
}

function OpenGate({ card, nullified, ownerName }: { card: GateCard; nullified: boolean; ownerName: string }) {
  const el = ELEMENT_BY_ID[gateElementOf(card)]
  return (
    <motion.div
      key="open"
      className="relative mt-2 w-60 rounded-lg border-2 bg-black/75 px-3 py-2 text-center backdrop-blur"
      style={{ borderColor: nullified ? '#666' : el.color, boxShadow: nullified ? 'none' : `0 0 22px ${el.color}88` }}
      initial={{ opacity: 0, rotateY: 90, scale: 1.3 }}
      animate={{ opacity: 1, rotateY: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      <div className={`flex items-center justify-center gap-2 ${nullified ? 'opacity-40' : ''}`}>
        <img src={el.icon} alt="" className="h-6 w-6" />
        <p className="font-display text-sm font-black">{card.name.toUpperCase()}</p>
      </div>
      <p className={`text-[10px] leading-snug text-white/70 ${nullified ? 'line-through opacity-50' : ''}`}>{card.text}</p>
      <p className="font-display mt-0.5 text-[9px] tracking-[0.3em] text-white/40">
        {gateKindLabel(card)} · {ownerName.toUpperCase()}
      </p>
      {nullified && (
        <motion.span
          className="font-display absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded border-2 border-[#ff4a3d] bg-black/70 px-2 text-lg font-black tracking-widest text-[#ff4a3d]"
          initial={{ scale: 2.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
        >
          NULLIFIED
        </motion.span>
      )}
    </motion.div>
  )
}

/** What the battle status says: whose move, and in plain words what is going on. */
function statusOf(d: Duel, you: boolean, names: [string, string]) {
  const p: [number, number] = [powerOf(d, 0), powerOf(d, 1)]
  const bakugan = [d.fighters[0].name, d.fighters[1].name]
  const loud = bakugan.map((n) => n.toUpperCase())
  const lead = leaderOf(d)
  const gap = Math.abs(p[0] - p[1])
  if (d.done) {
    const w = d.winner ?? lead
    const l = other(w)
    const score = `${bakugan[w]} wins, ${p[w]} G to ${p[l]} G`
    switch (d.end) {
      case 'ko':
        return { head: `${loud[l]} HAS 0 G — DEFEATED`, hint: `${bakugan[w]} wins the battle`, side: w }
      case 'finisher':
        return { head: `${loud[w]} WINS OUTRIGHT`, hint: 'A finisher decides the battle', side: w }
      case 'gaveUp':
        return { head: `${names[l]} GIVES UP`, hint: score, side: w }
      case 'noAnswer':
        return { head: `${names[l]} HAS NO ANSWER`, hint: score, side: w }
      default:
        return { head: 'NO MOVES LEFT', hint: score, side: w }
    }
  }
  const t = d.turn
  const foe = other(t)
  const mine = you && t === 0
  const head = mine ? 'YOUR MOVE' : `${names[t]}'S MOVE`
  const tied = gap === 0
  let hint: string
  if (mine) {
    const way = canOpenGate(d, 0) ? 'play a card or open your Gate Card' : 'play a card'
    if (lead === 0)
      hint = tied ? 'Tied, and you win ties: hold, or add more power' : `You're ${gap} G ahead: hold, or add more power`
    else hint = tied ? `Tied, and ties go to ${bakugan[1]}: ${way} to get ahead` : `You're ${gap} G behind: ${way} to get ahead`
  } else if (you) {
    hint =
      lead === 0
        ? `You're ${tied ? 'ahead on the tie' : `${gap} G ahead`}: ${names[t]} has to answer`
        : `${names[t]} is ${tied ? 'ahead on the tie' : `${gap} G ahead`} and may hold`
  } else
    hint =
      lead === t
        ? `${names[t]} is ${tied ? 'ahead on the tie' : `${gap} G ahead`}: hold, or add more power`
        : `${names[t]} is ${tied ? 'behind on the tie' : `${gap} G behind`} and has to answer ${names[foe]}`
  return { head, hint, side: t }
}

/**
 * Under the Gate Card: whose move it is, a bar of the two G-Powers (the leader's colour past the middle) with the gap,
 * and one plain line on what is going on ("You're 150 G behind: play a card or open your Gate Card to get ahead").
 */
export function BattleStatus({
  state,
  you,
  names,
  colors,
}: {
  state: BattleState
  /** The player brawls on side 0 (else both are watched). */
  you: boolean
  names: [string, string]
  /** The colour of each Bakugan on the field. */
  colors: [string, string]
}) {
  const d = state.duel
  if (!d) return null
  const p: [number, number] = [powerOf(d, 0), powerOf(d, 1)]
  const share = p[0] + p[1] > 0 ? p[0] / (p[0] + p[1]) : 0.5
  const lead = leaderOf(d)
  const gap = Math.abs(p[0] - p[1])
  const { head, hint, side } = statusOf(d, you, [names[0].toUpperCase(), names[1].toUpperCase()] as [string, string])
  const pointer = d.done ? '' : side === 0 ? '◀ ' : ''
  const after = d.done ? '' : side === 1 ? ' ▶' : ''
  return (
    <div className="mt-2 flex w-[23rem] flex-col items-center rounded-lg border border-white/15 bg-black/70 px-3 py-2 backdrop-blur">
      <motion.p
        key={`${head}-${d.moves}`}
        className="font-display text-sm font-black tracking-[0.25em]"
        style={{ color: d.done && d.end === 'ko' ? BEHIND : '#fff', textShadow: `0 0 14px ${colors[side]}` }}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {pointer}
        {head}
        {after}
      </motion.p>
      <div className="mt-1.5 flex w-full items-center gap-2">
        <span className="font-display w-12 text-right text-xs font-black tabular-nums" style={{ color: colors[0] }}>
          {p[0]}
        </span>
        <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-white/10">
          <motion.div
            className="absolute inset-y-0 left-0"
            style={{ background: colors[0] }}
            animate={{ width: `${share * 100}%` }}
            transition={{ duration: 0.7 }}
          />
          <motion.div
            className="absolute inset-y-0 right-0"
            style={{ background: colors[1] }}
            animate={{ width: `${(1 - share) * 100}%` }}
            transition={{ duration: 0.7 }}
          />
          <div className="absolute inset-y-[-2px] left-1/2 w-0.5 -translate-x-1/2 bg-white" />
        </div>
        <span className="font-display w-12 text-left text-xs font-black tabular-nums" style={{ color: colors[1] }}>
          {p[1]}
        </span>
      </div>
      <p className="font-display mt-1 text-[10px] tracking-[0.25em] text-white/75">
        {gap
          ? `${d.fighters[lead].name.toUpperCase()} AHEAD BY ${gap} G`
          : `TIED · ${d.fighters[lead].name.toUpperCase()} WINS TIES (THROWN FIRST)`}
      </p>
      <p className="mt-0.5 text-center text-xs leading-snug text-white/85">{hint}</p>
    </div>
  )
}
