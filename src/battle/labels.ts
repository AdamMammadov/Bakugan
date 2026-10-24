import { abilityLabel, type Ability } from '../data/bakugan'

/** The icon each kind of ability card shows in battle. */
export const TYPE_ICON: Record<Ability['type'], string> = {
  attack: '⚔',
  boost: '▲',
  weaken: '▼',
  drain: '⇄',
  shield: '⊘',
  finisher: '☠',
}

/** A short label for an ability card's effect, e.g. "▲ +100G" or "⊘ NULLIFY". */
export const cardTag = (a: Ability) => `${TYPE_ICON[a.type]} ${abilityLabel(a)}`
