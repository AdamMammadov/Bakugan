import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { BAKUGAN, type Bakugan, type Entrant } from '../data/bakugan'
import type { ElementId } from '../data/elements'
import type { Avatar } from './avatar'

/**
 * Player profiles, saved in the browser (localStorage).
 *
 * Economy
 * - A new player owns one Bakugan: the one of their attribute.
 * - Battles pay Battle Points (BP). BP buy more Bakugan in the shop: Bakugan of your own
 *   attribute are cheaper than those of other attributes. Very high player XP also unlocks them.
 * - Each Bakugan earns its own XP in battle. Evolving and unlocking ability cards take a lot of it.
 * - Brawler Rating (BR) goes up with wins and down with losses; the rank comes from BR and total XP.
 */

/** Bakugan XP needed for each next form (index = current form). E.g. Hydranoid → Dual 6.5k → Alpha 15k. */
export const EVOLVE_XP = [6500, 15000, 26000]
/** Ability cards unlocked at the start, plus one more every CARD_XP. */
const START_CARDS = 3
const CARD_XP = 1500

export const XP = { winMin: 60, winMax: 70, lossMin: 15, lossMax: 20, ko: 8 }
export const BP = { win: 100, loss: 25, streakBonus: 10, streakCap: 5 }
export const RATING = { win: 25, loss: 15 }

export const PRICES = {
  /** BP for a Bakugan of the player's own attribute. */
  ownElement: 5500,
  /** BP for a Bakugan of another attribute. */
  otherElement: 15000,
  /** Alternative: total player XP that unlocks the Bakugan for free. */
  ownElementXp: 20000,
  otherElementXp: 40000,
}

export const TIERS = [
  { name: 'Rookie', min: 0 },
  { name: 'Brawler', min: 300 },
  { name: 'Battle Brawler', min: 800 },
  { name: 'Ace Brawler', min: 1500 },
  { name: 'Master Brawler', min: 2500 },
  { name: 'Legendary Brawler', min: 4000 },
]

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
  /** Bakugan ids brought into battle, lead first (1–3). */
  team: string[]
  /** Battle Points to spend in the shop. */
  bp: number
  /** Total XP the player has earned. */
  xp: number
  /** Brawler Rating: up with wins, down with losses. */
  rating: number
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
  bp: number
  rating: number
  evolveReady: string[]
  newCards: Record<string, number>
  /** Bakugan unlocked by reaching a total-XP milestone. */
  unlocked: string[]
  /** New rank name when the player moved up a tier. */
  rankUp: string | null
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

/** The Bakugan a new player of this attribute starts with. */
export const starterFor = (element: ElementId) => BAKUGAN.find((b) => b.element === element)!.id

/** BP price and total-XP unlock of a Bakugan for this player. */
export function priceOf(p: Profile, bakugan: Bakugan) {
  const own = bakugan.element === p.element
  return { bp: own ? PRICES.ownElement : PRICES.otherElement, xp: own ? PRICES.ownElementXp : PRICES.otherElementXp }
}

/** Score the rank and leaderboard use: wins (through BR) and experience both count. */
export const rankScore = (p: Pick<Profile, 'rating' | 'xp'>) => p.rating + Math.floor(p.xp / 20)

export function tierOf(score: number) {
  let i = 0
  while (i + 1 < TIERS.length && score >= TIERS[i + 1].min) i++
  return { index: i, name: TIERS[i].name, next: TIERS[i + 1] ?? null }
}

export const rankOf = (p: Profile) => tierOf(rankScore(p)).name

export const teamEntrants = (p: Profile): Entrant[] =>
  p.team
    .map((id) => p.collection.find((o) => o.id === id))
    .filter((o): o is OwnedBakugan => !!o)
    .map((owned) => ({ bakugan: bakuganById(owned.id), form: owned.form, cards: unlockedCards(owned).map((a) => a.id) }))

const own = (id: string): OwnedBakugan => ({ id, form: 0, xp: 0, wins: 0, battles: 0, kos: 0 })
const roll = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1))

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
  /** Buys a Bakugan with BP, or claims it when the player's XP is high enough. */
  acquire: (bakuganId: string, how: 'bp' | 'xp') => boolean
  /** Applies XP, BP, rating and stats for the active player; returns what was gained. */
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
        const starter = starterFor(input.element)
        const profile: Profile = {
          ...input,
          id,
          createdAt: Date.now(),
          collection: [own(starter)],
          team: [starter],
          bp: 0,
          xp: 0,
          rating: 0,
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
      setTeam: (team) => set((s) => patchActive(s, (p) => ({ ...p, team: team.slice(0, 3) }))),
      evolve: (bakuganId) =>
        set((s) =>
          patchActive(s, (p) => ({
            ...p,
            collection: p.collection.map((o) => (o.id === bakuganId && canEvolve(o) ? { ...o, form: o.form + 1 } : o)),
          })),
        ),
      acquire: (bakuganId, how) => {
        const p = get().profiles.find((x) => x.id === get().activeId)
        if (!p || p.collection.some((o) => o.id === bakuganId)) return false
        const price = priceOf(p, bakuganById(bakuganId))
        if (how === 'bp' ? p.bp < price.bp : p.xp < price.xp) return false
        set((s) =>
          patchActive(s, (x) => ({
            ...x,
            bp: how === 'bp' ? x.bp - price.bp : x.bp,
            collection: [...x.collection, own(bakuganId)],
            team: x.team.length < 3 ? [...x.team, bakuganId] : x.team,
          })),
        )
        return true
      },
      recordBattle: (report) => {
        const p = get().profiles.find((x) => x.id === get().activeId)
        if (!p) return null
        const reward: BattleReward = { xp: {}, bp: 0, rating: 0, evolveReady: [], newCards: {}, unlocked: [], rankUp: null }
        const collection = p.collection.map((o) => {
          if (!report.team.includes(o.id)) return o
          const kos = report.kos[o.id] ?? 0
          const gained = (report.won ? roll(XP.winMin, XP.winMax) : roll(XP.lossMin, XP.lossMax)) + kos * XP.ko
          const next = { ...o, xp: o.xp + gained, battles: o.battles + 1, wins: o.wins + (report.won ? 1 : 0), kos: o.kos + kos }
          reward.xp[o.id] = gained
          if (canEvolve(next) && !canEvolve(o)) reward.evolveReady.push(o.id)
          const cards = cardCount(next) - cardCount(o)
          if (cards > 0) reward.newCards[o.id] = cards
          return next
        })
        const streak = report.won ? p.stats.streak + 1 : 0
        reward.bp = report.won ? BP.win + Math.min(streak - 1, BP.streakCap) * BP.streakBonus : BP.loss
        reward.rating = report.won ? RATING.win : -Math.min(RATING.loss, p.rating)
        const xp = p.xp + Object.values(reward.xp).reduce((a, b) => a + b, 0)
        const rating = p.rating + reward.rating
        const before = tierOf(rankScore(p))
        const after = tierOf(rankScore({ rating, xp }))
        if (after.index > before.index) reward.rankUp = after.name
        const stats = {
          battles: p.stats.battles + 1,
          wins: p.stats.wins + (report.won ? 1 : 0),
          losses: p.stats.losses + (report.won ? 0 : 1),
          kos: p.stats.kos + Object.values(report.kos).reduce((a, b) => a + b, 0),
          streak,
          bestStreak: Math.max(p.stats.bestStreak, streak),
        }
        set((s) => patchActive(s, (x) => ({ ...x, collection, stats, xp, rating, bp: x.bp + reward.bp })))
        return reward
      },
    }),
    {
      name: 'bakugan-profiles',
      version: 3,
      // v3 (new economy and rules): every earlier test profile is cleared so everyone starts from zero
      migrate: (state, version) => (version < 3 ? { profiles: [], activeId: null } : (state as { profiles: Profile[]; activeId: string | null })),
    },
  ),
)

export const useActiveProfile = () => useProfiles((s) => s.profiles.find((p) => p.id === s.activeId) ?? null)
