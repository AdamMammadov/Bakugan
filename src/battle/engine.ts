import { BAKUGAN, formBrawlG, formOf, type Ability, type Bakugan, type Entrant } from '../data/bakugan'
import type { GateCard } from '../data/gates'

/**
 * Team brawl (Battle System 2.0)
 * - Each side brings 3 Bakugan; one is on the field, the others wait on the bench.
 * - Ability cards from the whole team are shuffled into a deck; each side holds a hand and
 *   draws one card at the start of its turn. A card can only be played while the Bakugan it
 *   belongs to is on the field.
 * - Every round a Gate Card is set on the field, alternating between the players. Attribute
 *   gates add G's to Bakugan of that attribute; character gates double one Bakugan's power.
 * - On your turn: play a card, make a basic attack, or switch Bakugan.
 * - Defeat all three opposing Bakugan to win.
 */

export const MAX_HP = 1000
export const TEAM_SIZE = 3
export const HAND_SIZE = 5
const START_HAND = 3
const MIN_G = 100
const BASIC_POWER = 170

export type SideIndex = 0 | 1
export const other = (side: SideIndex): SideIndex => (side === 0 ? 1 : 0)

export interface Fighter {
  bakugan: Bakugan
  form: number
  name: string
  hp: number
  /** G-Power without the field gate bonus. */
  g: number
  shield: boolean
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
  active: number
  deck: Card[]
  hand: Card[]
  used: Card[]
  gates: GateCard[]
}

export interface BattleState {
  sides: [Side, Side]
  turn: SideIndex
  round: number
  /** Gate Card currently set on the field and who set it. */
  gate: { card: GateCard; owner: SideIndex } | null
  winner: SideIndex | null
  log: string[]
}

export type Action =
  | { kind: 'basic' }
  | { kind: 'ability'; card: Card }
  | { kind: 'switch'; to: number }

/** What happened during one action; drives the arena animation. */
export interface BattleEvent {
  actor: SideIndex
  target: SideIndex
  action: Action
  damage: number
  heal: number
  actorG: number
  targetG: number
  blocked: boolean
  ko: boolean
  /** Index of the Bakugan that came onto the field after a KO or a switch. */
  enters?: { side: SideIndex; index: number }
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
  const fighters = team.map(
    (e): Fighter => ({
      bakugan: e.bakugan,
      form: e.form,
      name: formOf(e).name,
      hp: MAX_HP,
      g: formBrawlG(e),
      shield: false,
    }),
  )
  const deck = shuffle(
    team.flatMap((e) =>
      e.bakugan.abilities
        .filter((a) => !e.cards || e.cards.includes(a.id))
        .map((ability) => ({ uid: `c${uid++}`, ability, owner: e.bakugan.id }))),
    rng,
  )
  return { team: fighters, active: 0, deck: deck.slice(START_HAND), hand: deck.slice(0, START_HAND), used: [], gates: shuffle(gates, rng) }
}

export function startBattle(
  left: Entrant[],
  right: Entrant[],
  gates: [GateCard[], GateCard[]],
  rng: () => number = Math.random,
): BattleState {
  const sides: [Side, Side] = [makeSide(left, gates[0], rng), makeSide(right, gates[1], rng)]
  const state: BattleState = { sides, turn: 0, round: 1, gate: null, winner: null, log: [] }
  setGate(state, 0)
  state.log.push(`${activeOf(sides[0]).name} vs ${activeOf(sides[1]).name} — brawl!`)
  return state
}

/** The side sets the top Gate Card of its gate deck (cycling back to the start). */
function setGate(state: BattleState, owner: SideIndex) {
  const side = state.sides[owner]
  if (!side.gates.length) return
  const card = side.gates.shift()!
  side.gates.push(card)
  state.gate = { card, owner }
  state.log.push(`Gate Card set: ${card.name}.`)
}

// ---------------------------------------------------------------- queries

export const activeOf = (side: Side) => side.team[side.active]
export const aliveBench = (side: Side) => side.team.map((f, i) => ({ f, i })).filter(({ f, i }) => i !== side.active && f.hp > 0)

/** Field gate bonus for a fighter. */
export function gateBonus(state: BattleState, f: Fighter) {
  const gate = state.gate?.card
  if (!gate) return 0
  if (gate.kind === 'attribute') return gate.element === f.bakugan.element ? gate.amount : 0
  return gate.bakugan === f.bakugan.id ? f.g : 0
}

export const powerOf = (state: BattleState, f: Fighter) => f.g + gateBonus(state, f)

export const canPlay = (side: Side, card: Card) => activeOf(side).bakugan.id === card.owner

/** Damage scales with the attacker/defender G-Power ratio, clamped so nobody is untouchable. */
function strike(power: number, attackerG: number, defenderG: number) {
  const ratio = Math.min(Math.max(attackerG / defenderG, 0.6), 1.5)
  return Math.round(power * ratio)
}

// ---------------------------------------------------------------- actions

function clone(state: BattleState): BattleState {
  return {
    ...state,
    sides: state.sides.map((s) => ({
      ...s,
      team: s.team.map((f) => ({ ...f })),
      deck: [...s.deck],
      hand: [...s.hand],
      used: [...s.used],
      gates: [...s.gates],
    })) as [Side, Side],
    gate: state.gate ? { ...state.gate } : null,
    log: [...state.log],
  }
}

export function act(prev: BattleState, action: Action): { state: BattleState; event: BattleEvent } {
  const state = clone(prev)
  const actor = state.turn
  const target = other(actor)
  const mySide = state.sides[actor]
  const foeSide = state.sides[target]
  const me = activeOf(mySide)
  const foe = activeOf(foeSide)
  const event: BattleEvent = { actor, target, action, damage: 0, heal: 0, actorG: 0, targetG: 0, blocked: false, ko: false }
  const myG = powerOf(state, me)
  const foeG = powerOf(state, foe)

  if (action.kind === 'switch') {
    mySide.active = action.to
    event.enters = { side: actor, index: action.to }
    state.log.push(`${me.name} returns. ${activeOf(mySide).name} enters the field!`)
  } else {
    if (action.kind === 'ability') {
      mySide.hand = mySide.hand.filter((c) => c.uid !== action.card.uid)
      mySide.used.push(action.card)
    }
    const hostile = action.kind === 'basic' || action.card.ability.type !== 'boost'
    const isShield = action.kind === 'ability' && action.card.ability.type === 'shield'

    if (hostile && !isShield && foe.shield) {
      foe.shield = false
      event.blocked = true
      state.log.push(`${foe.name}'s shield blocks ${action.kind === 'basic' ? 'the attack' : action.card.ability.name}!`)
    } else if (action.kind === 'basic') {
      event.damage = strike(BASIC_POWER, myG, foeG)
      state.log.push(`${me.name} attacks for ${event.damage} damage.`)
    } else {
      const a = action.card.ability
      switch (a.type) {
        case 'attack':
          event.damage = strike(BASIC_POWER + a.amount * 0.9, myG, foeG)
          state.log.push(`${me.name} uses ${a.name}! ${event.damage} damage.`)
          break
        case 'boost':
          event.actorG = a.amount
          state.log.push(`${me.name} uses ${a.name}: +${a.amount}G.`)
          break
        case 'weaken': {
          const cut = Math.max(0, Math.min(a.amount, foe.g - MIN_G))
          event.targetG = -cut
          event.damage = strike(BASIC_POWER * 0.5, myG, foeG)
          state.log.push(`${me.name} uses ${a.name}: ${foe.name} −${cut}G.`)
          break
        }
        case 'drain': {
          const stolen = Math.max(0, Math.min(a.amount, foe.g - MIN_G))
          event.targetG = -stolen
          event.actorG = stolen
          event.damage = Math.round(90 + a.amount * 0.8)
          event.heal = Math.round(a.amount * 0.4)
          state.log.push(`${me.name} uses ${a.name}: steals ${stolen}G and ${event.heal} life!`)
          break
        }
        case 'shield':
          me.shield = true
          state.log.push(`${me.name} uses ${a.name} and raises a shield.`)
          break
      }
    }
    me.g += event.actorG
    foe.g += event.targetG
    foe.hp = Math.max(0, foe.hp - event.damage)
    me.hp = Math.min(MAX_HP, me.hp + event.heal)
    event.ko = foe.hp === 0

    if (event.ko) {
      state.log.push(`${foe.name} is defeated!`)
      // a defeated Bakugan's ability cards leave the game
      const dead = (c: Card) => c.owner !== foe.bakugan.id
      foeSide.hand = foeSide.hand.filter(dead)
      foeSide.deck = foeSide.deck.filter(dead)
      const next = foeSide.team.findIndex((f) => f.hp > 0)
      if (next === -1) {
        state.winner = actor
        state.log.push(`${me.name} wins the brawl!`)
      } else {
        foeSide.active = next
        event.enters = { side: target, index: next }
        state.log.push(`${activeOf(foeSide).name} enters the field!`)
      }
    }
  }

  if (state.winner === null) {
    state.turn = target
    // draw for the player whose turn it is now
    const drawer = state.sides[target]
    if (drawer.deck.length && drawer.hand.length < HAND_SIZE) drawer.hand.push(drawer.deck.shift()!)
    // a new round starts once both players have acted; the gate alternates
    if (actor === 1) {
      state.round += 1
      setGate(state, (state.round % 2 === 1 ? 0 : 1) as SideIndex)
    }
  }
  return { state, event }
}

// ---------------------------------------------------------------- AI

export function legalActions(state: BattleState): Action[] {
  const side = state.sides[state.turn]
  return [
    { kind: 'basic' },
    ...side.hand.filter((c) => canPlay(side, c)).map((card) => ({ kind: 'ability', card }) as Action),
    ...aliveBench(side).map(({ i }) => ({ kind: 'switch', to: i }) as Action),
  ]
}

export interface AiLevel {
  /** Random wobble added to each option's value; lower plays sharper. */
  noise: number
  /** Turns searched ahead (1 = only its own move). */
  depth: number
}

export const AI_EASY: AiLevel = { noise: 80, depth: 1 }

/** Bots get sharper as the player climbs the ranks (tier 0 = Rookie). */
export const aiForTier = (tier: number): AiLevel => ({ noise: Math.max(4, 30 - tier * 6), depth: tier >= 4 ? 4 : tier >= 2 ? 3 : 2 })

/** How good the position is for `me`. */
function evaluate(state: BattleState, me: SideIndex): number {
  if (state.winner !== null) return state.winner === me ? 1e6 : -1e6
  const side = (i: SideIndex) => {
    const s = state.sides[i]
    const f = activeOf(s)
    const alive = s.team.filter((x) => x.hp > 0)
    return (
      alive.reduce((n, x) => n + x.hp + x.g * 0.6, 0) +
      alive.length * 350 +
      powerOf(state, f) * 1.2 +
      (f.shield ? 120 : 0) +
      s.hand.filter((c) => canPlay(s, c)).length * 25 +
      s.hand.length * 10
    )
  }
  return side(me) - side(other(me))
}

function search(state: BattleState, me: SideIndex, depth: number): number {
  if (depth === 0 || state.winner !== null) return evaluate(state, me)
  const values = legalActions(state).map((a) => search(act(state, a).state, me, depth - 1))
  return state.turn === me ? Math.max(...values) : Math.min(...values)
}

export function chooseAction(state: BattleState, level: AiLevel = AI_EASY, rng: () => number = Math.random): Action {
  const me = state.turn
  const options = legalActions(state).map((action) => ({
    action,
    v: search(act(state, action).state, me, level.depth - 1) + rng() * level.noise,
  }))
  options.sort((a, b) => b.v - a.v)
  return options[0].action
}

/** A random team of different Bakugan. */
export function randomTeam(size = TEAM_SIZE, exclude: string[] = [], rng: () => number = Math.random): Entrant[] {
  const pool = shuffle(BAKUGAN.filter((b) => !exclude.includes(b.id)), rng)
  const picks = (pool.length >= size ? pool : shuffle(BAKUGAN, rng)).slice(0, size)
  return picks.map((bakugan) => ({ bakugan, form: Math.floor(rng() * Math.min(2, bakugan.evolutions.length)) }))
}

const teamPower = (team: Entrant[]) => team.reduce((n, e) => n + formBrawlG(e), 0)

/**
 * An opponent on the player's level: same number of Bakugan, the same forms slot by slot and
 * the same number of ability cards, picked so the total G-Power is as close as possible.
 */
export function matchedOpponent(player: Entrant[], rng: () => number = Math.random): Entrant[] {
  const target = teamPower(player)
  let best: Entrant[] = []
  let gap = Infinity
  for (let tries = 0; tries < 30; tries++) {
    const team = shuffle(BAKUGAN, rng)
      .slice(0, player.length)
      .map((bakugan, i): Entrant => {
        const mine = player[i]
        const cards = mine.cards?.length ?? mine.bakugan.abilities.length
        return {
          bakugan,
          form: Math.min(mine.form, bakugan.evolutions.length - 1),
          cards: bakugan.abilities.slice(0, cards).map((a) => a.id),
        }
      })
    const d = Math.abs(teamPower(team) - target)
    if (d < gap) {
      gap = d
      best = team
    }
  }
  return best
}
