import { asset } from '../asset'
import type { ElementId } from './elements'

/** One card of the BakuProject card database (public/data/cards.json, built by tools/data/cards.py). */
export interface DbCard {
  id: string
  name: string
  type: CardType
  attributes: ElementId[]
  /** Who can play it: a Bakugan ("Pyrus Neo Dragonoid") or an attribute ("Haos"); null for anyone. */
  user: string | null
  text: string
  /** Deck-building cost in BakuProject. */
  hsp: number
  /** Copies allowed in one deck. */
  limit: number
  catalogue: string
  /** Not yet released in BakuProject. */
  pending?: boolean
}

export type CardType = 'character' | 'ability' | 'attribute-gate' | 'character-gate' | 'command-gate'

export const CARD_TYPES: { id: CardType; label: string; group: 'Ability' | 'Gate' }[] = [
  { id: 'character', label: 'Character Ability', group: 'Ability' },
  { id: 'ability', label: 'Attribute Ability', group: 'Ability' },
  { id: 'attribute-gate', label: 'Attribute Gate', group: 'Gate' },
  { id: 'character-gate', label: 'Character Gate', group: 'Gate' },
  { id: 'command-gate', label: 'Command Gate', group: 'Gate' },
]

const ATTRIBUTE_WORD = /^(Pyrus|Aquos|Subterra|Ventus|Haos|Darkus)\s+/i

/** "Pyrus Neo Dragonoid" → "Neo Dragonoid": the Bakugan without its attribute variant. */
export const baseBakugan = (user: string) => user.replace(ATTRIBUTE_WORD, '').trim()

/** The Bakugan a card belongs to: character abilities by their user, character gates by their name. */
export function cardBakugan(card: DbCard): string | null {
  if (card.type === 'character' && card.user) return baseBakugan(card.user)
  if (card.type === 'character-gate') return baseBakugan(card.name)
  return null
}

let cache: Promise<DbCard[]> | null = null

export function loadCards(): Promise<DbCard[]> {
  cache ??= fetch(asset('data/cards.json')).then((r) => {
    if (!r.ok) throw new Error(`Card database failed to load (${r.status})`)
    return r.json() as Promise<DbCard[]>
  })
  return cache
}
