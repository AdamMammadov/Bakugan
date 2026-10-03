import type { Bakugan } from './bakugan'
import type { ElementId } from './elements'

/** Bonus a Bakugan gets when standing on a Gate Card of its own attribute. */
export const GATE_BONUS = 100

export function startingPower(bakugan: Bakugan, gate: ElementId | null) {
  const base = bakugan.brawlG
  const gateBonus = gate === bakugan.element ? GATE_BONUS : 0
  return { base, gateBonus, total: base + gateBonus }
}
