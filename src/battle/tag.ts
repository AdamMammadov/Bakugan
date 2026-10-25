import type { Entrant } from '../data/bakugan'
import type { GateCard } from '../data/gates'
import {
  act,
  chooseAction,
  chooseGate,
  chooseThrow,
  LIVES,
  makeSide,
  memberValue,
  resolveBattle,
  setGate,
  throwBakugan,
  throwerOf,
  type AiLevel,
  type BattleEvent,
  type BattleResult,
  type BattleState,
  type Move,
  type Side,
  type SideIndex,
} from './engine'

/**
 * 2v2 tag battles, built from ordinary 1v1 battles of the match layer (engine.ts).
 *
 * Four brawlers: slot 0 is the player and slot 1 their partner (team 0), slots 2 and 3 the opponents (team 1). Each
 * keeps their own lives, Bakugan, ability cards and gate deck for the whole match; a brawler out of lives is out.
 * - Round: while all four are in, two battles at once, each brawler against one opponent (0 v 2 and 1 v 3, or
 *   crossed: 0 v 3 and 1 v 2). Each is a normal battle: a Gate Card, a throw each, turns, the loser loses a life.
 * - Between rounds, while all four are in, either team may swap opponents.
 * - A team down to one brawler: the survivor takes on both opponents in turn, one battle per round (the opponent who
 *   did not face them last steps in). Two survivors fight each other.
 * - A team wins when both opponents are out.
 * - In each battle the brawler who has set fewer Gate Cards so far sets this one (a coin toss on a tie).
 */

export type Slot = 0 | 1 | 2 | 3
export const SLOTS: Slot[] = [0, 1, 2, 3]
export const teamOf = (slot: Slot): SideIndex => (slot < 2 ? 0 : 1)
export const mateOf = (slot: Slot): Slot => (slot ^ 1) as Slot
export const membersOf = (team: SideIndex): [Slot, Slot] => (team === 0 ? [0, 1] : [2, 3])

/** One battle of a round: the team-0 brawler, then the team-1 brawler. */
export type Pair = [Slot, Slot]

/** A battle of the tag match; `winner` is a side of the pair (0 = the team-0 brawler). */
export interface TagResult extends BattleResult {
  round: number
  pair: Pair
}

export interface TagState {
  /** Each brawler's own record, kept from battle to battle: team, decks, gates, lives, battles won. */
  brawlers: [Side, Side, Side, Side]
  /** Round number, from 1. */
  round: number
  /** The pairs are swapped: 0 v 3 and 1 v 2. */
  crossed: boolean
  /** Gate Cards each brawler has set. */
  sets: [number, number, number, number]
  /** The last opponent each brawler faced. */
  lastFoe: (Slot | null)[]
  /** Battles each brawler has fought. */
  fought: [number, number, number, number]
  results: TagResult[]
  winner: SideIndex | null
}

export interface TagEntry {
  team: Entrant[]
  gates: GateCard[]
  lives?: number
}

export function startTag(entries: [TagEntry, TagEntry, TagEntry, TagEntry], crossed = false): TagState {
  return {
    brawlers: entries.map((e) => makeSide(e.team, e.gates, e.lives ?? LIVES)) as TagState['brawlers'],
    round: 1,
    crossed,
    sets: [0, 0, 0, 0],
    lastFoe: [null, null, null, null],
    fought: [0, 0, 0, 0],
    results: [],
    winner: null,
  }
}

const cloneTag = (s: TagState): TagState => ({
  ...s,
  brawlers: [...s.brawlers],
  sets: [...s.sets],
  lastFoe: [...s.lastFoe],
  fought: [...s.fought],
  results: [...s.results],
})

export const isIn = (s: TagState, slot: Slot) => s.brawlers[slot].lives > 0
/** A team's brawlers still in. */
export const inTeam = (s: TagState, team: SideIndex) => membersOf(team).filter((x) => isIn(s, x))

/** All four are in: the pairs may be swapped. */
export const canSwap = (s: TagState) => s.winner === null && inTeam(s, 0).length === 2 && inTeam(s, 1).length === 2

/** The opponent each brawler would face this round if all four are in. */
export const fullPairs = (crossed: boolean): Pair[] =>
  crossed
    ? [
        [0, 3],
        [1, 2],
      ]
    : [
        [0, 2],
        [1, 3],
      ]

/** Of the two brawlers of a team, the one who faces the other team's survivor next: not the one who faced them last. */
function nextUp(s: TagState, two: Slot[], lone: Slot): Slot {
  const last = s.lastFoe[lone]
  if (last !== null && two.includes(last)) return two.find((x) => x !== last)!
  return [...two].sort((x, y) => s.fought[x] - s.fought[y])[0]
}

/** This round's battles (two while all four are in, else one). */
export function pairsOf(s: TagState): Pair[] {
  if (s.winner !== null) return []
  const a = inTeam(s, 0)
  const b = inTeam(s, 1)
  if (a.length === 2 && b.length === 2) return fullPairs(s.crossed)
  if (!a.length || !b.length) return []
  if (a.length === 1 && b.length === 1) return [[a[0], b[0]]]
  if (a.length === 1) return [[a[0], nextUp(s, b, a[0])]]
  return [[nextUp(s, a, b[0]), b[0]]]
}

/** The pairs swap opponents. */
export function swapPairs(s: TagState): TagState {
  return { ...cloneTag(s), crossed: !s.crossed }
}

/** A battle between the pair, ready for the match layer (phase 'set'): the two brawlers' records as its sides. */
export function pairBattle(s: TagState, pair: Pair, rng: () => number = Math.random): BattleState {
  const [x, y] = pair
  const setter: SideIndex = s.sets[x] < s.sets[y] ? 0 : s.sets[y] < s.sets[x] ? 1 : rng() < 0.5 ? 0 : 1
  const copy = (side: Side): Side => ({ ...side, gates: [...side.gates] })
  return {
    sides: [copy(s.brawlers[x]), copy(s.brawlers[y])],
    phase: 'set',
    battle: s.round,
    turn: 0,
    first: setter,
    setter,
    gate: null,
    thrown: [null, null],
    duel: null,
    winner: null,
    log: [],
    results: [],
  }
}

/** The pair's battle is decided (after resolveBattle): both brawlers' records go back into the tag match. */
export function applyBattle(prev: TagState, pair: Pair, end: BattleState): TagState {
  const s = cloneTag(prev)
  const [x, y] = pair
  const result = end.results[end.results.length - 1]
  s.brawlers[x] = end.sides[0]
  s.brawlers[y] = end.sides[1]
  s.sets[pair[end.setter]]++
  s.lastFoe[x] = y
  s.lastFoe[y] = x
  s.fought[x]++
  s.fought[y]++
  if (result) s.results.push({ ...result, round: s.round, pair })
  if (!inTeam(s, 0).length) s.winner = 1
  else if (!inTeam(s, 1).length) s.winner = 0
  return s
}

/** On to the next round. */
export const nextRound = (s: TagState): TagState => ({ ...cloneTag(s), round: s.round + 1 })

/** The slot that won a result. */
export const winnerOf = (r: TagResult): Slot => r.pair[r.winner]
export const loserOf = (r: TagResult): Slot => r.pair[r.winner === 0 ? 1 : 0]

// ---------------------------------------------------------------- AI

/** What a brawler brings: their best Bakugan with its cards (rough G). */
const strengthOf = (side: Side) => Math.max(...side.team.map((_, i) => memberValue(side, i)))

/** Rough chance `a` beats `b` in a battle. */
const odds = (a: Side, b: Side) => 1 / (1 + Math.exp(-(strengthOf(a) - strengthOf(b)) / 120))

/**
 * How good a pairing looks for `team`: each battle's chance, a win counting more against a foe on their last
 * lives and a loss counting more for a brawler on their own.
 */
function pairingValue(s: TagState, team: SideIndex, crossed: boolean) {
  let v = 0
  for (const pair of fullPairs(crossed)) {
    const mine = s.brawlers[pair[team]]
    const foe = s.brawlers[pair[team === 0 ? 1 : 0]]
    const p = odds(mine, foe)
    v += p * (1 + 1 / Math.max(1, foe.lives)) - (1 - p) * (1 + 1 / Math.max(1, mine.lives))
  }
  return v
}

/** Whether a CPU team calls for swapping opponents before the next round (only while all four are in). */
export function wantsSwap(s: TagState, team: SideIndex, level: AiLevel, rng: () => number = Math.random) {
  if (!canSwap(s)) return false
  const gain = pairingValue(s, team, !s.crossed) - pairingValue(s, team, s.crossed)
  return gain + ((rng() - 0.5) * level.noise) / 200 > 0.15
}

/** What one step of a battle played by bots did. */
export interface AiStep {
  state: BattleState
  kind: 'set' | 'throw' | 'move' | 'result'
  /** The side that acted. */
  side: SideIndex
  move?: Move
  event?: BattleEvent | null
  result?: BattleResult
}

/**
 * One step of a battle between two bots (`levels` per side): the setter sets a Gate Card, a throw, a move, or the
 * battle is decided. Null once it is decided (phase 'result' or 'over').
 */
export function aiStep(s: BattleState, levels: [AiLevel, AiLevel], rng: () => number = Math.random): AiStep | null {
  if (s.phase === 'set') return { state: setGate(s, chooseGate(s, levels[s.setter], rng)), kind: 'set', side: s.setter }
  if (s.phase === 'throw') {
    const side = throwerOf(s)!
    return { state: throwBakugan(s, side, chooseThrow(s, side, levels[side], rng), rng), kind: 'throw', side }
  }
  if (s.phase === 'battle') {
    const side = s.duel!.turn
    const move = chooseAction(s, levels[side], rng)
    const step = act(s, move)
    return { state: step.state, kind: 'move', side, move, event: step.event }
  }
  if (s.phase === 'clash') {
    const r = resolveBattle(s)
    return { state: r.state, kind: 'result', side: r.result.winner, event: r.event, result: r.result }
  }
  return null
}

/** Plays a whole battle between bots (for simulations). */
export function playBattle(s: BattleState, levels: [AiLevel, AiLevel], rng: () => number = Math.random): BattleState {
  let state = s
  for (let guard = 0; guard < 200; guard++) {
    const step = aiStep(state, levels, rng)
    if (!step) break
    state = step.state
  }
  return state
}
