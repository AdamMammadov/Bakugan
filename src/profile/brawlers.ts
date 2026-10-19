import type { ElementId } from '../data/elements'
import type { Avatar } from './avatar'
import { botById, botNow, botTeam } from './bots'
import type { Clan } from './useClans'
import { rankScore, type Profile } from './useProfiles'

/** What the clan pages show of a brawler, whether a player on this device or a CPU bot. */
export interface BrawlerView {
  id: string
  name: string
  firstName: string
  cpu: boolean
  avatar: Avatar
  element: ElementId
  rating: number
  xp: number
  score: number
  wins: number
  losses: number
  kos: number
  bio: string
  frame?: string
  title?: string
  since?: number
  /** Battle team, lead first. */
  team: { id: string; form: number }[]
  /** CPU brawlers: brawls so far today and when the last one ended. */
  today?: number
  lastBattle?: number | null
}

/** A brawler as they stand at `now` (CPU records move with the clock, see botProgress.ts). */
export function brawlerOf(id: string, profiles: Profile[], now: number): BrawlerView | null {
  const base = botById(id)
  if (base) {
    const bot = botNow(base, now)
    return {
      id,
      name: bot.name,
      firstName: bot.name.split(' ')[0],
      cpu: true,
      avatar: { kind: 'preset', id: bot.characterId },
      element: bot.element,
      rating: bot.rating,
      xp: bot.xp,
      score: rankScore(bot),
      wins: bot.wins,
      losses: bot.losses,
      kos: bot.kos,
      bio: bot.bio,
      team: botTeam(bot),
      today: bot.today,
      lastBattle: bot.lastBattle,
    }
  }
  const p = profiles.find((x) => x.id === id)
  if (!p) return null
  return {
    id,
    name: `${p.firstName} ${p.lastName}`,
    firstName: p.firstName,
    cpu: false,
    avatar: p.avatar,
    element: p.element,
    rating: p.rating,
    xp: p.xp,
    score: rankScore(p),
    wins: p.stats.wins,
    losses: p.stats.losses,
    kos: p.stats.kos,
    bio: p.bio,
    frame: p.cosmetics?.frame,
    title: p.cosmetics?.title,
    since: p.createdAt,
    team: p.team.flatMap((t) => p.collection.filter((o) => o.id === t).map((o) => ({ id: o.id, form: o.form }))),
  }
}

/** A clan's members that still exist, in clan order. */
export const clanMembers = (clan: Clan, profiles: Profile[], now: number) =>
  clan.members.map((id) => brawlerOf(id, profiles, now)).filter((b): b is BrawlerView => !!b)

/** Clan score, as in the clan rankings: the members' rank scores added up. */
export const clanScore = (clan: Clan, profiles: Profile[], now: number) =>
  clanMembers(clan, profiles, now).reduce((n, m) => n + m.score, 0)

/** Colour of each rank tier (index = tier), as on the rankings page. */
export const TIER_COLORS = ['#9aa3b5', '#7ec8e3', '#3ee07a', '#f5c518', '#ff7a2f', '#e040fb']
