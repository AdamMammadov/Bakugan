import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Reward } from '../season/season'
import { botById, isBot } from './bots'
import { roll } from './botProgress'
import {
  addTally,
  botBrawls,
  botTally,
  CLAN_XP,
  clanXp,
  joinedAt,
  levelOf,
  NO_TALLY,
  weekEnd,
  weekId,
  weekStart,
  type Tally,
} from './clanStats'
import { clanOf, useClans, type Clan } from './useClans'
import { useProfiles } from './useProfiles'

/**
 * What a clan is working on: its level and perks, weekly goals with rewards, the weekly clan war (every clan, CPU
 * clans too, ranked by its members' ranked wins) and the activity feed. CPU members' part comes from the clock
 * (clanStats.ts); the players' brawls are logged here as they happen, and the rewards they collected are saved.
 */

const HOUR = 3_600_000
const DAY = 24 * HOUR
/** Players' brawls are kept this long (this week and last week's war). */
const KEEP = 15 * DAY

export interface PlayerBrawl {
  at: number
  won: boolean
  ranked: boolean
  kos: number
  /** The clan they were in. */
  clan?: string
  /** BP the clan's battle bonus added. */
  bonus?: number
}

interface ClanProgressState {
  /** Each player's recent brawls. */
  log: Record<string, PlayerBrawl[]>
  /** Rewards each player collected ("2026-10-26:wins"). */
  claimed: Record<string, string[]>
  /** Gives the rewards to the active player once per key; false when already collected or not possible. */
  claim: (profileId: string, key: string, rewards: Reward[]) => boolean
}

export const useClanProgress = create<ClanProgressState>()(
  persist(
    (set, get) => ({
      log: {},
      claimed: {},
      claim: (profileId, key, rewards) => {
        if (get().claimed[profileId]?.includes(key) || useProfiles.getState().activeId !== profileId) return false
        if (!useProfiles.getState().grantRewards(rewards)) return false
        set((s) => ({ claimed: { ...s.claimed, [profileId]: [...(s.claimed[profileId] ?? []), key].slice(-60) } }))
        return true
      },
    }),
    { name: 'bakugan-clan-progress', version: 1 },
  ),
)

// ---------------------------------------------------------------- level and perks

export interface Perk {
  level: number
  name: string
  text: string
}

export const PERKS: Perk[] = [
  { level: 2, name: 'Emblem shapes', text: 'Shield and round emblems for the clan badge' },
  { level: 4, name: 'Battle bonus I', text: '+5% BP on every win' },
  { level: 7, name: 'Weekly XP Boost', text: 'Every member collects a free XP Boost each week' },
  { level: 10, name: 'Battle bonus II', text: '+10% BP on every win (instead of 5%)' },
  { level: 13, name: 'Crown emblem', text: 'The crown shape for the clan badge' },
]

/** Extra BP on a win from the clan's battle bonus perk. */
export const bpBonus = (level: number) => (level >= 10 ? 0.1 : level >= 4 ? 0.05 : 0)

export type EmblemShape = 'hex' | 'shield' | 'circle' | 'star' | 'crown'
/** Badge shapes and the clan level that unlocks each. */
export const SHAPES: [EmblemShape, number][] = [
  ['hex', 1],
  ['star', 1],
  ['shield', 2],
  ['circle', 2],
  ['crown', 13],
]

export const clanLevel = (clan: Clan, now: number) => levelOf(clanXp(clan, now))

// ---------------------------------------------------------------- the week

/** A clan's brawls in [from, to): CPU members' (since they joined) and the players' logged in it. */
export function clanTally(clan: Clan, from: number, to: number, log: ClanProgressState['log']): Tally {
  let t = NO_TALLY
  for (const id of clan.members.filter(isBot)) t = addTally(t, botTally(id, Math.max(from, joinedAt(clan, id)), to))
  for (const list of Object.values(log))
    t = addTally(t, tallyOf(list.filter((b) => b.clan === clan.id && b.at >= from && b.at < to)))
  return t
}

const tallyOf = (list: PlayerBrawl[]): Tally => ({
  brawls: list.length,
  wins: list.filter((b) => b.won).length,
  kos: list.reduce((n, b) => n + b.kos, 0),
  ranked: list.filter((b) => b.won && b.ranked).length,
})

/** A player's own brawls for the clan in [from, to). */
export const myTally = (clan: Clan, me: string, from: number, to: number, log: ClanProgressState['log']) =>
  tallyOf((log[me] ?? []).filter((b) => b.clan === clan.id && b.at >= from && b.at < to))

export interface Goal {
  /** Claim key within the week. */
  id: string
  text: string
  /** Whose brawls count: the whole clan's, or the player's own. */
  scope: 'clan' | 'you'
  target: number
  progress: number
  reward: Reward[]
}

type Metric = 'wins' | 'kos' | 'brawls' | 'ranked'
const metric = (t: Tally, m: Metric) => t[m]

const CLAN_GOALS: { id: string; m: Metric; per: number; text: string }[] = [
  { id: 'cwins', m: 'wins', per: 14, text: 'Win {n} brawls as a clan' },
  { id: 'ckos', m: 'kos', per: 18, text: 'Score {n} KOs as a clan' },
  { id: 'cbrawls', m: 'brawls', per: 28, text: 'Play {n} brawls as a clan' },
]
const MY_GOALS: { id: string; m: Metric; n: number; text: string; reward: Reward[] }[] = [
  { id: 'mwins', m: 'wins', n: 5, text: 'Win {n} brawls yourself', reward: [{ kind: 'boost', amount: 1 }] },
  { id: 'mranked', m: 'ranked', n: 3, text: 'Win {n} ranked brawls yourself', reward: [{ kind: 'cardKey', amount: 1 }] },
  { id: 'mkos', m: 'kos', n: 8, text: 'Score {n} KOs yourself', reward: [{ kind: 'bp', amount: 150 }] },
]

/** This week's goals: two for the whole clan (sized to it), two of the player's own; picked anew each week. */
export function weeklyGoals(clan: Clan, me: string, now: number, log: ClanProgressState['log']): Goal[] {
  const from = weekStart(now)
  const n = Math.floor(from / (7 * DAY))
  const all = clanTally(clan, from, now, log)
  const mine = myTally(clan, me, from, now, log)
  const skip = Math.floor(roll(n, 11) * 3)
  const skip2 = Math.floor(roll(n, 12) * 3)
  const size = Math.max(3, clan.members.length)
  return [
    ...CLAN_GOALS.filter((_, i) => i !== skip).map((g) => {
      const target = g.per * size
      return {
        id: g.id,
        text: g.text.replace('{n}', String(target)),
        scope: 'clan' as const,
        target,
        progress: metric(all, g.m),
        reward: [{ kind: 'bp', amount: 250 }] as Reward[],
      }
    }),
    ...MY_GOALS.filter((_, i) => i !== skip2).map((g) => ({
      id: g.id,
      text: g.text.replace('{n}', String(g.n)),
      scope: 'you' as const,
      target: g.n,
      progress: metric(mine, g.m),
      reward: g.reward,
    })),
  ]
}

/** Collected for finishing all four goals of a week. */
export const ALL_GOALS_REWARD: Reward[] = [
  { kind: 'bp', amount: 300 },
  { kind: 'title', name: 'Clan Hero' },
]
export const PERK_BOOST: Reward[] = [{ kind: 'boost', amount: 1 }]

/** "2d 4h", "3h 20m". */
export function timeLeft(ms: number) {
  const h = Math.floor(ms / HOUR)
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${Math.floor((ms % HOUR) / 60_000)}m`
}

export { weekEnd, weekId, weekStart }

// ---------------------------------------------------------------- clan war

/** War points: 10 per ranked win, 2 per KO in ranked brawls (all of a CPU brawler's brawls are ranked). */
export const warPoints = (t: Tally) => t.ranked * 10 + t.kos * 2

export interface WarRow {
  clan: Clan
  points: number
  wins: number
}

/** Every clan's war points for [from, to), most first. */
export function warStandings(clans: Clan[], from: number, to: number, log: ClanProgressState['log']): WarRow[] {
  return clans
    .map((clan) => {
      // players' KOs only count from ranked brawls
      const bots = clan.members
        .filter(isBot)
        .reduce((t, id) => addTally(t, botTally(id, Math.max(from, joinedAt(clan, id)), to)), NO_TALLY)
      const players = Object.values(log)
        .flat()
        .filter((b) => b.clan === clan.id && b.ranked && b.at >= from && b.at < to)
      const t = addTally(bots, { ...tallyOf(players), brawls: 0 })
      return { clan, points: warPoints(t), wins: t.ranked }
    })
    .sort((a, b) => b.points - a.points || a.clan.name.localeCompare(b.clan.name))
}

/** Last week's war reward for a place (1st, 2nd, 3rd, or taking part). */
export function warReward(place: number): Reward[] {
  if (place === 1)
    return [
      { kind: 'bp', amount: 800 },
      { kind: 'title', name: 'War Champion' },
    ]
  return [{ kind: 'bp', amount: place === 2 ? 500 : place === 3 ? 300 : 100 }]
}

// ---------------------------------------------------------------- activity

export interface FeedItem {
  at: number
  /** Who it is about (a member id), if anyone. */
  who?: string
  icon: string
  text: string
  tone?: 'win' | 'gold' | 'muted'
}

/**
 * The clan's last two days: members' brawls and rank-ups, the players' brawls, joins and leaves (from the chat's
 * notices), goals done and levels reached. Newest first.
 */
export function clanFeed(clan: Clan, me: string, now: number, log: ClanProgressState['log']): FeedItem[] {
  const from = now - 2 * DAY
  const items: FeedItem[] = []
  // every brawl this week with its XP, oldest first, for goals crossed and levels reached
  const week = weekStart(now)
  const events: { at: number; won: boolean; kos: number; ranked: boolean; mine: boolean }[] = []
  for (const id of clan.members.filter(isBot)) {
    for (const b of botBrawls(id, Math.max(Math.min(from, week), joinedAt(clan, id)), now)) {
      events.push({ at: b.at, won: b.won, kos: b.kos, ranked: true, mine: false })
      if (b.at <= from) continue
      const name = botById(id)?.name.split(' ')[0] ?? 'A member'
      if (b.won)
        items.push({
          at: b.at,
          who: id,
          icon: '⚔',
          text: `${name} won a ranked brawl${b.kos ? ` · ${b.kos} KO` : ''}`,
          tone: 'win',
        })
      else items.push({ at: b.at, who: id, icon: '·', text: `${name} lost a ranked brawl`, tone: 'muted' })
      if (b.rankUp) items.push({ at: b.at + 1, who: id, icon: '▲', text: `${name} reached ${b.rankUp}`, tone: 'gold' })
    }
  }
  for (const [pid, list] of Object.entries(log))
    for (const b of list.filter((x) => x.clan === clan.id && x.at > Math.min(from, week))) {
      events.push({ at: b.at, won: b.won, kos: b.kos, ranked: b.ranked, mine: pid === me })
      if (b.at <= from) continue
      const name = pid === me ? 'You' : (useProfiles.getState().profiles.find((p) => p.id === pid)?.firstName ?? 'A player')
      const kind = b.ranked ? 'ranked' : 'friendly'
      items.push({
        at: b.at,
        who: pid,
        icon: b.won ? '⚔' : '·',
        text: `${name} ${b.won ? 'won' : 'lost'} a ${kind} brawl${b.kos ? ` · ${b.kos} KO` : ''}`,
        tone: b.won ? 'win' : 'muted',
      })
      if (b.bonus)
        items.push({
          at: b.at + 1,
          who: pid,
          icon: '✚',
          text: `Clan battle bonus: +${b.bonus} BP for ${name === 'You' ? 'you' : name}`,
          tone: 'gold',
        })
    }
  // joins, leaves and role changes
  for (const m of clan.messages) if (m.system && m.at > from) items.push({ at: m.at, who: m.author, icon: '◆', text: m.text })
  events.sort((a, b) => a.at - b.at)
  // clan goals done this week
  const goals = weeklyGoals(clan, me, now, log).filter((g) => g.scope === 'clan')
  const sums: Record<string, number> = {}
  for (const e of events.filter((x) => x.at >= week)) {
    for (const g of goals) {
      const add = g.id === 'cwins' ? Number(e.won) : g.id === 'ckos' ? e.kos : 1
      const before = sums[g.id] ?? 0
      sums[g.id] = before + add
      if (before < g.target && sums[g.id] >= g.target && e.at > from)
        items.push({ at: e.at + 2, icon: '★', text: `Weekly goal done: ${g.text}`, tone: 'gold' })
    }
  }
  // levels reached: walk back from today's XP
  let xp = clanXp(clan, now)
  for (const e of [...events].reverse()) {
    if (e.at <= from) break
    const gain = e.won ? CLAN_XP.win : CLAN_XP.loss
    const before = levelOf(xp - gain - e.kos * CLAN_XP.ko).level
    if (before < levelOf(xp).level)
      items.push({ at: e.at + 3, icon: '⬆', text: `[${clan.tag}] reached clan level ${levelOf(xp).level}!`, tone: 'gold' })
    xp -= gain + e.kos * CLAN_XP.ko
  }
  return items.sort((a, b) => b.at - a.at).slice(0, 80)
}

// ---------------------------------------------------------------- the players' brawls

/**
 * Logs each brawl the active player finishes (seen as their battle count going up), banks its clan XP and pays
 * the clan's battle bonus on a win. Runs app-wide (this module loads with the clans screen, at startup).
 */
useProfiles.subscribe((s, prev) => {
  const p = s.profiles.find((x) => x.id === s.activeId)
  const q = prev.profiles.find((x) => x.id === p?.id)
  if (!p || !q || p.stats.battles <= q.stats.battles) return
  const now = Date.now()
  const won = p.stats.wins > q.stats.wins
  const kos = Math.max(0, p.stats.kos - q.stats.kos)
  // a ranked result moves the rating (friendly and free-play brawls do not)
  const ranked = p.rating !== q.rating
  const clan = clanOf(useClans.getState().clans, p.id)
  const level = clan ? clanLevel(clan, now).level : 0
  const bonus = won && clan ? Math.round(Math.max(0, p.bp - q.bp) * bpBonus(level)) : 0
  const brawl: PlayerBrawl = { at: now, won, ranked, kos, ...(clan ? { clan: clan.id } : {}), ...(bonus ? { bonus } : {}) }
  useClanProgress.setState((st) => ({
    log: { ...st.log, [p.id]: [...(st.log[p.id] ?? []).filter((b) => b.at > now - KEEP), brawl] },
  }))
  if (!clan) return
  const xp = (won ? CLAN_XP.win : CLAN_XP.loss) + kos * CLAN_XP.ko
  useClans.setState((c) => ({ clans: c.clans.map((x) => (x.id === clan.id ? { ...x, xp: (x.xp ?? 0) + xp } : x)) }))
  if (bonus) queueMicrotask(() => useProfiles.getState().grantRewards([{ kind: 'bp', amount: bonus }]))
})
