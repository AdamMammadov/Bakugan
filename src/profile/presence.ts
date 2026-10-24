import { botById, botNow } from './bots'
import { roll } from './botProgress'

/**
 * Whether a CPU brawler is online, worked out from the clock like their brawls (botProgress.ts): each bot
 * drops in now and then, more in the evening, and is online around its brawls. A bot that was just written
 * to comes online to answer for a while.
 */

const MINUTE = 60_000
const SLOT = 20 * MINUTE
/** A bot written to stays online this long. */
const WOKEN = 12 * MINUTE

const woken: Record<string, number> = {}

/** The bot comes online (to answer a message). */
export const wake = (botId: string, now = Date.now()) => {
  woken[botId] = now
}

/** Chance to be online in a 20-minute slot at this local hour; each bot keeps its own hours. */
function activity(n: number, at: number) {
  const hour = (new Date(at).getHours() + (n % 5) - 2 + 24) % 24
  const base = hour < 7 ? 0.06 : hour < 12 ? 0.22 : hour < 17 ? 0.32 : 0.55
  return base * (0.7 + 0.6 * roll(n, 41))
}

const onlineIn = (n: number, slot: number) => roll(n, slot, 77) < activity(n, slot * SLOT)

export interface Presence {
  online: boolean
  /** The last brawl ended in the past 10 minutes. */
  justBrawled: boolean
  /** When they were last online (null while online). */
  lastSeen: number | null
}

export function presenceOf(botId: string, now: number): Presence {
  const base = botById(botId)
  if (!base) return { online: false, justBrawled: false, lastSeen: null }
  const n = Number(botId.slice(4))
  const last = botNow(base, now).lastBattle
  const justBrawled = !!last && now - last < 10 * MINUTE
  const slot = Math.floor(now / SLOT)
  if (justBrawled || now - (woken[botId] ?? -Infinity) < WOKEN || onlineIn(n, slot))
    return { online: true, justBrawled, lastSeen: null }
  // the end of the latest slot they were online in (or their last brawl, if later)
  let seen = (woken[botId] ?? 0) + WOKEN
  for (let s = slot - 1; s > slot - 72; s--)
    if (onlineIn(n, s)) {
      seen = Math.max(seen, (s + 1) * SLOT)
      break
    }
  return { online: false, justBrawled: false, lastSeen: Math.max(seen, last ?? 0) || now - 3 * 3_600_000 }
}

/** "just now", "25 min ago", "3 h ago", "2 days ago". */
export function ago(ms: number) {
  const min = Math.floor(ms / MINUTE)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.floor(min / 60)
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} ${h < 48 ? 'day' : 'days'} ago`
}
