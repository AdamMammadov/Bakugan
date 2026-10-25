import { abilitiesOf, formBrawlG, type Bakugan, type Entrant } from '../data/bakugan'
import { ELEMENT_BY_ID, type ElementId, type ElementInfo } from '../data/elements'
import {
  bakuganById,
  canEvolve,
  cardCount,
  nextCardXp,
  nextEvolveXp,
  type OwnedBakugan,
  type Profile,
} from '../profile/useProfiles'

/**
 * What the profile's collection browser works with: one row per owned Bakugan, its sorts and filters, and the
 * view the player picked (kept in this browser).
 */

const entrants = new Map<string, Entrant>()

/** One Entrant per Bakugan, form and skin, so a portrait keeps its picture request while the page re-renders. */
export function entrantOf(id: string, form: number, skin?: string): Entrant {
  const key = `${id}-${form}-${skin ?? ''}`
  let e = entrants.get(key)
  if (!e) entrants.set(key, (e = { bakugan: bakuganById(id), form, skin }))
  return e
}

export interface Row {
  owned: OwnedBakugan
  bakugan: Bakugan
  element: ElementInfo
  entrant: Entrant
  /** Name of the current form. */
  name: string
  g: number
  /** XP the next form needs (null: final form) and the XP the current form began at. */
  need: number | null
  prev: number
  /** 0–1 of the way to the next form (1 in the final form). */
  progress: number
  ready: boolean
  cards: number
  cardsTotal: number
  nextCard: number | null
  /** Place in the battle team (0 = lead), -1 when not in it. */
  team: number
  /** Place in the collection (higher = got later). */
  order: number
  usedAt: number
}

/** When the Bakugan last brawled, if the save records it (0 otherwise). */
const usedAt = (o: OwnedBakugan) => o.lastUsed ?? 0

export function rowOf(owned: OwnedBakugan, profile: Profile, order: number): Row {
  const bakugan = bakuganById(owned.id)
  const need = nextEvolveXp(bakugan, owned)
  const prev = owned.form === 0 ? 0 : (nextEvolveXp(bakugan, { ...owned, form: owned.form - 1 }) ?? 0)
  return {
    owned,
    bakugan,
    element: ELEMENT_BY_ID[bakugan.element],
    entrant: entrantOf(owned.id, owned.form, owned.skin),
    name: bakugan.evolutions[owned.form]?.name ?? bakugan.name,
    g: formBrawlG({ bakugan, form: owned.form }),
    need,
    prev,
    progress: need === null ? 1 : Math.max(0, Math.min(1, (owned.xp - prev) / (need - prev))),
    ready: canEvolve(owned),
    cards: cardCount(owned),
    cardsTotal: abilitiesOf(bakugan, owned.form).length,
    nextCard: nextCardXp(owned),
    team: profile.team.indexOf(owned.id),
    order,
    usedAt: usedAt(owned),
  }
}

// ---------------------------------------------------------------- sorts and filters

export type SortId = 'g' | 'evolve' | 'xp' | 'wins' | 'name' | 'recent'

export const SORTS: { id: SortId; label: string; hint: string }[] = [
  { id: 'g', label: 'G-POWER', hint: 'Strongest first' },
  { id: 'evolve', label: 'EVOLVE', hint: 'Closest to its next evolution first' },
  { id: 'xp', label: 'XP', hint: 'Most XP first' },
  { id: 'wins', label: 'WINS', hint: 'Most wins first' },
  { id: 'name', label: 'NAME', hint: 'A to Z' },
  { id: 'recent', label: 'RECENT', hint: 'Recently used first: the battle team, then the newest' },
]

const cmp = (a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0)
const toEvolve = (r: Row) => (r.need === null ? Infinity : r.need - r.owned.xp)
const teamRank = (r: Row) => (r.team === -1 ? 3 : r.team)

const COMPARE: Record<SortId, (a: Row, b: Row) => number> = {
  g: (a, b) => cmp(b.g, a.g),
  // ready ones first (furthest past the mark), final forms last
  evolve: (a, b) => cmp(toEvolve(a), toEvolve(b)) || cmp(b.owned.xp, a.owned.xp),
  xp: (a, b) => cmp(b.owned.xp, a.owned.xp),
  wins: (a, b) => cmp(b.owned.wins, a.owned.wins) || cmp(b.owned.battles, a.owned.battles),
  name: (a, b) => a.name.localeCompare(b.name),
  recent: (a, b) => cmp(b.usedAt, a.usedAt) || cmp(teamRank(a), teamRank(b)) || cmp(b.order, a.order),
}

export type QuickId = 'team' | 'soon' | 'locked'

export const QUICK: { id: QuickId; label: string; hint: string; test: (r: Row) => boolean }[] = [
  { id: 'team', label: 'IN TEAM', hint: 'In the battle team', test: (r) => r.team !== -1 },
  {
    id: 'soon',
    label: 'EVOLVE SOON',
    hint: 'Ready to evolve, or three quarters of the way there',
    test: (r) => r.ready || (r.need !== null && r.progress >= 0.75),
  },
  { id: 'locked', label: 'LOCKED CARDS', hint: 'Has ability cards still to unlock', test: (r) => r.cards < r.cardsTotal },
]

export interface Filters {
  query: string
  element: ElementId | 'all'
  quick: QuickId[]
}

/** Rows matching the search (any form's name, attribute or brawler), the attribute and every quick filter. */
export function filterRows(rows: Row[], f: Filters) {
  const q = f.query.trim().toLowerCase()
  return rows.filter(
    (r) =>
      (f.element === 'all' || r.bakugan.element === f.element) &&
      QUICK.every((k) => !f.quick.includes(k.id) || k.test(r)) &&
      (!q ||
        [r.bakugan.name, r.element.name, r.bakugan.brawler, ...r.bakugan.evolutions.map((e) => e.name)].some((s) =>
          s.toLowerCase().includes(q),
        )),
  )
}

export function sortRows(rows: Row[], sort: SortId, reverse: boolean) {
  const by = COMPARE[sort]
  const dir = reverse ? -1 : 1
  return [...rows].sort((a, b) => dir * by(a, b) || a.name.localeCompare(b.name))
}

// ---------------------------------------------------------------- the player's view

export interface Prefs {
  view: 'grid' | 'list'
  sort: SortId
  reverse: boolean
  element: ElementId | 'all'
  quick: QuickId[]
}

const PREFS_KEY = 'bakugan-collection-view'
export const DEFAULT_PREFS: Prefs = { view: 'grid', sort: 'g', reverse: false, element: 'all', quick: [] }

export function loadPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<Prefs> | null
    if (!p || typeof p !== 'object') return DEFAULT_PREFS
    return {
      view: p.view === 'list' ? 'list' : 'grid',
      sort: SORTS.some((s) => s.id === p.sort) ? p.sort! : DEFAULT_PREFS.sort,
      reverse: p.reverse === true,
      element: p.element && (p.element === 'all' || p.element in ELEMENT_BY_ID) ? p.element : 'all',
      quick: Array.isArray(p.quick) ? p.quick.filter((q) => QUICK.some((k) => k.id === q)) : [],
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    // private mode or a full storage: the view is just not remembered
  }
}

// ---------------------------------------------------------------- team

/** The team with this Bakugan added (a full team gives up its last place). */
export const joinTeam = (team: string[], id: string) => [...team.filter((x) => x !== id).slice(0, 2), id]
/** The team led by this Bakugan (a full team without it gives up its last place). */
export const leadTeam = (team: string[], id: string) => [id, ...team.filter((x) => x !== id)].slice(0, 3)
/** The team without this Bakugan; a team keeps at least one. */
export const leaveTeam = (team: string[], id: string) => (team.length > 1 ? team.filter((x) => x !== id) : team)

/** 12,900 → "12.9k" for the small labels. */
export const short = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1).replace(/\.0$/, '')}k` : `${Math.round(n)}`
