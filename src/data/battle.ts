import { formBrawlG, type Entrant } from './bakugan'
import type { ElementId } from './elements'

/** Bonus a Bakugan gets when standing on a Gate Card of its own attribute. */
export const GATE_BONUS = 100

export function startingPower(entrant: Entrant, gate: ElementId | null) {
  const base = formBrawlG(entrant)
  const gateBonus = gate === entrant.bakugan.element ? GATE_BONUS : 0
  return { base, gateBonus, total: base + gateBonus }
}
