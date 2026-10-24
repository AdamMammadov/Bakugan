import { Canvas } from '@react-three/fiber'
import { animate, AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { afterSpeech, hush, playSfx, shout as callOut } from '../audio/sfx'
import {
  act,
  aiForTier,
  canOpenGate,
  cardLock,
  chooseAction,
  gateDelta,
  chooseGate,
  chooseThrow,
  LIVES,
  nextBattle,
  nullifyTargets,
  other,
  playsLeft,
  powerOf,
  resolveBattle,
  setGate,
  startBattle,
  strikeOf,
  throwBakugan,
  throwerOf,
  type AiLevel,
  type BattleEvent,
  type BattleState,
  type Card,
  type Effect,
  type Move,
  type SideIndex,
  type Step,
} from '../battle/engine'
import { cardTag } from '../battle/labels'
import { BakuganPortrait } from '../components/BakuganPortrait'
import { BAKUGAN, battleEffect, type Ability, type Entrant } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { gateDeck, gateElementOf, gateKindLabel, gateLabel, type GateCard } from '../data/gates'
import { bakuganById, rankScore, TIERS, useActiveProfile, useProfiles, type BattleReward } from '../profile/useProfiles'
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
import { BrawlerHud, GateSlot, TurnCounter } from './BattleHud'

const INTRO_MS = 2600
/** "BATTLE n" before the Gate Card is set. */
const BATTLE_MS = 1300
/** The Gate Card lands on the field before the throws. */
const SET_MS = 1500
/** A CPU brawler's pick shows a moment before the other side picks. */
const PICK_MS = 900
/** Both brawlers throw; the balls open and the Bakugan stand. */
const THROW_MS = 2600
const AI_DELAY_MS = 800
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
/** The announcer's lines come at least this far apart. */
const ANNOUNCE_GAP = 2600
/** A battle won by this little is a close call. */
const CLOSE = 60

const clock = () => performance.now()

/**
 * The CPU brawler's answer to a rematch, after a moment: it says yes most of the time, more readily after a win or
 * a close match, less after a crushing defeat.
 */
function rematchAnswer(botWon: boolean, margin: number) {
  const yes = 0.7 + (botWon ? 0.15 : 0) + (margin <= 0.34 ? 0.1 : 0) - (!botWon && margin >= 0.66 ? 0.4 : 0)
  return { accept: Math.random() < Math.min(0.95, Math.max(0.2, yes)), after: 1500 + Math.random() * 1500 }
}

/** A CPU brawler's HSP: inside its rank's band, the same for the same character. */
function botHsp(tier: number, seed: string) {
  const lo = TIERS[tier]?.min ?? 0
  const hi = TIERS[tier + 1]?.min ?? lo + 1500
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) % 9973
  return lo + Math.round(((h % 1000) / 1000) * (hi - lo) * 0.8)
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
  model?: string
  voice: Voice
  /** The bot's strength; null when the player plays this side. */
  ai: AiLevel | null
  /** Holo-Sector Points: the brawler's ranking score, shown under their Bakugan. */
  hsp?: number
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
      // an invited friend brawls under their own name
      name: setup.bot.name ?? bot.name,
      tag: `CPU · ${(TIERS[setup.bot.tier]?.name ?? TIERS[0].name).toUpperCase()}`,
      avatar: { kind: 'preset', id: bot.id },
      parts: bot.parts,
      model: bot.model,
      voice: bot.voice,
      ai: aiForTier(setup.bot.tier),
      hsp: botHsp(setup.bot.tier, setup.bot.name ?? bot.id),
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

  return <Brawl teams={teams} brawlers={brawlers} ranked={setup.ranked} onLeave={() => go('compare')} />
}

type Cue = { gesture: { kind: BrawlerGesture; key: number }; call: BrawlerCall | null }

/** A battle's end on screen: the counters, then the winner, then its final blow. */
interface Clash {
  key: number
  power: [number, number]
  names: [string, string]
  winner: SideIndex
  finisher: boolean
  /** The loser's lives after this battle. */
  livesLeft: number
  /** 0 counting up · 1 winner shown · 2 the blow, a life lost */
  step: number
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
}

/** The match itself: lives, battles on a Gate Card, turns and each battle's end. */
export function Brawl({ teams, brawlers, live = false, ranked = false, onLeave, onOver, badge }: BrawlProps) {
  useEffect(() => teams.flat().forEach((e) => preloadModels(e.bakugan)), [teams])

  // a coin toss decides who sets the first Gate Card
  const fresh = () => startBattle(teams[0], teams[1], [gateDeck(teams[0]), gateDeck(teams[1])], Math.random() < 0.5 ? 0 : 1)
  const [battle, setBattle] = useState<BattleState>(fresh)
  // What the HUD shows; lags `battle` until each card or strike lands.
  const [shown, setShown] = useState<BattleState>(battle)
  const [event, setEvent] = useState<{ event: BattleEvent; key: number } | null>(null)
  const [throwKey, setThrowKey] = useState(0)
  const [defeated, setDefeated] = useState<[boolean, boolean]>([false, false])
  const [shields, setShields] = useState<[boolean, boolean]>([false, false])
  const [busy, setBusy] = useState(true)
  const [picking, setPicking] = useState<'gate' | 'throw' | null>(null)
  const [banner, setBanner] = useState<{ text: string; sub?: string; color?: string; key: number } | null>(null)
  const [clash, setClash] = useState<Clash | null>(null)
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
  const lines = useRef<string[]>([])
  const lineTimer = useRef(0)
  const lastLine = useRef(-ANNOUNCE_GAP)
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
  const waitQuiet = (fn: () => void, minMs = 0) => stopWaits.current.push(afterSpeech(fn, 3500, minMs))
  const say = (text: string, sub?: string, color?: string) => setBanner({ text, sub, color, key: nextKey() })
  const stopAll = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
    stopWaits.current.forEach((stop) => stop())
    stopWaits.current = []
    clearTimeout(lineTimer.current)
    lineTimer.current = 0
    lines.current = []
    hush()
  }

  /** The stadium announcer: lines wait their turn (two at most; a newer one pushes the oldest out). */
  const call = (text: string) => {
    lines.current.push(text)
    while (lines.current.length > 2) lines.current.shift()
    pumpLines()
  }
  const pumpLines = () => {
    if (lineTimer.current || !lines.current.length) return
    lineTimer.current = window.setTimeout(
      () => {
        lineTimer.current = 0
        const line = lines.current.shift()
        if (line) {
          lastLine.current = clock()
          announce(line)
        }
        pumpLines()
      },
      Math.max(0, lastLine.current + ANNOUNCE_GAP - clock()),
    )
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
    const s = fresh()
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
    say('BAKUGAN, BRAWL!', `${nameOf(0)} vs ${nameOf(1)}`)
    cue(0, 'point', 'BAKUGAN, BRAWL!', undefined, 'Bakugan, brawl!')
    later(900, () => cue(1, 'point', 'BAKUGAN, BRAWL!', undefined, 'Bakugan, brawl!'))
    call(`Welcome to the Bakugan Arena! ${nameOf(0)} versus ${nameOf(1)}! Three lives each!`)
    call(`${nameOf(s.setter)} wins the coin toss and sets the first Gate Card!`)
    crowd('cheer')
    later(delay, () => battleStart(s))
  }

  /** A new battle: the setter sets a Gate Card face-down. */
  function battleStart(s: BattleState) {
    setBattle(s)
    setShown(s)
    setClash(null)
    setEvent(null)
    setShields([false, false])
    say(`BATTLE ${s.battle}`, `${nameOf(s.setter)} sets the Gate Card`)
    if (s.battle > 1) crowd('chant')
    later(BATTLE_MS, () => {
      if (human(s.setter) && s.sides[0].gates.length > 1) {
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
    later(SET_MS, () => throwStep(next))
  }

  /** The setter picks a Bakugan first, then the other brawler answers; then both throw. */
  function throwStep(s: BattleState) {
    setBattle(s)
    setShown(s)
    const side = throwerOf(s)
    if (side === null) return throwAll(s)
    if (human(side) && s.sides[side].team.length > 1) {
      setPicking('throw')
      setBusy(false)
      return
    }
    const pick = human(side) ? 0 : chooseThrow(s, side, levelOf(side))
    const next = throwBakugan(s, side, pick)
    // the first pick shows on its card a moment before the other side picks
    if (next.duel) return throwStep(next)
    setBattle(next)
    setShown(next)
    later(human(side) ? 0 : PICK_MS, () => throwStep(next))
  }

  function pickThrow(s: BattleState, index: number) {
    setPicking(null)
    setBusy(true)
    throwStep(throwBakugan(s, 0, index))
  }

  /** Both brawlers throw: "Bakugan, brawl!" and the Bakugan stand on the Gate Card. */
  function throwAll(s: BattleState) {
    setBusy(true)
    const d = s.duel!
    const first = s.setter
    const second = other(first)
    const names = [d.fighters[0].name, d.fighters[1].name]
    playSfx('brawl')
    // the scene gets the new Bakugan together with the throw
    setShown(s)
    setThrowKey((k) => k + 1)
    setDefeated([false, false])
    cue(first, 'point', 'BAKUGAN, BRAWL!', `${names[first]}, stand!`, `Bakugan, brawl! ${names[first]}, stand!`)
    later(800, () =>
      cue(second, 'point', 'BAKUGAN, BRAWL!', `${names[second]}, stand!`, `Bakugan, brawl! ${names[second]}, stand!`),
    )
    call(`${nameOf(first)} throws ${names[first]}! ${nameOf(second)} answers with ${names[second]}!`)
    call(`${names[0]}, ${d.fighters[0].g} G! ${names[1]}, ${d.fighters[1].g} G! ${nameOf(second)} moves first!`)
    later(THROW_MS, () => waitQuiet(() => nextMove(s)))
  }

  function nextMove(s: BattleState) {
    setBattle(s)
    if (s.phase === 'clash') return battleEnd(s)
    const side = s.duel!.turn
    if (!human(side)) later(AI_DELAY_MS, () => run(s, chooseAction(s, levelOf(side))))
    else {
      if (!hinted.current) {
        hinted.current = true
        say('YOUR MOVE', 'Play an ability card, open your Gate Card, or ATTACK')
      }
      setBusy(false)
    }
  }

  function run(s: BattleState, move: Move) {
    setBusy(true)
    const step = act(s, move)
    // the card leaves the hand at once; the HUD (`shown`) catches up when the move lands
    setBattle(step.state)
    if (move.kind === 'gate') return openGate(s, step)
    if (move.kind === 'attack') return strike(s, step)
    playCard(s, step, move.card)
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
    // the announcer calls every card, whoever plays it
    call(cardLine(step, card, bakugan, d.fighters[foe].name, nameOf(side), nameOf(foe)))
    if (a.type === 'shield') {
      crowd('gasp')
      if (step.cancelled) say('NULLIFY!', `${a.name} cancels ${effectName(step.cancelled, step.state)}`, '#ff4a3d')
    } else if (a.type === 'finisher') crowd('gasp')
    else if (a.amount >= 150 || a.type === 'drain') crowd('roar', side)
    waitQuiet(() => perform(step, a), 700)
  }

  /** The Bakugan acts on the field: animation, then the G-Power changes on the HUD. */
  function perform(step: Step, a: Ability) {
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
      if (a.type === 'finisher') setDefeated(ev.target === 0 ? [true, false] : [false, true])
    })
    const hold = a.type === 'finisher' ? FINISHER_HOLD_MS : 0
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
    call(`Gate Card open! ${nameOf(side)} reveals ${gate.name}! ${gateOutcome(step.state, e)}`)
    crowd('roar', side)
    later(GATE_FLIP_MS, () => {
      setShown(step.state)
      if (e.delta[0] || e.delta[1]) playSfx('gPower')
    })
    later(GATE_HOLD_MS, () => waitQuiet(() => nextMove(step.state)))
  }

  /** "<Bakugan>, attack!": the strike flies and the opponent's G-Power drops. Its part in the battle is over. */
  function strike(s: BattleState, step: Step) {
    const d = s.duel!
    const side = d.turn
    const foe = other(side)
    const ev = step.event!
    const bakugan = d.fighters[side].name
    playSfx('ability')
    cue(side, 'point', 'ATTACK!', `${bakugan}, attack!`, `${bakugan}, attack!`)
    const answer = !step.state.duel!.attacked[foe] && !step.state.duel!.done
    call(`${bakugan} attacks! ${d.fighters[foe].name} loses ${ev.damage} G!${answer ? ` ${nameOf(foe)} has one last move!` : ''}`)
    waitQuiet(() => {
      setEvent({ event: ev, key: nextKey() })
      later(IMPACT_AT * 1000, () => {
        playSfx('hit')
        cue(foe, 'flinch')
        setShown(step.state)
        playSfx('gPower')
      })
      later(ACTION_DURATION * 1000, () => waitQuiet(() => nextMove(step.state)))
    }, 500)
  }

  /** Both have struck (or a finisher won it): the G-Powers count up, the winner deals the final blow, a life is lost. */
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
      livesLeft,
      step: 0,
    })
    if (!result.finisher) call(`Both Bakugan have attacked! ${result.power[0]} G against ${result.power[1]} G!`)
    later(COUNT_MS, () => {
      setClash((c) => c && { ...c, step: 1 })
      if (diff <= CLOSE) crowd('gasp')
    })
    later(COUNT_MS + WINNER_MS, () => {
      setClash((c) => c && { ...c, step: 2 })
      // the finisher's beam already struck
      if (!result.finisher) setEvent({ event: ev, key: nextKey() })
      later(result.finisher ? 0 : IMPACT_AT * 1000, () => {
        playSfx('hit')
        cue(loser, 'flinch')
        cue(winner, 'cheer', 'YES!', undefined, `Yes! Way to go, ${d.fighters[winner].name}!`)
        setShown(next)
        setDefeated(loser === 0 ? [true, false] : [false, true])
        const tie = diff === 0 && !result.finisher
        const line = `${d.fighters[winner].name} wins the battle${tie ? ' on the tie: it was thrown first' : ''}! ${nameOf(loser)} loses a life!`
        call(diff <= CLOSE && !result.finisher ? `What a close call! ${line}` : line)
        if (livesLeft === 1) {
          call(`Match point for ${nameOf(winner)}! ${nameOf(loser)} has one life left!`)
          crowd('chant', winner)
        } else crowd('roar', winner)
      })
      later(IMPACT_AT * 1000 + AFTER_STRIKE_MS, () => afterBattle(next))
    })
  }

  function afterBattle(s: BattleState) {
    setClash(null)
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
          flawless: s.sides[0].lives === LIVES,
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

  const duel = battle.duel
  const myTurn = controls && !busy && battle.phase === 'battle' && duel?.turn === 0 && battle.winner === null
  // each brawler's colour: their lead Bakugan's attribute
  const colors = [0, 1].map((i) => ELEMENT_BY_ID[teams[i][0].bakugan.element].color) as [string, string]
  const fieldGate = shown.duel?.gate
  const over = battle.winner !== null && battle.phase === 'over' && !clash
  const gateOwner = shown.duel?.gate?.owner ?? shown.setter

  return (
    <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Canvas shadows camera={{ position: [0, 11, 46], fov: 50 }} dpr={[1, 2]}>
        <ArenaScene
          fighters={[teams[0][shown.sides[0].active], teams[1][shown.sides[1].active]]}
          // a face-down Gate Card shows no attribute; it lights up once opened (and goes dark again if nullified)
          gate={fieldGate?.open && !fieldGate.nullified ? gateElementOf(fieldGate.card) : null}
          event={event}
          shields={shields}
          defeated={defeated}
          throwKey={throwKey}
          brawlers={[
            { parts: brawlers[0].parts, model: brawlers[0].model, gesture: cues[0].gesture },
            { parts: brawlers[1].parts, model: brawlers[1].model, gesture: cues[1].gesture },
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

      {/* the HUD: each brawler's lives, face, Bakugan card with its G-Power and HSP; the turn counter and Gate Card */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-gradient-to-b from-black/75 via-black/40 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 px-4 pt-3">
        <BrawlerHud state={shown} side={0} brawler={brawlers[0]} teams={teams} color={colors[0]} />
        <div className="flex min-w-48 flex-col items-center text-center">
          {badge}
          <TurnCounter turn={shown.turn + (shown.phase === 'battle' ? 1 : 0)} battle={shown.battle} />
          <GateSlot state={shown} ownerName={nameOf(gateOwner)} mine={controls && gateOwner === 0} />
          <PhaseLabel state={battle} busy={busy} controls={controls} picking={picking} names={[nameOf(0), nameOf(1)]} />
        </div>
        <BrawlerHud state={shown} side={1} brawler={brawlers[1]} teams={teams} color={colors[1]} />
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

      {picking === 'gate' && !busy && <GatePicker gates={battle.sides[0].gates} onPick={(i) => gateSet(battle, i)} />}
      {picking === 'throw' && !busy && <ThrowPicker state={battle} teams={teams} onPick={(i) => pickThrow(battle, i)} />}

      {/* the player's moves: the cards in hand, the Gate Card and ATTACK */}
      {controls && battle.phase === 'battle' && duel && (
        <MoveBar
          state={battle}
          myTurn={myTurn}
          color={ELEMENT_BY_ID[duel.fighters[0].bakugan.element].color}
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
        {clash && <ClashView key={clash.key} clash={clash} colors={colors} brawlerNames={[nameOf(0), nameOf(1)]} />}
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

// ---------------------------------------------------------------- announcer lines

/** What an effect is called on screen: an ability card's name or the Gate Card's. */
function effectName(e: Effect, s: BattleState) {
  return e.kind === 'gate' ? `the Gate Card (${s.duel?.gate?.card.name ?? ''})` : (e.card?.ability.name ?? 'the card')
}

/** The announcer on a card, whoever plays it. */
function cardLine(step: Step, card: Card, bakugan: string, foeBakugan: string, brawler: string, foeBrawler: string) {
  const a = card.ability
  const d = step.state.duel!
  const side = step.event!.actor
  const foe = other(side)
  const e = step.effect!
  switch (a.type) {
    case 'boost':
      return `${brawler} activates ${a.name}! ${bakugan} powers up to ${powerOf(d, side)} G!`
    case 'attack':
      return `${bakugan} strikes with ${a.name}! ${foeBakugan} drops to ${powerOf(d, foe)} G!`
    case 'weaken':
      return `${brawler} activates ${a.name}! ${foeBakugan} is weakened to ${powerOf(d, foe)} G!`
    case 'drain':
      return `${a.name}! ${bakugan} steals ${e.delta[side]} G from ${foeBakugan}!`
    case 'shield':
      return step.cancelled
        ? `${brawler} activates ${a.name}! ${foeBrawler}'s ${effectName(step.cancelled, step.state)} is nullified!`
        : `${brawler} activates ${a.name}!`
    case 'finisher':
      return `${bakugan} unleashes ${a.name}! ${foeBakugan} is wiped out!`
  }
}

/** The announcer on an opened Gate Card. */
function gateOutcome(s: BattleState, e: Effect) {
  const d = s.duel!
  const parts = ([0, 1] as const)
    .filter((i) => e.delta[i])
    .map((i) => `${d.fighters[i].name} ${e.delta[i] > 0 ? 'rises' : 'drops'} to ${powerOf(d, i)} G`)
  return parts.length ? `${parts.join(', ')}!` : 'But nothing happens!'
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

/** The player's moves in battle: each card in hand, opening the Gate Card, and ATTACK. */
function MoveBar({
  state,
  myTurn,
  color,
  onMove,
}: {
  state: BattleState
  myTurn: boolean
  color: string
  onMove: (move: Move) => void
}) {
  const d = state.duel!
  const left = playsLeft(d, 0)
  const answering = d.attacked[1] && !d.attacked[0]
  const gate = d.gate?.owner === 0 && !d.gate.open ? d.gate.card : null
  const mustAttack = !d.attacked[0] && left === 0
  const owner = d.fighters[0]
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
          />
        )
      })}
      {gate && (
        <GateButton
          gate={gate}
          preview={gateDelta(d, gate, 0)}
          disabled={!myTurn || !canOpenGate(d, 0)}
          lock={d.attacked[1] ? 'Too late: they attacked' : left === 0 ? 'No moves left' : undefined}
          onClick={() => onMove({ kind: 'gate' })}
        />
      )}
      <div className="flex w-44 shrink-0 flex-col items-stretch gap-2 self-center">
        <p className="font-display text-center text-[10px] tracking-[0.3em] text-white/60">
          {d.attacked[0]
            ? 'YOU HAVE ATTACKED'
            : answering
              ? left
                ? 'LAST MOVE · THEN STRIKE BACK'
                : 'STRIKE BACK!'
              : `MOVES ${d.plays[0]}/${d.limit[0]}`}
        </p>
        <motion.button
          disabled={!myTurn || d.attacked[0]}
          onClick={() => onMove({ kind: 'attack' })}
          whileHover={myTurn ? { scale: 1.05 } : undefined}
          whileTap={myTurn ? { scale: 0.95 } : undefined}
          animate={
            myTurn && mustAttack ? { boxShadow: [`0 0 10px ${color}`, `0 0 34px ${color}`, `0 0 10px ${color}`] } : undefined
          }
          transition={myTurn && mustAttack ? { repeat: Infinity, duration: 1 } : undefined}
          className="font-display rounded-lg border-2 border-[#ff6a4a] bg-[#ff3b2f]/20 py-4 text-xl font-black tracking-[0.25em] backdrop-blur transition disabled:opacity-35"
          style={{ boxShadow: myTurn ? `0 0 22px ${color}88` : 'none' }}
        >
          ATTACK!
          <span className="mt-1 block text-[10px] font-normal tracking-[0.2em] text-white/70">
            −{strikeOf(d, 0)}G · ENDS YOUR PART
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
  disabled,
  lock,
  onClick,
}: {
  gate: GateCard
  /** What opening it would do right now (G for the player, for the opponent). */
  preview: [number, number]
  disabled: boolean
  lock?: string
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
        <span className="mt-1 line-clamp-1 text-xs leading-snug text-white/55 [@media(min-height:720px)]:line-clamp-3">
          {gate.text}
        </span>
        {lock && disabled && (
          <span className="font-display absolute inset-x-0 bottom-2 px-2 text-center text-[10px] leading-tight tracking-widest text-white/80">
            {lock.toUpperCase()}
          </span>
        )}
      </motion.button>
      <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-4 w-64 -translate-x-1/2 rounded-lg border border-[#ffc94a]/70 bg-black/90 p-4 opacity-0 shadow-2xl backdrop-blur transition group-hover:opacity-100">
        <p className="font-display text-[11px] font-bold tracking-wider text-[#ffc94a]">YOUR GATE CARD · FACE-DOWN</p>
        <p className="font-display mt-1 text-base font-bold">{gate.name}</p>
        <p className="mt-2 text-sm leading-snug text-white/80">{gate.text}</p>
        <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-snug text-white/60">
          Opening it takes a move. Your opponent gets a move to answer it and may nullify it.
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
          <p className="font-display mt-1 text-sm tracking-[0.3em] text-white/70">
            {clash.finisher
              ? 'WON OUTRIGHT BY ITS FINISHER'
              : tie
                ? 'A TIE: IT WAS THROWN FIRST'
                : `BY ${Math.abs(clash.power[0] - clash.power[1])} G`}
          </p>
        </motion.div>
      )}
      {clash.step >= 2 && (
        <motion.p
          className="font-display mt-2 text-xl font-black tracking-widest text-[#ff5a4f]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {brawlerNames[loser].toUpperCase()} LOSES A LIFE ·{' '}
          {clash.livesLeft === 0 ? 'DEFEATED!' : clash.livesLeft === 1 ? 'MATCH POINT!' : `${clash.livesLeft} LEFT`}
        </motion.p>
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
