import { botById, botNow, isBot } from './bots'
import { roll } from './botProgress'
import { rankScore, tierOf } from './useProfiles'
import type { Clan } from './useClans'

/**
 * Clan numbers worked out from the clock: what CPU members brawled while in the clan (botProgress.ts plays their
 * brawls), clan XP and level, and the week clan goals and the clan war count in. No store here, so clan life
 * (clanLife.ts) can bank a leaving member's XP too.
 */

const MINUTE = 60_000
const DAY = 86_400_000

/** Clan XP per brawl a member plays while in the clan. */
export const CLAN_XP = { win: 10, loss: 3, ko: 1 }

export interface Tally {
  brawls: number
  wins: number
  kos: number
  /** Wins in ranked brawls (all of a CPU brawler's brawls are ranked). */
  ranked: number
}

export const NO_TALLY: Tally = { brawls: 0, wins: 0, kos: 0, ranked: 0 }

export const addTally = (a: Tally, b: Tally): Tally => ({
  brawls: a.brawls + b.brawls,
  wins: a.wins + b.wins,
  kos: a.kos + b.kos,
  ranked: a.ranked + b.ranked,
})

export const xpOf = (t: Tally) => t.wins * CLAN_XP.win + (t.brawls - t.wins) * CLAN_XP.loss + t.kos * CLAN_XP.ko

/** A CPU brawler's brawls that ended in (from, to]. */
export function botTally(botId: string, from: number, to: number): Tally {
  const base = botById(botId)
  if (!base || to <= from) return NO_TALLY
  const a = botNow(base, from)
  const b = botNow(base, to)
  const wins = b.wins - a.wins
  return { brawls: wins + b.losses - a.losses, wins, kos: b.kos - a.kos, ranked: wins }
}

/** When a member joined (CPU clans' first members: when the clan was founded). */
export const joinedAt = (clan: Clan, id: string) => clan.since?.[id] ?? clan.createdAt

/** Clan XP a CPU member has earned since joining. */
export const botXp = (clan: Clan, botId: string, now: number) => xpOf(botTally(botId, joinedAt(clan, botId), now))

/** A CPU clan's XP from before brawls were played from the clock (it has been around a while). */
function legacyXp(clan: Clan, now: number) {
  if (!clan.cpu) return 0
  let seed = 3
  for (const ch of clan.id) seed = (Math.imul(seed, 31) + ch.charCodeAt(0)) | 0
  const days = Math.max(0, (Math.min(now, Date.UTC(2026, 9, 17)) - clan.createdAt) / DAY)
  return Math.round(days * 40 * (0.75 + 0.5 * roll(seed, 5)))
}

/** All a clan's XP: banked (players' brawls, members who left) plus what its CPU members earned since joining. */
export const clanXp = (clan: Clan, now: number) =>
  (clan.xp ?? 0) + legacyXp(clan, now) + clan.members.filter(isBot).reduce((n, id) => n + botXp(clan, id, now), 0)

/** Level from XP: level L takes 250 × L more XP to clear. */
export function levelOf(xp: number) {
  let level = 1
  let from = 0
  while (xp >= from + 250 * level) {
    from += 250 * level
    level++
  }
  return { level, into: xp - from, need: 250 * level }
}

/** Monday 00:00 (local time) of the week `now` is in. */
export function weekStart(now: number) {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

/** The next Monday 00:00. */
export const weekEnd = (now: number) => {
  const d = new Date(weekStart(now))
  d.setDate(d.getDate() + 7)
  return d.getTime()
}

/** "2026-10-26": a week's id (its Monday). */
export const weekId = (start: number) => {
  const d = new Date(start)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface BotBrawl {
  botId: string
  at: number
  won: boolean
  kos: number
  /** The rank they reached with this brawl, when it took them up one. */
  rankUp?: string
}

const brawlCache = new Map<string, BotBrawl[]>()

/** A CPU brawler's brawls that ended in (from, to], newest first (worked out once a minute). */
export function botBrawls(botId: string, from: number, to: number): BotBrawl[] {
  const base = botById(botId)
  if (!base) return []
  const key = `${botId}|${Math.floor(from / MINUTE)}|${Math.floor(to / MINUTE)}`
  const hit = brawlCache.get(key)
  if (hit) return hit
  const out: BotBrawl[] = []
  let t = to
  for (let i = 0; i < 120; i++) {
    const at = botNow(base, t).lastBattle
    if (!at || at <= from) break
    // the bot's record a minute either side of the brawl (it moves to the minute)
    const before = botNow(base, at - MINUTE)
    const after = botNow(base, at + MINUTE)
    const was = tierOf(rankScore(before))
    const is = tierOf(rankScore(after))
    out.push({
      botId,
      at,
      won: after.wins > before.wins,
      kos: after.kos - before.kos,
      rankUp: is.step > was.step ? is.rank : undefined,
    })
    t = at - MINUTE
  }
  if (brawlCache.size > 400) brawlCache.clear()
  brawlCache.set(key, out)
  return out
}
