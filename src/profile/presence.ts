import { botById, botNow, isBot, type BotBrawler } from './bots'
import { roll } from './botProgress'

/**
 * Whether a CPU brawler is online, worked out from the clock like their brawls (botProgress.ts): each bot
 * drops in now and then, more in the evening, and is online around its brawls (in the match, and for a while
 * after it). Writing to a bot does not bring it online: it reads the message when it is next on.
 */

const MINUTE = 60_000
const SLOT = 20 * MINUTE
/** About how long a CPU brawler's brawl takes (botProgress logs it when it ends). */
const BRAWL = 7 * MINUTE
/** A bot stays online this long after a brawl. */
const AFTER = 10 * MINUTE

/** Chance to be online in a 20-minute slot at this local hour; each bot keeps its own hours. */
function activity(n: number, at: number) {
  const hour = (new Date(at).getHours() + (n % 5) - 2 + 24) % 24
  const base = hour < 7 ? 0.06 : hour < 12 ? 0.22 : hour < 17 ? 0.32 : 0.55
  return base * (0.7 + 0.6 * roll(n, 41))
}

const onlineIn = (n: number, slot: number) => roll(n, slot, 77) < activity(n, slot * SLOT)

/** When the brawl a bot is playing right now ends, or null (worked out once a minute). */
const brawls: Record<string, { minute: number; end: number | null }> = {}
function brawlEnd(bot: BotBrawler, now: number) {
  const minute = Math.floor(now / MINUTE)
  const hit = brawls[bot.id]
  if (hit?.minute === minute) return hit.end
  // a brawl that ends in the next few minutes is being played now
  const next = botNow(bot, now + BRAWL).lastBattle
  const end = next && next > now ? next : null
  brawls[bot.id] = { minute, end }
  return end
}

export interface Presence {
  online: boolean
  /** In the middle of a brawl (online, but busy). */
  inMatch: boolean
  /** The last brawl ended in the past 10 minutes. */
  justBrawled: boolean
  /** When they were last online (null while online). */
  lastSeen: number | null
}

export function presenceOf(botId: string, now: number): Presence {
  const base = botById(botId)
  if (!base) return { online: false, inMatch: false, justBrawled: false, lastSeen: null }
  const n = Number(botId.slice(4))
  const last = botNow(base, now).lastBattle
  const inMatch = brawlEnd(base, now) !== null
  const justBrawled = !inMatch && !!last && now - last < AFTER
  const slot = Math.floor(now / SLOT)
  if (inMatch || justBrawled || onlineIn(n, slot)) return { online: true, inMatch, justBrawled, lastSeen: null }
  // the end of the latest slot they were online in (or of their last brawl, if later)
  let seen = 0
  for (let s = slot - 1; s > slot - 72; s--)
    if (onlineIn(n, s)) {
      seen = (s + 1) * SLOT
      break
    }
  return {
    online: false,
    inMatch: false,
    justBrawled: false,
    lastSeen: Math.max(seen, last ? last + AFTER : 0) || now - 3 * 3_600_000,
  }
}

/** Online and not in a brawl: reads messages and answers invites now. */
export const isAvailable = (botId: string, now: number) => {
  const p = presenceOf(botId, now)
  return p.online && !p.inMatch
}

export type PresenceState = 'online' | 'match' | 'offline' | 'local'

export interface Status {
  state: PresenceState
  /** "Online", "In a match", "Last seen 2 h ago", "Player on this device". */
  text: string
}

/** What a friend's status line says right now. Other players on this device have no online status. */
export function statusOf(id: string, now: number): Status {
  if (!isBot(id)) return { state: 'local', text: 'Player on this device' }
  const p = presenceOf(id, now)
  if (p.inMatch) return { state: 'match', text: 'In a match' }
  if (p.online) return { state: 'online', text: p.justBrawled ? 'Online · just finished a brawl' : 'Online' }
  return { state: 'offline', text: `Last seen ${ago(now - (p.lastSeen ?? now))}` }
}

export const PRESENCE_COLOR: Record<PresenceState, string> = {
  online: '#3ee07a',
  match: '#ffb648',
  offline: '#5b6170',
  local: '#7aa7ff',
}

/** "just now", "25 min ago", "3 h ago", "2 days ago". */
export function ago(ms: number) {
  const min = Math.floor(ms / MINUTE)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.floor(min / 60)
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} ${h < 48 ? 'day' : 'days'} ago`
}
