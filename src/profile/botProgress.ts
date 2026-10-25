import { useEffect, useState } from 'react'
import type { BotBrawler } from './bots'
import { rankScore, ratingChange, ratingSwing } from './useProfiles'

/**
 * CPU brawlers keep brawling while nobody is looking. There is no server, so their record is worked out
 * from the clock: every bot plays a number of brawls each day (some days none), at fixed times, and wins
 * or loses each one by a seeded roll. Same bot + same time = same numbers, on every screen and after a
 * reload. Ratings move by the players' ranked rules (ratingChange, against a bot on its own level). A bot's win
 * chance falls as it nears the rating its skill can hold (that ceiling creeps up slowly with time), so bots stay
 * spread over the ladder, strong ones keep climbing a little, and bad days cost rating.
 */

const MINUTE = 60_000
const DAY = 86_400_000
/** First (UTC) day the bots brawl on their own: their bots.ts numbers are where they stood at its start. */
const START_DAY = Math.floor(Date.UTC(2026, 9, 17) / DAY)
/** Share of wins that holds a rating level at a rank score (higher ranks need more). */
function holdAt(score: number) {
  const { win, loss } = ratingSwing(score)
  return loss / (win + loss)
}

/** A seeded roll in [0, 1) for three whole numbers. */
export function roll(a: number, b: number, c = 0) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1)
  h ^= h >>> 15
  h = Math.imul(h, 0x2c1b3c6d)
  h ^= h >>> 12
  h = Math.imul(h, 0x297a2d39)
  h ^= h >>> 15
  return (h >>> 0) / 4294967296
}

interface Tally {
  rating: number
  xp: number
  wins: number
  losses: number
  kos: number
  /** Brawls on the day so far (for the profile card). */
  today: number
  lastBattle: number | null
  /** Wins in a row (the streak bonus). */
  streak: number
}

interface Plan {
  n: number
  /** 0 (weakest) … 1 (strongest). */
  skill: number
  /** Typical brawls a day. */
  pace: number
  /** How far above its starting rating the bot can hold, at the start. */
  headroom: number
  /** How much that grows a day as the bot keeps practising. */
  growth: number
  start: number
}

const plans: Record<string, Plan> = {}
function planOf(bot: BotBrawler, count: number): Plan {
  const n = Number(bot.id.slice(4))
  if (plans[bot.id]) return plans[bot.id]
  const skill = 1 - n / count
  return (plans[bot.id] = {
    n,
    skill,
    pace: 2 + 5 * skill + 3 * roll(n, 1),
    headroom: 60 + 240 * skill,
    growth: 0.3 + 2.2 * skill * skill,
    start: bot.rating,
  })
}

/** Size of the team a bot brings at a rating (as in botTeam). */
const teamSize = (rating: number) => (rating >= 2500 ? 3 : rating >= 900 ? 2 : 1)

/** The brawls of one UTC day: how many and when each one ends. */
function dayPlan(plan: Plan, day: number) {
  if (roll(plan.n, day, 1) < 0.12) return { form: 0, times: [] as number[] }
  const count = Math.max(1, Math.round(plan.pace * (0.6 + 0.8 * roll(plan.n, day, 3))))
  // good and bad days
  const form = (roll(plan.n, day, 2) - 0.5) * 0.24
  const times = Array.from({ length: count }, (_, k) => day * DAY + ((k + 0.15 + 0.7 * roll(plan.n, day, 10 + k)) / count) * DAY)
  return { form, times }
}

/** Plays a bot's brawls of `day` that end by `until`. */
function playDay(plan: Plan, day: number, from: Tally, until: number): Tally {
  const r = { ...from, today: 0 }
  const { form, times } = dayPlan(plan, day)
  const ceiling = plan.start + plan.headroom + plan.growth * (day - START_DAY)
  for (const [k, at] of times.entries()) {
    if (at > until) break
    const score = rankScore(r)
    const chance = Math.min(0.8, Math.max(0.2, holdAt(score) + (0.15 * (ceiling - r.rating)) / plan.headroom + form))
    const size = teamSize(r.rating)
    const won = roll(plan.n, day, 100 + k) < chance
    const kos = Math.floor(roll(plan.n, day, 200 + k) * (won ? size + 1 : size))
    r.streak = won ? r.streak + 1 : 0
    r.rating = Math.max(0, r.rating + ratingChange(score, won, score, r.streak))
    if (won) {
      r.wins++
      r.xp += (60 + Math.round(10 * roll(plan.n, day, 300 + k))) * size + kos * 8
    } else {
      r.losses++
      r.xp += (15 + Math.round(5 * roll(plan.n, day, 300 + k))) * size + kos * 8
    }
    r.kos += kos
    r.today++
    r.lastBattle = at
  }
  return r
}

/** Each bot's record at the start of every day played so far (index 0 = START_DAY). */
const dayStarts: Record<string, Tally[]> = {}
const latest: Record<string, { minute: number; bot: LiveBot }> = {}

export type LiveBot = BotBrawler & { today: number; lastBattle: number | null }

/** The bot as it stands at `now` (to the minute). */
export function botAt(bot: BotBrawler, count: number, now: number): LiveBot {
  const minute = Math.floor(now / MINUTE)
  const hit = latest[bot.id]
  if (hit?.minute === minute) return hit.bot
  const plan = planOf(bot, count)
  const t = minute * MINUTE
  const day = Math.floor(t / DAY)
  let rec: Tally = {
    rating: bot.rating,
    xp: bot.xp,
    wins: bot.wins,
    losses: bot.losses,
    kos: bot.kos,
    today: 0,
    lastBattle: null,
    streak: 0,
  }
  if (day >= START_DAY) {
    const starts = (dayStarts[bot.id] ??= [rec])
    while (starts.length <= day - START_DAY) {
      const d = START_DAY + starts.length - 1
      starts.push(playDay(plan, d, starts[starts.length - 1], Infinity))
    }
    rec = playDay(plan, day, starts[day - START_DAY], t)
  }
  const live = { ...bot, ...rec }
  // the newest minute asked for is kept (screens ask for "now" over and over)
  if (!hit || hit.minute < minute) latest[bot.id] = { minute, bot: live }
  return live
}

/** The current minute, ticking over while the screen is open, so CPU numbers move live. */
export function useMinute() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / MINUTE) * MINUTE)
  useEffect(() => {
    const t = window.setTimeout(() => setNow(Math.floor(Date.now() / MINUTE) * MINUTE), now + MINUTE - Date.now() + 50)
    return () => clearTimeout(t)
  }, [now])
  return now
}
