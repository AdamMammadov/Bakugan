import { abilitiesOf, formBrawlG, formOf, type Ability, type Bakugan, type Entrant } from '../data/bakugan'
import type { ElementId } from '../data/elements'
import type { GateCard } from '../data/gates'
import { released } from '../season/release'

/**
 * Bakugan brawl as in the Battle Brawlers anime (season 1).
 *
 * Match: each brawler has LIVES lives (the balls at the top of the screen; an event may set others). A match is a series of battles, one
 * Bakugan against one; the loser of a battle loses a life and a brawler out of lives is defeated. A beaten Bakugan
 * goes back to its brawler and can be thrown again, so teams of 1, 2 or 3 all work.
 *
 * Battle (a pure 1v1 `Duel`, so a tag match can be built from duels later):
 * - Gate Card: one brawler sets a Gate Card from their gate deck, face-down (they take turns; a coin toss decides
 *   who sets the first). It stays on the field for the whole battle and is spent afterwards. It does nothing until
 *   its owner opens it on one of their turns ("Gate Card, open!").
 * - Throw: the setter throws first, the other brawler answers with a Bakugan of their own. The Bakugan thrown first
 *   wins a tie.
 * - Turns: the brawler who did not set the gate moves first, then they alternate. A turn is one move: play an
 *   ability card, open your Gate Card, or ATTACK. A side makes at most PLAYS card or gate moves, then must attack.
 * - Attack: the Bakugan strikes (the opponent loses STRIKE of the attacker's G-Power) and the attacker's part in
 *   the battle is over. The opponent may answer with one more move, then must strike back.
 * - Nullify cards cancel the opponent's last ability card or their opened Gate Card (its G change is undone).
 * - When both have attacked, the higher G-Power wins the battle.
 */

export const LIVES = 3
export const TEAM_SIZE = 3
/** Cards drawn each battle from the thrown Bakugan's own deck. */
export const HAND_SIZE = 4
/** Card plays and gate opens a side may make in one battle before it must attack. */
export const PLAYS = 3
/** An attack takes this share of the attacker's G-Power from the opponent (rounded to 10). */
export const STRIKE = 0.3
/** Other ability cards a Bakugan must play in the battle before its finisher (it gathers its power first). */
export const FINISHER_CHARGE = 2

export type SideIndex = 0 | 1
export const other = (side: SideIndex): SideIndex => (side === 0 ? 1 : 0)
const SIDES: SideIndex[] = [0, 1]

export interface Fighter {
  bakugan: Bakugan
  form: number
  name: string
  /** G-Power on a Gate Card, before cards and the gate. */
  g: number
}

export interface Card {
  /** Unique per copy in a deck. */
  uid: string
  ability: Ability
  /** Bakugan id the card belongs to. */
  owner: string
}

/** The Gate Card on the field: face-down until its owner opens it. */
export interface FieldGate {
  card: GateCard
  owner: SideIndex
  open: boolean
  nullified: boolean
}

/** Something that moved G-Power in a battle: an ability card, the opened Gate Card or a strike. */
export interface Effect {
  id: string
  side: SideIndex
  kind: 'ability' | 'gate' | 'strike'
  card?: Card
  /** G-Power change for side 0 and side 1. */
  delta: [number, number]
  nullified: boolean
  /** A nullify card: the effect it cancelled. */
  cancels?: string
}

/** One battle: one Bakugan against one on a Gate Card. Knows nothing of lives or teams. */
export interface Duel {
  fighters: [Fighter, Fighter]
  hands: [Card[], Card[]]
  gate: FieldGate | null
  effects: Effect[]
  attacked: [boolean, boolean]
  /** Card plays and gate opens made. */
  plays: [number, number]
  /** Most plays allowed: PLAYS, or one more once the opponent has attacked. */
  limit: [number, number]
  /** Ability cards played (a finisher needs FINISHER_CHARGE of them first). */
  cards: [number, number]
  /** Side to move. */
  turn: SideIndex
  /** Thrown first (the gate setter's Bakugan): it wins a tie. */
  first: SideIndex
  /** Battles each brawler lost before this one (Grand Spirit). */
  lost: [number, number]
  /** Moves made in this battle. */
  moves: number
  /** Both struck, or a finisher won it. */
  done: boolean
  winner: SideIndex | null
  /** Won outright by a finisher. */
  finisher: boolean
}

export interface Side {
  team: Fighter[]
  /** Each team member's own ability cards (same order as `team`). */
  decks: Card[][]
  /** Gate Cards not set yet; one is spent each time this side sets one. */
  gates: GateCard[]
  /** The whole gate deck: once every card is spent, the deck comes back. */
  gateDeck: GateCard[]
  lives: number
  /** Lives at the start of the match (LIVES, unless an event says otherwise). */
  maxLives: number
  /** Team member on the field (this battle's, or the last one's until the next throw). */
  active: number
  wins: number
}

/**
 * set: the setter picks a Gate Card · throw: the setter, then the other side, picks a Bakugan · battle: turns ·
 * clash: both have struck, the battle is decided · result: a life is lost, the next battle comes · over: match won
 */
export type Phase = 'set' | 'throw' | 'battle' | 'clash' | 'result' | 'over'

export interface BattleResult {
  battle: number
  winner: SideIndex
  /** Both G-Powers at the end. */
  power: [number, number]
  /** Team member each side threw. */
  thrown: [number, number]
  setter: SideIndex
  gate: GateCard | null
  /** Its owner opened the Gate Card (and nobody nullified it). */
  gateUsed: boolean
  finisher: boolean
  moves: number
}

/** A whole match. */
export interface BattleState {
  sides: [Side, Side]
  phase: Phase
  /** Battle number, from 1. */
  battle: number
  /** Turn counter over the whole match (moves made), shown as "05T". */
  turn: number
  /** Coin toss: who set the first Gate Card. */
  first: SideIndex
  /** Who sets this battle's Gate Card. */
  setter: SideIndex
  /** This battle's Gate Card, set before the Bakugan are thrown. */
  gate: GateCard | null
  /** Team member each side has thrown this battle. */
  thrown: [number | null, number | null]
  duel: Duel | null
  winner: SideIndex | null
  log: string[]
  results: BattleResult[]
}

/** What a Bakugan does on the field (drives the arena animation): `basic` is a strike. */
export type Action = { kind: 'basic' } | { kind: 'ability'; card: Card } | { kind: 'switch'; to: number }

/** A move in battle. A nullify card may name the effect it cancels (the best one when left out). */
export type Move = { kind: 'ability'; card: Card; target?: string } | { kind: 'gate' } | { kind: 'attack' }

/** What happened in one card play, strike or battle result; drives the arena animation. */
export interface BattleEvent {
  actor: SideIndex
  target: SideIndex
  action: Action
  /** G the target lost (a hit flinches it). */
  damage: number
  heal: number
  actorG: number
  targetG: number
  blocked: boolean
  /** The target's brawler is out of lives. */
  ko: boolean
  /** Index of a Bakugan that came onto the field (not used by battles). */
  enters?: { side: SideIndex; index: number }
  /** A battle's result: both sides' G-Power. */
  clash?: { power: [number, number]; diff: number }
}

/** What a move did, for the screen: the scene event (none for a gate opening) and the effect it made. */
export interface Step {
  state: BattleState
  event: BattleEvent | null
  effect: Effect | null
  /** The effect a nullify card cancelled. */
  cancelled: Effect | null
}

// ---------------------------------------------------------------- setup

let uid = 0
function shuffle<T>(items: T[], rng: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const round10 = (n: number) => Math.round(n / 10) * 10

export function makeSide(team: Entrant[], gates: GateCard[], lives = LIVES): Side {
  return {
    team: team.map((e) => ({ bakugan: e.bakugan, form: e.form, name: formOf(e).name, g: formBrawlG(e) + (e.bonusG ?? 0) })),
    decks: team.map((e) =>
      abilitiesOf(e.bakugan, e.form)
        .filter((a) => !e.cards || e.cards.includes(a.id))
        .map((ability) => ({ uid: `c${uid++}`, ability, owner: e.bakugan.id })),
    ),
    gates: [...gates],
    gateDeck: [...gates],
    lives,
    maxLives: lives,
    active: 0,
    wins: 0,
  }
}

/** A new match; `first` won the coin toss and sets the first Gate Card. `lives` per side, LIVES each by default. */
export function startBattle(
  left: Entrant[],
  right: Entrant[],
  gates: [GateCard[], GateCard[]],
  first: SideIndex = 0,
  lives: [number, number] = [LIVES, LIVES],
): BattleState {
  return {
    sides: [makeSide(left, gates[0], lives[0]), makeSide(right, gates[1], lives[1])],
    phase: 'set',
    battle: 1,
    turn: 0,
    first,
    setter: first,
    gate: null,
    thrown: [null, null],
    duel: null,
    winner: null,
    log: [],
    results: [],
  }
}

/** A new battle between two Bakugan (pure: no lives or teams). `first` set the gate and threw first. */
export function startDuel(
  fighters: [Fighter, Fighter],
  hands: [Card[], Card[]],
  gate: { card: GateCard; owner: SideIndex } | null,
  first: SideIndex,
  lost: [number, number] = [0, 0],
): Duel {
  return {
    fighters,
    hands,
    gate: gate ? { ...gate, open: false, nullified: false } : null,
    effects: [],
    attacked: [false, false],
    plays: [0, 0],
    limit: [PLAYS, PLAYS],
    cards: [0, 0],
    // the brawler who did not set the gate moves first
    turn: other(first),
    first,
    lost,
    moves: 0,
    done: false,
    winner: null,
    finisher: false,
  }
}

function cloneDuel(d: Duel): Duel {
  return {
    ...d,
    hands: [[...d.hands[0]], [...d.hands[1]]],
    gate: d.gate ? { ...d.gate } : null,
    effects: d.effects.map((e) => ({ ...e })),
    attacked: [...d.attacked],
    plays: [...d.plays],
    limit: [...d.limit],
    cards: [...d.cards],
  }
}

function clone(state: BattleState): BattleState {
  return {
    ...state,
    sides: state.sides.map((s) => ({ ...s, gates: [...s.gates] })) as [Side, Side],
    thrown: [...state.thrown],
    duel: state.duel ? cloneDuel(state.duel) : null,
    log: [...state.log],
    results: [...state.results],
  }
}

// ---------------------------------------------------------------- queries

export const activeOf = (side: Side) => side.team[side.active]

/** The Gate Cards a side can set now: those not spent yet, or the whole deck again once all are. */
export const gatesLeft = (side: Side) => (side.gates.length ? side.gates : side.gateDeck)

/** A side's G-Power in the battle: its Bakugan's own plus every effect still standing. */
export function powerOf(d: Duel, side: SideIndex) {
  let g = d.fighters[side].g
  for (const e of d.effects) if (!e.nullified) g += e.delta[side]
  return Math.max(0, g)
}

/** G the side's attack takes from the opponent right now. */
export const strikeOf = (d: Duel, side: SideIndex) => Math.min(round10(powerOf(d, side) * STRIKE), powerOf(d, other(side)))

export const playsLeft = (d: Duel, side: SideIndex) => (d.attacked[side] ? 0 : Math.max(0, d.limit[side] - d.plays[side]))

/** How many of the cards a finisher waits for its side has played this battle. */
export const chargeOf = (d: Duel, side: SideIndex) => d.cards[side]

/** Effects of the opponent a nullify card can cancel: their last ability card and their opened Gate Card. */
export function nullifyTargets(d: Duel, side: SideIndex): Effect[] {
  const foe = other(side)
  const live = d.effects.filter((e) => e.side === foe && !e.nullified)
  const card = [...live].reverse().find((e) => e.kind === 'ability' && !e.cancels && e.card?.ability.type !== 'finisher')
  const gate = live.find((e) => e.kind === 'gate')
  return [card, gate].filter((e): e is Effect => !!e)
}

/** Why a card cannot be played now (null when it can). */
export function cardLock(d: Duel, side: SideIndex, card: Card): string | null {
  if (d.done || d.attacked[side]) return 'Attacked'
  if (playsLeft(d, side) <= 0) return 'Attack now!'
  if (card.ability.type === 'shield' && !nullifyTargets(d, side).length) return 'Nothing to nullify'
  if (card.ability.type === 'finisher' && chargeOf(d, side) < FINISHER_CHARGE) {
    const n = FINISHER_CHARGE - chargeOf(d, side)
    return `Charging: play ${n} more card${n === 1 ? '' : 's'}`
  }
  return null
}

export const canPlay = (d: Duel, side: SideIndex, card: Card) => cardLock(d, side, card) === null

/** The side can open its face-down Gate Card now: not once the opponent has struck (it could not answer any more). */
export const canOpenGate = (d: Duel, side: SideIndex) =>
  !d.done && !!d.gate && d.gate.owner === side && !d.gate.open && playsLeft(d, side) > 0 && !d.attacked[other(side)]

/** G change opening the gate would make now (side 0, side 1). */
export function gateDelta(d: Duel, gate: GateCard, owner: SideIndex): [number, number] {
  const delta: [number, number] = [0, 0]
  const foe = other(owner)
  const p = (s: SideIndex) => powerOf(d, s)
  if (gate.kind === 'attribute') {
    for (const s of SIDES) if (d.fighters[s].bakugan.element === gate.element) delta[s] = gate.amount
  } else if (gate.kind === 'character') {
    for (const s of SIDES) if (d.fighters[s].bakugan.id === gate.bakugan) delta[s] = round10(d.fighters[s].g / 2)
  } else
    switch (gate.command) {
      case 'level-down':
      case 'trade-off':
        if (p(foe) >= (gate.threshold ?? 0)) delta[foe] = -Math.min(gate.amount, p(foe))
        break
      case 'energy-merge': {
        const x = Math.min(gate.amount, p(foe))
        delta[foe] = -x
        delta[owner] = x
        break
      }
      case 'super-pyrus': {
        const x = p(foe) - p(owner)
        if (x > 0 && x <= gate.amount) {
          delta[owner] = x
          delta[foe] = -x
        }
        break
      }
      case 'positive-delta': {
        const hit: ElementId[] = ['pyrus', 'aquos', 'haos']
        const s = hit.includes(d.fighters[foe].bakugan.element) ? foe : owner
        delta[s] = -Math.min(gate.amount, p(s))
        break
      }
      case 'reloaded': {
        // every G the opponent's cards and strikes took from it
        let lost = 0
        for (const e of d.effects) if (!e.nullified && e.side === foe && e.delta[owner] < 0) lost -= e.delta[owner]
        delta[owner] = lost + gate.amount
        break
      }
      case 'grand-spirit':
        delta[owner] = gate.amount * d.lost[owner]
        break
    }
  return delta
}

/** The battle's winner once both have struck: the higher G-Power, a tie to the Bakugan thrown first. */
export function leaderOf(d: Duel): SideIndex {
  const a = powerOf(d, 0)
  const b = powerOf(d, 1)
  return a === b ? d.first : a > b ? 0 : 1
}

// ---------------------------------------------------------------- battle moves

/** Every move the side to move can make (a nullify once per target it could cancel). */
export function duelMoves(d: Duel): Move[] {
  if (d.done) return []
  const side = d.turn
  const moves: Move[] = [{ kind: 'attack' }]
  if (canOpenGate(d, side)) moves.push({ kind: 'gate' })
  const seen = new Set<string>()
  for (const card of d.hands[side]) {
    if (!canPlay(d, side, card)) continue
    // the same card twice in hand: one option is enough
    const key = card.ability.id
    if (seen.has(key)) continue
    seen.add(key)
    if (card.ability.type === 'shield')
      for (const t of nullifyTargets(d, side)) moves.push({ kind: 'ability', card, target: t.id })
    else moves.push({ kind: 'ability', card })
  }
  return moves
}

/** How much a cancelled effect was worth to `side` (G in its favour once it is undone). */
const cancelGain = (e: Effect, side: SideIndex) => e.delta[other(side)] - e.delta[side]

/** One move in a duel (pure). */
export function duelStep(
  prev: Duel,
  move: Move,
): { duel: Duel; event: BattleEvent | null; effect: Effect | null; cancelled: Effect | null } {
  const d = cloneDuel(prev)
  const actor = d.turn
  const target = other(actor)
  const event: BattleEvent = {
    actor,
    target,
    action: { kind: 'basic' },
    damage: 0,
    heal: 0,
    actorG: 0,
    targetG: 0,
    blocked: false,
    ko: false,
  }
  let effect: Effect | null = null
  let cancelled: Effect | null = null
  let scene = true
  const delta = (mine: number, theirs: number): [number, number] => (actor === 0 ? [mine, theirs] : [theirs, mine])

  if (move.kind === 'attack') {
    const x = strikeOf(d, actor)
    effect = { id: `s${d.moves}-${actor}`, side: actor, kind: 'strike', delta: delta(0, -x), nullified: false }
    d.attacked[actor] = true
    // the opponent may answer with one more move before it strikes back
    d.limit[target] = Math.min(d.limit[target], d.plays[target] + 1)
    event.damage = x
    event.targetG = -x
  } else if (move.kind === 'gate') {
    const gate = d.gate!
    gate.open = true
    effect = { id: 'gate', side: actor, kind: 'gate', delta: gateDelta(d, gate.card, actor), nullified: false }
    d.plays[actor]++
    // the opponent always gets a move to answer an opened Gate Card (to nullify it, if it has the power)
    d.limit[target] = Math.max(d.limit[target], d.plays[target] + 1)
    scene = false
  } else {
    const card = move.card
    const a = card.ability
    d.hands[actor] = d.hands[actor].filter((c) => c.uid !== card.uid)
    d.plays[actor]++
    if (a.type !== 'finisher') d.cards[actor]++
    event.action = { kind: 'ability', card }
    const foeG = powerOf(d, target)
    effect = { id: card.uid, side: actor, kind: 'ability', card, delta: [0, 0], nullified: false }
    switch (a.type) {
      case 'boost':
        effect.delta = delta(a.amount, 0)
        break
      case 'attack':
      case 'weaken':
        effect.delta = delta(0, -Math.min(a.amount, foeG))
        break
      case 'drain': {
        const x = Math.min(a.amount, foeG)
        effect.delta = delta(x, -x)
        break
      }
      case 'shield': {
        const targets = nullifyTargets(d, actor)
        const t =
          targets.find((e) => e.id === move.target) ?? [...targets].sort((x, y) => cancelGain(y, actor) - cancelGain(x, actor))[0]
        if (t) {
          t.nullified = true
          if (t.kind === 'gate' && d.gate) d.gate.nullified = true
          effect.cancels = t.id
          cancelled = t
        }
        break
      }
      case 'finisher':
        d.done = true
        d.winner = actor
        d.finisher = true
        event.ko = true
        break
    }
    const mine = effect.delta[actor] + (cancelled ? -cancelled.delta[actor] : 0)
    const theirs = effect.delta[target] + (cancelled ? -cancelled.delta[target] : 0)
    event.actorG = mine
    event.targetG = theirs
    event.damage = Math.max(0, -theirs)
  }
  if (effect) d.effects.push(effect)
  d.moves++

  if (!d.done && d.attacked[0] && d.attacked[1]) {
    d.done = true
    d.winner = leaderOf(d)
  }
  // the turn passes, unless the opponent has already struck: then this side moves until it strikes back
  if (!d.done) d.turn = d.attacked[target] ? actor : target
  return { duel: d, event: scene ? event : null, effect, cancelled }
}

// ---------------------------------------------------------------- match flow

const nameOf = (state: BattleState, side: SideIndex) => {
  const d = state.duel
  return d ? d.fighters[side].name : activeOf(state.sides[side]).name
}

/** The setter sets one of its Gate Cards face-down (index into its gates). */
export function setGate(prev: BattleState, index: number): BattleState {
  const state = clone(prev)
  const side = state.sides[state.setter]
  // every card of the deck spent (a long match): the deck comes back
  if (!side.gates.length) side.gates = [...side.gateDeck]
  const i = Math.min(Math.max(index, 0), side.gates.length - 1)
  state.gate = side.gates.length ? side.gates.splice(i, 1)[0] : null
  state.phase = 'throw'
  state.log.push(`Battle ${state.battle}: Gate Card set.`)
  return state
}

/** The side that throws next: the setter first, then the other side; null once both have thrown. */
export function throwerOf(state: BattleState): SideIndex | null {
  if (state.phase !== 'throw') return null
  if (state.thrown[state.setter] === null) return state.setter
  const o = other(state.setter)
  return state.thrown[o] === null ? o : null
}

/** A side throws a team member onto the Gate Card; once both have, each draws a hand and the battle begins. */
export function throwBakugan(prev: BattleState, side: SideIndex, index: number, rng: () => number = Math.random): BattleState {
  const state = clone(prev)
  const s = state.sides[side]
  state.thrown[side] = Math.min(Math.max(index, 0), s.team.length - 1)
  if (state.thrown[0] === null || state.thrown[1] === null) return state
  const picks = state.thrown as [number, number]
  state.sides.forEach((x, i) => (x.active = picks[i]))
  const hands = picks.map((p, i) => shuffle(state.sides[i].decks[p], rng).slice(0, HAND_SIZE)) as [Card[], Card[]]
  state.duel = startDuel(
    [activeOf(state.sides[0]), activeOf(state.sides[1])],
    hands,
    state.gate ? { card: state.gate, owner: state.setter } : null,
    state.setter,
    [state.sides[0].maxLives - state.sides[0].lives, state.sides[1].maxLives - state.sides[1].lives],
  )
  state.phase = 'battle'
  state.log.push(`${nameOf(state, state.setter)} vs ${nameOf(state, other(state.setter))}!`)
  return state
}

function describe(state: BattleState, side: SideIndex, effect: Effect | null, cancelled: Effect | null): string {
  const name = nameOf(state, side)
  const foe = nameOf(state, other(side))
  if (!effect) return ''
  const mine = effect.delta[side]
  const theirs = effect.delta[other(side)]
  const g = (n: number) => `${n > 0 ? '+' : ''}${n}G`
  if (effect.kind === 'strike') return `${name} attacks: ${foe} ${g(theirs)}.`
  if (effect.kind === 'gate') {
    const parts = [mine && `${name} ${g(mine)}`, theirs && `${foe} ${g(theirs)}`].filter(Boolean)
    return `Gate Card open: ${state.duel?.gate?.card.name}! ${parts.join(', ') || 'No effect.'}`
  }
  const a = effect.card!.ability
  if (a.type === 'shield')
    return cancelled
      ? `${name} uses ${a.name}: ${cancelled.kind === 'gate' ? 'the Gate Card' : cancelled.card?.ability.name} is nullified!`
      : `${name} uses ${a.name}.`
  if (a.type === 'finisher') return `${name} unleashes ${a.name}! ${foe} is defeated!`
  const parts = [mine && `${g(mine)}`, theirs && `${foe} ${g(theirs)}`].filter(Boolean)
  return `${name} uses ${a.name}: ${parts.join(', ')}.`
}

/** One move of the side to move in the battle. */
export function act(prev: BattleState, move: Move): Step {
  const state = clone(prev)
  const side = state.duel!.turn
  const r = duelStep(state.duel!, move)
  state.duel = r.duel
  state.turn++
  state.log.push(describe(state, side, r.effect, r.cancelled))
  if (r.duel.done) state.phase = 'clash'
  return { state, event: r.event, effect: r.effect, cancelled: r.cancelled }
}

/**
 * The battle is decided: the loser's brawler loses a life. `event` is the winner's final blow (the scene shows it and
 * the loser falls).
 */
export function resolveBattle(prev: BattleState): { state: BattleState; event: BattleEvent; result: BattleResult } {
  const state = clone(prev)
  const d = state.duel!
  const winner = d.winner ?? leaderOf(d)
  const loser = other(winner)
  const power: [number, number] = [powerOf(d, 0), powerOf(d, 1)]
  state.sides[loser].lives = Math.max(0, state.sides[loser].lives - 1)
  state.sides[winner].wins++
  const result: BattleResult = {
    battle: state.battle,
    winner,
    power,
    thrown: [state.sides[0].active, state.sides[1].active],
    setter: state.setter,
    gate: state.gate,
    gateUsed: !!d.gate?.open && !d.gate.nullified,
    finisher: d.finisher,
    moves: d.moves,
  }
  state.results.push(result)
  const ko = state.sides[loser].lives === 0
  if (ko) state.winner = winner
  state.phase = ko ? 'over' : 'result'
  state.log.push(
    d.finisher
      ? `${nameOf(state, winner)} wins the battle outright!`
      : `${nameOf(state, winner)} wins the battle, ${power[winner]}G to ${power[loser]}G.`,
  )
  const event: BattleEvent = {
    actor: winner,
    target: loser,
    action: { kind: 'basic' },
    damage: 1,
    heal: 0,
    actorG: 0,
    targetG: 0,
    blocked: false,
    ko,
    clash: { power, diff: Math.abs(power[0] - power[1]) },
  }
  return { state, event, result }
}

/** The next battle: the other brawler sets a Gate Card, the Bakugan go back to their balls. */
export function nextBattle(prev: BattleState): BattleState {
  const state = clone(prev)
  state.battle += 1
  state.setter = other(state.setter)
  state.gate = null
  state.thrown = [null, null]
  state.duel = null
  state.phase = 'set'
  return state
}

// ---------------------------------------------------------------- AI

export interface AiLevel {
  /** Random wobble (in G) added to each option's value; lower plays sharper. */
  noise: number
  /** Moves searched ahead (1 = only its own move). */
  depth: number
  /** Extra G for the bot's Bakugan, as a share of the player's (0.05 = +5%). */
  edge?: number
}

export const AI_EASY: AiLevel = { noise: 80, depth: 1 }

/**
 * Bots get sharper and a little stronger as the player climbs the ranks (index = tier, 0 = Rookie).
 * Tuned by simulation so a Rookie wins a bit over half of their brawls and higher ranks take real skill.
 */
const BOT_LEVELS: AiLevel[] = [
  { noise: 90, depth: 1, edge: 0 },
  { noise: 60, depth: 2, edge: 0.01 },
  { noise: 40, depth: 2, edge: 0.02 },
  { noise: 25, depth: 3, edge: 0.03 },
  { noise: 12, depth: 3, edge: 0.045 },
  { noise: 0, depth: 4, edge: 0.06 },
]
export const aiForTier = (tier: number): AiLevel => BOT_LEVELS[Math.min(Math.max(tier, 0), BOT_LEVELS.length - 1)]

/** What a face-down Gate Card of the opponent is guessed to be worth to its owner. */
const HIDDEN_GATE_G = 150

/** The duel as `me` sees it: the opponent's face-down Gate Card is a guess, not the real card. */
function seenBy(d: Duel, me: SideIndex): Duel {
  if (!d.gate || d.gate.owner === me || d.gate.open) return d
  const owner = d.fighters[d.gate.owner].bakugan.element
  const guess: GateCard = { id: 'hidden', kind: 'attribute', name: '?', element: owner, amount: HIDDEN_GATE_G, text: '' }
  return { ...d, gate: { ...d.gate, card: guess } }
}

/** G swing in the side's favour a card would make now (a rough value for the AI). */
function cardSwing(d: Duel, side: SideIndex, card: Card): number {
  const a = card.ability
  const foeG = powerOf(d, other(side))
  switch (a.type) {
    case 'boost':
      return a.amount
    case 'attack':
    case 'weaken':
      return Math.min(a.amount, foeG)
    case 'drain':
      return 2 * Math.min(a.amount, foeG)
    case 'shield': {
      // worth what it can cancel now, or a fair guess at what the opponent will play
      const best = Math.max(0, ...nullifyTargets(d, side).map((e) => cancelGain(e, side)))
      return d.attacked[other(side)] ? best : Math.max(best, 90)
    }
    case 'finisher':
      return 3000
  }
}

/** G swing a side can still make with its moves left: its best cards and its gate (the foe may answer, so a share). */
function potential(d: Duel, side: SideIndex) {
  const n = playsLeft(d, side)
  if (!n) return 0
  const options = d.hands[side]
    .filter((c) => c.ability.type !== 'finisher' || chargeOf(d, side) + n - 1 >= FINISHER_CHARGE)
    .map((c) => cardSwing(d, side, c))
  if (d.gate && d.gate.owner === side && !d.gate.open) {
    const g = gateDelta(d, d.gate.card, side)
    options.push(Math.max(0, g[side] - g[other(side)]))
  }
  options.sort((a, b) => b - a)
  return options.slice(0, n).reduce((sum, v) => sum + v, 0) * 0.6
}

/** How good the battle looks for `me`, in G: a win or loss is worth far more than any lead. */
function evaluate(d: Duel, me: SideIndex): number {
  const foe = other(me)
  const diff = powerOf(d, me) - powerOf(d, foe)
  if (d.done) return (d.winner === me ? 2000 : -2000) + diff
  let est = diff + potential(d, me) - potential(d, foe)
  if (!d.attacked[me]) est += strikeOf(d, me)
  if (!d.attacked[foe]) est -= strikeOf(d, foe)
  return est + (d.first === me ? 5 : -5)
}

function search(d: Duel, me: SideIndex, depth: number): number {
  if (depth <= 0 || d.done) return evaluate(d, me)
  const values = duelMoves(d).map((m) => search(duelStep(d, m).duel, me, depth - 1))
  return d.turn === me ? Math.max(...values) : Math.min(...values)
}

/** The bot's move in a duel. */
export function chooseDuelMove(real: Duel, level: AiLevel = AI_EASY, rng: () => number = Math.random): Move {
  const me = real.turn
  const d = seenBy(real, me)
  const options = duelMoves(d).map((move) => ({
    move,
    v: search(duelStep(d, move).duel, me, level.depth - 1) + rng() * level.noise,
  }))
  options.sort((a, b) => b.v - a.v)
  return options[0]?.move ?? { kind: 'attack' }
}

/** The bot's move in the battle of a match. */
export const chooseAction = (state: BattleState, level: AiLevel = AI_EASY, rng: () => number = Math.random): Move =>
  chooseDuelMove(state.duel!, level, rng)

/** Rough G a team member brings: its own G plus its best cards. */
export function memberValue(s: Side, i: number) {
  const cards = s.decks[i]
    .map((c) => {
      const a = c.ability
      return a.type === 'drain' ? 2 * a.amount : a.type === 'shield' ? 90 : a.type === 'finisher' ? 300 : a.amount
    })
    .sort((a, b) => b - a)
    .slice(0, PLAYS)
  return s.team[i].g + cards.reduce((n, v) => n + v, 0) * 0.5
}

/** What a Gate Card is likely worth to its setter with a given Bakugan on it (the opponent is not known yet). */
function gateValue(gate: GateCard, f: Fighter, livesLost: number) {
  if (gate.kind === 'attribute') return f.bakugan.element === gate.element ? gate.amount : 0
  if (gate.kind === 'character') return f.bakugan.id === gate.bakugan ? f.g / 2 : 0
  switch (gate.command) {
    case 'level-down':
      return gate.amount * 0.9
    case 'energy-merge':
      return gate.amount * 2
    case 'super-pyrus':
      return 70
    case 'positive-delta':
      return gate.amount * 0.5
    case 'reloaded':
      return 120
    case 'grand-spirit':
      return gate.amount * livesLost * 0.9
    case 'trade-off':
      return gate.amount * 0.4
  }
}

/** The Gate Card the setter sets (index into its gates): the one that fits its team best. */
export function chooseGate(state: BattleState, level: AiLevel = AI_EASY, rng: () => number = Math.random) {
  const s = state.sides[state.setter]
  const lost = s.maxLives - s.lives
  const gates = gatesLeft(s)
  let best = 0
  let bestV = -Infinity
  gates.forEach((gate, gi) => {
    const v = Math.max(...s.team.map((f, i) => memberValue(s, i) + gateValue(gate, f, lost))) + rng() * level.noise
    if (v > bestV) {
      bestV = v
      best = gi
    }
  })
  return best
}

/** The team member a side throws: the strongest with its gate (when it is the setter's) and its cards. */
export function chooseThrow(state: BattleState, side: SideIndex, level: AiLevel = AI_EASY, rng: () => number = Math.random) {
  const s = state.sides[side]
  const lost = s.maxLives - s.lives
  const own = state.setter === side && state.gate
  const options = s.team.map((f, i) => ({
    i,
    v: memberValue(s, i) + (own ? gateValue(state.gate!, f, lost) : 0) + rng() * level.noise * 2,
  }))
  options.sort((a, b) => b.v - a.v)
  return options[0].i
}

/** A random team of different Bakugan. */
export function randomTeam(size = TEAM_SIZE, exclude: string[] = [], rng: () => number = Math.random): Entrant[] {
  const pool = shuffle(
    released().filter((b) => !exclude.includes(b.id)),
    rng,
  )
  const picks = (pool.length >= size ? pool : shuffle(released(), rng)).slice(0, size)
  return picks.map((bakugan) => ({ bakugan, form: Math.floor(rng() * Math.min(2, bakugan.evolutions.length)) }))
}

/** The highest G-Power on a Gate Card of any Bakugan players can get, at the given form (or its last). */
function strongest(form: number) {
  return Math.max(...released().map((bakugan) => formBrawlG({ bakugan, form: Math.min(form, bakugan.evolutions.length - 1) })))
}

/**
 * An opponent on the player's level: as many Bakugan as the player brings, any attribute,
 * the same forms and the same number of ability cards. Bakugan differ in base power, so
 * each opponent gets a G adjustment that puts it level with the player's Bakugan in that slot,
 * plus the bot's `edge` for the player's rank.
 */
export function matchedOpponent(player: Entrant[], rng: () => number = Math.random, edge = 0): Entrant[] {
  const mine = new Set(player.map((e) => e.bakugan.id))
  const others = released().filter((b) => !mine.has(b.id))
  const pool = shuffle(others.length >= player.length ? others : released(), rng)
  return player.map((slot, i): Entrant => {
    const bakugan = pool[i % pool.length]
    const form = Math.min(slot.form, bakugan.evolutions.length - 1)
    const cards = slot.cards?.length ?? abilitiesOf(slot.bakugan, slot.form).length
    const entrant: Entrant = {
      bakugan,
      form,
      cards: abilitiesOf(bakugan, form)
        .slice(0, cards)
        .map((a) => a.id),
    }
    // levelled to the player's Bakugan, but never past the strongest one players can get (the owner's own stay ahead)
    const level = Math.min(formBrawlG(slot) + (slot.bonusG ?? 0), strongest(slot.form))
    return { ...entrant, bonusG: level + Math.round(level * edge) - formBrawlG(entrant) }
  })
}
