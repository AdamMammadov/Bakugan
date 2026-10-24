import { BAKUGAN } from '../data/bakugan'
import type { ElementId } from '../data/elements'
import { LAUNCH } from '../season/release'
import type { Avatar } from './avatar'
import { botById, botNow, botTeam, type BotBrawler } from './bots'
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
  /** Bakugan they own, furthest evolved first (the team's always among them). */
  collection: { id: string; form: number }[]
  bestStreak?: number
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
      collection: botCollection(bot),
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
    collection: [...p.collection].sort((a, b) => b.form - a.form || b.xp - a.xp).map((o) => ({ id: o.id, form: o.form })),
    bestStreak: p.stats.bestStreak,
  }
}

/**
 * The Bakugan a CPU brawler owns: their team plus more launch Bakugan the more they have won, mostly of
 * their own attribute (always the same ones for the same bot).
 */
export function botCollection(bot: BotBrawler) {
  const team = botTeam(bot)
  const n = Number(bot.id.slice(4))
  const size = Math.min(10, team.length + Math.floor(bot.wins / 45))
  const launch = BAKUGAN.filter((b) => LAUNCH.includes(b.id) && !team.some((t) => t.id === b.id))
  const own = launch.filter((b) => b.element === bot.element)
  const rest = launch.filter((b) => b.element !== bot.element)
  const picks = [...own, ...rest.map((_, k) => rest[(n * 5 + k * 7) % rest.length])]
  const extra = [...new Set(picks)].slice(0, size - team.length)
  const stage = bot.rating >= 3000 ? 1 : 0
  return [
    ...team,
    ...extra.map((b) => ({ id: b.id, form: Math.min(b.element === bot.element ? stage : 0, b.evolutions.length - 1) })),
  ]
}

/** A clan's members that still exist, in clan order. */
export const clanMembers = (clan: Clan, profiles: Profile[], now: number) =>
  clan.members.map((id) => brawlerOf(id, profiles, now)).filter((b): b is BrawlerView => !!b)

/** Clan score, as in the clan rankings: the members' rank scores added up. */
export const clanScore = (clan: Clan, profiles: Profile[], now: number) =>
  clanMembers(clan, profiles, now).reduce((n, m) => n + m.score, 0)

/** Colour of each rank tier (index = tier), as on the rankings page. */
export const TIER_COLORS = ['#9aa3b5', '#7ec8e3', '#3ee07a', '#f5c518', '#ff7a2f', '#e040fb']
