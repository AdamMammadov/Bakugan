import { useAdmin } from '../admin/useAdmin'
import { BAKUGAN } from '../data/bakugan'
import { seasonAt, type SeasonRole } from './season'

/** The season running now, from the admin's Season 1 start date. */
export const currentSeason = (now = Date.now()) => seasonAt(useAdmin.getState().seasonStart, now)

/** Bakugan that belong to a season: the 4 pass ones (in slot order) and the in-play ones. */
export function seasonBakugan(season: number) {
  const roles = useAdmin.getState().seasonRoles[season] ?? {}
  const of = (role: SeasonRole) => BAKUGAN.filter((b) => roles[b.id] === role).map((b) => b.id)
  return { pass: of('pass').slice(0, 4), challenge: of('challenge') }
}

/** The season a Bakugan was released in and how, if it is a season Bakugan at all. */
export function seasonOfBakugan(id: string): { season: number; role: SeasonRole } | null {
  const all = useAdmin.getState().seasonRoles
  for (const [season, roles] of Object.entries(all)) if (roles[id]) return { season: Number(season), role: roles[id] }
  return null
}
