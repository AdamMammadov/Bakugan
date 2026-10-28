import { BAKUGAN, type Entrant } from './bakugan'
import { ROSTER } from './roster'
import type { ElementId } from './elements'

/**
 * Gate Cards, after the Battle Brawlers anime and the season-1 card game (the card database and the Bakugan Wiki). A Gate Card is set face-down and does nothing until its
 * owner opens it ("Gate Card, open!"). It always works in the favour of the brawler it is open for: its owner, or the
 * opponent who closed it and opened it for themselves (engine gateDelta):
 * - Attribute Gate Cards give that brawler's Bakugan extra G's: in full if it has the card's attribute, half otherwise;
 * - Character Gate Cards raise its G-Power by half if it is the card's Bakugan (×1.5), by a quarter otherwise;
 * - Command Gate Cards have a rule of their own (Level Down, Energy Merge, Super Pyrus…).
 * "You" in a card's text is the brawler it is open for.
 */
export type GateCommand =
  | 'level-down'
  | 'energy-merge'
  | 'super-pyrus'
  | 'positive-delta'
  | 'reloaded'
  | 'grand-spirit'
  | 'trade-off'

export type GateCard =
  | { id: string; kind: 'attribute'; name: string; element: ElementId; amount: number; text: string }
  | { id: string; kind: 'character'; name: string; bakugan: string; text: string }
  | {
      id: string
      kind: 'command'
      name: string
      command: GateCommand
      /** The colour the card is drawn in. */
      element: ElementId
      /** G the card moves. */
      amount: number
      /** G-Power the opponent's Bakugan needs for the card to hit it (Level Down, Trade Off). */
      threshold?: number
      text: string
    }

const ELEMENTS: ElementId[] = ['pyrus', 'aquos', 'subterra', 'ventus', 'haos', 'darkus']
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

/** Attribute amounts there are cards for; a gate deck uses ATTRIBUTE_GATE_G. */
const ATTRIBUTE_AMOUNTS = [50, 100, 150, 200]
export const ATTRIBUTE_GATE_G = 150

export const ATTRIBUTE_GATES: GateCard[] = ELEMENTS.flatMap((element) =>
  ATTRIBUTE_AMOUNTS.map((amount) => ({
    id: `${element}-${amount}`,
    kind: 'attribute' as const,
    name: `${cap(element)} - ${amount}`,
    element,
    amount,
    text: `Your Bakugan gains +${amount} G's if it is ${cap(element)}, +${amount / 2} G's otherwise.`,
  })),
)

export const CHARACTER_GATES: GateCard[] = [
  ['dragonoid', 'Dragonoid'],
  ['preyas', 'Preyas'],
  ['gorem', 'Gorem'],
  ['skyress', 'Skyress'],
  ['tigrerra', 'Tigrerra'],
  ['hydranoid', 'Hydranoid'],
  // launch roster Bakugan that have their own Character Gate Card
  ...ROSTER.filter((b) => b.characterGate).map((b) => [b.id, b.name]),
].map(([bakugan, name]) => ({
  id: `char-${bakugan}`,
  kind: 'character' as const,
  name,
  bakugan,
  text: `If your Bakugan is ${name}, its G-Power rises by half (×1.5); any other Bakugan's, by a quarter.`,
}))

/** Season-1 Command Gate Cards, their numbers set to this game's G scale. */
export const COMMAND_GATES: GateCard[] = [
  {
    id: 'level-down',
    kind: 'command',
    name: 'Level Down',
    command: 'level-down',
    element: 'subterra',
    amount: 100,
    threshold: 500,
    text: "If the opponent's Bakugan has 500 G's or more, it loses 100 G's.",
  },
  {
    id: 'energy-merge',
    kind: 'command',
    name: 'Energy Merge',
    command: 'energy-merge',
    element: 'aquos',
    amount: 100,
    text: "100 G's pass from the opponent's Bakugan to yours.",
  },
  {
    id: 'super-pyrus',
    kind: 'command',
    name: 'Super Pyrus',
    command: 'super-pyrus',
    element: 'pyrus',
    amount: 100,
    text: "If the opponent's Bakugan is ahead by 100 G's or less, the two Bakugan swap G-Powers.",
  },
  {
    id: 'positive-delta',
    kind: 'command',
    name: 'Positive Delta',
    command: 'positive-delta',
    element: 'haos',
    amount: 200,
    text: "A Pyrus, Aquos or Haos opponent loses 200 G's; an opponent of any other attribute, 100 G's.",
  },
  {
    id: 'reloaded',
    kind: 'command',
    name: 'Reloaded',
    command: 'reloaded',
    element: 'ventus',
    amount: 0,
    text: 'Your Bakugan gets back every G the opponent has taken from it in this battle.',
  },
  {
    id: 'grand-spirit',
    kind: 'command',
    name: 'Grand Spirit',
    command: 'grand-spirit',
    element: 'darkus',
    amount: 100,
    text: "Your Bakugan gains 100 G's for every battle you have lost in this match.",
  },
  {
    id: 'trade-off',
    kind: 'command',
    name: 'Trade Off',
    command: 'trade-off',
    element: 'darkus',
    amount: 150,
    threshold: 700,
    text: "If the opponent's Bakugan has 700 G's or more, it loses 150 G's.",
  },
]

export const ALL_GATES = [...ATTRIBUTE_GATES, ...CHARACTER_GATES, ...COMMAND_GATES]
export const GATE_BY_ID = Object.fromEntries(ALL_GATES.map((g) => [g.id, g])) as Record<string, GateCard>

/** The Command Gate Card each attribute's brawlers bring. */
const COMMAND_FOR: Record<ElementId, string> = {
  pyrus: 'super-pyrus',
  aquos: 'energy-merge',
  subterra: 'level-down',
  ventus: 'reloaded',
  haos: 'positive-delta',
  darkus: 'trade-off',
}

/** The element a gate card is drawn in (character gates use their Bakugan's attribute). */
export function gateElementOf(gate: GateCard): ElementId {
  if (gate.kind === 'character') return BAKUGAN.find((b) => b.id === gate.bakugan)?.element ?? 'pyrus'
  return gate.element
}

/** Short label for a gate card, e.g. "Pyrus +150", "Dragonoid ×2" or "Level Down". */
export function gateLabel(gate: GateCard) {
  if (gate.kind === 'attribute') return `${cap(gate.element)} +${gate.amount}`
  if (gate.kind === 'character') return `${gate.name} ×1.5`
  return gate.name
}

export const gateKindLabel = (gate: GateCard) =>
  gate.kind === 'attribute' ? 'ATTRIBUTE GATE' : gate.kind === 'character' ? 'CHARACTER GATE' : 'COMMAND GATE'

/**
 * A side's Gate Card deck: three cards, one for each battle it sets (a brawler sets at most three in a match).
 * The lead Bakugan's attribute gate, its attribute's command gate, and the lead's character gate when it has one
 * (else Grand Spirit, which helps a brawler who is behind).
 */
export function gateDeck(team: Entrant[]): GateCard[] {
  if (!team.length) return []
  const lead = team[0].bakugan
  const attribute = GATE_BY_ID[`${lead.element}-${ATTRIBUTE_GATE_G}`]
  const command = GATE_BY_ID[COMMAND_FOR[lead.element]]
  const third = GATE_BY_ID[`char-${lead.id}`] ?? GATE_BY_ID['grand-spirit']
  return [attribute, command, third]
}
