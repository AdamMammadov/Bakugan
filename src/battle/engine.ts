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
    team.flatMap((e) => e.bakugan.abilities.map((ability) => ({ uid: `c${uid++}`, ability, owner: e.bakugan.id }))),
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
  const ratio = Math.min(Math.max(attackerG / defenderG, 0.5), 2)
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
          event.damage = strike(BASIC_POWER + a.amount * 1.1, myG, foeG)
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

/** Rough value of an action for the side to move: damage dealt, power gained, danger avoided. */
function score(state: BattleState, action: Action): number {
  const me = activeOf(state.sides[state.turn])
  const foe = activeOf(state.sides[other(state.turn)])
  const { state: next, event } = act(state, action)
  if (next.winner === state.turn) return 10_000
  let v = event.damage * 1.2 + event.heal + (event.actorG - event.targetG) * 0.9
  if (event.ko) v += 600
  if (event.blocked) v -= 150
  if (action.kind === 'ability') {
    const a = action.card.ability
    if (a.type === 'shield') v += me.shield ? -200 : me.hp < MAX_HP * 0.45 ? 220 : 40
    if (a.type === 'boost') v += 40
  }
  if (action.kind === 'switch') {
    const incoming = next.sides[state.turn].team[action.to]
    // switch out of a losing match-up when hurt
    const ratioNow = powerOf(state, me) / powerOf(state, foe)
    const ratioNew = powerOf(next, incoming) / powerOf(next, activeOf(next.sides[other(state.turn)]))
    // only worth a turn when the match-up improves a lot or the Bakugan on the field is nearly down
    v = (ratioNew - ratioNow) * 300 + ((incoming.hp - me.hp) / MAX_HP) * 200 + (me.hp < MAX_HP * 0.25 && incoming.hp > MAX_HP * 0.5 ? 120 : -260)
  }
  return v
}

export function legalActions(state: BattleState): Action[] {
  const side = state.sides[state.turn]
  return [
    { kind: 'basic' },
    ...side.hand.filter((c) => canPlay(side, c)).map((card) => ({ kind: 'ability', card }) as Action),
    ...aliveBench(side).map(({ i }) => ({ kind: 'switch', to: i }) as Action),
  ]
}

export function chooseAction(state: BattleState, rng: () => number = Math.random): Action {
  const options = legalActions(state).map((action) => ({ action, v: score(state, action) + rng() * 40 }))
  options.sort((a, b) => b.v - a.v)
  return options[0].action
}

/** A random opponent team of three different Bakugan. */
export function randomTeam(exclude: string[] = [], rng: () => number = Math.random): Entrant[] {
  const pool = shuffle(BAKUGAN.filter((b) => !exclude.includes(b.id)), rng)
  const picks = (pool.length >= TEAM_SIZE ? pool : shuffle(BAKUGAN, rng)).slice(0, TEAM_SIZE)
  return picks.map((bakugan) => ({ bakugan, form: Math.floor(rng() * Math.min(2, bakugan.evolutions.length)) }))
}
