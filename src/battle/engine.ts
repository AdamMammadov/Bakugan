import { abilitiesOf, formBrawlG, formOf, type Ability, type Bakugan, type Entrant } from '../data/bakugan'
import type { ElementId } from '../data/elements'
import type { GateCard } from '../data/gates'
import { released } from '../season/release'

/**
 * Bakugan brawl as in the Battle Brawlers anime (season 1).
 *
 * Match: each brawler has LIVES lives (the balls at the top of the screen; an event may set others). A match is a series of battles, one
 * Bakugan against one; the loser of a battle loses a life and a brawler out of lives is defeated. A beaten Bakugan
 * goes back to its brawler in ball form and can be thrown again, so teams of 1, 2 or 3 all work.
 *
 * Battle (one round, a pure 1v1 `Duel`, so a tag match can be built from duels):
 * - Gate Card: one brawler sets a Gate Card from their gate deck, face-down (they take turns; a coin toss decides
 *   who sets the first). It stays on the field for the battle and is spent afterwards.
 * - Throw: the setter throws first, then the other brawler answers with a Bakugan of their own. The Bakugan thrown
 *   first wins a tie. Each draws HAND_SIZE ability cards from its Bakugan's deck.
 * - Moves: each brawler has MOVES moves. They alternate, the Gate Card's owner first. A move is an ability card or a
 *   gate action; there is no passing. A brawler with no legal move skips their turn.
 * - Gate tug-of-war: the owner opens the Gate Card ("Gate Card, open!") and it works in their favour; the other brawler
 *   may close it (its effect is undone), then open it for themselves (it works in their favour); the owner may then
 *   close it again. Each brawler opens it at most once and closes it at most once; each action costs a move.
 * - Nullify cards cancel the opponent's last ability card (its G change is undone).
 * - Clash: once both brawlers have used their moves (or neither can move), the higher G-Power wins; a tie goes to the
 *   Bakugan thrown first. The battle ends sooner when a Bakugan drops to 0 G (it is defeated at once) or when a
 *   finisher is played (charged by FINISHER_CHARGE other ability cards in the battle).
 */

export const LIVES = 3
export const TEAM_SIZE = 3
/** Moves each brawler makes in a battle. */
export const MOVES = 3
/** Cards drawn each battle from the thrown Bakugan's own deck (one more than the moves: the brawler picks). */
export const HAND_SIZE = 4
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

/** The Gate Card on the field: face-down until its owner opens it, then pulled back and forth. */
export interface FieldGate {
  card: GateCard
  owner: SideIndex
  /** Open and working in this side's favour; null while face-down or closed. */
  openFor: SideIndex | null
  /** Each side has opened it (once each at most). */
  opened: [boolean, boolean]
  /** Each side has closed it (once each at most). */
  closed: [boolean, boolean]
}

/**
 * A gate action: open (the owner: "Gate Card, open!") · close (undo it while it works for the opponent) · take (open it
 * for yourself, after closing it).
 */
export type GateAction = 'open' | 'close' | 'take'

/** Something that moved G-Power in a battle: an ability card or the opened Gate Card. */
export interface Effect {
  id: string
  side: SideIndex
  kind: 'ability' | 'gate'
  card?: Card
  /** G-Power change for side 0 and side 1. */
  delta: [number, number]
  /** Cancelled: an ability card nullified, or the Gate Card closed (its G change is undone). */
  undone: boolean
  /** A nullify card: the effect it cancelled. */
  cancels?: string
}

/** Why a battle ended. ko: a Bakugan dropped to 0 G · finisher: won outright · clash: the moves were made, the higher G won. */
export type DuelEnd = 'ko' | 'finisher' | 'clash'

/** One battle: one Bakugan against one on a Gate Card. Knows nothing of lives or teams. */
export interface Duel {
  fighters: [Fighter, Fighter]
  hands: [Card[], Card[]]
  gate: FieldGate | null
  effects: Effect[]
  /** Ability cards played (a finisher needs FINISHER_CHARGE of them first). */
  cards: [number, number]
  /** Moves each side has left. */
  left: [number, number]
  /** Side to move. */
  turn: SideIndex
  /** Thrown first (the gate setter's Bakugan): it moves first and wins a tie. */
  first: SideIndex
  /** Battles each brawler lost before this one (Grand Spirit). */
  lost: [number, number]
  /** Moves made in this battle. */
  moves: number
  /** The battle is decided. */
  done: boolean
  winner: SideIndex | null
  /** Won outright by a finisher. */
  finisher: boolean
  /** Why it ended (null while it goes on). */
  end: DuelEnd | null
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
 * set: the setter picks a Gate Card · throw: the setter, then the other side, throws a Bakugan · battle: the moves ·
 * clash: the battle is decided · result: a life is lost, the next battle comes · over: match won
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
  /** The side the Gate Card was open for at the end (null: face-down or closed). */
  gateFor: SideIndex | null
  finisher: boolean
  /** How the battle was decided. */
  end: DuelEnd
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

/** What a Bakugan does on the field (drives the arena animation): `basic` is the winner's final blow. */
export type Action = { kind: 'basic' } | { kind: 'ability'; card: Card } | { kind: 'switch'; to: number }

/** A move in battle: an ability card, or the gate action the side can make now (see gateAction). */
export type Move = { kind: 'ability'; card: Card } | { kind: 'gate' }

/** What happened in one card play or battle result; drives the arena animation. */
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
  /** The target is beaten for good: knocked out, out of lives, or hit by a finisher. */
  ko: boolean
  /** Index of a Bakugan that came onto the field (not used by battles). */
  enters?: { side: SideIndex; index: number }
  /** A battle's result: both sides' G-Power. */
  clash?: { power: [number, number]; diff: number }
}

/** What a move did, for the screen: the scene event (none for a gate action), the effect it made and what it undid. */
export interface Step {
  state: BattleState
  event: BattleEvent | null
  effect: Effect | null
  /** The effect a nullify card cancelled, or the gate effect a close undid. */
  cancelled: Effect | null
  /** The gate action, when the move was one. */
  gate: GateAction | null
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

/** A new battle between two Bakugan (pure: no lives or teams). `first` set the gate, threw first and moves first. */
export function startDuel(
  fighters: [Fighter, Fighter],
  hands: [Card[], Card[]],
  gate: { card: GateCard; owner: SideIndex } | null,
  first: SideIndex,
  lost: [number, number] = [0, 0],
  moves = MOVES,
): Duel {
  const d: Duel = {
    fighters,
    hands,
    gate: gate ? { ...gate, openFor: null, opened: [false, false], closed: [false, false] } : null,
    effects: [],
    cards: [0, 0],
    left: [moves, moves],
    turn: first,
    first,
    lost,
    moves: 0,
    done: false,
    winner: null,
    finisher: false,
    end: null,
  }
  advance(d, first)
  return d
}

function cloneDuel(d: Duel): Duel {
  return {
    ...d,
    hands: [[...d.hands[0]], [...d.hands[1]]],
    gate: d.gate ? { ...d.gate, opened: [...d.gate.opened], closed: [...d.gate.closed] } : null,
    effects: d.effects.map((e) => ({ ...e })),
    cards: [...d.cards],
    left: [...d.left],
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
  for (const e of d.effects) if (!e.undone) g += e.delta[side]
  return Math.max(0, g)
}

/** Who is winning right now: the higher G-Power, a tie to the Bakugan thrown first. */
export function leaderOf(d: Duel): SideIndex {
  const a = powerOf(d, 0)
  const b = powerOf(d, 1)
  return a === b ? d.first : a > b ? 0 : 1
}

/** How far the side is ahead (negative: behind), in G. */
export const gapOf = (d: Duel, side: SideIndex) => powerOf(d, side) - powerOf(d, other(side))

/** How many of the cards a finisher waits for its side has played this battle. */
export const chargeOf = (d: Duel, side: SideIndex) => d.cards[side]

/** The opponent's ability card a nullify card would cancel: their last one still standing (none, or one). */
export function nullifyTargets(d: Duel, side: SideIndex): Effect[] {
  const foe = other(side)
  const card = [...d.effects]
    .reverse()
    .find((e) => e.side === foe && !e.undone && e.kind === 'ability' && !e.cancels && e.card?.ability.type !== 'finisher')
  return card ? [card] : []
}

/** Why a card cannot be played now (null when it can). */
export function cardLock(d: Duel, side: SideIndex, card: Card): string | null {
  if (d.done) return 'Battle over'
  if (card.ability.type === 'shield' && !nullifyTargets(d, side).length) return 'Nothing to nullify'
  if (card.ability.type === 'finisher' && chargeOf(d, side) < FINISHER_CHARGE) {
    const n = FINISHER_CHARGE - chargeOf(d, side)
    return `Charging: play ${n} more card${n === 1 ? '' : 's'}`
  }
  return null
}

export const canPlay = (d: Duel, side: SideIndex, card: Card) => cardLock(d, side, card) === null

/**
 * The gate action the side may make now, if any: the owner opens its face-down Gate Card; while it works for the
 * opponent the side may close it (once); having closed it, the side may open it for itself (once).
 */
export function gateAction(d: Duel, side: SideIndex): GateAction | null {
  const g = d.gate
  if (d.done || !g) return null
  if (g.openFor === null) {
    if (g.opened[side]) return null
    if (side === g.owner) return 'open'
    return g.closed[side] ? 'take' : null
  }
  return g.openFor !== side && !g.closed[side] ? 'close' : null
}

/** The side has a legal move now: an ability card it can play, or a gate action. */
export const canAct = (d: Duel, side: SideIndex) => gateAction(d, side) !== null || d.hands[side].some((c) => canPlay(d, side, c))

/** The gate effect standing now (open for someone), if any. */
export const gateEffectOf = (d: Duel) => d.effects.find((e) => e.kind === 'gate' && !e.undone) ?? null

/**
 * G change opening the gate would make now in `opener`'s favour (side 0, side 1). "You" on a card is whoever opens it.
 * - Attribute: the opener's Bakugan gains the amount, in full if it has the card's attribute, half otherwise.
 * - Character: the opener's Bakugan gains half its G-Power if it is the card's Bakugan (×1.5), a quarter otherwise.
 * - Command: the card's own rule, worked for the opener.
 */
export function gateDelta(d: Duel, gate: GateCard, opener: SideIndex): [number, number] {
  const delta: [number, number] = [0, 0]
  const foe = other(opener)
  const me = d.fighters[opener]
  const p = (s: SideIndex) => powerOf(d, s)
  if (gate.kind === 'attribute') delta[opener] = me.bakugan.element === gate.element ? gate.amount : gate.amount / 2
  else if (gate.kind === 'character') delta[opener] = round10(me.g / (me.bakugan.id === gate.bakugan ? 2 : 4))
  else
    switch (gate.command) {
      case 'level-down':
      case 'trade-off':
        if (p(foe) >= (gate.threshold ?? 0)) delta[foe] = -Math.min(gate.amount, p(foe))
        break
      case 'energy-merge': {
        const x = Math.min(gate.amount, p(foe))
        delta[foe] = -x
        delta[opener] = x
        break
      }
      case 'super-pyrus': {
        const x = p(foe) - p(opener)
        if (x > 0 && x <= gate.amount) {
          delta[opener] = x
          delta[foe] = -x
        }
        break
      }
      case 'positive-delta': {
        // in full against a Pyrus, Aquos or Haos opponent, half against any other
        const hit: ElementId[] = ['pyrus', 'aquos', 'haos']
        const x = hit.includes(d.fighters[foe].bakugan.element) ? gate.amount : gate.amount / 2
        delta[foe] = -Math.min(x, p(foe))
        break
      }
      case 'reloaded': {
        // every G the opponent's cards took from the opener
        let lost = 0
        for (const e of d.effects) if (!e.undone && e.side === foe && e.delta[opener] < 0) lost -= e.delta[opener]
        delta[opener] = lost + gate.amount
        break
      }
      case 'grand-spirit':
        delta[opener] = gate.amount * d.lost[opener]
        break
    }
  return delta
}

// ---------------------------------------------------------------- battle moves

/** Every move the side to move can make: each playable card (one per kind of card) and its gate action. */
export function duelMoves(d: Duel): Move[] {
  if (d.done) return []
  const side = d.turn
  const moves: Move[] = []
  if (gateAction(d, side)) moves.push({ kind: 'gate' })
  const seen = new Set<string>()
  for (const card of d.hands[side]) {
    if (!canPlay(d, side, card)) continue
    // the same card twice in hand: one option is enough
    const key = card.ability.id
    if (seen.has(key)) continue
    seen.add(key)
    moves.push({ kind: 'ability', card })
  }
  return moves
}

/** How much a cancelled effect was worth to `side` (G in its favour once it is undone). */
const cancelGain = (e: Effect, side: SideIndex) => e.delta[other(side)] - e.delta[side]

function finish(d: Duel, winner: SideIndex, end: DuelEnd) {
  d.done = true
  d.winner = winner
  d.end = end
  d.finisher = end === 'finisher'
}

/**
 * Whose move it is next: `next` if it has a move left and something to play, else the other side (a brawler with no
 * legal move skips their turn). When neither can move, the Bakugan clash: the higher G-Power wins.
 */
function advance(d: Duel, next: SideIndex) {
  if (d.done) return
  for (const s of [next, other(next)]) {
    if (d.left[s] > 0 && canAct(d, s)) {
      d.turn = s
      return
    }
  }
  d.turn = next
  finish(d, leaderOf(d), 'clash')
}

/** One move in a duel (pure). A move the side cannot make changes nothing. */
export function duelStep(
  prev: Duel,
  move: Move,
): { duel: Duel; event: BattleEvent | null; effect: Effect | null; cancelled: Effect | null; gate: GateAction | null } {
  const action = move.kind === 'gate' ? gateAction(prev, prev.turn) : null
  if (prev.done || (move.kind === 'gate' && !action) || (move.kind === 'ability' && !canPlay(prev, prev.turn, move.card)))
    return { duel: prev, event: null, effect: null, cancelled: null, gate: null }
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
  const delta = (mine: number, theirs: number): [number, number] => (actor === 0 ? [mine, theirs] : [theirs, mine])

  if (move.kind === 'gate') {
    const gate = d.gate!
    if (action === 'close') {
      cancelled = gateEffectOf(d)
      if (cancelled) cancelled.undone = true
      gate.closed[actor] = true
      gate.openFor = null
    } else {
      effect = { id: `gate-${actor}`, side: actor, kind: 'gate', delta: gateDelta(d, gate.card, actor), undone: false }
      gate.opened[actor] = true
      gate.openFor = actor
    }
  } else {
    const card = move.card
    const a = card.ability
    d.hands[actor] = d.hands[actor].filter((c) => c.uid !== card.uid)
    if (a.type !== 'finisher') d.cards[actor]++
    event.action = { kind: 'ability', card }
    const foeG = powerOf(d, target)
    effect = { id: card.uid, side: actor, kind: 'ability', card, delta: [0, 0], undone: false }
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
        const t = nullifyTargets(d, actor)[0]
        if (t) {
          t.undone = true
          effect.cancels = t.id
          cancelled = t
        }
        break
      }
      case 'finisher':
        finish(d, actor, 'finisher')
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
  d.left[actor]--

  // a Bakugan down to 0 G is defeated at once
  if (!d.done) {
    const zero = SIDES.filter((s) => powerOf(d, s) <= 0)
    if (zero.length) {
      finish(d, zero.length === 2 ? actor : other(zero[0]), 'ko')
      event.ko = zero.includes(target)
    }
  }
  advance(d, target)
  return { duel: d, event: move.kind === 'ability' ? event : null, effect, cancelled, gate: action }
}

/** Both G-Powers after a move (and the winner, if it decides the battle): the card previews on screen. */
export function previewMove(d: Duel, move: Move): { power: [number, number]; winner: SideIndex | null; end: DuelEnd | null } {
  const next = duelStep(d, move).duel
  return { power: [powerOf(next, 0), powerOf(next, 1)], winner: next.winner, end: next.end }
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

/** A side throws a team member onto the Gate Card; once both have, each draws a hand and the moves begin. */
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
  state.phase = state.duel.done ? 'clash' : 'battle'
  state.log.push(`${nameOf(state, state.setter)} vs ${nameOf(state, other(state.setter))}!`)
  return state
}

const signedG = (n: number) => `${n > 0 ? '+' : ''}${n}G`

function describe(state: BattleState, side: SideIndex, effect: Effect | null, cancelled: Effect | null, gate: GateAction | null) {
  const d = state.duel!
  const name = nameOf(state, side)
  const foe = nameOf(state, other(side))
  const gateName = d.gate?.card.name ?? 'the Gate Card'
  if (gate === 'close') return `${name} closes the Gate Card: ${gateName} is undone.`
  if (!effect) return ''
  const mine = effect.delta[side]
  const theirs = effect.delta[other(side)]
  const parts = [mine && `${name} ${signedG(mine)}`, theirs && `${foe} ${signedG(theirs)}`].filter(Boolean).join(', ')
  if (effect.kind === 'gate')
    return `${gate === 'take' ? `${name} opens ${gateName} for itself` : `Gate Card open: ${gateName}`}! ${parts || 'No effect.'}`
  const a = effect.card!.ability
  if (a.type === 'shield')
    return cancelled ? `${name} uses ${a.name}: ${cancelled.card?.ability.name} is nullified!` : `${name} uses ${a.name}.`
  if (a.type === 'finisher') return `${name} unleashes ${a.name}! ${foe} is defeated!`
  return `${name} uses ${a.name}: ${[mine && signedG(mine), theirs && `${foe} ${signedG(theirs)}`].filter(Boolean).join(', ')}.`
}

/** One move of the side to move in the battle. */
export function act(prev: BattleState, move: Move): Step {
  const state = clone(prev)
  const side = state.duel!.turn
  const r = duelStep(state.duel!, move)
  state.duel = r.duel
  state.turn++
  state.log.push(describe(state, side, r.effect, r.cancelled, r.gate))
  if (r.duel.done) state.phase = 'clash'
  return { state, event: r.event, effect: r.effect, cancelled: r.cancelled, gate: r.gate }
}

/** How a battle was won, for the log and the tag panels. */
function endLine(state: BattleState, winner: SideIndex, power: [number, number], end: DuelEnd) {
  const loser = other(winner)
  const w = nameOf(state, winner)
  const l = nameOf(state, loser)
  switch (end) {
    case 'ko':
      return `${l} is down to 0G: ${w} wins the battle!`
    case 'finisher':
      return `${w} wins the battle outright!`
    case 'clash':
      return `Clash! ${w} wins the battle, ${power[winner]}G to ${power[loser]}G.`
  }
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
  const end = d.end ?? 'clash'
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
    gateFor: d.gate?.openFor ?? null,
    finisher: d.finisher,
    end,
    moves: d.moves,
  }
  state.results.push(result)
  const ko = state.sides[loser].lives === 0
  if (ko) state.winner = winner
  state.phase = ko ? 'over' : 'result'
  state.log.push(endLine(state, winner, power, end))
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
  /** Moves searched ahead (1 = only its own move; MOVES * 2 sees the whole battle). */
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
  { noise: 50, depth: 1, edge: 0.01 },
  { noise: 40, depth: 2, edge: 0.02 },
  { noise: 25, depth: 3, edge: 0.03 },
  { noise: 12, depth: 4, edge: 0.045 },
  { noise: 0, depth: 6, edge: 0.06 },
]
export const aiForTier = (tier: number): AiLevel => BOT_LEVELS[Math.min(Math.max(tier, 0), BOT_LEVELS.length - 1)]

/** What a face-down Gate Card of the opponent is guessed to be worth to its owner. */
const HIDDEN_GATE_G = 150
/** A battle won or lost, against any lead in G. */
const WIN = 5000
/** A nullify card in hand: what it is guessed to cancel while the opponent still has moves to make. */
const NULLIFY_G = 90
/** A brawler likes to open their own Gate Card when it pays, as in the anime ("Gate Card, open!"). */
const OPEN_BIAS = 60

/** The duel as `me` sees it: the opponent's face-down Gate Card is a guess, not the real card. */
function seenBy(d: Duel, me: SideIndex): Duel {
  const g = d.gate
  if (!g || g.owner === me || g.opened[g.owner]) return d
  const owner = d.fighters[g.owner].bakugan.element
  const guess: GateCard = { id: 'hidden', kind: 'attribute', name: '?', element: owner, amount: HIDDEN_GATE_G, text: '' }
  return { ...d, gate: { ...g, card: guess } }
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
    case 'shield':
      // what it can cancel now, or a fair guess at what the opponent will still play
      return Math.max(d.left[other(side)] > 0 ? NULLIFY_G : 0, ...nullifyTargets(d, side).map((e) => cancelGain(e, side)))
    case 'finisher':
      return 1000
  }
}

/** G swing the side's gate action would make now. */
function gateSwing(d: Duel, side: SideIndex): number {
  const action = gateAction(d, side)
  if (!action) return 0
  if (action === 'close') {
    const e = gateEffectOf(d)
    return e ? cancelGain(e, side) : 0
  }
  const g = gateDelta(d, d.gate!.card, side)
  return g[side] - g[other(side)]
}

/** G swing a side can still make with the moves it has left: its best cards and its gate action. */
function potential(d: Duel, side: SideIndex) {
  const n = d.left[side]
  if (n <= 0) return 0
  const hand = d.hands[side]
  // a finisher counts once there are enough other cards (and moves) to charge it
  const others = hand.filter((c) => c.ability.type !== 'finisher').length
  const charged = chargeOf(d, side) + Math.min(n - 1, others) >= FINISHER_CHARGE
  const values = hand.filter((c) => c.ability.type !== 'finisher' || charged).map((c) => cardSwing(d, side, c))
  values.push(gateSwing(d, side))
  values.sort((a, b) => b - a)
  let sum = 0
  for (let i = 0; i < Math.min(n, values.length); i++) sum += Math.max(0, values[i])
  return sum
}

/**
 * How good the battle looks for `me`, in G: a win or loss is worth far more than any lead. Otherwise it is a race of
 * G-Power: the lead now plus what each side can still make with its moves (the last word counts a little).
 */
function evaluate(d: Duel, me: SideIndex): number {
  const foe = other(me)
  const diff = powerOf(d, me) - powerOf(d, foe)
  if (d.done) return (d.winner === me ? WIN : -WIN) + diff
  return diff + potential(d, me) - potential(d, foe) + (d.first === me ? 5 : -5)
}

function search(d: Duel, me: SideIndex, depth: number, alpha: number, beta: number): number {
  if (depth <= 0 || d.done) return evaluate(d, me)
  const mine = d.turn === me
  let best = mine ? -Infinity : Infinity
  for (const m of duelMoves(d)) {
    const v = search(duelStep(d, m).duel, me, depth - 1, alpha, beta)
    if (mine) {
      best = Math.max(best, v)
      alpha = Math.max(alpha, v)
    } else {
      best = Math.min(best, v)
      beta = Math.min(beta, v)
    }
    if (alpha >= beta) break
  }
  return best
}

/**
 * The bot's move in a duel: it looks `depth` moves ahead (its own and the answers) and picks what leaves it best
 * placed: answering when behind, opening, closing or taking the Gate Card when that pays, and keeping a nullify card
 * for a card worth cancelling.
 */
export function chooseDuelMove(real: Duel, level: AiLevel = AI_EASY, rng: () => number = Math.random): Move {
  const me = real.turn
  const d = seenBy(real, me)
  const open = gateAction(d, me) === 'open' && gateSwing(d, me) > 0
  const options = duelMoves(d).map((move) => ({
    move,
    v:
      search(duelStep(d, move).duel, me, level.depth - 1, -Infinity, Infinity) +
      rng() * level.noise +
      (open && move.kind === 'gate' ? OPEN_BIAS : 0),
  }))
  options.sort((a, b) => b.v - a.v)
  return options[0]?.move ?? { kind: 'gate' }
}

/** The bot's move in the battle of a match. */
export const chooseAction = (state: BattleState, level: AiLevel = AI_EASY, rng: () => number = Math.random): Move =>
  chooseDuelMove(state.duel!, level, rng)

/** Rough G a team member brings: its own G plus its best cards (as many as it has moves). */
export function memberValue(s: Side, i: number) {
  const cards = s.decks[i]
    .map((c) => {
      const a = c.ability
      return a.type === 'drain' ? 2 * a.amount : a.type === 'shield' ? NULLIFY_G : a.type === 'finisher' ? 300 : a.amount
    })
    .sort((a, b) => b - a)
    .slice(0, MOVES)
  return s.team[i].g + cards.reduce((n, v) => n + v, 0) * 0.5
}

/** What a Gate Card is likely worth to its setter with a given Bakugan on it (the opponent is not known yet). */
function gateValue(gate: GateCard, f: Fighter, livesLost: number) {
  if (gate.kind === 'attribute') return f.bakugan.element === gate.element ? gate.amount : gate.amount / 2
  if (gate.kind === 'character') return f.bakugan.id === gate.bakugan ? f.g / 2 : f.g / 4
  switch (gate.command) {
    case 'level-down':
      return gate.amount * 0.9
    case 'energy-merge':
      return gate.amount * 2
    case 'super-pyrus':
      return 70
    case 'positive-delta':
      return gate.amount * 0.75
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
