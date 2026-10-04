import { BAKUGAN, type Entrant } from './bakugan'
import type { ElementId } from './elements'

/**
 * Gate Cards from the BakuProject card database (https://bakuproject.info/cards):
 * Attribute Gate Cards give Bakugan of one attribute extra G's; Character Gate Cards
 * double the power of one specific Bakugan.
 */
export type GateCard =
  | { id: string; kind: 'attribute'; name: string; element: ElementId; amount: number; text: string }
  | { id: string; kind: 'character'; name: string; bakugan: string; text: string }

const ELEMENTS: ElementId[] = ['pyrus', 'aquos', 'subterra', 'ventus', 'haos', 'darkus']
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

export const ATTRIBUTE_GATES: GateCard[] = ELEMENTS.flatMap((element) =>
  [50, 100, 150].map((amount) => ({
    id: `${element}-${amount}`,
    kind: 'attribute' as const,
    name: `${cap(element)} - ${amount}`,
    element,
    amount,
    text: `${cap(element)} Bakugan present on the Gate Card gain +${amount} G's.`,
  })),
)

export const CHARACTER_GATES: GateCard[] = [
  ['dragonoid', 'Dragonoid'],
  ['preyas', 'Preyas'],
  ['gorem', 'Gorem'],
  ['skyress', 'Skyress'],
  ['tigrerra', 'Tigrerra'],
  ['hydranoid', 'Hydranoid'],
].map(([bakugan, name]) => ({
  id: `char-${bakugan}`,
  kind: 'character' as const,
  name,
  bakugan,
  text: `${name}'s power level is doubled.`,
}))

export const ALL_GATES = [...ATTRIBUTE_GATES, ...CHARACTER_GATES]
export const GATE_BY_ID = Object.fromEntries(ALL_GATES.map((g) => [g.id, g])) as Record<string, GateCard>

/** The element a gate card is drawn in (character gates use their Bakugan's attribute). */
export function gateElementOf(gate: GateCard): ElementId {
  return gate.kind === 'attribute' ? gate.element : (BAKUGAN.find((b) => b.id === gate.bakugan)?.element ?? 'pyrus')
}

/**
 * A side's Gate Card deck, built from its team: an attribute gate for each Bakugan
 * (50, 100 and 150 G's) plus the lead Bakugan's character gate when it has one.
 */
export function gateDeck(team: Entrant[]): GateCard[] {
  const attribute = team.map((e, i) => GATE_BY_ID[`${e.bakugan.element}-${[50, 100, 150][i % 3]}`])
  const character = team.length ? GATE_BY_ID[`char-${team[0].bakugan.id}`] : undefined
  return character ? [...attribute, character] : attribute
}
