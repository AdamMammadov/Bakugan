import { formOf, type Ability, type Bakugan, type Entrant } from '../data/bakugan'
import { startingPower } from '../data/battle'
import type { ElementId } from '../data/elements'

export const MAX_HP = 1000
const MIN_G = 100
const BASIC_POWER = 120

export type SideIndex = 0 | 1

export interface Fighter {
  bakugan: Bakugan
  form: number
  /** Display name of the form, e.g. "Alpha Hydranoid". */
  name: string
  hp: number
  g: number
  used: string[]
  shield: boolean
}

export interface BattleState {
  fighters: [Fighter, Fighter]
  turn: SideIndex
  round: number
  winner: SideIndex | null
  log: string[]
}

export type Action = { kind: 'basic' } | { kind: 'ability'; ability: Ability }

/** What happened during one action; drives the arena animation. */
export interface BattleEvent {
  actor: SideIndex
  target: SideIndex
  action: Action
  /** Life lost by the target (0 when blocked). */
  damage: number
  /** Life regained by the actor (drain). */
  heal: number
  /** G-Power change for actor / target. */
  actorG: number
  targetG: number
  blocked: boolean
  ko: boolean
}

export const other = (side: SideIndex): SideIndex => (side === 0 ? 1 : 0)

export function startBattle(left: Entrant, right: Entrant, gate: ElementId | null): BattleState {
  const fighter = (e: Entrant): Fighter => ({
    bakugan: e.bakugan,
    form: e.form,
    name: formOf(e).name,
    hp: MAX_HP,
    g: startingPower(e, gate).total,
    used: [],
    shield: false,
  })
  return {
    fighters: [fighter(left), fighter(right)],
    turn: 0,
    round: 1,
    winner: null,
    log: [`${formOf(left).name} vs ${formOf(right).name} — brawl!`],
  }
}

/** Damage scales with the attacker/defender G-Power ratio, clamped so nobody is untouchable. */
function strike(power: number, attacker: Fighter, defender: Fighter) {
  const ratio = Math.min(Math.max(attacker.g / defender.g, 0.5), 2)
  return Math.round(power * ratio)
}

export function act(state: BattleState, action: Action): { state: BattleState; event: BattleEvent } {
  const actor = state.turn
  const target = other(actor)
  const fighters = state.fighters.map((f) => ({ ...f, used: [...f.used] })) as [Fighter, Fighter]
  const me = fighters[actor]
  const foe = fighters[target]
  const event: BattleEvent = { actor, target, action, damage: 0, heal: 0, actorG: 0, targetG: 0, blocked: false, ko: false }
  const name = me.name
  let line: string

  if (action.kind === 'ability') me.used.push(action.ability.id)
  const hostile = action.kind === 'basic' || action.ability.type !== 'boost'
  const isShield = action.kind === 'ability' && action.ability.type === 'shield'

  if (hostile && !isShield && foe.shield) {
    foe.shield = false
    event.blocked = true
    line = `${foe.name}'s shield blocks ${action.kind === 'basic' ? 'the attack' : action.ability.name}!`
  } else if (action.kind === 'basic') {
    event.damage = strike(BASIC_POWER, me, foe)
    line = `${name} attacks for ${event.damage} damage.`
  } else {
    const a = action.ability
    switch (a.type) {
      case 'attack':
        event.damage = strike(BASIC_POWER + a.amount * 0.8, me, foe)
        line = `${name} uses ${a.name}! ${event.damage} damage.`
        break
      case 'boost':
        event.actorG = a.amount
        line = `${name} uses ${a.name}: +${a.amount}G.`
        break
      case 'weaken': {
        const cut = Math.min(a.amount, foe.g - MIN_G)
        event.targetG = -cut
        event.damage = strike(BASIC_POWER * 0.5, me, foe)
        line = `${name} uses ${a.name}: ${foe.name} −${cut}G.`
        break
      }
      case 'drain': {
        const stolen = Math.min(a.amount, foe.g - MIN_G)
        event.targetG = -stolen
        event.actorG = stolen
        event.damage = Math.round(60 + a.amount * 0.6)
        event.heal = Math.round(a.amount * 0.4)
        line = `${name} uses ${a.name}: steals ${stolen}G and ${event.heal} life!`
        break
      }
      case 'shield':
        me.shield = true
        line = `${name} uses ${a.name} and raises a shield.`
        break
    }
  }

  me.g += event.actorG
  foe.g += event.targetG
  foe.hp = Math.max(0, foe.hp - event.damage)
  me.hp = Math.min(MAX_HP, me.hp + event.heal)
  event.ko = foe.hp === 0

  return {
    event,
    state: {
      fighters,
      turn: target,
      round: actor === 1 ? state.round + 1 : state.round,
      winner: event.ko ? actor : null,
      log: [...state.log, line, ...(event.ko ? [`${foe.name} is defeated! ${name} wins!`] : [])],
    },
  }
}

export const available = (f: Fighter) => f.bakugan.abilities.filter((a) => !f.used.includes(a.id))

/** Opponent AI: simple priorities with a bit of randomness. */
export function chooseAction(state: BattleState): Action {
  const me = state.fighters[state.turn]
  const foe = state.fighters[other(state.turn)]
  const hand = available(me)
  const pick = (type: Ability['type']) => hand.find((a) => a.type === type)
  const roll = Math.random()

  if (foe.shield) {
    const boost = pick('boost')
    if (boost) return { kind: 'ability', ability: boost }
    return { kind: 'basic' }
  }
  if (me.hp < MAX_HP * 0.35 && !me.shield) {
    const save = pick('shield') ?? pick('drain')
    if (save && roll < 0.7) return { kind: 'ability', ability: save }
  }
  if (me.g < foe.g && roll < 0.5) {
    const fix = pick('boost') ?? pick('weaken') ?? pick('drain')
    if (fix) return { kind: 'ability', ability: fix }
  }
  const attacks = hand.filter((a) => a.type === 'attack' || a.type === 'drain')
  if (attacks.length && roll < 0.75) {
    return { kind: 'ability', ability: attacks.reduce((best, a) => (a.amount > best.amount ? a : best)) }
  }
  if (hand.length && roll < 0.85) return { kind: 'ability', ability: hand[Math.floor(Math.random() * hand.length)] }
  return { kind: 'basic' }
}
