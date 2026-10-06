import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { BAKUGAN, type Bakugan, type Entrant } from '../data/bakugan'
import type { ElementId } from '../data/elements'
import type { Avatar } from './avatar'
import { currentSeason, seasonBakugan, seasonOfBakugan } from '../season/current'
import { cosmeticsOnSale, PACKS } from '../shop/shop'
import {
  challengeRequirement,
  PASS_BAKUGAN_PRICE,
  dailyChallenges,
  dayKey,
  isPremiumLevel,
  PASS_XP,
  passLevel,
  passRewards,
  weekKey,
  weeklyChallenges,
  type ChallengeStat,
  type Reward,
  SKIN_BY_ID,
  skinFits,
} from '../season/season'

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
  /** Equipped skin id (cosmetic colour variant). */
  skin?: string
  /** Ability cards unlocked early with Card Keys. */
  bonusCards?: number
}

interface ChallengeProgress {
  key: string
  stats: Partial<Record<ChallengeStat, number>>
  /** Challenge ids already completed (their XP is paid out once). */
  done: string[]
}

export interface SeasonProgress {
  id: number
  passXp: number
  premium: boolean
  /** Pass levels whose reward was collected. */
  claimed: number[]
  wins: number
  /** Battle pass XP earned today, against the daily cap. */
  battleDay: string
  battleXp: number
  day: ChallengeProgress
  week: ChallengeProgress
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
  season?: SeasonProgress
  /** Earned cosmetics ("skin:ember", "frame:gold", "title:…", "outfit:royal", "acc:crown") and what is worn. */
  cosmetics?: { owned: string[]; title?: string; frame?: string }
  /** XP Boosts: the next battles give +50% Bakugan XP. */
  boosts?: number
  /** The player switched boosts off to save them for later. */
  boostsOff?: boolean
  /** Card Keys: each unlocks the next ability card of a Bakugan early. */
  cardKeys?: number
  seasonHistory?: { season: number; level: number; tier: string; score: number }[]
  /** Shown once after a season ends. */
  seasonNotice?: { ended: number; title: string; level: number } | null
}

export interface BattleReport {
  won: boolean
  /** Bakugan ids that took part. */
  team: string[]
  /** KOs scored per Bakugan id. */
  kos: Record<string, number>
  /** Ability cards the player activated. */
  abilities?: number
  /** Won without losing a Bakugan. */
  flawless?: boolean
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
  passXp: number
  passLevelUp: number | null
  challengesDone: string[]
  boosted: boolean
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
  Math.min(bakuganById(owned.id).abilities.length, START_CARDS + (owned.bonusCards ?? 0) + Math.floor(owned.xp / CARD_XP))

export const unlockedCards = (owned: OwnedBakugan) => bakuganById(owned.id).abilities.slice(0, cardCount(owned))

/** XP at which ability card number `index` (0-based) unlocks. */
export const cardUnlockXp = (index: number) => Math.max(0, index - START_CARDS + 1) * CARD_XP

/** XP at which the next ability card unlocks, or null when all are unlocked. */
export const nextCardXp = (owned: OwnedBakugan) => {
  const n = cardCount(owned)
  return n >= bakuganById(owned.id).abilities.length ? null : cardUnlockXp(n - (owned.bonusCards ?? 0))
}

/** Season Bakugan of the running season are earned on the Season page, not bought. */
export const inShop = (bakuganId: string) => {
  const s = seasonOfBakugan(bakuganId)
  return !s || s.season < currentSeason().id
}

/** The Bakugan a new player of this attribute starts with. */
export const starterFor = (element: ElementId) =>
  // the weakest Bakugan of the attribute: the rest are earned or bought
  BAKUGAN.filter((b) => b.element === element).reduce((a, b) => (b.baseG < a.baseG ? b : a)).id

/** Guests (no profile) only get each attribute's starter. */
export const ownsBakugan = (p: Profile | null, id: string) =>
  p ? p.collection.some((o) => o.id === id) : starterFor(bakuganById(id).element) === id

/** The player's current form of a Bakugan (guests: base form only), or -1 if not owned. */
export const ownedForm = (p: Profile | null, id: string) =>
  p ? (p.collection.find((o) => o.id === id)?.form ?? -1) : ownsBakugan(null, id) ? 0 : -1

/** How a player gets a Bakugan they do not own yet. */
export function unlockHint(p: Profile | null, b: Bakugan): string {
  if (!p) return 'Create a profile to collect it'
  const s = seasonOfBakugan(b.id)
  const now = currentSeason().id
  if (s && s.season > now) return `Arrives in Season ${s.season}`
  if (s && s.season === now) {
    if (s.role === 'pass') return `Season ${s.season} Pass reward`
    const r = challengeRequirement(b.element === p.element)
    return `Season ${s.season}: ${r.wins} season wins, pass level ${r.level} and ${r.bp.toLocaleString('en')} BP`
  }
  const price = priceOf(p, b)
  return Number.isFinite(price.xp)
    ? `Shop: ${price.bp.toLocaleString('en')} BP or ${price.xp.toLocaleString('en')} player XP`
    : `Shop: ${price.bp.toLocaleString('en')} BP`
}

/** BP price and total-XP unlock of a Bakugan for this player. */
export function priceOf(p: Profile, bakugan: Bakugan) {
  // pass Bakugan of an earlier season: in the shop, but expensive so the pass keeps its value
  if (seasonOfBakugan(bakugan.id)?.role === 'pass') return { bp: PASS_BAKUGAN_PRICE, xp: Infinity }
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
    .map((owned) => ({
      bakugan: bakuganById(owned.id),
      form: owned.form,
      cards: unlockedCards(owned).map((a) => a.id),
      skin: owned.skin,
    }))

const own = (id: string): OwnedBakugan => ({ id, form: 0, xp: 0, wins: 0, battles: 0, kos: 0 })
const roll = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1))

// ---------------------------------------------------------------- season

const freshChallenges = (key: string): ChallengeProgress => ({ key, stats: {}, done: [] })

export function emptySeason(id: number, now = Date.now()): SeasonProgress {
  return {
    id,
    passXp: 0,
    premium: false,
    claimed: [],
    wins: 0,
    battleDay: dayKey(now),
    battleXp: 0,
    day: freshChallenges(dayKey(now)),
    week: freshChallenges(weekKey(now)),
  }
}

/** The profile's progress for the running season, rolling over to a new season when needed. */
export function seasonFor(p: Profile, now = Date.now()): SeasonProgress {
  const id = currentSeason(now).id
  const s = p.season && p.season.id === id ? p.season : emptySeason(id, now)
  return {
    ...s,
    day: s.day.key === dayKey(now) ? s.day : freshChallenges(dayKey(now)),
    week: s.week.key === weekKey(now) ? s.week : freshChallenges(weekKey(now)),
    battleXp: s.battleDay === dayKey(now) ? s.battleXp : 0,
    battleDay: dayKey(now),
  }
}

/** Ends a finished season: history entry, a rank title, and a softer rating for the new one. */
function rollSeason(p: Profile, now = Date.now()): Profile {
  const id = currentSeason(now).id
  if (!p.season || p.season.id === id) return p.season ? p : { ...p, season: emptySeason(id, now) }
  const old = p.season
  const tier = tierOf(rankScore(p)).name
  const title = `Season ${old.id} ${tier}`
  const owned = new Set(p.cosmetics?.owned ?? [])
  owned.add(`title:${title}`)
  return {
    ...p,
    rating: Math.floor(p.rating * 0.6),
    season: emptySeason(id, now),
    cosmetics: { ...p.cosmetics, owned: [...owned] },
    seasonHistory: [...(p.seasonHistory ?? []), { season: old.id, level: passLevel(old.passXp), tier, score: rankScore(p) }],
    seasonNotice: { ended: old.id, title, level: passLevel(old.passXp) },
  }
}

/** Gives a pass reward to the profile. Returns null when it cannot be given yet. */
function grant(p: Profile, r: Reward, seasonId: number): Profile | null {
  const addCosmetic = (key: string) => {
    const owned = new Set(p.cosmetics?.owned ?? [])
    owned.add(key)
    return { ...p, cosmetics: { ...p.cosmetics, owned: [...owned] } }
  }
  switch (r.kind) {
    case 'bp':
      return { ...p, bp: p.bp + r.amount }
    case 'boost':
      return { ...p, boosts: (p.boosts ?? 0) + r.amount }
    case 'cardKey':
      return { ...p, cardKeys: (p.cardKeys ?? 0) + r.amount }
    case 'title':
      return addCosmetic(`title:${r.name}`)
    case 'frame':
      return addCosmetic(`frame:${r.id}`)
    case 'skin':
      return addCosmetic(`skin:${r.id}`)
    case 'outfit':
      return addCosmetic(`outfit:${r.id}`)
    case 'accessory':
      return addCosmetic(`acc:${r.id}`)
    case 'seasonBakugan': {
      const id = seasonBakugan(seasonId).pass[r.slot]
      if (!id) return null
      if (p.collection.some((o) => o.id === id)) return { ...p, bp: p.bp + 5000 }
      return { ...p, collection: [...p.collection, own(id)], team: p.team.length < 3 ? [...p.team, id] : p.team }
    }
    case 'bundle': {
      let next: Profile | null = p
      for (const item of r.items) next = next && grant(next, item, seasonId)
      return next
    }
  }
}

export const hasCosmetic = (p: Profile | null, key: string) => !!p?.cosmetics?.owned.includes(key)

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
  /** Rolls the active player over into a new season when the old one has ended. */
  syncSeason: () => void
  dismissSeasonNotice: () => void
  /** Collects the reward of a reached pass level. */
  claimLevel: (level: number) => boolean
  claimAll: () => number
  /** Takes an in-play season Bakugan once its requirements are met. */
  claimSeasonBakugan: (bakuganId: string) => boolean
  applyCardKey: (bakuganId: string) => void
  /** Buys a BP-priced shop item (cosmetic or pack). Money items wait for the online version. */
  buyShopItem: (key: string) => boolean
  equip: (slot: 'title' | 'frame', value: string | undefined) => void
  /** Turns the automatic use of XP Boosts on or off. */
  setBoostsOn: (on: boolean) => void
  /** Wears an owned outfit colour or accessory on the drawn (custom) avatar. */
  wearOnAvatar: (part: 'outfit' | 'accessory', value: string) => void
  setSkin: (bakuganId: string, skin: string | undefined) => void
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
        const reward: BattleReward = {
          xp: {},
          bp: 0,
          rating: 0,
          evolveReady: [],
          newCards: {},
          unlocked: [],
          rankUp: null,
          passXp: 0,
          passLevelUp: null,
          challengesDone: [],
          boosted: false,
        }
        const boosted = (p.boosts ?? 0) > 0 && !p.boostsOff
        const collection = p.collection.map((o) => {
          if (!report.team.includes(o.id)) return o
          const kos = report.kos[o.id] ?? 0
          const base = (report.won ? roll(XP.winMin, XP.winMax) : roll(XP.lossMin, XP.lossMax)) + kos * XP.ko
          const gained = boosted ? Math.round(base * 1.5) : base
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
        // season pass: battle XP (capped per day) plus daily and weekly challenges
        const season = seasonFor(p)
        const totalKos = Object.values(report.kos).reduce((a, b) => a + b, 0)
        const ownWin = report.won && report.team.some((id) => bakuganById(id).element === p.element)
        const bump = (c: ChallengeProgress): ChallengeProgress => ({
          ...c,
          stats: {
            ...c.stats,
            battles: (c.stats.battles ?? 0) + 1,
            wins: (c.stats.wins ?? 0) + (report.won ? 1 : 0),
            kos: (c.stats.kos ?? 0) + totalKos,
            abilities: (c.stats.abilities ?? 0) + (report.abilities ?? 0),
            ownWins: (c.stats.ownWins ?? 0) + (ownWin ? 1 : 0),
            flawless: (c.stats.flawless ?? 0) + (report.won && report.flawless ? 1 : 0),
          },
        })
        let day = bump(season.day)
        let week = bump(season.week)
        let challengeXp = 0
        for (const [list, prog, setProg] of [
          [dailyChallenges(), day, (v: ChallengeProgress) => (day = v)],
          [weeklyChallenges(), week, (v: ChallengeProgress) => (week = v)],
        ] as const) {
          const done = [...prog.done]
          for (const c of list)
            if (!done.includes(c.id) && (prog.stats[c.stat] ?? 0) >= c.goal) {
              done.push(c.id)
              challengeXp += c.xp
              reward.challengesDone.push(c.text)
            }
          setProg({ ...prog, done })
        }
        const battlePass = Math.min(
          report.won ? PASS_XP.win : PASS_XP.loss,
          Math.max(0, PASS_XP.dailyBattleCap - season.battleXp),
        )
        reward.passXp = battlePass + challengeXp
        reward.boosted = boosted
        const nextSeason: SeasonProgress = {
          ...season,
          passXp: season.passXp + reward.passXp,
          battleXp: season.battleXp + battlePass,
          wins: season.wins + (report.won ? 1 : 0),
          day,
          week,
        }
        if (passLevel(nextSeason.passXp) > passLevel(season.passXp)) reward.passLevelUp = passLevel(nextSeason.passXp)

        set((s) =>
          patchActive(s, (x) => ({
            ...x,
            collection,
            stats,
            xp,
            rating,
            bp: x.bp + reward.bp,
            season: nextSeason,
            boosts: boosted ? (x.boosts ?? 0) - 1 : x.boosts,
          })),
        )
        return reward
      },
      syncSeason: () => set((s) => patchActive(s, (p) => rollSeason(p))),
      dismissSeasonNotice: () => set((s) => patchActive(s, (p) => ({ ...p, seasonNotice: null }))),
      claimLevel: (level) => {
        const p = get().profiles.find((x) => x.id === get().activeId)
        if (!p) return false
        const season = seasonFor(p)
        if (season.claimed.includes(level) || passLevel(season.passXp) < level) return false
        if (isPremiumLevel(level) && !season.premium) return false
        const next = grant(p, passRewards(season.id)[level], season.id)
        if (!next) return false
        set((s) => patchActive(s, () => ({ ...next, season: { ...season, claimed: [...season.claimed, level] } })))
        return true
      },
      claimAll: () => {
        let n = 0
        for (let l = 1; l <= 50; l++) if (get().claimLevel(l)) n++
        return n
      },
      claimSeasonBakugan: (bakuganId) => {
        const p = get().profiles.find((x) => x.id === get().activeId)
        if (!p || p.collection.some((o) => o.id === bakuganId)) return false
        const season = seasonFor(p)
        if (!seasonBakugan(season.id).challenge.includes(bakuganId)) return false
        const req = challengeRequirement(bakuganById(bakuganId).element === p.element)
        if (season.wins < req.wins || passLevel(season.passXp) < req.level || p.bp < req.bp) return false
        set((s) =>
          patchActive(s, (x) => ({
            ...x,
            bp: x.bp - req.bp,
            collection: [...x.collection, own(bakuganId)],
            team: x.team.length < 3 ? [...x.team, bakuganId] : x.team,
          })),
        )
        return true
      },
      applyCardKey: (bakuganId) =>
        set((s) =>
          patchActive(s, (p) => {
            const o = p.collection.find((x) => x.id === bakuganId)
            if (!o || (p.cardKeys ?? 0) < 1 || cardCount(o) >= bakuganById(o.id).abilities.length) return p
            return {
              ...p,
              cardKeys: (p.cardKeys ?? 0) - 1,
              collection: p.collection.map((x) => (x.id === bakuganId ? { ...x, bonusCards: (x.bonusCards ?? 0) + 1 } : x)),
            }
          }),
        ),
      buyShopItem: (key) => {
        const p = get().profiles.find((x) => x.id === get().activeId)
        const item = [...cosmeticsOnSale(), ...PACKS].find((i) => i.key === key)
        if (!p || !item || !('bp' in item.price) || p.bp < item.price.bp) return false
        if (item.kind !== 'boost' && item.kind !== 'cardKey' && hasCosmetic(p, key)) return false
        const cost = item.price.bp
        set((s) =>
          patchActive(s, (x) => {
            const paid = { ...x, bp: x.bp - cost }
            if (item.kind === 'boost') return { ...paid, boosts: (x.boosts ?? 0) + (item.amount ?? 0) }
            if (item.kind === 'cardKey') return { ...paid, cardKeys: (x.cardKeys ?? 0) + (item.amount ?? 0) }
            return { ...paid, cosmetics: { ...x.cosmetics, owned: [...(x.cosmetics?.owned ?? []), key] } }
          }),
        )
        return true
      },
      setBoostsOn: (on) => set((s) => patchActive(s, (p) => ({ ...p, boostsOff: !on }))),
      wearOnAvatar: (part, value) =>
        set((s) =>
          patchActive(s, (p) =>
            p.avatar.kind === 'custom' ? { ...p, avatar: { ...p.avatar, parts: { ...p.avatar.parts, [part]: value } } } : p,
          ),
        ),
      equip: (slot, value) =>
        set((s) => patchActive(s, (p) => ({ ...p, cosmetics: { owned: [], ...p.cosmetics, [slot]: value } }))),
      setSkin: (bakuganId, skin) =>
        set((s) =>
          patchActive(s, (p) =>
            // a model skin only goes on its own Bakugan
            skin && SKIN_BY_ID[skin] && !skinFits(SKIN_BY_ID[skin], bakuganId)
              ? p
              : { ...p, collection: p.collection.map((o) => (o.id === bakuganId ? { ...o, skin } : o)) },
          ),
        ),
    }),
    {
      name: 'bakugan-profiles',
      version: 3,
      // v3 (new economy and rules): every earlier test profile is cleared so everyone starts from zero
      migrate: (state, version) =>
        version < 3 ? { profiles: [], activeId: null } : (state as { profiles: Profile[]; activeId: string | null }),
    },
  ),
)

export const useActiveProfile = () => useProfiles((s) => s.profiles.find((p) => p.id === s.activeId) ?? null)
