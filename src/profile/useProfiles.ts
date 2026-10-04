import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { BAKUGAN, type Bakugan, type Entrant } from '../data/bakugan'
import { CORRELATIONS, type ElementId } from '../data/elements'
import type { Avatar } from './avatar'

/**
 * Player profiles, saved in the browser (localStorage). Each player owns a collection of
 * Bakugan that earn XP in battle, evolve, and unlock more ability cards as they grow.
 */

/** XP a Bakugan needs in total to reach each next form (index = current form). */
export const EVOLVE_XP = [300, 750, 1400, 2200]
/** Ability cards unlocked at the start, plus one more every CARD_XP. */
const START_CARDS = 4
const CARD_XP = 120
/** Wins needed to unlock each further Bakugan beyond the starting three. */
export const UNLOCK_WINS = [2, 5, 9]

export const XP = { win: 120, loss: 45, ko: 35 }

export interface OwnedBakugan {
  id: string
  /** Current evolution (index into the Bakugan's evolutions). */
  form: number
  xp: number
  wins: number
  battles: number
  kos: number
}

export interface Profile {
  id: string
  firstName: string
  lastName: string
  bio: string
  element: ElementId
  avatar: Avatar
  createdAt: number
  collection: OwnedBakugan[]
  /** Bakugan ids brought into battle, lead first. */
  team: string[]
  stats: { battles: number; wins: number; losses: number; kos: number; streak: number; bestStreak: number }
}

export interface BattleReport {
  won: boolean
  /** Bakugan ids that took part. */
  team: string[]
  /** KOs scored per Bakugan id. */
  kos: Record<string, number>
}

export interface BattleReward {
  xp: Record<string, number>
  evolveReady: string[]
  newCards: Record<string, number>
  unlocked: string[]
}

export type ProfileInput = Pick<Profile, 'firstName' | 'lastName' | 'bio' | 'element' | 'avatar'>

// ---------------------------------------------------------------- rules

export const bakuganById = (id: string) => BAKUGAN.find((b) => b.id === id)!

export const nextEvolveXp = (b: Bakugan, owned: OwnedBakugan): number | null =>
  owned.form + 1 < b.evolutions.length ? (EVOLVE_XP[owned.form] ?? EVOLVE_XP[EVOLVE_XP.length - 1]) : null

export const canEvolve = (owned: OwnedBakugan) => {
  const need = nextEvolveXp(bakuganById(owned.id), owned)
  return need !== null && owned.xp >= need
}

/** Number of ability cards this Bakugan has unlocked. */
export const cardCount = (owned: OwnedBakugan) =>
  Math.min(bakuganById(owned.id).abilities.length, START_CARDS + Math.floor(owned.xp / CARD_XP))

export const unlockedCards = (owned: OwnedBakugan) => bakuganById(owned.id).abilities.slice(0, cardCount(owned))

/** XP at which ability card number `index` (0-based) unlocks. */
export const cardUnlockXp = (index: number) => Math.max(0, index - START_CARDS + 1) * CARD_XP

/** XP at which the next ability card unlocks, or null when all are unlocked. */
export const nextCardXp = (owned: OwnedBakugan) => {
  const n = cardCount(owned)
  return n >= bakuganById(owned.id).abilities.length ? null : cardUnlockXp(n)
}

/** The order in which a player who picked `element` gets Bakugan: their own, its allies, then the rest. */
export function unlockOrder(element: ElementId): string[] {
  const elements = [element, ...CORRELATIONS[element]]
  const first = elements.flatMap((e) => BAKUGAN.filter((b) => b.element === e).map((b) => b.id))
  return [...first, ...BAKUGAN.map((b) => b.id).filter((id) => !first.includes(id))]
}

/** Wins needed before Bakugan `id` joins the collection (0 = from the start). */
export function winsToUnlock(element: ElementId, id: string) {
  const i = unlockOrder(element).indexOf(id)
  return i < 3 ? 0 : (UNLOCK_WINS[i - 3] ?? UNLOCK_WINS[UNLOCK_WINS.length - 1] + (i - 3 - UNLOCK_WINS.length + 1) * 4)
}

export const teamEntrants = (p: Profile): Entrant[] =>
  p.team.map((id) => {
    const owned = p.collection.find((o) => o.id === id)!
    return { bakugan: bakuganById(id), form: owned.form, cards: unlockedCards(owned).map((a) => a.id) }
  })

export function rankOf(p: Profile) {
  const w = p.stats.wins
  if (w >= 30) return 'Legendary Brawler'
  if (w >= 15) return 'Ace Brawler'
  if (w >= 6) return 'Battle Brawler'
  if (w >= 1) return 'Brawler'
  return 'Rookie'
}

const own = (id: string): OwnedBakugan => ({ id, form: 0, xp: 0, wins: 0, battles: 0, kos: 0 })

// ---------------------------------------------------------------- store

interface ProfilesState {
  profiles: Profile[]
  activeId: string | null
  create: (input: ProfileInput) => string
  update: (id: string, input: Partial<ProfileInput>) => void
  remove: (id: string) => void
  select: (id: string | null) => void
  setTeam: (team: string[]) => void
  evolve: (bakuganId: string) => void
  /** Applies XP, stats and unlocks for the active player; returns what was gained. */
  recordBattle: (report: BattleReport) => BattleReward | null
}

const patchActive = (s: ProfilesState, fn: (p: Profile) => Profile) => ({
  profiles: s.profiles.map((p) => (p.id === s.activeId ? fn(p) : p)),
})

export const useProfiles = create<ProfilesState>()(
  persist(
    (set, get) => ({
      profiles: [],
      activeId: null,
      create: (input) => {
        const id = `p${Date.now().toString(36)}`
        const starters = unlockOrder(input.element).slice(0, 3)
        const profile: Profile = {
          ...input,
          id,
          createdAt: Date.now(),
          collection: starters.map(own),
          team: starters,
          stats: { battles: 0, wins: 0, losses: 0, kos: 0, streak: 0, bestStreak: 0 },
        }
        set((s) => ({ profiles: [...s.profiles, profile], activeId: id }))
        return id
      },
      update: (id, input) => set((s) => ({ profiles: s.profiles.map((p) => (p.id === id ? { ...p, ...input } : p)) })),
      remove: (id) =>
        set((s) => ({
          profiles: s.profiles.filter((p) => p.id !== id),
          activeId: s.activeId === id ? null : s.activeId,
        })),
      select: (activeId) => set({ activeId }),
      setTeam: (team) => set((s) => patchActive(s, (p) => ({ ...p, team }))),
      evolve: (bakuganId) =>
        set((s) =>
          patchActive(s, (p) => ({
            ...p,
            collection: p.collection.map((o) => (o.id === bakuganId && canEvolve(o) ? { ...o, form: o.form + 1 } : o)),
          })),
        ),
      recordBattle: (report) => {
        const p = get().profiles.find((x) => x.id === get().activeId)
        if (!p) return null
        const reward: BattleReward = { xp: {}, evolveReady: [], newCards: {}, unlocked: [] }
        const collection = p.collection.map((o) => {
          if (!report.team.includes(o.id)) return o
          const kos = report.kos[o.id] ?? 0
          const gained = (report.won ? XP.win : XP.loss) + kos * XP.ko
          const next = { ...o, xp: o.xp + gained, battles: o.battles + 1, wins: o.wins + (report.won ? 1 : 0), kos: o.kos + kos }
          reward.xp[o.id] = gained
          if (canEvolve(next) && !canEvolve(o)) reward.evolveReady.push(o.id)
          const cards = cardCount(next) - cardCount(o)
          if (cards > 0) reward.newCards[o.id] = cards
          return next
        })
        const wins = p.stats.wins + (report.won ? 1 : 0)
        for (const id of unlockOrder(p.element)) {
          if (!collection.some((o) => o.id === id) && winsToUnlock(p.element, id) <= wins) {
            collection.push(own(id))
            reward.unlocked.push(id)
          }
        }
        const streak = report.won ? p.stats.streak + 1 : 0
        const stats = {
          battles: p.stats.battles + 1,
          wins,
          losses: p.stats.losses + (report.won ? 0 : 1),
          kos: p.stats.kos + Object.values(report.kos).reduce((a, b) => a + b, 0),
          streak,
          bestStreak: Math.max(p.stats.bestStreak, streak),
        }
        set((s) => patchActive(s, (x) => ({ ...x, collection, stats })))
        return reward
      },
    }),
    { name: 'bakugan-profiles', version: 1 },
  ),
)

export const useActiveProfile = () => useProfiles((s) => s.profiles.find((p) => p.id === s.activeId) ?? null)
