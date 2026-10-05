import { BAKUGAN } from '../data/bakugan'
import { seasonAt, type SeasonRole } from './season'

/** Start date of Season 1; later seasons follow every 35 days. */
export const SEASON_ONE_START = '2026-10-05'

/**
 * The Bakugan each season brings and how they are obtained: 4 from the pass (slot order =
 * pass levels 10, 20, 30, 40) and 8 earned in play. Everything else is in the shop.
 * Season 1 uses launch Bakugan, spread over the attributes; later seasons add new ones.
 */
const SEASONS: Record<number, { pass: string[]; challenge: string[] }> = {
  1: {
    pass: ['helios', 'vladitor', 'ingram', 'elico'],
    challenge: ['fourtress', 'elfin', 'wilda', 'premo-vulcan', 'altair', 'nemus', 'brontes', 'leonidas'],
  },
}

/** The season running now. */
export const currentSeason = (now = Date.now()) => seasonAt(SEASON_ONE_START, now)

/** Bakugan that belong to a season: the 4 pass ones (in slot order) and the in-play ones. */
export function seasonBakugan(season: number) {
  const s = SEASONS[season]
  const known = (ids: string[] = []) => ids.filter((id) => BAKUGAN.some((b) => b.id === id))
  return { pass: known(s?.pass).slice(0, 4), challenge: known(s?.challenge) }
}

/** The season a Bakugan was released in and how, if it is a season Bakugan at all. */
export function seasonOfBakugan(id: string): { season: number; role: SeasonRole } | null {
  for (const [season, s] of Object.entries(SEASONS)) {
    if (s.pass.includes(id)) return { season: Number(season), role: 'pass' }
    if (s.challenge.includes(id)) return { season: Number(season), role: 'challenge' }
  }
  return null
}
