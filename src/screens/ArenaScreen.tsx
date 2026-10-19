import { Canvas } from '@react-three/fiber'
import { animate, AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { afterSpeech, hush, playSfx, shout as callOut } from '../audio/sfx'
import {
  act,
  activeOf,
  aiForTier,
  canPlay,
  chargeOf,
  chooseAction,
  chooseThrow,
  FINISHER_CHARGE,
  gateBonus,
  LIFE,
  MAX_HIT,
  MIN_HIT,
  nextRound,
  other,
  PLAYS,
  playsLeft,
  powerOf,
  resolveRound,
  startBattle,
  throwBakugan,
  type AiLevel,
  type BattleEvent,
  type BattleState,
  type Move,
  type SideIndex,
} from '../battle/engine'
import { Avatar } from '../components/Avatar'
import { GateChip } from '../components/GateChip'
import { abilityLabel, BAKUGAN, battleEffect, type Ability, type Entrant } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { gateDeck, gateElementOf } from '../data/gates'
import { bakuganById, TIERS, useActiveProfile, useProfiles, type BattleReward } from '../profile/useProfiles'
import { useGame, type TeamMember } from '../store/useGame'
import {
  botCharacter,
  CHARACTER_BY_ID,
  DEFAULT_PARTS,
  DEFAULT_VOICE,
  opponentCharacter,
  type Avatar as AvatarValue,
  type AvatarParts,
  type Voice,
} from '../profile/avatar'
import { ACTION_DURATION, ArenaScene, IMPACT_AT } from '../three/ArenaScene'
import type { BrawlerCall, BrawlerGesture } from '../three/Brawler'
import { preloadModels } from '../three/BakuganModels'
import { announce, crowd } from '../three/stadium'

const INTRO_MS = 2600
/** Round banner and Gate Card before the throw. */
const GATE_MS = 1700
/** Both brawlers throw; the balls open and the Bakugan stand. */
const THROW_MS = 2600
const AI_DELAY_MS = 750
const PASS_MS = 900
/** The two G-Power counters count up before the difference shows. */
const COUNT_MS = 1500
const DIFF_MS = 1100
/** After the deciding strike lands, before the next round. */
const AFTER_STRIKE_MS = 2600
/** Extra time a finisher's beam and pillar of darkness hold the field before the battle goes on (or ends). */
const FINISHER_HOLD_MS = 1600
/** The announcer speaks at most this often. */
const ANNOUNCE_GAP = 3000
/** A round won or lost by this little is a close call. */
const CLOSE = 60

const TYPE_ICON: Record<Ability['type'], string> = {
  attack: '⚔',
  boost: '▲',
  weaken: '▼',
  drain: '⇄',
  shield: '◆',
  finisher: '☠',
}

const clock = () => performance.now()

/**
 * The CPU brawler's answer to a rematch, after a moment: it says yes most of the time, more readily after a win or
 * a close match, less after a crushing defeat.
 */
function rematchAnswer(botWon: boolean, margin: number) {
  const yes = 0.7 + (botWon ? 0.15 : 0) + (margin <= 0.3 ? 0.1 : 0) - (!botWon && margin >= 0.6 ? 0.4 : 0)
  return { accept: Math.random() < Math.min(0.95, Math.max(0.2, yes)), after: 1500 + Math.random() * 1500 }
}

const toTeam = (members: TeamMember[]): Entrant[] =>
  members.map((m) => ({
    bakugan: BAKUGAN.find((b) => b.id === m.id)!,
    form: m.form,
    cards: m.cards,
    bonusG: m.bonusG,
    skin: m.skin,
  }))

/** One side of a brawl: who brawls, how they look and sound, and who plays them. */
export interface BrawlerSide {
  name: string
  /** Shown under the name, e.g. "YOU" or "CPU · ACE". */
  tag: string
  avatar: AvatarValue
  parts: AvatarParts
  photo?: string
  model?: string
  voice: Voice
  /** The bot's strength; null when the player plays this side. */
  ai: AiLevel | null
}

/** A ranked or free-play brawl: the player against a CPU brawler. */
export function ArenaScreen() {
  const setup = useGame((s) => s.arena)!
  const go = useGame((s) => s.go)
  const teams = useMemo(() => [toTeam(setup.left), toTeam(setup.right)] as const, [setup])
  const profile = useActiveProfile()

  const brawlers = useMemo((): [BrawlerSide, BrawlerSide] => {
    const bot = CHARACTER_BY_ID[setup.bot.characterId] ?? opponentCharacter(teams[1][0].bakugan)
    const cpu: BrawlerSide = {
      name: bot.name,
      tag: `CPU · ${(TIERS[setup.bot.tier]?.name ?? TIERS[0].name).toUpperCase()}`,
      avatar: { kind: 'preset', id: bot.id },
      parts: bot.parts,
      model: bot.model,
      voice: bot.voice,
      ai: aiForTier(setup.bot.tier),
    }
    if (!profile) {
      const c = botCharacter(teams[0][0].bakugan.element)
      return [
        {
          name: 'You',
          tag: 'YOU',
          avatar: { kind: 'preset', id: c.id },
          parts: c.parts,
          model: c.model,
          voice: c.voice,
          ai: null,
        },
        cpu,
      ]
    }
    const a = profile.avatar
    const preset = a.kind === 'preset' ? CHARACTER_BY_ID[a.id] : undefined
    return [
      {
        name: profile.firstName,
        tag: 'YOU',
        avatar: a,
        parts:
          a.kind === 'custom'
            ? a.parts
            : a.kind === 'preset'
              ? (preset?.parts ?? DEFAULT_PARTS)
              : botCharacter(profile.element).parts,
        photo: a.kind === 'photo' ? a.dataUrl : undefined,
        model: preset?.model,
        voice: preset?.voice ?? DEFAULT_VOICE,
        ai: null,
      },
      cpu,
    ]
  }, [profile, setup, teams])

  return <Brawl teams={teams} brawlers={brawlers} ranked={setup.ranked} onLeave={() => go('compare')} />
}

type Cue = { gesture: { kind: BrawlerGesture; key: number }; call: BrawlerCall | null }

/** A round's battle on screen: counters, then the difference, then the strike. */
interface Clash {
  key: number
  power: [number, number]
  winner: SideIndex | null
  damage: number
  /** 0 counting up · 1 difference shown · 2 strike */
  step: number
}

interface BrawlProps {
  teams: readonly [Entrant[], Entrant[]]
  brawlers: [BrawlerSide, BrawlerSide]
  /** Spectating: both sides are CPU, nobody controls them and nothing is recorded. */
  live?: boolean
  /** The result goes to the player's profile (XP, BP, rating). */
  ranked?: boolean
  onLeave: () => void
  leaveLabel?: string
  /** Called once the match is over. */
  onOver?: (state: BattleState) => void
  /** Shown above the round number (the live badge). */
  badge?: ReactNode
}

/** The battle itself: life gauges, rounds, the ability phase and each round's battle. */
export function Brawl({
  teams,
  brawlers,
  live = false,
  ranked = false,
  onLeave,
  leaveLabel = '← LEAVE',
  onOver,
  badge,
}: BrawlProps) {
  useEffect(() => teams.flat().forEach((e) => preloadModels(e.bakugan)), [teams])

  // a coin toss decides who sets the first Gate Card
  const fresh = () =>
    startBattle(teams[0], teams[1], [gateDeck(teams[0]), gateDeck(teams[1])], Math.random, Math.random() < 0.5 ? 0 : 1)
  const [battle, setBattle] = useState<BattleState>(fresh)
  // What the HUD shows; lags `battle` until each card or strike lands.
  const [shown, setShown] = useState<BattleState>(battle)
  const [event, setEvent] = useState<{ event: BattleEvent; key: number } | null>(null)
  const [throwKey, setThrowKey] = useState(0)
  const [defeated, setDefeated] = useState<[boolean, boolean]>([false, false])
  const [busy, setBusy] = useState(true)
  const [banner, setBanner] = useState<{ text: string; sub?: string; key: number } | null>(null)
  const [clash, setClash] = useState<Clash | null>(null)
  /** Life just lost, shown under each gauge. */
  const [hits, setHits] = useState<[{ amount: number; key: number } | null, { amount: number; key: number } | null]>([null, null])
  const [reward, setReward] = useState<BattleReward | null>(null)
  const [rematch, setRematch] = useState<'idle' | 'asking' | 'declined'>('idle')
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null)
  const [cues, setCues] = useState<[Cue, Cue]>([
    { gesture: { kind: null, key: 0 }, call: null },
    { gesture: { kind: null, key: 0 }, call: null },
  ])
  const timers = useRef<number[]>([])
  const stopWaits = useRef<(() => void)[]>([])
  const seq = useRef(1)
  const lastLine = useRef(-ANNOUNCE_GAP)
  const queuedLine = useRef(0)
  const toastTimer = useRef(0)
  // ability cards the player activated, for Season Pass challenges
  const playerCards = useRef(0)

  const controls = brawlers[0].ai === null && !live
  const human = (side: SideIndex) => side === 0 && controls
  const levelOf = (side: SideIndex) => brawlers[side].ai ?? aiForTier(0)
  const nameOf = (side: SideIndex) => brawlers[side].name
  const nextKey = () => seq.current++
  const later = (ms: number, fn: () => void) => void timers.current.push(window.setTimeout(fn, ms))
  /** Continue once nobody is talking any more (at least `minMs` from now). */
  const waitQuiet = (fn: () => void, minMs = 0) => stopWaits.current.push(afterSpeech(fn, 3500, minMs))
  const say = (text: string, sub?: string) => setBanner({ text, sub, key: nextKey() })
  const stopAll = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    stopWaits.current.forEach((stop) => stop())
    stopWaits.current = []
    clearTimeout(queuedLine.current)
    hush()
  }

  /** The stadium announcer: a line that matters waits its turn, a small one is dropped while another is fresh. */
  const call = (text: string, important = false) => {
    const wait = lastLine.current + ANNOUNCE_GAP - clock()
    if (wait <= 0) {
      lastLine.current = clock()
      announce(text)
    } else if (important) {
      clearTimeout(queuedLine.current)
      queuedLine.current = window.setTimeout(() => {
        lastLine.current = clock()
        announce(text)
      }, wait)
    }
  }

  const notify = (text: string) => {
    clearTimeout(toastTimer.current)
    setToast({ text, key: nextKey() })
    toastTimer.current = window.setTimeout(() => setToast(null), 3800)
  }

  /** A brawler gestures and calls out (speech bubble + voice). */
  const cue = (side: SideIndex, kind: BrawlerGesture, title?: string, sub?: string, voice?: string) => {
    const key = nextKey()
    setCues((c) => {
      const next = [...c] as typeof c
      next[side] = { gesture: { kind, key }, call: title ? { key, title, sub } : c[side].call }
      return next
    })
    if (voice) callOut(voice, brawlers[side].voice)
    // the bubble disappears after a moment unless a newer call replaced it
    if (title)
      later(2200, () =>
        setCues((c) => {
          if (c[side].call?.key !== key) return c
          const next = [...c] as typeof c
          next[side] = { ...c[side], call: null }
          return next
        }),
      )
  }

  const showHit = (side: SideIndex, amount: number) =>
    setHits((h) => {
      const next = [...h] as typeof h
      next[side] = { amount, key: nextKey() }
      return next
    })

  // ------------------------------------------------------------ match flow

  function begin(delay: number) {
    const s = fresh()
    setBattle(s)
    setShown(s)
    setEvent(null)
    setDefeated([false, false])
    setClash(null)
    setHits([null, null])
    setReward(null)
    setRematch('idle')
    setBusy(true)
    playerCards.current = 0
    playSfx('brawl')
    say('BAKUGAN, BRAWL!', `${nameOf(0)} vs ${nameOf(1)}`)
    cue(0, 'point', 'BAKUGAN, BRAWL!', undefined, 'Bakugan, brawl!')
    later(900, () => cue(1, 'point', 'BAKUGAN, BRAWL!'))
    call(`Welcome to the Bakugan Arena! ${nameOf(0)} versus ${nameOf(1)}!`, true)
    crowd('cheer')
    later(delay, () => roundStart(s))
  }

  /** A Gate Card is set; the player picks a Bakugan (when they have more than one), then both throw. */
  function roundStart(s: BattleState) {
    setBattle(s)
    setShown(s)
    setClash(null)
    setHits([null, null])
    setEvent(null)
    playSfx('gateCard')
    say(`ROUND ${s.round}`, s.gate ? `Gate Card: ${s.gate.card.name}` : undefined)
    if (s.gate) cue(s.gate.owner, 'point', 'GATE CARD, SET!', s.gate.card.name, 'Gate card, set!')
    // a brawler near the end of their gauge gets a mention
    const low = ([0, 1] as const).find((i) => s.sides[i].life <= 100)
    const danger = low === undefined ? '' : ` ${nameOf(low)} is down to ${s.sides[low].life} life!`
    call(`Round ${s.round}!${danger} Gate card set!`, s.round > 1)
    if (s.round > 1) crowd('chant')
    later(GATE_MS, () => {
      if (controls && s.sides[0].team.length > 1) setBusy(false)
      else throwAll(s, s.sides[0].active)
    })
  }

  function throwAll(s: BattleState, mine: number) {
    setBusy(true)
    const picks: [number, number] = [human(0) ? mine : chooseThrow(s, 0, levelOf(0)), chooseThrow(s, 1, levelOf(1))]
    const next = throwBakugan(s, picks)
    const names = [activeOf(next.sides[0]).name, activeOf(next.sides[1]).name]
    playSfx('brawl')
    setThrowKey((k) => k + 1)
    setDefeated([false, false])
    cue(0, 'point', 'BAKUGAN, BRAWL!', `Go, ${names[0]}!`, `Bakugan brawl! Go, ${names[0]}!`)
    later(700, () => cue(1, 'point', 'BAKUGAN, BRAWL!', `Go, ${names[1]}!`, `Go, ${names[1]}!`))
    call(`${nameOf(0)} throws ${names[0]}! ${nameOf(1)} throws ${names[1]}!`)
    later(400, () => {
      setBattle(next)
      setShown(next)
    })
    later(THROW_MS, () => waitQuiet(() => nextMove(next)))
  }

  function nextMove(s: BattleState) {
    setBattle(s)
    if (s.phase === 'over') return finish(s)
    if (s.phase === 'battle') return battleStart(s)
    if (!human(s.turn)) later(AI_DELAY_MS, () => run(s, chooseAction(s, levelOf(s.turn))))
    else {
      if (s.round === 1 && !s.sides[0].played.length && s.passes === 0) say('ABILITY PHASE', 'Play a card, or get READY')
      setBusy(false)
    }
  }

  function run(s: BattleState, move: Move) {
    setBusy(true)
    const { state: next, event: ev } = act(s, move)
    const side = ev.actor
    if (move.kind === 'pass') {
      cue(side, 'point', 'READY!')
      later(PASS_MS, () => {
        setShown(next)
        nextMove(next)
      })
      return
    }
    if (human(side)) playerCards.current++
    const a = move.card.ability
    const bakugan = activeOf(s.sides[side]).name
    playSfx('ability')
    cue(side, 'card', 'ABILITY ACTIVATE!', a.name, `Ability activate! ${a.name}!`)
    if (a.type === 'finisher') {
      call(`${bakugan} unleashes ${a.name}!`, true)
      crowd('gasp')
    } else if (!ev.blocked && (a.amount >= 150 || a.type === 'drain')) {
      call(`${bakugan} activates ${a.name}!`)
      crowd('roar', side)
    }
    waitQuiet(() => perform(next, ev, a), 800)
  }

  /** The Bakugan acts on the field: animation, then the G-Power (or life) changes on the HUD. */
  function perform(next: BattleState, ev: BattleEvent, a: Ability) {
    const hostile = a.type === 'attack' || a.type === 'weaken' || a.type === 'drain' || a.type === 'finisher'
    // the scene flinches a Bakugan that takes damage; a card hit takes G, not life, so it is marked as a hit too
    setEvent({ event: { ...ev, damage: ev.damage || (hostile && !ev.blocked ? 1 : 0) }, key: nextKey() })
    later(IMPACT_AT * 1000, () => {
      if (hostile && !ev.blocked) {
        playSfx('hit')
        cue(ev.target, 'flinch')
      }
      // the stands react to hits and blocks by themselves (ArenaScene)
      if (ev.blocked) call(`Blocked! The shield cancels ${a.name}!`)
      if (ev.actorG || ev.targetG) playSfx('gPower')
      setShown(next)
      if (ev.ko) {
        showHit(ev.target, ev.damage)
        setDefeated(ev.target === 0 ? [true, false] : [false, true])
      }
    })
    const hold = a.type === 'finisher' ? FINISHER_HOLD_MS : 0
    later(ACTION_DURATION * 1000 + hold, () => waitQuiet(() => nextMove(next)))
  }

  /** Both G-Powers count up, the difference shows, then the winner strikes and the loser's gauge drains. */
  function battleStart(s: BattleState) {
    setBusy(true)
    const { state: next, event: ev, result } = resolveRound(s)
    const diff = Math.abs(result.power[0] - result.power[1])
    playSfx('brawl')
    say('BATTLE!')
    setClash({ key: nextKey(), power: result.power, winner: result.winner, damage: result.damage, step: 0 })
    later(COUNT_MS, () => {
      setClash((c) => c && { ...c, step: 1 })
      if (result.winner === null) {
        call("It's a draw! Nobody loses life!", true)
        crowd('gasp')
        later(DIFF_MS + 1400, () => afterRound(next))
      } else if (diff <= CLOSE) crowd('gasp')
    })
    if (!ev) return
    later(COUNT_MS + DIFF_MS, () => {
      setClash((c) => c && { ...c, step: 2 })
      setEvent({ event: ev, key: nextKey() })
      later(IMPACT_AT * 1000, () => {
        playSfx('hit')
        cue(ev.target, 'flinch')
        cue(ev.actor, 'cheer')
        setShown(next)
        showHit(ev.target, ev.damage)
        setDefeated(ev.target === 0 ? [true, false] : [false, true])
        const line = `${activeOf(next.sides[ev.actor]).name} wins the round! ${nameOf(ev.target)} loses ${ev.damage} life!`
        call(diff <= CLOSE ? `What a close call! ${line}` : line, true)
        if (ev.damage >= 250) crowd('roar', ev.actor)
      })
      later(IMPACT_AT * 1000 + AFTER_STRIKE_MS, () => afterRound(next))
    })
  }

  function afterRound(s: BattleState) {
    setClash(null)
    if (s.phase === 'over') finish(s)
    else roundStart(nextRound(s))
  }

  function finish(s: BattleState) {
    setBattle(s)
    setShown(s)
    setBusy(true)
    const w = s.winner ?? 0
    playSfx(live || w === 0 ? 'victory' : 'defeat')
    cue(w, 'cheer', 'I WIN!', undefined, 'Yes! Victory!')
    cue(other(w), 'slump')
    call(`${nameOf(w)} wins the brawl!`, true)
    crowd('roar', w)
    later(7000, () => crowd('calm'))
    if (ranked && controls) {
      // a round won defeats the opposing Bakugan: it counts as a KO for the player's Bakugan that won it
      const kos: Record<string, number> = {}
      const ko = (index: number) => {
        const id = s.sides[0].team[index].bakugan.id
        kos[id] = (kos[id] ?? 0) + 1
      }
      for (const r of s.results) if (r.winner === 0) ko(r.thrown[0])
      // a finisher ended the match in the ability phase, before the round's battle
      if (s.winner === 0 && s.results.length < s.round) ko(s.sides[0].active)
      setReward(
        useProfiles.getState().recordBattle({
          won: s.winner === 0,
          team: s.sides[0].team.map((f) => f.bakugan.id),
          kos,
          abilities: playerCards.current,
          flawless: s.results.every((r) => r.winner !== 1),
        }),
      )
    }
    onOver?.(s)
  }

  function askRematch() {
    if (rematch !== 'idle') return
    setRematch('asking')
    const answer = rematchAnswer(battle.winner === 1, Math.abs(battle.sides[0].life - battle.sides[1].life) / LIFE)
    later(answer.after, () => {
      if (answer.accept) {
        notify(`${nameOf(1)} accepted the rematch!`)
        stopAll()
        begin(1600)
      } else {
        setRematch('declined')
        notify(`${nameOf(1)} declined the rematch`)
      }
    })
  }

  // the match starts once the screen is up, and everything stops when it closes
  const flow = useRef({ start: () => {}, stop: () => {} })
  useEffect(() => {
    flow.current = {
      start: () => begin(INTRO_MS),
      stop: () => {
        stopAll()
        clearTimeout(toastTimer.current)
      },
    }
  })
  useEffect(() => {
    const t = window.setTimeout(() => flow.current.start(), 0)
    return () => {
      clearTimeout(t)
      flow.current.stop()
    }
  }, [])

  // ------------------------------------------------------------ view

  const mySide = battle.sides[0]
  const picking = controls && !busy && battle.phase === 'pick' && battle.winner === null
  const myTurn = controls && !busy && battle.phase === 'abilities' && battle.turn === 0 && battle.winner === null
  const revealed = shown.phase !== 'pick'
  const colors = [0, 1].map((i) => ELEMENT_BY_ID[activeOf(shown.sides[i]).bakugan.element].color) as [string, string]
  const gate = shown.gate?.card ?? null
  const over = battle.winner !== null && battle.phase === 'over' && !clash

  return (
    <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Canvas shadows camera={{ position: [0, 11, 46], fov: 50 }} dpr={[1, 2]}>
        <ArenaScene
          fighters={[teams[0][shown.sides[0].active], teams[1][shown.sides[1].active]]}
          gate={gate ? gateElementOf(gate) : null}
          event={event}
          shields={[shown.sides[0].shield, shown.sides[1].shield]}
          defeated={defeated}
          throwKey={throwKey}
          brawlers={[
            { parts: brawlers[0].parts, photo: brawlers[0].photo, model: brawlers[0].model, gesture: cues[0].gesture },
            { parts: brawlers[1].parts, photo: brawlers[1].photo, model: brawlers[1].model, gesture: cues[1].gesture },
          ]}
        />
      </Canvas>

      {/* what each brawler calls out, above their head on the field */}
      {cues.map((c, i) =>
        c.call ? (
          <div
            key={c.call.key}
            className={`pointer-events-none absolute bottom-[31%] z-10 ${i === 0 ? 'left-[4%]' : 'right-[4%]'}`}
          >
            <div className="brawler-call" style={{ borderColor: colors[i] }}>
              <span className="brawler-call-name text-white/60">{brawlers[i].name}</span>
              <span className="brawler-call-title">{c.call.title}</span>
              {c.call.sub && <span className="brawler-call-sub">{c.call.sub}</span>}
            </div>
          </div>
        ) : null,
      )}

      {/* the brawlers' life gauges, their Bakugan's G-Power and the cards played this round */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-black/80 via-black/50 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 grid grid-cols-[1fr_auto_1fr] items-start gap-6 px-6 pt-4">
        <BrawlerPanel state={shown} side={0} brawler={brawlers[0]} revealed={revealed} hit={hits[0]} />
        <div className="flex min-w-40 flex-col items-center text-center">
          {badge}
          <p className="font-display text-[10px] tracking-[0.5em] text-white/40">ROUND</p>
          <p className="font-display text-4xl leading-none font-black">{shown.round}</p>
          {gate && (
            <div className="mt-2">
              <p className="font-display mb-1 text-[10px] tracking-[0.4em] text-white/40">GATE CARD</p>
              <GateChip gate={gate} />
            </div>
          )}
          <PhaseLabel state={battle} busy={busy} controls={controls} names={[nameOf(0), nameOf(1)]} />
        </div>
        <BrawlerPanel state={shown} side={1} brawler={brawlers[1]} revealed={revealed} hit={hits[1]} showHand />
      </div>

      <button
        onClick={onLeave}
        className="font-display absolute top-[40%] left-6 text-xs tracking-[0.4em] text-white/40 transition hover:text-white"
      >
        {leaveLabel}
      </button>

      {/* battle log */}
      <div className="pointer-events-none absolute top-[40%] right-6 w-72 space-y-1 text-right text-xs">
        {shown.log.slice(-4).map((line, i, arr) => (
          <p key={shown.log.length - arr.length + i} className={i === arr.length - 1 ? 'text-white/85' : 'text-white/35'}>
            {line}
          </p>
        ))}
      </div>

      {/* round start: the player picks which Bakugan to throw (the one from last round is first in line) */}
      {picking && <ThrowPicker state={battle} onPick={(i) => throwAll(battle, i)} />}

      {/* hand: this round's cards of the Bakugan on the field, plus READY */}
      {controls && battle.phase === 'abilities' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center gap-3 px-28 pb-5 *:pointer-events-auto">
          {mySide.hand.map((card) => {
            const playable = canPlay(mySide, card)
            const a = card.ability
            const owner = activeOf(mySide)
            const charge = FINISHER_CHARGE - chargeOf(mySide)
            return (
              <HandButton
                key={card.uid}
                disabled={!myTurn || !playable}
                locked={
                  playable
                    ? undefined
                    : playsLeft(mySide) <= 0
                      ? `${PLAYS} cards played`
                      : `Charging: play ${charge} more card${charge === 1 ? '' : 's'}`
                }
                onClick={() => run(battle, { kind: 'ability', card })}
                color={ELEMENT_BY_ID[owner.bakugan.element].color}
                owner={owner.name}
                title={a.name}
                tag={`${TYPE_ICON[a.type]} ${abilityLabel(a)}`}
                text={a.description}
                effect={battleEffect(a)}
              />
            )
          })}
          <div className="flex w-40 shrink-0 flex-col items-stretch gap-2 self-center">
            <p className="font-display text-center text-[10px] tracking-[0.4em] text-white/50">
              CARDS {mySide.played.length}/{PLAYS} THIS ROUND
            </p>
            <motion.button
              disabled={!myTurn}
              onClick={() => run(battle, { kind: 'pass' })}
              whileHover={myTurn ? { scale: 1.05 } : undefined}
              whileTap={myTurn ? { scale: 0.95 } : undefined}
              className="font-display rounded-lg border-2 border-white/80 bg-white/10 py-4 text-xl font-black tracking-[0.3em] backdrop-blur transition disabled:opacity-35"
              style={{ boxShadow: myTurn ? `0 0 24px ${colors[0]}88` : 'none' }}
            >
              READY
              <span className="mt-1 block text-[10px] font-normal tracking-[0.25em] text-white/60">PASS · NO MORE CARDS</span>
            </motion.button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {banner && !clash && battle.winner === null && (
          <motion.div
            key={banner.key}
            className="pointer-events-none absolute inset-x-0 top-[32%] text-center"
            initial={{ opacity: 0, scale: 2 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            onAnimationComplete={() => window.setTimeout(() => setBanner((s) => (s?.key === banner.key ? null : s)), 900)}
          >
            <p className="font-display text-5xl font-black tracking-wider italic" style={{ textShadow: `0 0 30px ${colors[0]}` }}>
              {banner.text}
            </p>
            {banner.sub && <p className="font-display mt-2 text-xl tracking-widest text-white/80">{banner.sub}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {clash && <ClashView key={clash.key} clash={clash} colors={colors} names={[nameOf(0), nameOf(1)]} />}
      </AnimatePresence>

      <AnimatePresence>
        {over && (
          <motion.div
            className="absolute inset-x-0 top-[30%] z-20 flex flex-col items-center bg-black/75 py-8 backdrop-blur"
            style={{ borderBlock: `2px solid ${live || battle.winner === 0 ? colors[battle.winner!] : '#666'}` }}
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
          >
            <p
              className="font-display text-6xl font-black tracking-widest italic"
              style={{ textShadow: `0 0 40px ${colors[battle.winner!]}` }}
            >
              {live ? `${nameOf(battle.winner!).toUpperCase()} WINS!` : battle.winner === 0 ? 'VICTORY!' : 'DEFEAT'}
            </p>
            <p className="font-display mt-2 tracking-[0.3em] text-white/60">
              {live ? nameOf(battle.winner!).toUpperCase() : battle.winner === 0 ? 'YOU WIN' : `${nameOf(1).toUpperCase()} WINS`}{' '}
              IN {battle.round} ROUND{battle.round === 1 ? '' : 'S'} · {battle.sides[battle.winner!].life} LIFE LEFT
            </p>
            {reward && <RewardList reward={reward} />}
            {live ? (
              <p className="font-display mt-5 animate-pulse text-sm tracking-[0.4em] text-white/60">NEXT LIVE MATCH STARTING…</p>
            ) : (
              <>
                {rematch === 'asking' && (
                  <p className="font-display mt-5 animate-pulse text-sm tracking-[0.3em] text-white/80">
                    WAITING FOR {nameOf(1).toUpperCase()}…
                  </p>
                )}
                <div className="mt-5 flex gap-4">
                  <button
                    onClick={askRematch}
                    disabled={rematch !== 'idle'}
                    className="font-display border-2 border-white/70 px-8 py-3 tracking-[0.3em] enabled:hover:bg-white/10 disabled:opacity-40"
                  >
                    {rematch === 'declined' ? 'REMATCH DECLINED' : rematch === 'asking' ? 'REMATCH ASKED' : 'REMATCH'}
                  </button>
                  <button
                    onClick={onLeave}
                    className="font-display border-2 border-white/25 px-8 py-3 tracking-[0.3em] text-white/70 hover:bg-white/10"
                  >
                    CHANGE TEAMS
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.key}
            className="font-display pointer-events-none fixed top-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-white/30 bg-black/90 px-6 py-3 text-sm tracking-[0.2em] shadow-2xl"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
          >
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/** Whose move it is, under the Gate Card. */
function PhaseLabel({
  state,
  busy,
  controls,
  names,
}: {
  state: BattleState
  busy: boolean
  controls: boolean
  names: [string, string]
}) {
  let text = ''
  if (state.phase === 'pick') text = controls && !busy ? 'CHOOSE YOUR BAKUGAN' : 'GATE CARD SET'
  else if (state.phase === 'abilities')
    text = controls && state.turn === 0 ? (busy ? 'ABILITY PHASE' : 'YOUR MOVE') : `${names[state.turn].toUpperCase()}'S MOVE`
  else if (state.phase === 'battle' || state.phase === 'result') text = 'BATTLE!'
  if (!text || state.phase === 'over') return null
  return (
    <p className="font-display mt-2 rounded border border-white/15 bg-black/50 px-3 py-1 text-[10px] tracking-[0.35em] text-white/80">
      {text}
    </p>
  )
}

/** A brawler's life gauge, the Bakugan they threw with its G-Power for the round, and the cards they played. */
function BrawlerPanel({
  state,
  side,
  brawler,
  revealed,
  hit,
  showHand,
}: {
  state: BattleState
  side: SideIndex
  brawler: BrawlerSide
  revealed: boolean
  hit: { amount: number; key: number } | null
  /** Shows how many cards are in hand (the opponent's, face down). */
  showHand?: boolean
}) {
  const s = state.sides[side]
  const f = activeOf(s)
  const el = ELEMENT_BY_ID[f.bakugan.element]
  const right = side === 1
  const gate = gateBonus(state, f)
  return (
    <div className={`relative flex flex-col gap-2 ${right ? 'items-end text-right' : ''}`}>
      <div className={`flex items-center gap-3 ${right ? 'flex-row-reverse' : ''}`}>
        <Avatar avatar={brawler.avatar} color={el.color} size={48} />
        <div>
          <p className="font-display text-xl leading-tight font-black tracking-wider">{brawler.name.toUpperCase()}</p>
          <p className="font-display text-[10px] tracking-[0.35em] text-white/45">
            {brawler.tag} · {s.roundsWon} ROUND{s.roundsWon === 1 ? '' : 'S'} WON
          </p>
        </div>
      </div>
      <LifeGauge life={s.life} right={right} hit={hit} />
      <div className={`flex w-full items-center gap-3 ${right ? 'flex-row-reverse' : ''}`}>
        <img
          src={el.icon}
          alt=""
          className="h-10 w-10"
          style={{ filter: `drop-shadow(0 0 10px ${el.glow})`, opacity: revealed ? 1 : 0.3 }}
        />
        {revealed ? (
          <>
            <div className="min-w-0 flex-1">
              <p className="font-display truncate text-sm font-bold">
                {f.name}
                {s.shield && (
                  <span className="ml-2 text-[10px] tracking-widest" style={{ color: el.glow }}>
                    ◆ SHIELD
                  </span>
                )}
              </p>
              <p className="text-[10px] tracking-wider text-white/50">
                {f.g} BASE{gate > 0 && ` · GATE +${gate}`}
                {s.boost !== 0 && ` · CARDS ${s.boost > 0 ? '+' : '−'}${Math.abs(s.boost)}`}
              </p>
            </div>
            <p
              className="font-display text-3xl font-black tabular-nums"
              style={{ color: el.color, textShadow: `0 0 18px ${el.glow}` }}
            >
              <AnimatedNumber value={powerOf(state, side)} />
              <span className="text-lg">G</span>
            </p>
          </>
        ) : (
          <p className="font-display flex-1 text-xs tracking-[0.3em] text-white/45">CHOOSING A BAKUGAN…</p>
        )}
      </div>
      <div className={`flex min-h-6 flex-wrap gap-1.5 ${right ? 'justify-end' : ''}`}>
        {revealed &&
          s.played.map((c) => {
            const blocked = s.blocked.includes(c.uid)
            return (
              <motion.span
                key={c.uid}
                initial={{ opacity: 0, scale: 1.4 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`rounded border bg-black/60 px-2 py-0.5 text-[10px] font-bold ${blocked ? 'text-white/40 line-through' : ''}`}
                style={{ borderColor: `${el.color}88` }}
                title={blocked ? 'Cancelled by a shield' : c.ability.description}
              >
                {TYPE_ICON[c.ability.type]} {c.ability.name} <span style={{ color: el.color }}>{abilityLabel(c.ability)}</span>
              </motion.span>
            )
          })}
        {showHand && revealed && state.phase === 'abilities' && (
          <span className="rounded border border-white/10 bg-black/40 px-2 py-0.5 text-[10px] tracking-widest text-white/45">
            {s.hand.length} IN HAND · {s.played.length}/{PLAYS} PLAYED
          </span>
        )}
      </div>
    </div>
  )
}

/** The brawler's life gauge: the life just lost lingers a moment, then drains away. */
function LifeGauge({ life, right, hit }: { life: number; right: boolean; hit: { amount: number; key: number } | null }) {
  const pct = (life / LIFE) * 100
  const color = pct > 50 ? '#3ee07a' : pct > 25 ? '#f5c518' : '#ff3b2f'
  const from = right ? 'right-0' : 'left-0'
  return (
    <div className="w-full max-w-md">
      <div className="relative h-5 overflow-hidden rounded-sm border border-white/20 bg-white/5">
        <motion.div
          className={`absolute inset-y-0 ${from} bg-white/75`}
          animate={{ width: `${pct}%` }}
          transition={{ delay: 0.55, duration: 1, ease: 'easeIn' }}
        />
        <motion.div
          className={`absolute inset-y-0 ${from}`}
          style={{ background: color, boxShadow: `0 0 14px ${color}` }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.35 }}
        />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="absolute inset-y-0 w-px bg-black/50" style={{ left: `${i * 20}%` }} />
        ))}
      </div>
      <div className={`font-display mt-0.5 flex items-baseline gap-2 ${right ? 'flex-row-reverse' : ''}`}>
        <span className="text-[10px] tracking-[0.4em] text-white/45">LIFE</span>
        <span className="text-lg font-black tabular-nums" style={{ color }}>
          <AnimatedNumber value={life} />
        </span>
        <span className="text-xs text-white/40">/ {LIFE}</span>
        <AnimatePresence>
          {hit && (
            <motion.span
              key={hit.key}
              className="text-2xl font-black text-[#ff4a3d]"
              style={{ textShadow: '0 0 16px #ff4a3d' }}
              initial={{ opacity: 0, scale: 1.8 }}
              animate={{ opacity: [0, 1, 1, 0], scale: 1 }}
              transition={{ duration: 2.4, times: [0, 0.1, 0.8, 1] }}
            >
              −{hit.amount}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/** Round start: the player's team, each with its G-Power on this Gate Card; a click throws it. */
function ThrowPicker({ state, onPick }: { state: BattleState; onPick: (index: number) => void }) {
  const s = state.sides[0]
  return (
    <motion.div
      className="absolute inset-x-0 bottom-5 flex flex-col items-center"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <p className="font-display mb-5 text-xs tracking-[0.5em] text-white/70">CHOOSE YOUR BAKUGAN · THROW!</p>
      <div className="flex gap-3">
        {s.team.map((f, i) => {
          const el = ELEMENT_BY_ID[f.bakugan.element]
          const bonus = gateBonus(state, f)
          const last = i === s.active
          return (
            <motion.button
              key={f.bakugan.id}
              onClick={() => onPick(i)}
              whileHover={{ y: -10 }}
              whileTap={{ scale: 0.95 }}
              className="relative flex w-44 flex-col items-center rounded-lg border-2 bg-black/80 p-3 backdrop-blur"
              style={{
                borderColor: last ? el.color : 'rgba(255,255,255,0.2)',
                boxShadow: last ? `0 0 22px ${el.color}66` : 'none',
              }}
            >
              {last && state.round > 1 && (
                <span className="font-display absolute -top-2.5 rounded bg-white px-2 text-[9px] font-bold tracking-widest text-black">
                  LAST ROUND
                </span>
              )}
              <img src={el.icon} alt="" className="h-10 w-10" style={{ filter: `drop-shadow(0 0 10px ${el.glow})` }} />
              <span className="font-display mt-1 text-sm font-bold">{f.name}</span>
              <span className="font-display text-lg font-black" style={{ color: el.color }}>
                {f.g + bonus}G
              </span>
              <span className="text-[10px] tracking-wider text-white/55">
                {bonus > 0 ? `GATE +${bonus}` : 'NO GATE BONUS'} · {s.decks[i].length} CARDS
              </span>
            </motion.button>
          )
        })}
      </div>
    </motion.div>
  )
}

/** The round's battle: both G-Powers count up, then the difference and the life it costs. */
function ClashView({ clash, colors, names }: { clash: Clash; colors: [string, string]; names: [string, string] }) {
  const diff = Math.abs(clash.power[0] - clash.power[1])
  const loser = clash.winner === null ? null : other(clash.winner)
  return (
    <motion.div
      className="pointer-events-none absolute inset-x-0 top-[34%] z-10 flex flex-col items-center"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex items-center gap-8 rounded-xl border border-white/15 bg-black/75 px-10 py-4 backdrop-blur">
        {[0, 1].map((i) => (
          <div key={i} className={`flex flex-col items-center ${i === 1 ? 'order-3' : ''}`}>
            <span className="font-display text-[10px] tracking-[0.4em] text-white/50">{names[i].toUpperCase()}</span>
            <motion.span
              className="font-display text-6xl font-black tabular-nums"
              style={{ color: colors[i], textShadow: `0 0 26px ${colors[i]}` }}
              animate={
                clash.step >= 1 && clash.winner !== null
                  ? { scale: clash.winner === i ? 1.15 : 0.9, opacity: clash.winner === i ? 1 : 0.6 }
                  : { scale: 1, opacity: 1 }
              }
            >
              <CountUp value={clash.power[i]} />
              <span className="text-3xl">G</span>
            </motion.span>
          </div>
        ))}
        <span className="font-display order-2 text-3xl font-black text-white/40 italic">VS</span>
      </div>
      {clash.step >= 1 && (
        <motion.div
          className="mt-3 text-center"
          initial={{ opacity: 0, scale: 1.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 20 }}
        >
          {loser === null ? (
            <p className="font-display text-5xl font-black tracking-widest italic">DRAW!</p>
          ) : (
            <>
              <p className="font-display text-[11px] tracking-[0.5em] text-white/60">DIFFERENCE</p>
              <p className="font-display text-5xl leading-none font-black">{diff}G</p>
              <p className="font-display mt-1 text-lg font-bold tracking-widest text-[#ff5a4f]">
                {names[loser].toUpperCase()} −{clash.damage} LIFE
                {diff > MAX_HIT ? ' (MAX)' : diff < MIN_HIT ? ' (MIN)' : ''}
              </p>
            </>
          )}
        </motion.div>
      )}
    </motion.div>
  )
}

/** Counts up from zero with the G-Power tick. */
function CountUp({ value }: { value: number }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    let tick = 0
    const controls = animate(0, value, {
      duration: COUNT_MS / 1000 - 0.2,
      ease: 'easeOut',
      onUpdate: (v) => {
        setShown(Math.round(v))
        const now = performance.now()
        if (now - tick > 60) {
          tick = now
          playSfx('gPower')
        }
      },
    })
    return () => controls.stop()
  }, [value])
  return <>{shown}</>
}

/** XP and unlocks earned in a ranked brawl. */
function RewardList({ reward }: { reward: BattleReward }) {
  const lines = [
    {
      id: 'bp',
      color: '#f5c518',
      text: `+${reward.bp} BP`,
      extra: `${reward.rating >= 0 ? '+' : ''}${reward.rating} rating`,
    },
    {
      id: 'pass',
      color: '#7ec8e3',
      text: `+${reward.passXp} PASS XP`,
      extra: reward.passLevelUp
        ? `PASS LEVEL ${reward.passLevelUp}!`
        : reward.boosted
          ? 'XP boost used (+50% Bakugan XP)'
          : 'Season Pass',
    },
    ...reward.challengesDone.map((c, i) => ({ id: `ch-${i}`, color: '#3ee07a', text: 'CHALLENGE DONE', extra: c })),
    ...(reward.rankUp
      ? [{ id: 'rank', color: '#ffffff', text: `RANK UP: ${reward.rankUp.toUpperCase()}`, extra: 'new tier reached' }]
      : []),
    ...Object.entries(reward.xp).map(([id, xp]) => {
      const b = bakuganById(id)
      const extra = [
        reward.newCards[id] ? `+${reward.newCards[id]} ability card` : '',
        reward.evolveReady.includes(id) ? 'READY TO EVOLVE!' : '',
      ].filter(Boolean)
      return { id, color: ELEMENT_BY_ID[b.element].color, text: `${b.name} +${xp} XP`, extra: extra.join(' · ') }
    }),
    ...reward.unlocked.map((id) => ({
      id: `new-${id}`,
      color: ELEMENT_BY_ID[bakuganById(id).element].glow,
      text: `NEW BAKUGAN: ${bakuganById(id).name}`,
      extra: 'joined your collection',
    })),
  ]
  return (
    <div className="mt-5 flex flex-wrap justify-center gap-3">
      {lines.map((l, i) => (
        <motion.div
          key={l.id}
          className="rounded-md border bg-black/60 px-4 py-2 text-center"
          style={{ borderColor: `${l.color}aa` }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 + i * 0.15 }}
        >
          <p className="font-display font-bold" style={{ color: l.color }}>
            {l.text}
          </p>
          {l.extra && <p className="text-xs tracking-widest text-white/70">{l.extra}</p>}
        </motion.div>
      ))}
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
  locked,
  owner,
  onClick,
}: {
  title: string
  tag: string
  text: string
  /** Arena effect summary shown in the hover popover. */
  effect?: string
  color: string
  disabled: boolean
  /** Why the card can't be played right now. */
  locked?: string
  /** Bakugan the card belongs to. */
  owner?: string
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
          borderColor: locked ? 'rgba(255,255,255,0.1)' : `${color}aa`,
          opacity: locked ? 0.4 : disabled ? 0.6 : 1,
          boxShadow: disabled ? 'none' : `0 0 18px ${color}44`,
        }}
      >
        <span className="font-display text-[11px] font-bold tracking-wider" style={{ color }}>
          {tag}
        </span>
        {owner && <span className="truncate text-[10px] tracking-wider text-white/45 uppercase">{owner}</span>}
        <span className="font-display mt-1 text-sm leading-tight font-bold">{title}</span>
        <span className="mt-1.5 line-clamp-2 text-xs leading-snug text-white/65 [@media(min-height:720px)]:line-clamp-4">
          {text}
        </span>
        {locked && (
          <span className="font-display absolute inset-x-0 bottom-2 px-2 text-center text-[10px] leading-tight tracking-widest text-white/80">
            {locked.toUpperCase()}
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
