import { BOTS, botById, isBot } from './bots'
import { roll } from './botProgress'
import { leaveReason } from './clanChat'
import { botXp } from './clanStats'
import { isAvailable } from './presence'
import type { Clan, ClanMessage } from './useClans'

/**
 * Clan life without a server: CPU brawlers ask to join players' clans, now and then a CPU member leaves,
 * and the CPU clans swap a member here and there, always while the brawler is online. Time moves in short steps; what happens in a step is
 * rolled from the step's number and the clan, and played forward from where the save left off (catching
 * up on the time away, up to a limit) and live while the clans are on screen.
 */

const MINUTE = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000
export const STEP = 3 * MINUTE
/** After a long time away, clan life catches up on this much at most. */
export const CATCH_UP = 3 * DAY
/** Players plus CPU members in one clan. */
export const MAX_MEMBERS = 15
/** CPU clans keep between these many bots (they start with 6). */
const CPU_MIN = 4
const CPU_MAX = 8
const MAX_REQUESTS = 3
/** An open join request is dropped after this long. */
const REQUEST_LIFE = DAY
/** A CPU brawler stays at least this long in a clan they joined… */
const SETTLE = 2 * DAY
/** …and one who left, was removed or turned down keeps away from that clan this long… */
const AWAY = 3 * DAY
/** …and from every clan for this long after leaving one (a move straight to another clan aside). */
const REST = 12 * HOUR

// rates per hour
/** Join requests to a player's clan: soon after it is founded, then rarely, and none once it is full. */
const requestRate = (size: number) => (size <= 2 ? 4 : size < 5 ? 1 / 2 : size < 9 ? 1 / 7 : size < MAX_MEMBERS ? 1 / 20 : 0)
/** Each CPU member of a player's clan leaves about once a month. */
const OWN_LEAVE = 1 / (30 * 24)
/** Each CPU-clan member (not the leader) leaves about once in 25 days. */
const CPU_LEAVE = 1 / (25 * 24)
/** A free brawler joins a short-handed CPU clan within half a day or so, a full-sized one about every 4 days. */
const cpuJoinRate = (bots: number) => (bots < 6 ? 1 / 12 : bots < CPU_MAX ? 1 / 96 : 0)
/** Chance per step for a rate per hour. */
const perStep = (rate: number) => (rate * STEP) / HOUR
/**
 * Brawlers only join, leave or ask while online (presence.ts), about a third of the time: a leave is rolled this
 * much more often and then taken by a member who is on, so a member still leaves about as often as before.
 */
const ONLINE_SHARE = 1 / 3
/** Of `ids`, those online (and not in a brawl) at `at`. */
const onAt = <T extends { id: string } | string>(ids: T[], at: number) =>
  ids.filter((x) => isAvailable(typeof x === 'string' ? x : x.id, at))

const nameOf = (botId: string) => botById(botId)?.name ?? 'A brawler'

/** A stable number for a clan id, to seed its rolls. */
function seedOf(id: string) {
  let h = 7
  for (const ch of id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0
  return h
}

/** CPU brawlers in no clan right now. */
export const freeBots = (clans: Clan[]) => {
  const taken = new Set(clans.flatMap((c) => c.members))
  return BOTS.filter((b) => !taken.has(b.id))
}

/** Free brawlers who would join `clan` at `at`: not resting after leaving a clan, not lately turned away by this one. */
const willing = (clans: Clan[], clan: Clan, at: number) =>
  freeBots(clans).filter(
    (b) => (clan.away?.[b.id] ?? -Infinity) + AWAY <= at && clans.every((c) => (c.away?.[b.id] ?? -Infinity) + REST <= at),
  )

/** One of the bots, seeded by `r`; bots of the clan's attribute are three times as likely. */
function pick(bots: typeof BOTS, clan: Clan, r: number) {
  const weights = bots.map((b) => (b.element === clan.element ? 3 : 1))
  let left = r * weights.reduce((a, b) => a + b, 0)
  return bots.find((_, i) => (left -= weights[i]) < 0) ?? bots[bots.length - 1]
}

export const systemLine = (author: string, text: string, at: number): ClanMessage => ({
  id: `s${at.toString(36)}${seedOf(author + text).toString(36)}`,
  author,
  text,
  at,
  system: true,
})

/** Notes that a brawler left `clan` (or was removed or turned down) at `at`, dropping notes that ran out. */
export function keepAway(clan: Clan, botId: string, at: number): Clan {
  const away = Object.fromEntries(Object.entries(clan.away ?? {}).filter(([, t]) => t + AWAY > at))
  return { ...clan, away: { ...away, [botId]: at } }
}

export interface Life {
  clans: Clan[]
  /** CPU brawlers who joined a clan on their own (they say hello in its chat). */
  joined: { clanId: string; botId: string; at: number }[]
}

/** Plays clan life over the steps that ended in (from, to]; `from` is a step boundary. */
export function advance(start: Clan[], from: number, to: number, post: (c: Clan, m: ClanMessage) => Clan): Life {
  let clans = start
  const joined: Life['joined'] = []
  const patch = (id: string, fn: (c: Clan) => Clan) => (clans = clans.map((c) => (c.id === id ? fn(c) : c)))
  const addMember = (c: Clan, botId: string, at: number): Clan => ({
    ...c,
    members: [...c.members, botId],
    since: { ...c.since, [botId]: at },
    requests: c.requests?.filter((r) => r.id !== botId),
  })
  const dropMember = (c: Clan, botId: string, at: number): Clan => {
    const since = { ...c.since }
    delete since[botId]
    // what they earned for the clan stays with it
    const xp = (c.xp ?? 0) + botXp(c, botId, at)
    const officers = c.officers?.filter((m) => m !== botId)
    return keepAway({ ...c, members: c.members.filter((m) => m !== botId), since, xp, officers }, botId, at)
  }
  const settled = (c: Clan, m: string, at: number) => isBot(m) && (c.since?.[m] ?? 0) + SETTLE <= at
  // a leaver sometimes moves to a CPU clan with room, else becomes a free brawler for a while
  const move = (from: Clan, botId: string, at: number, r: number, r2: number) => {
    const room = clans.filter((c) => c.cpu && c.id !== from.id && c.members.filter(isBot).length < CPU_MAX)
    const to = r < 0.4 && room.length ? room[Math.floor(r2 * room.length)] : null
    const name = nameOf(botId)
    patch(from.id, (c) =>
      post(
        dropMember(c, botId, at),
        systemLine(botId, to ? `${name} left for [${to.tag}] ${to.name}.` : `${name} left the clan — ${leaveReason(r2)}.`, at),
      ),
    )
    if (to) patch(to.id, (c) => post(addMember(c, botId, at), systemLine(botId, `${name} joined from [${from.tag}].`, at)))
  }

  for (let q = Math.floor(from / STEP); (q + 1) * STEP <= to; q++) {
    for (const id of clans.map((c) => c.id)) {
      const clan = clans.find((c) => c.id === id)
      if (!clan) continue
      const seed = seedOf(id)
      const r = (k: number) => roll(q, seed, k)
      const at = q * STEP + Math.floor(r(0) * STEP)

      if (!clan.cpu) {
        // join requests run out after a day, or when the brawler joined another clan
        const free = new Set(freeBots(clans).map((b) => b.id))
        const requests = (clan.requests ?? []).filter((x) => x.at + REQUEST_LIFE > at && free.has(x.id))
        if (requests.length !== (clan.requests ?? []).length) patch(id, (c) => ({ ...c, requests }))
        // a CPU member leaves
        const leavers = clan.members.filter((m) => settled(clan, m, at))
        const leaving = leavers.length && r(1) < perStep(leavers.length * OWN_LEAVE) / ONLINE_SHARE ? onAt(leavers, at) : []
        if (leaving.length) {
          move(clan, leaving[Math.floor(r(2) * leaving.length)], at, r(3), r(5))
          continue
        }
        // a free brawler asks to join (shown on the clan page), or joins right away when the clan is open
        if (requests.length < MAX_REQUESTS && r(4) < perStep(requestRate(clan.members.length))) {
          const pool = onAt(
            willing(clans, clan, at).filter((b) => !requests.some((x) => x.id === b.id)),
            at,
          )
          if (!pool.length) continue
          const bot = pick(pool, clan, r(6)).id
          if (clan.open) {
            patch(id, (c) => post(addMember(c, bot, at), systemLine(bot, `${nameOf(bot)} joined the clan.`, at)))
            joined.push({ clanId: id, botId: bot, at })
          } else patch(id, (c) => ({ ...c, requests: [...requests, { id: bot, at }] }))
        }
        continue
      }

      // CPU clans: a member (never the leader) leaves now and then…
      const bots = clan.members.filter(isBot)
      const leavers = bots.filter((m) => m !== clan.leaderId && settled(clan, m, at))
      const leaving =
        bots.length > CPU_MIN && leavers.length && r(1) < perStep(leavers.length * CPU_LEAVE) / ONLINE_SHARE
          ? onAt(leavers, at)
          : []
      if (leaving.length) {
        move(clan, leaving[Math.floor(r(2) * leaving.length)], at, r(3), r(5))
        continue
      }
      // …and free brawlers join the ones with room
      if (r(4) < perStep(cpuJoinRate(bots.length))) {
        const pool = onAt(willing(clans, clan, at), at)
        if (!pool.length) continue
        const bot = pick(pool, clan, r(6)).id
        patch(id, (c) => post(addMember(c, bot, at), systemLine(bot, `${nameOf(bot)} joined the clan.`, at)))
        joined.push({ clanId: id, botId: bot, at })
      }
    }
  }
  return { clans, joined }
}
