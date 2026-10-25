import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ElementId } from '../data/elements'
import type { CupStage, Difficulty, Place } from './catalog'

/** A brawler in a cup: the player (id 'me') or a CPU brawler, as they stood when the cup began. */
export interface CupEntrant {
  id: string
  name: string
  /** Series character they look like (the player keeps their own avatar). */
  characterId: string
  element: ElementId
  /** Ranking score when the cup began. */
  score: number
  /** Bakugan they bring (a CPU brawler's own, used when two CPU brawlers meet). */
  team: { id: string; form: number }[]
  /** Ability cards each of their Bakugan has. */
  cards: number
}

export interface CupMatch {
  /** Entrant indexes. */
  a: number
  b: number
  winner: number | null
  /** Battles won by a and b. */
  score?: [number, number]
}

/** One go at a cup: the bracket, filled in round by round. */
export interface CupRun {
  id: string
  /** Cup index (see cupAt). */
  cup: number
  name: string
  element: ElementId
  startedAt: number
  /** Eight entrants in bracket order: 0 v 1, 2 v 3… in the quarter-finals. */
  entrants: CupEntrant[]
  /** The player's entrant index. */
  me: number
  /** Quarter-finals, semi-finals, final; a round appears once its pairs are known. */
  rounds: CupMatch[][]
  /** The player's next match, or how the run ended. */
  stage: CupStage | 'out' | 'champion'
  place: Place | null
}

export interface Trophy {
  cup: string
  place: Place
  at: number
}

export interface BossProgress {
  /** Difficulties beaten at least once (their first-clear reward is paid). */
  cleared: Difficulty[]
  wins: number
  losses: number
  /** Week key of the last weekly bounty paid. */
  bounty: string | null
}

export interface RuleProgress {
  wins: number
  played: number
  claimed: boolean
}

/** One profile's events. */
export interface ProfileEvents {
  /** The current (or last) cup run. */
  cup: CupRun | null
  /** Days (dayKey) the player entered a cup: one entry a day. */
  cupDays: string[]
  trophies: Trophy[]
  bosses: Record<string, BossProgress>
  /** Progress per rule event run (see RuleEvent.id). */
  rules: Record<string, RuleProgress>
  /** The cup match the player went into the arena for; cleared by its result, a loss if they leave first. */
  pending: { run: string; stage: string } | null
}

export const EMPTY_EVENTS: ProfileEvents = { cup: null, cupDays: [], trophies: [], bosses: {}, rules: {}, pending: null }
export const EMPTY_BOSS: BossProgress = { cleared: [], wins: 0, losses: 0, bounty: null }

interface EventsState {
  /** Per profile id: several players can share a browser. */
  byProfile: Record<string, ProfileEvents>
  patch: (profileId: string, fn: (e: ProfileEvents) => ProfileEvents) => void
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

/** A saved profile's events with every field present (older or damaged saves fill in the gaps). */
export function normalize(raw: unknown): ProfileEvents {
  if (!isObj(raw)) return EMPTY_EVENTS
  const bosses: Record<string, BossProgress> = {}
  if (isObj(raw.bosses))
    for (const [id, b] of Object.entries(raw.bosses))
      if (isObj(b))
        bosses[id] = {
          cleared: arr<Difficulty>(b.cleared),
          wins: Number(b.wins) || 0,
          losses: Number(b.losses) || 0,
          bounty: typeof b.bounty === 'string' ? b.bounty : null,
        }
  const rules: Record<string, RuleProgress> = {}
  if (isObj(raw.rules))
    for (const [id, r] of Object.entries(raw.rules))
      if (isObj(r)) rules[id] = { wins: Number(r.wins) || 0, played: Number(r.played) || 0, claimed: !!r.claimed }
  const cup =
    isObj(raw.cup) && Array.isArray(raw.cup.entrants) && Array.isArray(raw.cup.rounds) ? (raw.cup as unknown as CupRun) : null
  const pending =
    isObj(raw.pending) && typeof raw.pending.run === 'string' && typeof raw.pending.stage === 'string'
      ? { run: raw.pending.run, stage: raw.pending.stage }
      : null
  return { cup, cupDays: arr<string>(raw.cupDays).slice(-14), trophies: arr<Trophy>(raw.trophies), bosses, rules, pending }
}

/** Old rule-event runs are dropped once there are many. */
function prune(e: ProfileEvents): ProfileEvents {
  const ids = Object.keys(e.rules)
  if (ids.length <= 30) return e
  return { ...e, rules: Object.fromEntries(ids.slice(-30).map((id) => [id, e.rules[id]])) }
}

export const useEvents = create<EventsState>()(
  persist(
    (set) => ({
      byProfile: {},
      patch: (profileId, fn) =>
        set((s) => ({ byProfile: { ...s.byProfile, [profileId]: prune(fn(s.byProfile[profileId] ?? EMPTY_EVENTS)) } })),
    }),
    {
      name: 'bakugan-events',
      version: 1,
      partialize: (s) => ({ byProfile: s.byProfile }),
      // any older or unknown save is read field by field, so nothing a player earned is lost
      migrate: (state) => {
        const by = isObj(state) && isObj(state.byProfile) ? state.byProfile : {}
        return { byProfile: Object.fromEntries(Object.entries(by).map(([id, e]) => [id, normalize(e)])) }
      },
      merge: (persisted, current) => {
        const by = isObj(persisted) && isObj(persisted.byProfile) ? persisted.byProfile : {}
        return { ...current, byProfile: Object.fromEntries(Object.entries(by).map(([id, e]) => [id, normalize(e)])) }
      },
    },
  ),
)

/** The events of a profile (a stable empty one when it has none yet). */
export const useProfileEvents = (profileId: string | undefined) =>
  useEvents((s) => (profileId && s.byProfile[profileId]) || EMPTY_EVENTS)
