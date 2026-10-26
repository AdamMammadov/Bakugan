import { Canvas } from '@react-three/fiber'
import { animate, AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { afterSpeech, hush, playSfx, shout as callOut } from '../audio/sfx'
import type { SpeakerVoice } from '../audio/voices'
import {
  act,
  aiForTier,
  canAct,
  canOpenGate,
  cardLock,
  chooseAction,
  chooseGate,
  chooseThrow,
  gapOf,
  gateDelta,
  gatesLeft,
  leaderOf,
  LIVES,
  nextBattle,
  nullifyTargets,
  other,
  powerOf,
  previewMove,
  resolveBattle,
  setGate,
  startBattle,
  throwBakugan,
  throwerOf,
  type AiLevel,
  type BattleEvent,
  type BattleResult,
  type BattleState,
  type Card,
  type Duel,
  type DuelEnd,
  type Effect,
  type Move,
  type SideIndex,
  type Step,
} from '../battle/engine'
import { cardTag } from '../battle/labels'
import { BakuganPortrait } from '../components/BakuganPortrait'
import { BAKUGAN, battleEffect, type Ability, type Entrant } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { GATE_BY_ID, gateDeck, gateElementOf, gateKindLabel, gateLabel, type GateCard } from '../data/gates'
import { reportEventResult } from '../events/results'
import { bakuganById, rankScore, TIERS, useActiveProfile, useProfiles, type BattleReward } from '../profile/useProfiles'
import { useGame, type ArenaSetup, type TeamMember } from '../store/useGame'
import {
  botCharacter,
  CHARACTER_BY_ID,
  DEFAULT_PARTS,
  DEFAULT_VOICE,
  opponentCharacter,
  type Avatar as AvatarValue,
  type AvatarParts,
} from '../profile/avatar'
import { ACTION_DURATION, ArenaScene, IMPACT_AT, type BrawlerInfo } from '../three/ArenaScene'
import type { BrawlerCall, BrawlerGesture } from '../three/Brawler'
import { preloadModels } from '../three/BakuganModels'
import { announce, crowd } from '../three/stadium'
import { AHEAD, BattleStatus, BEHIND, BrawlerHud, GateSlot, TurnCounter } from './BattleHud'
import { TagArena } from './TagArena'

const INTRO_MS = 2600
/** "BATTLE n" before the Gate Card is set. */
const BATTLE_MS = 1300
/** The Gate Card lands on the field before the throws. */
const SET_MS = 1500
/** A CPU brawler picks its Bakugan for a moment before it throws. */
const PICK_MS = 700
/** One brawler's throw: the call, the ball's flight, and the Bakugan standing on the card. */
const THROW_MS = 2400
const AI_DELAY_MS = 800
/** A pass: the brawler's call shows before the next move. */
const PASS_MS = 1100
/** The Gate Card flips over before its effect lands. */
const GATE_FLIP_MS = 900
const GATE_HOLD_MS = 2300
/** The two G-Power counters count up before the winner shows. */
const COUNT_MS = 1500
const WINNER_MS = 1200
/** After the winner's final blow, before the next battle. */
const AFTER_STRIKE_MS = 2800
/** Extra time a finisher's beam and pillar of darkness hold the field. */
const FINISHER_HOLD_MS = 1600
/** How long a nullify card's shield flashes round its Bakugan. */
const NULLIFY_FLASH_MS = 1400
/** The flow waits at most this long for everyone to finish talking. */
const QUIET_MAX_MS = 6000
/** A battle won by this little is a close call. */
const CLOSE = 60

/**
 * The CPU brawler's answer to a rematch, after a moment: it says yes most of the time, more readily after a win or
 * a close match, less after a crushing defeat.
 */
function rematchAnswer(botWon: boolean, margin: number) {
  const yes = 0.7 + (botWon ? 0.15 : 0) + (margin <= 0.34 ? 0.1 : 0) - (!botWon && margin >= 0.66 ? 0.4 : 0)
  return { accept: Math.random() < Math.min(0.95, Math.max(0.2, yes)), after: 1500 + Math.random() * 1500 }
}

/** 0–1, the same for the same text. */
function seedOf(seed: string) {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 9973
  return (h % 1000) / 1000
}

/** A CPU brawler's HSP: inside its rank's band, the same for the same character. */
function botHsp(tier: number, seed: string) {
  const lo = TIERS[tier]?.min ?? 0
  const hi = TIERS[tier + 1]?.min ?? lo + 1500
  return lo + Math.round(seedOf(seed) * (hi - lo) * 0.8)
}

/** A ranked CPU opponent's HSP: close to the player's own score (within 150), the same for the same character. */
const rankedHsp = (score: number, seed: string) => Math.max(0, score + Math.round((seedOf(seed) - 0.5) * 300))

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
  model?: string
  /** Their voice; an `id` sets them apart from someone else using the same character's voice. */
  voice: SpeakerVoice
  /** The bot's strength; null when the player plays this side. */
  ai: AiLevel | null
  /** Holo-Sector Points: the brawler's ranking score, shown under their Bakugan. */
  hsp?: number
}

/** Lives in words, for the announcer. */
const livesLine = (n: number) => `${['No', 'One', 'Two', 'Three', 'Four', 'Five'][n] ?? n} ${n === 1 ? 'life' : 'lives'}`

/** "SPRING CUP · SEMI-FINAL" as the announcer says it: "Spring Cup, Semi-Final". */
const spoken = (title: string) =>
  title
    .split('·')
    .map((part) =>
      part
        .trim()
        .toLowerCase()
        .replace(/(^|[\s-])\p{L}/gu, (c) => c.toUpperCase()),
    )
    .join(', ')

/** The arena: a 1v1 match, or a 2v2 tag battle when the setup has one. */
export function ArenaScreen() {
  const setup = useGame((s) => s.arena)!
  const [again, setAgain] = useState(0)
  if (setup.tag) return <TagArena key={again} setup={setup} tag={setup.tag} onAgain={() => setAgain((n) => n + 1)} />
  return <MatchArena setup={setup} />
}

/** A ranked or free-play brawl: the player against a CPU brawler (an event match plays by the event's rules). */
function MatchArena({ setup }: { setup: ArenaSetup }) {
  const go = useGame((s) => s.go)
  const event = setup.event
  const boost = Math.max(0, event?.cpuBoost ?? 0)
  const teams = useMemo(
    () =>
      [
        toTeam(setup.left),
        // a boss: every Bakugan on the CPU side gets the event's extra G-Power
        toTeam(setup.right).map((e) => (boost ? { ...e, bonusG: (e.bonusG ?? 0) + boost } : e)),
      ] as const,
    [setup, boost],
  )
  // an event's Gate Cards replace both sides' own decks
  const gates = useMemo((): [GateCard[], GateCard[]] | undefined => {
    const list = (event?.gates ?? []).map((id) => GATE_BY_ID[id]).filter((g): g is GateCard => !!g)
    return list.length ? [list, [...list]] : undefined
  }, [event])
  const lives = useMemo((): [number, number] | undefined => {
    const l = event?.lives
    return l ? [Math.max(1, Math.round(l[0])), Math.max(1, Math.round(l[1]))] : undefined
  }, [event])
  // the event hears how its match ended, once
  const reported = useRef(false)
  const profile = useActiveProfile()

  const brawlers = useMemo((): [BrawlerSide, BrawlerSide] => {
    const bot = CHARACTER_BY_ID[setup.bot.characterId] ?? opponentCharacter(teams[1][0].bakugan)
    const cpu: BrawlerSide = {
      // an invited friend brawls under their own name
      name: setup.bot.name ?? bot.name,
      tag: setup.event?.id.startsWith('boss:')
        ? `BOSS · ${String(setup.event.stage ?? '').toUpperCase()}`
        : `CPU · ${(TIERS[setup.bot.tier]?.name ?? TIERS[0].name).toUpperCase()}`,
      avatar: { kind: 'preset', id: bot.id },
      parts: bot.parts,
      model: bot.model,
      // a CPU playing the player's own character gets a voice of its own
      voice:
        profile?.avatar.kind === 'preset' && profile.avatar.id === bot.id
          ? { ...bot.voice, id: setup.bot.name ?? `cpu ${bot.name}` }
          : bot.voice,
      ai: aiForTier(setup.bot.tier),
      // a ranked brawl is against someone on the player's level
      hsp:
        profile && setup.ranked && !setup.event
          ? rankedHsp(rankScore(profile), setup.bot.name ?? bot.id)
          : botHsp(setup.bot.tier, setup.bot.name ?? bot.id),
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
          hsp: 0,
        },
        cpu,
      ]
    }
    const a = profile.avatar
    const preset = a.kind === 'preset' ? CHARACTER_BY_ID[a.id] : undefined
    return [
      {
        name: profile.firstName,
        tag: `YOU · ${setup.ranked ? 'RANKED' : 'FREE PLAY'}`,
        avatar: a,
        parts:
          a.kind === 'custom'
            ? a.parts
            : a.kind === 'preset'
              ? (preset?.parts ?? DEFAULT_PARTS)
              : botCharacter(profile.element).parts,
        model: preset?.model,
        voice: preset?.voice ?? DEFAULT_VOICE,
        ai: null,
        hsp: rankScore(profile),
      },
      cpu,
    ]
  }, [profile, setup, teams])

  if (!event) return <Brawl teams={teams} brawlers={brawlers} ranked={setup.ranked} onLeave={() => go('compare')} />
  return (
    <Brawl
      teams={teams}
      brawlers={brawlers}
      ranked={setup.ranked}
      gates={gates}
      lives={lives}
      boost={boost}
      title={event.title}
      exit={{ label: 'BACK TO EVENTS', onClick: () => go('events') }}
      onLeave={() => go('events')}
      onOver={(s) => {
        if (reported.current) return
        reported.current = true
        reportEventResult({ event, won: s.winner === 0, livesLeft: s.sides[0].lives, battles: s.results.length })
      }}
    />
  )
}

type Cue = { gesture: { kind: BrawlerGesture; key: number }; call: BrawlerCall | null }

/** A battle a host hands to the brawl (a round of a tag match). */
export interface HostBattle {
  /** A new key starts this battle. */
  key: number
  /** The battle, in phase 'set'. */
  state: BattleState
  /** The banner as it starts, e.g. "ROUND 2". */
  title: string
  sub: string
}

/** Lets a host follow the brawl: the stadium announcer and the cards the player has activated. */
export interface HostTools {
  call: (line: string) => void
  /** Ability cards the player has activated so far (Season Pass challenges). */
  abilities: () => number
}

/**
 * A match run from outside (a tag match): the brawl plays the battles it is given, one at a time, and hands each
 * result back instead of going on to the next battle by itself. `teams` and `brawlers` are the current battle's.
 */
export interface BrawlHost {
  battle: HostBattle
  /** The opening: what shows under BAKUGAN, BRAWL! and the announcer's lines. */
  intro: { sub: string; lines: string[] }
  /** The brawl is up: the host's way to the announcer. */
  connect: (tools: HostTools) => void
  /** A battle is decided (its state after resolveBattle). */
  onBattle: (end: BattleState, result: BattleResult) => void
  /** Under the turn counter: "ROUND". */
  counter?: string
}

/** A battle's end on screen: the counters, then the winner, then its final blow. */
interface Clash {
  key: number
  power: [number, number]
  names: [string, string]
  winner: SideIndex
  finisher: boolean
  /** How it was decided. */
  end: DuelEnd
  /** The loser's lives after this battle. */
  livesLeft: number
  /** 0 counting up · 1 winner shown · 2 the blow, a life lost */
  step: number
  /** A battle of a hosted (tag) match: a brawler out of lives is out, not the match lost. */
  hosted?: boolean
}

interface BrawlProps {
  teams: readonly [Entrant[], Entrant[]]
  brawlers: [BrawlerSide, BrawlerSide]
  /** Spectating: both sides are CPU, nobody controls them and nothing is recorded. */
  live?: boolean
  /** The result goes to the player's profile (XP, BP, rating). */
  ranked?: boolean
  /** After the match (CHANGE TEAMS), or leaving a live match being watched. */
  onLeave: () => void
  /** Called once the match is over. */
  onOver?: (state: BattleState) => void
  /** Shown above the turn counter (the live badge). */
  badge?: ReactNode
  /** Event rules: the Gate Cards each side sets, instead of their own decks. */
  gates?: [GateCard[], GateCard[]]
  /** Event rules: lives per side (LIVES each when left out). */
  lives?: [number, number]
  /** A boss's extra G-Power on side 1's Bakugan (already in its team's G), shown in its HUD. */
  boost?: number
  /** The event's name, shown over the turn counter. */
  title?: string
  /** After the match, one way out (e.g. BACK TO EVENTS) instead of REMATCH and CHANGE TEAMS. */
  exit?: { label: string; onClick: () => void }
  /** A match run from outside (a tag match), see BrawlHost. */
  host?: BrawlHost
  /** Drawn over the arena (a host's own HUD, panels and result). */
  overlay?: ReactNode
  /** Where a brawler's call-out bubble sits, from the screen's edge (e.g. clear of a panel). */
  callInset?: [string, string]
  /** A tag battle: each brawler's teammate, standing next to them in the scene. */
  partners?: [BrawlerInfo | null, BrawlerInfo | null]
}

/** The match itself: lives, battles on a Gate Card, turns and each battle's end. */
export function Brawl({
  teams,
  brawlers,
  live = false,
  ranked = false,
  onLeave,
  onOver,
  badge,
  gates,
  lives,
  boost = 0,
  title,
  exit,
  host,
  overlay,
  callInset,
  partners,
}: BrawlProps) {
  useEffect(() => teams.flat().forEach((e) => preloadModels(e.bakugan)), [teams])

  // a coin toss decides who sets the first Gate Card
  const fresh = () =>
    startBattle(
      teams[0],
      teams[1],
      gates ? [[...gates[0]], [...gates[1]]] : [gateDeck(teams[0]), gateDeck(teams[1])],
      Math.random() < 0.5 ? 0 : 1,
      lives,
    )
  const [battle, setBattle] = useState<BattleState>(fresh)
  // What the HUD shows; lags `battle` until each card or strike lands.
  const [shown, setShown] = useState<BattleState>(battle)
  const [event, setEvent] = useState<{ event: BattleEvent; key: number } | null>(null)
  // each side's throws so far (the scene throws a side's Bakugan in when its count goes up)
  const [throws, setThrows] = useState<[number, number]>([0, 0])
  const [defeated, setDefeated] = useState<[boolean, boolean]>([false, false])
  const [shields, setShields] = useState<[boolean, boolean]>([false, false])
  const [busy, setBusy] = useState(true)
  const [picking, setPicking] = useState<'gate' | 'throw' | null>(null)
  const [banner, setBanner] = useState<{ text: string; sub?: string; color?: string; key: number } | null>(null)
  const [clash, setClash] = useState<Clash | null>(null)
  const [reward, setReward] = useState<BattleReward | null>(null)
  const [rematch, setRematch] = useState<'idle' | 'asking' | 'declined'>('idle')
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null)
  // a hosted match: who is on the field changes with each battle, together with `shown`
  const [view, setView] = useState({ teams, brawlers })
  const [cues, setCues] = useState<[Cue, Cue]>([
    { gesture: { kind: null, key: 0 }, call: null },
    { gesture: { kind: null, key: 0 }, call: null },
  ])
  const timers = useRef<number[]>([])
  const stopWaits = useRef<(() => void)[]>([])
  const seq = useRef(1)
  const toastTimer = useRef(0)
  const hinted = useRef(false)
  // ability cards the player activated, for Season Pass challenges
  const playerCards = useRef(0)

  const controls = brawlers[0].ai === null && !live
  const human = (side: SideIndex) => side === 0 && controls
  const levelOf = (side: SideIndex) => brawlers[side].ai ?? aiForTier(0)
  const nameOf = (side: SideIndex) => brawlers[side].name
  const nextKey = () => seq.current++
  const later = (ms: number, fn: () => void) => void timers.current.push(window.setTimeout(fn, ms))
  /** Continue once nobody is talking any more (at least `minMs` from now). */
  const waitQuiet = (fn: () => void, minMs = 0) => stopWaits.current.push(afterSpeech(fn, QUIET_MAX_MS, minMs))
  const say = (text: string, sub?: string, color?: string) => setBanner({ text, sub, color, key: nextKey() })
  const stopAll = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    stopWaits.current.forEach((stop) => stop())
    stopWaits.current = []
    hush()
  }

  /** The stadium announcer (its lines wait their turn in the shared speech queue, after the brawlers' calls). */
  const call = (text: string) => announce(text)

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
      later(2400, () =>
        setCues((c) => {
          if (c[side].call?.key !== key) return c
          const next = [...c] as typeof c
          next[side] = { ...c[side], call: null }
          return next
        }),
      )
  }

  // ------------------------------------------------------------ match flow

  function begin(delay: number) {
    const s = host ? host.battle.state : fresh()
    setView({ teams, brawlers })
    setBattle(s)
    setShown(s)
    setEvent(null)
    setDefeated([false, false])
    setShields([false, false])
    setClash(null)
    setReward(null)
    setRematch('idle')
    setPicking(null)
    setBusy(true)
    playerCards.current = 0
    hinted.current = false
    playSfx('brawl')
    say('BAKUGAN, BRAWL!', host ? host.intro.sub : `${nameOf(0)} vs ${nameOf(1)}`)
    cue(0, 'point', 'BAKUGAN, BRAWL!', undefined, 'Bakugan, brawl!')
    later(900, () => cue(1, 'point', 'BAKUGAN, BRAWL!', undefined, 'Bakugan, brawl!'))
    crowd('cheer')
    if (host) {
      host.connect({ call, abilities: () => playerCards.current })
      host.intro.lines.forEach(call)
      started.current = host.battle.key
      const b = host.battle
      return later(delay, () => waitQuiet(() => battleStart(s, b)))
    }
    const [l0, l1] = [s.sides[0].maxLives, s.sides[1].maxLives]
    const livesCall = l0 === l1 ? `${livesLine(l0)} each!` : `${nameOf(0)} has ${livesLine(l0)}, ${nameOf(1)} ${livesLine(l1)}!`
    call(`Welcome to the ${title ? spoken(title) : 'Bakugan Arena'}! ${nameOf(0)} versus ${nameOf(1)}! ${livesCall}`)
    if (boost) call(`Watch out! Every Bakugan of ${nameOf(1)} brawls with ${boost} extra G!`)
    call(`${nameOf(s.setter)} wins the coin toss and sets the first Gate Card!`)
    // the opening lines are said before the first battle starts
    later(delay, () => waitQuiet(() => battleStart(s)))
  }

  /** A new battle: the setter sets a Gate Card face-down. A host's battle brings its own banner. */
  function battleStart(s: BattleState, hosted?: HostBattle) {
    setView({ teams, brawlers })
    setBattle(s)
    setShown(s)
    setClash(null)
    setEvent(null)
    setShields([false, false])
    setBusy(true)
    if (hosted) say(hosted.title, hosted.sub)
    else say(`BATTLE ${s.battle}`, `${nameOf(s.setter)} sets the Gate Card`)
    if (s.battle > 1) crowd('chant')
    later(BATTLE_MS, () => {
      if (human(s.setter) && gatesLeft(s.sides[0]).length > 1) {
        setPicking('gate')
        setBusy(false)
      } else gateSet(s, human(s.setter) ? 0 : chooseGate(s, levelOf(s.setter)))
    })
  }

  function gateSet(s: BattleState, index: number) {
    setPicking(null)
    setBusy(true)
    const next = setGate(s, index)
    const side = s.setter
    playSfx('gateCard')
    cue(side, 'card', 'GATE CARD, SET!', human(side) && next.gate ? next.gate.name : 'face-down', 'Gate card, set!')
    call(`${nameOf(side)} sets a Gate Card face-down! Only ${nameOf(side)} knows what it is!`)
    setBattle(next)
    setShown(next)
    later(SET_MS, () => waitQuiet(() => throwStep(next)))
  }

  /** The brawlers throw in turn: the setter first, then the other brawler answers. Each throw is a beat of its own. */
  function throwStep(s: BattleState) {
    setBattle(s)
    setShown(s)
    const side = throwerOf(s)
    if (side === null) return battleReady(s)
    if (human(side) && s.sides[side].team.length > 1) {
      setPicking('throw')
      setBusy(false)
      return
    }
    if (human(side)) return throwOne(s, side, 0)
    later(PICK_MS, () => throwOne(s, side, chooseThrow(s, side, levelOf(side))))
  }

  function pickThrow(s: BattleState, index: number) {
    setPicking(null)
    setBusy(true)
    throwOne(s, 0, index)
  }

  /** One brawler throws: "Bakugan, brawl!", the ball flies, opens, and the Bakugan stands on the Gate Card. */
  function throwOne(s: BattleState, side: SideIndex, index: number) {
    setBusy(true)
    const next = throwBakugan(s, side, index)
    const name = next.sides[side].team[next.thrown[side]!].name
    // the first throw of a battle clears the field of the last one's result
    if (s.thrown[0] === null && s.thrown[1] === null) setDefeated([false, false])
    // the scene gets the new Bakugan together with the throw
    setBattle(next)
    setShown(next)
    setThrows((t) => (side === 0 ? [t[0] + 1, t[1]] : [t[0], t[1] + 1]))
    playSfx('brawl')
    cue(side, 'throw', 'BAKUGAN, BRAWL!', `${name}, stand!`, `Bakugan, brawl! ${name}, stand!`)
    later(THROW_MS, () => waitQuiet(() => throwStep(next)))
  }

  /** Both Bakugan stand: the announcer gives their G-Powers and who has to answer. */
  function battleReady(s: BattleState) {
    const d = s.duel!
    const names = [d.fighters[0].name, d.fighters[1].name]
    hinted.current = false
    if (d.done) return waitQuiet(() => nextMove(s))
    const mover = d.turn
    const gap = Math.abs(gapOf(d, mover))
    const ahead = leaderOf(d) === mover
    call(
      `${names[0]}, ${d.fighters[0].g} G! ${names[1]}, ${d.fighters[1].g} G! ` +
        (ahead
          ? `${nameOf(mover)} moves first, ${gap ? `${gap} G ahead` : 'ahead on the tie'}!`
          : `${nameOf(mover)} moves first and has to answer${gap ? `: ${gap} G behind` : ''}!`),
    )
    waitQuiet(() => nextMove(s), 500)
  }

  function nextMove(s: BattleState) {
    setBattle(s)
    if (s.phase === 'clash') return battleEnd(s)
    const d = s.duel!
    const side = d.turn
    if (!human(side)) return later(AI_DELAY_MS, () => run(s, chooseAction(s, levelOf(side))))
    // ahead with nothing left to play: the player can only hold
    if (!canAct(d, side)) {
      say('NOTHING LEFT TO PLAY', `You hold at ${powerOf(d, side)} G`)
      return later(PASS_MS, () => run(s, { kind: 'pass' }))
    }
    if (!hinted.current) {
      hinted.current = true
      const gap = Math.abs(gapOf(d, side))
      if (leaderOf(d) === side) say('YOUR MOVE', `You're ${gap ? `${gap} G ahead` : 'ahead on the tie'}: hold, or add more power`)
      else say('YOUR MOVE', `You're ${gap ? `${gap} G behind` : 'tied, and lose ties'}: play a card to get ahead`, BEHIND)
    }
    setBusy(false)
  }

  function run(s: BattleState, move: Move) {
    setBusy(true)
    const step = act(s, move)
    // the card leaves the hand at once; the HUD (`shown`) catches up when the move lands
    setBattle(step.state)
    if (move.kind === 'gate') return openGate(s, step)
    if (move.kind === 'pass') return pass(s, step)
    playCard(s, step, move.card)
  }

  /** A pass: ahead, the brawler holds ("beat that!"); behind, they give the battle up. */
  function pass(s: BattleState, step: Step) {
    const d = s.duel!
    const side = d.turn
    const foe = other(side)
    const g = powerOf(d, side)
    if (step.state.duel!.end === 'gaveUp') {
      cue(side, 'slump', "I CAN'T BEAT THAT…", undefined, "I can't beat that...")
      call(`${nameOf(side)} can't get past ${powerOf(d, foe)} G and gives up the battle!`)
      crowd('gasp')
    } else {
      cue(side, 'point', 'HOLD!', `Beat ${g} G!`, HOLD_LINES[d.moves % HOLD_LINES.length])
      call(`${nameOf(side)} holds at ${g} G! ${nameOf(foe)} has to beat it!`)
    }
    setShown(step.state)
    later(PASS_MS, () => waitQuiet(() => nextMove(step.state)))
  }

  /** "Ability activate!": the card's effect plays on the field, then the G-Powers change. */
  function playCard(s: BattleState, step: Step, card: Card) {
    const d = s.duel!
    const side = d.turn
    const foe = other(side)
    const a = card.ability
    const bakugan = d.fighters[side].name
    if (human(side)) playerCards.current++
    playSfx('ability')
    cue(side, 'card', a.type === 'shield' ? 'NULLIFY!' : 'ABILITY ACTIVATE!', a.name, `Ability activate! ${a.name}!`)
    if (a.type === 'shield') {
      crowd('gasp')
      if (step.cancelled) say('NULLIFY!', `${a.name} cancels ${effectName(step.cancelled, step.state)}`, '#ff4a3d')
    } else if (a.type === 'finisher') crowd('gasp')
    else if (a.amount >= 150 || a.type === 'drain') crowd('roar', side)
    // the announcer calls the card as it lands
    const line = cardLine(step, card, bakugan, d.fighters[foe].name, nameOf(side), nameOf(foe))
    waitQuiet(() => perform(step, a, line), 700)
  }

  /** The Bakugan acts on the field: animation, then the G-Power changes on the HUD and the announcer calls it. */
  function perform(step: Step, a: Ability, line: string) {
    const ev = step.event!
    const side = ev.actor
    setEvent({ event: ev, key: nextKey() })
    if (a.type === 'shield') {
      // the nullifying Bakugan's shield flashes up for a moment
      setShields(side === 0 ? [true, false] : [false, true])
      later(NULLIFY_FLASH_MS, () => setShields([false, false]))
    }
    later(IMPACT_AT * 1000, () => {
      if (ev.damage > 0) {
        playSfx('hit')
        cue(ev.target, 'flinch')
      }
      if (ev.actorG || ev.targetG) playSfx('gPower')
      setShown(step.state)
      call(line)
      // a finisher, or a Bakugan down to 0 G: it falls at once
      const end = step.state.duel!.end
      if (end === 'finisher' || end === 'ko') {
        const loser = other(step.state.duel!.winner!)
        setDefeated(loser === 0 ? [true, false] : [false, true])
      }
    })
    const hold = a.type === 'finisher' ? FINISHER_HOLD_MS : 0
    // the next move waits for the announcer's call
    later(ACTION_DURATION * 1000 + hold, () => waitQuiet(() => nextMove(step.state)))
  }

  /** "Gate Card, open!": the card flips over in the middle and its effect lands. */
  function openGate(s: BattleState, step: Step) {
    const side = s.duel!.turn
    const gate = step.state.duel!.gate!.card
    const e = step.effect!
    playSfx('gateCard')
    cue(side, 'card', 'GATE CARD, OPEN!', gate.name, `Gate card, open! ${gate.name}!`)
    say('GATE CARD, OPEN!', `${gate.name}: ${gate.text}`, ELEMENT_BY_ID[gateElementOf(gate)].color)
    crowd('roar', side)
    later(GATE_FLIP_MS, () => {
      setShown(step.state)
      if (e.delta[0] || e.delta[1]) playSfx('gPower')
      call(`${nameOf(side)} reveals ${gate.name}! ${gateOutcome(step.state, e)}`)
      const end = step.state.duel!.end
      if (end === 'ko') {
        const loser = other(step.state.duel!.winner!)
        setDefeated(loser === 0 ? [true, false] : [false, true])
      }
    })
    later(GATE_HOLD_MS, () => waitQuiet(() => nextMove(step.state)))
  }

  /** The battle is decided: the G-Powers count up, the winner deals the final blow, a life is lost. */
  function battleEnd(s: BattleState) {
    setBusy(true)
    const { state: next, event: ev, result } = resolveBattle(s)
    const d = s.duel!
    const winner = result.winner
    const loser = other(winner)
    const diff = Math.abs(result.power[0] - result.power[1])
    const livesLeft = next.sides[loser].lives
    playSfx('brawl')
    setClash({
      key: nextKey(),
      power: result.power,
      names: [d.fighters[0].name, d.fighters[1].name],
      winner,
      finisher: result.finisher,
      end: result.end,
      livesLeft,
      step: 0,
      hosted: !!host,
    })
    const endCall = endLine(result.end, nameOf(loser), d.fighters[loser].name, result.power)
    if (endCall) call(endCall)
    later(COUNT_MS, () => {
      setClash((c) => c && { ...c, step: 1 })
      if (diff <= CLOSE) crowd('gasp')
    })
    later(COUNT_MS + WINNER_MS, () => {
      setClash((c) => c && { ...c, step: 2 })
      // the finisher's beam already struck, and a Bakugan at 0 G is already down
      const struck = result.finisher || result.end === 'ko'
      if (!struck) setEvent({ event: ev, key: nextKey() })
      later(struck ? 0 : IMPACT_AT * 1000, () => {
        playSfx('hit')
        cue(loser, 'flinch')
        cue(winner, 'cheer', 'YES!', undefined, `Yes! Way to go, ${d.fighters[winner].name}!`)
        setShown(next)
        setDefeated(loser === 0 ? [true, false] : [false, true])
        const tie = diff === 0 && !result.finisher
        const line = `${d.fighters[winner].name} wins the battle${tie ? ' on the tie: it was thrown first' : ''}! ${nameOf(loser)} loses a life!`
        call(diff <= CLOSE && !struck ? `What a close call! ${line}` : line)
        if (livesLeft === 1 && !host) {
          call(`Match point for ${nameOf(winner)}! ${nameOf(loser)} has one life left!`)
          crowd('chant', winner)
        } else crowd('roar', winner)
      })
      later(IMPACT_AT * 1000 + AFTER_STRIKE_MS, () => afterBattle(next))
    })
  }

  function afterBattle(s: BattleState) {
    setClash(null)
    if (host) return host.onBattle(s, s.results[s.results.length - 1])
    if (s.phase === 'over') finish(s)
    else battleStart(nextBattle(s))
  }

  function finish(s: BattleState) {
    setBattle(s)
    setShown(s)
    setBusy(true)
    const w = s.winner ?? 0
    playSfx(live || w === 0 ? 'victory' : 'defeat')
    cue(w, 'cheer', 'I WIN!', undefined, 'Yes! Victory!')
    cue(other(w), 'slump')
    call(`${nameOf(w)} wins the brawl, ${s.sides[w].wins} battles to ${s.sides[other(w)].wins}!`)
    crowd('roar', w)
    later(7000, () => crowd('calm'))
    if (ranked && controls) {
      // a battle won defeats the opposing Bakugan: it counts as a KO for the player's Bakugan that won it
      const kos: Record<string, number> = {}
      for (const r of s.results)
        if (r.winner === 0) {
          const id = s.sides[0].team[r.thrown[0]].bakugan.id
          kos[id] = (kos[id] ?? 0) + 1
        }
      setReward(
        useProfiles.getState().recordBattle({
          won: s.winner === 0,
          team: s.sides[0].team.map((f) => f.bakugan.id),
          kos,
          abilities: playerCards.current,
          flawless: s.sides[0].lives === s.sides[0].maxLives,
          foe: brawlers[1].hsp,
        }),
      )
    }
    onOver?.(s)
  }

  function askRematch() {
    if (rematch !== 'idle') return
    setRematch('asking')
    const answer = rematchAnswer(battle.winner === 1, Math.abs(battle.sides[0].lives - battle.sides[1].lives) / LIVES)
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
  const flow = useRef<{ start: () => void; stop: () => void; battle: (b: HostBattle) => void }>({
    start: () => {},
    stop: () => {},
    battle: () => {},
  })
  useEffect(() => {
    flow.current = {
      start: () => begin(INTRO_MS),
      stop: () => {
        stopAll()
        clearTimeout(toastTimer.current)
      },
      battle: (b) => battleStart(b.state, b),
    }
  })
  useEffect(() => {
    const t = window.setTimeout(() => flow.current.start(), 0)
    return () => {
      clearTimeout(t)
      flow.current.stop()
    }
  }, [])
  // a host's next battle (after the flow above has this render's teams and brawlers)
  const started = useRef<number | null>(null)
  const hostBattle = host?.battle
  useEffect(() => {
    if (!hostBattle || started.current === null || started.current === hostBattle.key) return
    started.current = hostBattle.key
    flow.current.battle(hostBattle)
  }, [hostBattle])

  // ------------------------------------------------------------ view

  // who is on the field: in a hosted match the battle's own brawlers (they change with `shown`), else the props
  const cast = host ? view : { teams, brawlers }
  const shownName = (side: SideIndex) => cast.brawlers[side].name
  const onField = cast.brawlers[0].ai === null && !live
  const duel = battle.duel
  const myTurn = onField && !busy && battle.phase === 'battle' && duel?.turn === 0 && battle.winner === null
  // each brawler's colour: their lead Bakugan's attribute
  const colors = [0, 1].map((i) => ELEMENT_BY_ID[cast.teams[i][0].bakugan.element].color) as [string, string]
  const fieldGate = shown.duel?.gate
  const over = !host && battle.winner !== null && battle.phase === 'over' && !clash
  const gateOwner = shown.duel?.gate?.owner ?? shown.setter
  // the Bakugan on the field: this battle's once thrown (the other side's last one waits in its ball till then)
  const onCard = (side: SideIndex) => (shown.duel ? shown.sides[side].active : (shown.thrown[side] ?? shown.sides[side].active))
  const fighterColors = [0, 1].map((i) => ELEMENT_BY_ID[cast.teams[i][onCard(i as SideIndex)].bakugan.element].color) as [
    string,
    string,
  ]

  return (
    <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Canvas shadows camera={{ position: [0, 11, 46], fov: 50 }} dpr={[1, 2]}>
        <ArenaScene
          fighters={[cast.teams[0][onCard(0)], cast.teams[1][onCard(1)]]}
          // a face-down Gate Card shows no attribute; it lights up once opened (and goes dark again if nullified)
          gate={fieldGate?.open && !fieldGate.nullified ? gateElementOf(fieldGate.card) : null}
          event={event}
          shields={shields}
          defeated={defeated}
          throws={throws}
          partners={partners}
          brawlers={[
            { parts: cast.brawlers[0].parts, model: cast.brawlers[0].model, gesture: cues[0].gesture },
            { parts: cast.brawlers[1].parts, model: cast.brawlers[1].model, gesture: cues[1].gesture },
          ]}
        />
      </Canvas>

      {/* what each brawler calls out, above their head on the field */}
      {cues.map((c, i) =>
        c.call ? (
          <div
            key={c.call.key}
            className={`pointer-events-none absolute bottom-[31%] z-10 ${i === 0 ? 'left-[4%]' : 'right-[4%]'}`}
            style={callInset ? (i === 0 ? { left: callInset[0] } : { right: callInset[1] }) : undefined}
          >
            <div className="brawler-call" style={{ borderColor: colors[i] }}>
              <span className="brawler-call-name text-white/60">{cast.brawlers[i].name}</span>
              <span className="brawler-call-title">{c.call.title}</span>
              {c.call.sub && <span className="brawler-call-sub">{c.call.sub}</span>}
            </div>
          </div>
        ) : null,
      )}

      {/* the HUD: each brawler's lives, face, Bakugan card with its G-Power and HSP; the turn counter and Gate Card */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-black/75 via-black/40 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 px-4 pt-3">
        <BrawlerHud state={shown} side={0} brawler={cast.brawlers[0]} teams={cast.teams} color={colors[0]} />
        <div className="flex min-w-48 flex-col items-center text-center">
          {badge}
          {title && (
            <p className="font-display mb-2 max-w-72 rounded-full border border-[#ffc94a]/70 bg-black/70 px-3 py-1 text-[10px] font-bold tracking-[0.3em] text-[#ffc94a]">
              ★ {title.toUpperCase()}
            </p>
          )}
          <TurnCounter turn={shown.turn + (shown.phase === 'battle' ? 1 : 0)} battle={shown.battle} label={host?.counter} />
          <GateSlot state={shown} ownerName={shownName(gateOwner)} mine={onField && gateOwner === 0} />
          {shown.duel && (battle.phase === 'battle' || battle.phase === 'clash') ? (
            <BattleStatus state={shown} you={onField} names={[shownName(0), shownName(1)]} colors={fighterColors} />
          ) : (
            <PhaseLabel state={battle} busy={busy} controls={onField} picking={picking} names={[shownName(0), shownName(1)]} />
          )}
        </div>
        <BrawlerHud state={shown} side={1} brawler={cast.brawlers[1]} teams={cast.teams} color={colors[1]} boost={boost} />
      </div>

      {/* leaving a live match being watched (a brawler cannot walk out of their own match) */}
      {live && (
        <button
          onClick={onLeave}
          className="font-display absolute top-[46%] left-5 text-xs tracking-[0.4em] text-white/45 transition hover:text-white"
        >
          ✕ EXIT
        </button>
      )}

      {picking === 'gate' && !busy && <GatePicker gates={gatesLeft(battle.sides[0])} onPick={(i) => gateSet(battle, i)} />}
      {picking === 'throw' && !busy && <ThrowPicker state={battle} teams={cast.teams} onPick={(i) => pickThrow(battle, i)} />}

      {/* the player's moves: the cards in hand, the Gate Card and PASS (hold, or give up) */}
      {onField && battle.phase === 'battle' && duel && (
        <MoveBar
          state={battle}
          myTurn={myTurn}
          color={ELEMENT_BY_ID[duel.fighters[0].bakugan.element].color}
          foeName={shownName(1)}
          onMove={(m) => run(battle, m)}
        />
      )}

      <AnimatePresence>
        {banner && !clash && battle.winner === null && (
          <motion.div
            key={banner.key}
            className="pointer-events-none absolute inset-x-0 top-[33%] z-10 text-center"
            initial={{ opacity: 0, scale: 2 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            onAnimationComplete={() => window.setTimeout(() => setBanner((s) => (s?.key === banner.key ? null : s)), 1100)}
          >
            <p
              className="font-display text-5xl font-black tracking-wider italic"
              style={{ textShadow: `0 0 30px ${banner.color ?? colors[0]}` }}
            >
              {banner.text}
            </p>
            {banner.sub && (
              <p className="font-display mx-auto mt-2 max-w-2xl text-lg tracking-widest text-white/85">{banner.sub}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {clash && <ClashView key={clash.key} clash={clash} colors={colors} brawlerNames={[shownName(0), shownName(1)]} />}
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
              {battle.sides[battle.winner!].wins}–{battle.sides[other(battle.winner!)].wins} IN {battle.results.length} BATTLES ·{' '}
              {battle.sides[battle.winner!].lives} {battle.sides[battle.winner!].lives === 1 ? 'LIFE' : 'LIVES'} LEFT
            </p>
            {reward && <RewardList reward={reward} />}
            {live ? (
              <p className="font-display mt-5 animate-pulse text-sm tracking-[0.4em] text-white/60">NEXT LIVE MATCH STARTING…</p>
            ) : exit ? (
              <button
                onClick={exit.onClick}
                className="font-display mt-5 border-2 border-white/70 px-8 py-3 tracking-[0.3em] hover:bg-white/10"
              >
                {exit.label}
              </button>
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

      {overlay}

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

// ---------------------------------------------------------------- announcer lines

/** What an effect is called on screen: an ability card's name or the Gate Card's. */
function effectName(e: Effect, s: BattleState) {
  return e.kind === 'gate' ? `the Gate Card (${s.duel?.gate?.card.name ?? ''})` : (e.card?.ability.name ?? 'the card')
}

/** What the brawler calls out when holding the lead. */
const HOLD_LINES = ['Beat that if you can!', 'Your move!', "Let's see what you've got!", 'Go ahead, top that!']

/** After a move, the state of the race: who has to answer now (or how the battle ended). */
function raceLine(d: Duel, names: [string, string]) {
  if (d.done) return ''
  const lead = leaderOf(d)
  const gap = Math.abs(gapOf(d, lead))
  if (d.turn === lead) return `${names[lead]} leads by ${gap} G!`
  return gap ? `${names[d.turn]} is ${gap} G behind and has to answer!` : `It's a tie! ${names[d.turn]} has to answer!`
}

/** The announcer on a card, whoever plays it. */
function cardLine(step: Step, card: Card, bakugan: string, foeBakugan: string, brawler: string, foeBrawler: string) {
  const a = card.ability
  const d = step.state.duel!
  const side = step.event!.actor
  const foe = other(side)
  const e = step.effect!
  const names: [string, string] = side === 0 ? [brawler, foeBrawler] : [foeBrawler, brawler]
  const next = raceLine(d, names)
  const ko = d.end === 'ko' ? `${foeBakugan} is down to 0 G!` : ''
  switch (a.type) {
    case 'boost':
      return `${brawler} activates ${a.name}! ${bakugan} powers up to ${powerOf(d, side)} G! ${next}`
    case 'attack':
      return `${bakugan} strikes with ${a.name}! ${ko || `${foeBakugan} drops to ${powerOf(d, foe)} G! ${next}`}`
    case 'weaken':
      return `${brawler} activates ${a.name}! ${ko || `${foeBakugan} is weakened to ${powerOf(d, foe)} G! ${next}`}`
    case 'drain':
      return `${a.name}! ${bakugan} steals ${e.delta[side]} G from ${foeBakugan}! ${ko || next}`
    case 'shield':
      return step.cancelled
        ? `${brawler} activates ${a.name}! ${foeBrawler}'s ${effectName(step.cancelled, step.state)} is nullified! ${next}`
        : `${brawler} activates ${a.name}!`
    case 'finisher':
      return `${bakugan} unleashes ${a.name}! ${foeBakugan} is wiped out!`
  }
}

/** The announcer as a battle is decided (the finisher's own line already said it). */
function endLine(end: DuelEnd, loser: string, loserBakugan: string, power: [number, number]) {
  const score = `${Math.max(...power)} G against ${Math.min(...power)} G!`
  switch (end) {
    case 'ko':
      return `${loserBakugan} has no G-Power left! It's defeated!`
    case 'finisher':
      return ''
    case 'gaveUp':
      return `${loser} gives up! ${score}`
    case 'noAnswer':
      return `${loser} has nothing left to answer with! ${score}`
    case 'standoff':
      return `Neither side can play any more! ${score}`
  }
}

/** The announcer on an opened Gate Card. */
function gateOutcome(s: BattleState, e: Effect) {
  const d = s.duel!
  const parts = ([0, 1] as const)
    .filter((i) => e.delta[i])
    .map((i) => `${d.fighters[i].name} ${e.delta[i] > 0 ? 'rises' : 'drops'} to ${powerOf(d, i)} G`)
  const next = raceLine(d, [d.fighters[0].name, d.fighters[1].name])
  return parts.length ? `${parts.join(', ')}! ${next}` : `But nothing happens! ${next}`
}

// ---------------------------------------------------------------- the player's controls

/** Whose move it is, under the Gate Card. */
function PhaseLabel({
  state,
  busy,
  controls,
  picking,
  names,
}: {
  state: BattleState
  busy: boolean
  controls: boolean
  picking: 'gate' | 'throw' | null
  names: [string, string]
}) {
  let text = ''
  const turn = state.duel?.turn
  if (picking === 'gate' && !busy) text = 'SET A GATE CARD'
  else if (picking === 'throw' && !busy) text = 'CHOOSE YOUR BAKUGAN'
  else if (state.phase === 'set') text = `${names[state.setter].toUpperCase()} SETS THE GATE`
  else if (state.phase === 'throw') text = 'BAKUGAN, BRAWL!'
  else if (state.phase === 'battle' && turn !== undefined)
    text = controls && turn === 0 ? 'YOUR MOVE' : `${names[turn].toUpperCase()}'S MOVE`
  else if (state.phase === 'clash' || state.phase === 'result') text = 'BATTLE!'
  if (!text || state.phase === 'over') return null
  return (
    <p className="font-display mt-2 rounded border border-white/15 bg-black/60 px-3 py-1 text-[10px] tracking-[0.35em] text-white/85">
      {text}
    </p>
  )
}

/** What a move would leave on the field, on its button: both G-Powers and whether the player would be ahead. */
function previewText(d: Duel, move: Move): { text: string; color: string } {
  const p = previewMove(d, move)
  if (p.winner === 0) return { text: p.end === 'ko' ? 'KNOCKS IT OUT: YOU WIN THE BATTLE' : 'WINS THE BATTLE', color: AHEAD }
  if (p.winner === 1) return { text: 'YOU WOULD LOSE THE BATTLE', color: BEHIND }
  const gap = p.power[0] - p.power[1]
  const ahead = gap > 0 || (gap === 0 && d.first === 0)
  return {
    text: `${p.power[0]} VS ${p.power[1]} · ${ahead ? (gap ? `AHEAD BY ${gap}` : 'AHEAD ON THE TIE') : gap ? `STILL ${-gap} BEHIND` : 'TIED, STILL BEHIND'}`,
    color: ahead ? AHEAD : BEHIND,
  }
}

/** The player's moves in battle: each card in hand, opening the Gate Card, and PASS (hold the lead, or give up). */
function MoveBar({
  state,
  myTurn,
  color,
  foeName,
  onMove,
}: {
  state: BattleState
  myTurn: boolean
  color: string
  foeName: string
  onMove: (move: Move) => void
}) {
  const d = state.duel!
  const gate = d.gate?.owner === 0 && !d.gate.open ? d.gate.card : null
  const owner = d.fighters[0]
  const ahead = leaderOf(d) === 0
  const gap = Math.abs(gapOf(d, 0))
  const mine = powerOf(d, 0)
  const theirs = powerOf(d, 1)
  const live = myTurn && !d.done
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center gap-3 px-24 pb-5 *:pointer-events-auto">
      {d.hands[0].map((card) => {
        const lock = cardLock(d, 0, card)
        const target = card.ability.type === 'shield' ? bestTarget(d) : null
        return (
          <HandButton
            key={card.uid}
            disabled={!myTurn || !!lock}
            locked={lock ?? undefined}
            onClick={() => onMove({ kind: 'ability', card })}
            color={ELEMENT_BY_ID[owner.bakugan.element].color}
            owner={owner.name}
            title={card.ability.name}
            tag={cardTag(card.ability)}
            text={target ? `Cancels ${target}` : card.ability.description}
            effect={battleEffect(card.ability)}
            preview={live && !lock ? previewText(d, { kind: 'ability', card }) : undefined}
          />
        )
      })}
      {gate && (
        <GateButton
          gate={gate}
          preview={gateDelta(d, gate, 0)}
          result={live && canOpenGate(d, 0) ? previewText(d, { kind: 'gate' }) : undefined}
          disabled={!myTurn || !canOpenGate(d, 0)}
          onClick={() => onMove({ kind: 'gate' })}
        />
      )}
      <div className="flex w-52 shrink-0 flex-col items-stretch gap-1.5 self-center">
        <p className="font-display text-center text-[10px] tracking-[0.3em] text-white/60">
          {myTurn ? 'YOUR MOVE' : `${foeName.toUpperCase()}'S MOVE…`}
        </p>
        <p className="font-display text-center text-lg leading-none font-black" style={{ color: ahead ? AHEAD : BEHIND }}>
          {gap ? `${gap} G ${ahead ? 'AHEAD' : 'BEHIND'}` : ahead ? 'TIED · YOU WIN TIES' : 'TIED · THEY WIN TIES'}
        </p>
        <p className="text-center text-[11px] leading-snug text-white/70">
          {ahead
            ? `${foeName} has to beat ${mine} G. Hold, or add more power.`
            : `Get past ${theirs} G: play a card${gate && canOpenGate(d, 0) ? ' or open your Gate Card' : ''}.`}
        </p>
        <motion.button
          disabled={!myTurn}
          onClick={() => onMove({ kind: 'pass' })}
          whileHover={myTurn ? { scale: 1.04 } : undefined}
          whileTap={myTurn ? { scale: 0.96 } : undefined}
          className={`font-display rounded-lg border-2 py-2.5 text-lg font-black tracking-[0.25em] backdrop-blur transition disabled:opacity-35 ${
            ahead ? 'border-[#3ee07a] bg-[#3ee07a]/15' : 'border-white/30 bg-black/50 text-white/80'
          }`}
          style={{ boxShadow: myTurn && ahead ? `0 0 22px ${color}88` : 'none' }}
        >
          {ahead ? 'HOLD' : 'GIVE UP'}
          <span className="mt-0.5 block text-[10px] font-normal tracking-[0.15em] text-white/70">
            {ahead ? `PASS · ${foeName.toUpperCase()} MUST ANSWER` : 'PASS · LOSE THIS BATTLE'}
          </span>
        </motion.button>
      </div>
    </div>
  )
}

/** What a nullify card would cancel now (the effect worth the most to the player). */
function bestTarget(d: NonNullable<BattleState['duel']>) {
  const targets = nullifyTargets(d, 0)
  if (!targets.length) return null
  const best = [...targets].sort((a, b) => b.delta[1] - b.delta[0] - (a.delta[1] - a.delta[0]))[0]
  return best.kind === 'gate' ? `their Gate Card (${d.gate?.card.name})` : (best.card?.ability.name ?? null)
}

const signed = (n: number) => `${n > 0 ? '+' : '−'}${Math.abs(n)}G`

/** The player's own face-down Gate Card: "Gate Card, open!" */
function GateButton({
  gate,
  preview,
  result,
  disabled,
  onClick,
}: {
  gate: GateCard
  /** What opening it would do right now (G for the player, for the opponent). */
  preview: [number, number]
  /** Where that would leave the battle. */
  result?: { text: string; color: string }
  disabled: boolean
  onClick: () => void
}) {
  const el = ELEMENT_BY_ID[gateElementOf(gate)]
  return (
    <div className="group relative flex min-w-0 flex-1 basis-0 [max-width:10rem]">
      <motion.button
        disabled={disabled}
        onClick={onClick}
        whileHover={disabled ? undefined : { y: -14 }}
        className="relative flex h-[clamp(6rem,24vh,11rem)] w-full flex-col rounded-lg border-2 p-3 text-left backdrop-blur transition disabled:cursor-not-allowed"
        style={{
          borderColor: '#ffc94a',
          opacity: disabled ? 0.45 : 1,
          background: 'linear-gradient(160deg, rgba(42,29,74,.92), rgba(10,8,20,.92))',
          boxShadow: disabled ? 'none' : '0 0 20px #ffc94a66',
        }}
      >
        <span className="font-display text-[11px] font-bold tracking-wider text-[#ffc94a]">▣ GATE CARD, OPEN!</span>
        <span className="flex items-center gap-1.5 text-[10px] tracking-wider text-white/45 uppercase">
          <img src={el.icon} alt="" className="h-4 w-4" />
          {gateKindLabel(gate)}
        </span>
        <span className="font-display mt-1 text-sm leading-tight font-bold">{gateLabel(gate)}</span>
        {/* what it would do if opened now */}
        <span
          className="font-display mt-1.5 text-[11px] leading-snug font-bold tracking-wider"
          style={{
            color: preview[0] - preview[1] > 0 ? '#3ee07a' : preview[0] || preview[1] ? '#ff6a4a' : 'rgba(255,255,255,0.45)',
          }}
        >
          {preview[0] || preview[1]
            ? `NOW: ${[preview[0] && `YOU ${signed(preview[0])}`, preview[1] && `FOE ${signed(preview[1])}`].filter(Boolean).join(' · ')}`
            : 'NO EFFECT RIGHT NOW'}
        </span>
        <span className="mt-1 line-clamp-1 text-xs leading-snug text-white/55 [@media(min-height:720px)]:line-clamp-2">
          {gate.text}
        </span>
        {result && <ResultLine result={result} />}
      </motion.button>
      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-4 w-64 -translate-x-1/2 rounded-lg border border-[#ffc94a]/70 bg-black/90 p-4 opacity-0 shadow-2xl backdrop-blur transition group-hover:opacity-100">
        <p className="font-display text-[11px] font-bold tracking-wider text-[#ffc94a]">YOUR GATE CARD · FACE-DOWN</p>
        <p className="font-display mt-1 text-base font-bold">{gate.name}</p>
        <p className="mt-2 text-sm leading-snug text-white/80">{gate.text}</p>
        <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-snug text-white/60">
          Opening it takes your turn. Your opponent can then answer it, or nullify it.
        </p>
      </div>
    </div>
  )
}

/** The player sets a Gate Card: their unused ones, face up (only they see it). */
function GatePicker({ gates, onPick }: { gates: GateCard[]; onPick: (index: number) => void }) {
  return (
    <motion.div
      className="absolute inset-x-0 bottom-5 z-10 flex flex-col items-center"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <p className="font-display mb-1 text-xs tracking-[0.5em] text-white/80">GATE CARD, SET!</p>
      <p className="mb-4 text-xs text-white/55">It lies face-down: open it during the battle when the time is right.</p>
      <div className="flex gap-3">
        {gates.map((g, i) => {
          const el = ELEMENT_BY_ID[gateElementOf(g)]
          return (
            <motion.button
              key={g.id}
              onClick={() => onPick(i)}
              whileHover={{ y: -10 }}
              whileTap={{ scale: 0.95 }}
              className="flex w-52 flex-col items-start rounded-lg border-2 bg-black/85 p-3 text-left backdrop-blur"
              style={{ borderColor: `${el.color}cc`, boxShadow: `0 0 18px ${el.color}44` }}
            >
              <span className="flex items-center gap-2">
                <img src={el.icon} alt="" className="h-7 w-7" />
                <span className="font-display text-sm font-bold">{gateLabel(g)}</span>
              </span>
              <span className="font-display mt-1 text-[9px] tracking-[0.3em] text-white/45">{gateKindLabel(g)}</span>
              <span className="mt-1 text-xs leading-snug text-white/70">{g.text}</span>
            </motion.button>
          )
        })}
      </div>
    </motion.div>
  )
}

/** The player picks the Bakugan to throw (the last one first in line); answering a throw, they see what they face. */
function ThrowPicker({
  state,
  teams,
  onPick,
}: {
  state: BattleState
  teams: readonly [Entrant[], Entrant[]]
  onPick: (index: number) => void
}) {
  const s = state.sides[0]
  const foePick = state.thrown[1]
  const foe = foePick === null ? null : state.sides[1].team[foePick]
  const myGate = state.setter === 0 ? state.gate : null
  return (
    <motion.div
      className="absolute inset-x-0 bottom-5 z-10 flex flex-col items-center"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <p className="font-display mb-1 text-xs tracking-[0.5em] text-white/80">CHOOSE YOUR BAKUGAN · THROW!</p>
      <p className="mb-4 text-xs text-white/55">
        {foe ? `${foe.name} (${foe.g} G) stands on the Gate Card. Who answers it?` : 'You throw first: your Bakugan wins a tie.'}
      </p>
      <div className="flex gap-3">
        {s.team.map((f, i) => {
          const el = ELEMENT_BY_ID[f.bakugan.element]
          const last = i === s.active
          const fits =
            myGate &&
            ((myGate.kind === 'attribute' && myGate.element === f.bakugan.element) ||
              (myGate.kind === 'character' && myGate.bakugan === f.bakugan.id))
          return (
            <motion.button
              key={f.bakugan.id}
              onClick={() => onPick(i)}
              whileHover={{ y: -10 }}
              whileTap={{ scale: 0.95 }}
              className="relative flex w-44 flex-col items-center rounded-lg border-2 bg-black/85 p-2 backdrop-blur"
              style={{
                borderColor: last ? el.color : 'rgba(255,255,255,0.2)',
                boxShadow: last ? `0 0 22px ${el.color}66` : 'none',
              }}
            >
              {last && state.battle > 1 && (
                <span className="font-display absolute -top-2.5 z-10 rounded bg-white px-2 text-[9px] font-bold tracking-widest text-black">
                  LAST BATTLE
                </span>
              )}
              <div className="h-20 w-20 overflow-hidden rounded-md">
                <BakuganPortrait entrant={teams[0][i]} />
              </div>
              <span className="font-display mt-1 flex items-center gap-1 text-sm font-bold">
                <img src={el.icon} alt="" className="h-5 w-5" />
                {f.name}
              </span>
              <span className="font-display text-lg font-black" style={{ color: el.color }}>
                {f.g}G
              </span>
              <span className="text-[10px] tracking-wider text-white/55">
                {s.decks[i].length} CARDS{fits ? ' · FITS YOUR GATE' : ''}
              </span>
            </motion.button>
          )
        })}
      </div>
    </motion.div>
  )
}

/** A battle's end: both G-Powers count up, the winner shows, then the loser's brawler loses a life. */
function ClashView({ clash, colors, brawlerNames }: { clash: Clash; colors: [string, string]; brawlerNames: [string, string] }) {
  const loser = other(clash.winner)
  const tie = clash.power[0] === clash.power[1] && !clash.finisher
  return (
    <motion.div
      className="pointer-events-none absolute inset-x-0 top-[33%] z-10 flex flex-col items-center"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="flex items-center gap-8 rounded-xl border border-white/15 bg-black/80 px-10 py-4 backdrop-blur">
        {[0, 1].map((i) => (
          <div key={i} className={`flex flex-col items-center ${i === 1 ? 'order-3' : ''}`}>
            <span className="font-display text-[10px] tracking-[0.4em] text-white/55">{clash.names[i].toUpperCase()}</span>
            <motion.span
              className="font-display text-6xl font-black tabular-nums"
              style={{ color: colors[i], textShadow: `0 0 26px ${colors[i]}` }}
              animate={
                clash.step >= 1
                  ? { scale: clash.winner === i ? 1.18 : 0.88, opacity: clash.winner === i ? 1 : 0.5 }
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
          <p
            className="font-display text-5xl font-black tracking-wider italic"
            style={{ textShadow: `0 0 30px ${colors[clash.winner]}` }}
          >
            {clash.names[clash.winner].toUpperCase()} WINS!
          </p>
          <p className="font-display mt-1 text-sm tracking-[0.3em] text-white/70">{clashReason(clash, brawlerNames, tie)}</p>
        </motion.div>
      )}
      {clash.step >= 2 && (
        <motion.p
          className="font-display mt-2 text-xl font-black tracking-widest text-[#ff5a4f]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {brawlerNames[loser].toUpperCase()} LOSES A LIFE ·{' '}
          {clash.livesLeft === 0
            ? clash.hosted
              ? 'OUT OF THE MATCH!'
              : 'DEFEATED!'
            : clash.livesLeft === 1
              ? clash.hosted
                ? 'LAST LIFE!'
                : 'MATCH POINT!'
              : `${clash.livesLeft} LEFT`}
        </motion.p>
      )}
    </motion.div>
  )
}

/** Why the battle was won, under the winner's name. */
function clashReason(clash: Clash, brawlers: [string, string], tie: boolean) {
  const loser = other(clash.winner)
  const by = tie ? 'ON THE TIE: THROWN FIRST' : `BY ${Math.abs(clash.power[0] - clash.power[1])} G`
  switch (clash.end) {
    case 'finisher':
      return 'WON OUTRIGHT BY ITS FINISHER'
    case 'ko':
      return `${clash.names[loser].toUpperCase()} HAS 0 G — DEFEATED`
    case 'gaveUp':
      return `${by} · ${brawlers[loser].toUpperCase()} GAVE UP`
    case 'noAnswer':
      return `${by} · ${brawlers[loser].toUpperCase()} HAD NO ANSWER`
    case 'standoff':
      return `${by} · NO MOVES LEFT`
  }
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
export function RewardList({ reward }: { reward: BattleReward }) {
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
      ? [{ id: 'rank', color: '#ffffff', text: `RANK UP: ${reward.rankUp.toUpperCase()}`, extra: 'new rank reached' }]
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

function HandButton({
  title,
  tag,
  text,
  effect,
  color,
  disabled,
  locked,
  owner,
  preview,
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
  /** Where playing it now would leave the battle. */
  preview?: { text: string; color: string }
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
        <span className="mt-1.5 line-clamp-2 text-xs leading-snug text-white/65 [@media(min-height:720px)]:line-clamp-3">
          {text}
        </span>
        {preview && <ResultLine result={preview} />}
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

/** At the foot of a card: what playing it now would do to the race. */
function ResultLine({ result }: { result: { text: string; color: string } }) {
  return (
    <span
      className="font-display absolute inset-x-0 bottom-0 rounded-b-md border-t border-white/10 bg-black/70 px-2 py-1 text-center text-[9px] leading-tight font-bold tracking-wider"
      style={{ color: result.color }}
    >
      → {result.text}
    </span>
  )
}
