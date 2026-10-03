import type { Bakugan } from './bakugan'
import type { ElementId } from './elements'

/** Bonus a Bakugan gets when standing on a Gate Card of its own attribute. */
export const GATE_BONUS = 100

export interface BrawlSide {
  bakugan: Bakugan
  abilities: string[]
}

export function brawlPower(side: BrawlSide, gate: ElementId | null) {
  const base = side.bakugan.brawlG
  const gateBonus = gate === side.bakugan.element ? GATE_BONUS : 0
  const abilityBonus = side.bakugan.abilities
    .filter((a) => side.abilities.includes(a.id))
    .reduce((sum, a) => sum + a.gBoost, 0)
  return { base, gateBonus, abilityBonus, total: base + gateBonus + abilityBonus }
}
