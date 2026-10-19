import { abilitiesOf, formBrawlG, formOf, type Ability, type Bakugan, type Entrant } from '../data/bakugan'
import { released } from '../season/release'
import type { GateCard } from '../data/gates'

/**
 * Life gauge brawl (Battle System 3.0, after Bakugan: New Vestroia)
 * - Each brawler has a life gauge of LIFE. A match is a series of rounds; a brawler whose life reaches 0 loses.
 * - Every round: a Gate Card is set (the brawlers take turns), each side throws one Bakugan of its team,
 *   then comes the ability phase: the sides take turns to play one ability card of the Bakugan they threw,
 *   or pass. It ends when both pass in a row or each has played PLAYS cards. Cards only count this round.
 * - Battle: the higher G-Power wins the round and the loser's brawler loses the difference in life
 *   (at least MIN_HIT, at most MAX_HIT). A tie is a draw.
 * - Next round every card is back: each round a fresh hand is drawn from the thrown Bakugan's own cards.
 * - After MAX_ROUNDS rounds the brawler with more life wins.
 */

export const LIFE = 500
export const TEAM_SIZE = 3
/** Cards drawn each round from the thrown Bakugan's own deck. */
export const HAND_SIZE = 4
/** Cards each side may play in one round. */
export const PLAYS = 3
/** Life lost for a round lost, at least: a near-tie still counts. */
export const MIN_HIT = 50
/** Life lost for a round lost, at most: nobody is knocked out by a single round (a doubled Character Gate can win big). */
export const MAX_HIT = 350
/** Safety net: after this many rounds the brawler with more life wins. */
export const MAX_ROUNDS = 15
const MIN_G = 100

export type SideIndex = 0 | 1
export const other = (side: SideIndex): SideIndex => (side === 0 ? 1 : 0)

export interface Fighter {
  bakugan: Bakugan
  form: number
  name: string
  /** G-Power on a Gate Card, before cards and the gate bonus. */
  g: number
}

export interface Card {
  /** Unique per copy in a deck. */
  uid: string
  ability: Ability
  /** Bakugan id the card belongs to. */
  owner: string
}

export interface Side {
  team: Fighter[]
  /** Each team member's own ability cards (same order as `team`). */
  decks: Card[][]
  gates: GateCard[]
  life: number
  /** Team member on the field (this round's, or last round's until the next throw). */
  active: number
  /** G this round's cards added (or took) on top of the Bakugan's own. */
  boost: number
  hand: Card[]
  /** Cards this side played this round, in order. */
  played: Card[]
  /** uids of played cards a shield cancelled. */
  blocked: string[]
  shield: boolean
  roundsWon: number
}

/** pick: both sides choose a Bakugan · abilities: cards are played · battle: G-Powers are compared · result: round over */
export type Phase = 'pick' | 'abilities' | 'battle' | 'result' | 'over'

export interface RoundResult {
  round: number
  winner: SideIndex | null
  power: [number, number]
  /** Life the loser lost. */
  damage: number
  /** Team member each side threw. */
  thrown: [number, number]
}

export interface BattleState {
  sides: [Side, Side]
  phase: Phase
  /** Side to move in the ability phase. */
  turn: SideIndex
  /** Passes in a row in the ability phase. */
  passes: number
  /** Side that set the first Gate Card (a coin toss); the brawlers take turns after that. */
  first: SideIndex
  round: number
  /** Gate Card currently set on the field and who set it. */
  gate: { card: GateCard; owner: SideIndex } | null
  winner: SideIndex | null
  log: string[]
  results: RoundResult[]
}

/** What a Bakugan does on the field (drives the arena animation): `basic` is the round's deciding strike. */
export type Action = { kind: 'basic' } | { kind: 'ability'; card: Card } | { kind: 'switch'; to: number }

/** A move in the ability phase. */
export type Move = { kind: 'ability'; card: Card } | { kind: 'pass' }

/** What happened during one card play or round battle; drives the arena animation. */
export interface BattleEvent {
  actor: SideIndex
  target: SideIndex
  action: Action
  /** Life the target lost. */
  damage: number
  heal: number
  actorG: number
  targetG: number
  blocked: boolean
  /** The target's brawler is out of life. */
  ko: boolean
  /** Index of a Bakugan that came onto the field (not used by round play). */
  enters?: { side: SideIndex; index: number }
  /** A round's battle: both sides' G-Power. */
  clash?: { power: [number, number]; diff: number }
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

function makeSide(team: Entrant[], gates: GateCard[], rng: () => number): Side {
  return {
    team: team.map((e) => ({ bakugan: e.bakugan, form: e.form, name: formOf(e).name, g: formBrawlG(e) + (e.bonusG ?? 0) })),
    decks: team.map((e) =>
      abilitiesOf(e.bakugan, e.form)
        .filter((a) => !e.cards || e.cards.includes(a.id))
        .map((ability) => ({ uid: `c${uid++}`, ability, owner: e.bakugan.id })),
    ),
    gates: shuffle(gates, rng),
    life: LIFE,
    active: 0,
    boost: 0,
    hand: [],
    played: [],
    blocked: [],
    shield: false,
    roundsWon: 0,
  }
}

export function startBattle(
  left: Entrant[],
  right: Entrant[],
  gates: [GateCard[], GateCard[]],
  rng: () => number = Math.random,
  first: SideIndex = 0,
): BattleState {
  const sides: [Side, Side] = [makeSide(left, gates[0], rng), makeSide(right, gates[1], rng)]
  const state: BattleState = {
    sides,
    phase: 'pick',
    turn: first,
    passes: 0,
    first,
    round: 1,
    gate: null,
    winner: null,
    log: [],
    results: [],
  }
  setGate(state, first)
  return state
}

/** The side sets the top Gate Card of its gate deck (cycling back to the start). */
function setGate(state: BattleState, owner: SideIndex) {
  const side = state.sides[owner]
  if (!side.gates.length) return
  const card = side.gates.shift()!
  side.gates.push(card)
  state.gate = { card, owner }
  state.log.push(`Round ${state.round}: Gate Card set — ${card.name}.`)
}

function clone(state: BattleState): BattleState {
  return {
    ...state,
    sides: state.sides.map((s) => ({
      ...s,
      hand: [...s.hand],
      played: [...s.played],
      blocked: [...s.blocked],
      gates: [...s.gates],
    })) as [Side, Side],
    gate: state.gate ? { ...state.gate } : null,
    log: [...state.log],
    results: [...state.results],
  }
}

// ---------------------------------------------------------------- queries

export const activeOf = (side: Side) => side.team[side.active]

/** Field gate bonus for a fighter: attribute gates add G's, a character gate doubles its Bakugan's power. */
export function gateBonus(state: BattleState, f: Fighter) {
  const gate = state.gate?.card
  if (!gate) return 0
  if (gate.kind === 'attribute') return gate.element === f.bakugan.element ? gate.amount : 0
  return gate.bakugan === f.bakugan.id ? f.g : 0
}

/** A side's G-Power this round: its Bakugan's own, the gate bonus and the cards played. */
export const powerOf = (state: BattleState, side: SideIndex) => {
  const s = state.sides[side]
  const f = activeOf(s)
  return Math.max(MIN_G, f.g + gateBonus(state, f) + s.boost)
}

/** Life the loser of a round loses for a G-Power difference. */
export const hitFor = (diff: number) => (diff === 0 ? 0 : Math.min(MAX_HIT, Math.max(MIN_HIT, Math.abs(diff))))

/** Other ability cards a Bakugan must play in the round before its finisher (it gathers its power first). */
export const FINISHER_CHARGE = 2

/** How many of the cards a finisher waits for its side has played this round. */
export const chargeOf = (side: Side) => side.played.filter((c) => c.ability.type !== 'finisher').length

export const playsLeft = (side: Side) => PLAYS - side.played.length

export const canPlay = (side: Side, card: Card) =>
  playsLeft(side) > 0 &&
  activeOf(side).bakugan.id === card.owner &&
  (card.ability.type !== 'finisher' || chargeOf(side) >= FINISHER_CHARGE)

// ---------------------------------------------------------------- round flow

/** Both sides throw a Bakugan (team indexes); each draws a fresh hand from its cards and the ability phase begins. */
export function throwBakugan(prev: BattleState, picks: [number, number], rng: () => number = Math.random): BattleState {
  const state = clone(prev)
  state.sides.forEach((s, i) => {
    s.active = Math.min(Math.max(picks[i], 0), s.team.length - 1)
    s.hand = shuffle(s.decks[s.active], rng).slice(0, HAND_SIZE)
  })
  state.log.push(`${activeOf(state.sides[0]).name} vs ${activeOf(state.sides[1]).name}!`)
  state.phase = 'abilities'
  state.passes = 0
  // the side that did not set the Gate Card opens the ability phase
  state.turn = state.gate ? other(state.gate.owner) : state.first
  settle(state)
  return state
}

/** Hands the turn on until a side that can play a card is to move, or ends the ability phase. */
function settle(state: BattleState) {
  while (state.phase === 'abilities') {
    if (state.passes >= 2 || state.sides.every((s) => playsLeft(s) <= 0)) {
      state.phase = 'battle'
      return
    }
    const side = state.sides[state.turn]
    if (side.hand.some((c) => canPlay(side, c))) return
    state.passes++
    state.turn = other(state.turn)
  }
}

/** One move in the ability phase: play a card or pass. */
export function act(prev: BattleState, move: Move): { state: BattleState; event: BattleEvent } {
  const state = clone(prev)
  const actor = state.turn
  const target = other(actor)
  const me = state.sides[actor]
  const foe = state.sides[target]
  const name = activeOf(me).name
  const foeName = activeOf(foe).name
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

  if (move.kind === 'pass') {
    state.passes++
    state.log.push(`${name} is ready.`)
  } else {
    state.passes = 0
    const card = move.card
    const a = card.ability
    me.hand = me.hand.filter((c) => c.uid !== card.uid)
    me.played.push(card)
    event.action = { kind: 'ability', card }
    // a finisher goes through any shield
    if (foe.shield && a.type !== 'finisher') {
      foe.shield = false
      event.blocked = true
      me.blocked.push(card.uid)
      state.log.push(`${foeName}'s shield cancels ${a.name}!`)
    } else {
      switch (a.type) {
        case 'boost':
        case 'attack':
          event.actorG = a.amount
          state.log.push(`${name} uses ${a.name}: +${a.amount}G.`)
          break
        case 'weaken': {
          event.targetG = -Math.max(0, Math.min(a.amount, powerOf(state, target) - MIN_G))
          state.log.push(`${name} uses ${a.name}: ${foeName} ${event.targetG}G.`)
          break
        }
        case 'drain': {
          const stolen = Math.max(0, Math.min(a.amount, powerOf(state, target) - MIN_G))
          event.targetG = -stolen
          event.actorG = stolen
          state.log.push(`${name} uses ${a.name}: steals ${stolen}G!`)
          break
        }
        case 'shield':
          me.shield = true
          state.log.push(`${name} uses ${a.name}: the opponent's next card is cancelled.`)
          break
        case 'finisher':
          foe.shield = false
          event.damage = foe.life
          event.ko = true
          state.log.push(`${name} uses ${a.name}! ${foeName} is wiped out.`)
          break
      }
      me.boost += event.actorG
      foe.boost += event.targetG
      foe.life -= event.damage
      if (event.ko) {
        state.winner = actor
        state.phase = 'over'
      }
    }
  }

  if (state.phase === 'abilities') {
    state.turn = target
    settle(state)
  }
  return { state, event }
}

/**
 * The round's battle: the higher G-Power wins and the loser's brawler loses the difference in life.
 * `event` (the winner strikes the loser) is null for a draw.
 */
export function resolveRound(prev: BattleState): { state: BattleState; event: BattleEvent | null; result: RoundResult } {
  const state = clone(prev)
  const power: [number, number] = [powerOf(state, 0), powerOf(state, 1)]
  const diff = Math.abs(power[0] - power[1])
  const winner: SideIndex | null = diff === 0 ? null : power[0] > power[1] ? 0 : 1
  const result: RoundResult = {
    round: state.round,
    winner,
    power,
    damage: 0,
    thrown: [state.sides[0].active, state.sides[1].active],
  }
  let event: BattleEvent | null = null
  if (winner === null) state.log.push(`${power[0]}G vs ${power[1]}G — a draw!`)
  else {
    const loser = other(winner)
    const lost = Math.min(state.sides[loser].life, hitFor(diff))
    state.sides[loser].life -= lost
    state.sides[winner].roundsWon++
    result.damage = lost
    event = {
      actor: winner,
      target: loser,
      action: { kind: 'basic' },
      damage: lost,
      heal: 0,
      actorG: 0,
      targetG: 0,
      blocked: false,
      ko: state.sides[loser].life === 0,
      clash: { power, diff },
    }
    state.log.push(`${activeOf(state.sides[winner]).name} wins the round, ${power[winner]}G to ${power[loser]}G: −${lost} life.`)
    if (event.ko) state.winner = winner
  }
  state.results.push(result)
  if (state.winner === null && state.round >= MAX_ROUNDS) state.winner = leader(state)
  state.phase = state.winner === null ? 'result' : 'over'
  return { state, event, result }
}

/** Who wins when the round limit is reached: more life, then more rounds won, then the last round's winner. */
function leader(state: BattleState): SideIndex {
  const [a, b] = state.sides
  if (a.life !== b.life) return a.life > b.life ? 0 : 1
  if (a.roundsWon !== b.roundsWon) return a.roundsWon > b.roundsWon ? 0 : 1
  return [...state.results].reverse().find((r) => r.winner !== null)?.winner ?? other(state.first)
}

/** The next round: cards and G-Power reset, the Bakugan return to their balls, a new Gate Card is set. */
export function nextRound(prev: BattleState): BattleState {
  const state = clone(prev)
  state.round += 1
  for (const s of state.sides) {
    s.boost = 0
    s.hand = []
    s.played = []
    s.blocked = []
    s.shield = false
  }
  state.phase = 'pick'
  state.passes = 0
  setGate(state, state.round % 2 === 1 ? state.first : other(state.first))
  return state
}

// ---------------------------------------------------------------- AI

export function legalMoves(state: BattleState): Move[] {
  if (state.phase !== 'abilities') return []
  const side = state.sides[state.turn]
  return [{ kind: 'pass' }, ...side.hand.filter((c) => canPlay(side, c)).map((card) => ({ kind: 'ability', card }) as Move)]
}

export interface AiLevel {
  /** Random wobble added to each option's value; lower plays sharper. */
  noise: number
  /** Moves searched ahead (1 = only its own move). */
  depth: number
  /** Extra G for the bot's Bakugan, as a share of the player's (0.05 = +5%). */
  edge?: number
}

export const AI_EASY: AiLevel = { noise: 80, depth: 1 }

/**
 * Bots get sharper and a little stronger as the player climbs the ranks (index = tier, 0 = Rookie).
 * Tuned by simulation so a Rookie wins a bit under half of their brawls and higher ranks take real skill.
 * In round play a few G decide close rounds, so the edge is the main lever.
 */
const BOT_LEVELS: AiLevel[] = [
  { noise: 50, depth: 1, edge: 0.01 },
  { noise: 35, depth: 2, edge: 0.02 },
  { noise: 25, depth: 2, edge: 0.03 },
  { noise: 15, depth: 3, edge: 0.05 },
  { noise: 8, depth: 3, edge: 0.065 },
  { noise: 0, depth: 4, edge: 0.08 },
]
export const aiForTier = (tier: number): AiLevel => BOT_LEVELS[Math.min(Math.max(tier, 0), BOT_LEVELS.length - 1)]

/** Rough G swing a card brings this round. */
function cardValue(a: Ability, foePower: number) {
  switch (a.type) {
    case 'boost':
    case 'attack':
      return a.amount
    case 'weaken':
      return Math.min(a.amount, foePower - MIN_G)
    case 'drain':
      return 2 * Math.min(a.amount, foePower - MIN_G)
    case 'shield':
      return 70
    case 'finisher':
      return 5000
  }
}

/** G swing a side can still bring this round: its best cards for the plays it has left (the foe may answer, so half). */
function potential(state: BattleState, side: SideIndex) {
  const s = state.sides[side]
  const foePower = powerOf(state, other(side))
  const best = s.hand
    .filter((c) => c.ability.type !== 'finisher' || chargeOf(s) + playsLeft(s) - 1 >= FINISHER_CHARGE)
    .map((c) => cardValue(c.ability, foePower))
    .sort((a, b) => b - a)
    .slice(0, Math.max(0, playsLeft(s)))
  return best.reduce((n, v) => n + v, 0) * 0.5 + (s.shield ? 60 : 0)
}

/** How good the position is for `me`: the life gauges once this round's battle is fought. */
function evaluate(state: BattleState, me: SideIndex): number {
  if (state.winner !== null) return state.winner === me ? 1e6 : -1e6
  const foe = other(me)
  let mine = state.sides[me].life
  let theirs = state.sides[foe].life
  if (state.phase === 'abilities' || state.phase === 'battle') {
    let d = powerOf(state, me) - powerOf(state, foe)
    if (state.phase === 'abilities') d += potential(state, me) - potential(state, foe)
    if (d > 0) theirs -= hitFor(d)
    else if (d < 0) mine -= hitFor(d)
  }
  // a gauge run dry ends the match
  return mine - theirs + (theirs <= 0 ? 3000 : 0) - (mine <= 0 ? 3000 : 0)
}

function search(state: BattleState, me: SideIndex, depth: number): number {
  if (depth === 0 || state.phase !== 'abilities') return evaluate(state, me)
  const values = legalMoves(state).map((m) => search(act(state, m).state, me, depth - 1))
  return state.turn === me ? Math.max(...values) : Math.min(...values)
}

/** The bot's move in the ability phase. */
export function chooseAction(state: BattleState, level: AiLevel = AI_EASY, rng: () => number = Math.random): Move {
  const me = state.turn
  const options = legalMoves(state).map((move) => ({
    move,
    v: search(act(state, move).state, me, level.depth - 1) + rng() * level.noise,
  }))
  options.sort((a, b) => b.v - a.v)
  return options[0]?.move ?? { kind: 'pass' }
}

/** The team member a side throws this round: the strongest on this Gate Card with the best cards. */
export function chooseThrow(state: BattleState, side: SideIndex, level: AiLevel = AI_EASY, rng: () => number = Math.random) {
  const s = state.sides[side]
  const options = s.team.map((f, i) => {
    const cards = s.decks[i]
      .map((c) => cardValue(c.ability, 500))
      .sort((a, b) => b - a)
      .slice(0, PLAYS)
    return { i, v: f.g + gateBonus(state, f) + cards.reduce((n, v) => n + v, 0) * 0.6 + rng() * level.noise * 2 }
  })
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
