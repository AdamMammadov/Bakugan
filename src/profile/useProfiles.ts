import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { abilitiesOf, BAKUGAN, type Bakugan, type Entrant } from '../data/bakugan'
import type { ElementId } from '../data/elements'
import { normalizeAvatar, type Avatar } from './avatar'
import { currentSeason, seasonBakugan, seasonOfBakugan } from '../season/current'
import { isReleased, LAUNCH, OWNER_ONLY } from '../season/release'
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
 * - Brawler Rating (BR) goes up with ranked wins and down with losses (see RATING); the rank comes mostly from BR,
 *   with a small, capped share from total XP.
 */

/** Bakugan XP needed for each next form (index = current form). E.g. Hydranoid → Dual 6.5k → Alpha 15k. */
export const EVOLVE_XP = [6500, 15000, 26000]
/** Ability cards unlocked at the start, plus one more every CARD_XP. */
const START_CARDS = 3
const CARD_XP = 1500

export const XP = { winMin: 60, winMax: 70, lossMin: 15, lossMax: 20, ko: 8 }
export const BP = { win: 100, loss: 25, streakBonus: 10, streakCap: 5 }

export const PRICES = {
  /** BP for a Bakugan of the player's own attribute. */
  ownElement: 4000,
  /** BP for a Bakugan of another attribute. */
  otherElement: 11000,
  /** Alternative: total player XP that unlocks the Bakugan for free. */
  ownElementXp: 15000,
  otherElementXp: 30000,
}

/** The six major tiers (index 0–5 sets CPU strength and matchmaking); each has divisions III → II → I. */
export const TIERS = [
  { name: 'Rookie', min: 0 },
  { name: 'Brawler', min: 600 },
  { name: 'Battle Brawler', min: 1350 },
  { name: 'Ace Brawler', min: 2100 },
  { name: 'Master Brawler', min: 3000 },
  { name: 'Legendary Brawler', min: 4050 },
]

/** Score each division of a major tier takes: the higher the tier, the wider. */
const DIVISION_SIZE = [200, 250, 250, 300, 350, 400]

export type Division = 'III' | 'II' | 'I'

export interface Rank {
  /** E.g. "Battle Brawler II"; the top rank has no division. */
  name: string
  /** Major tier index (0–5); the top rank counts as Legendary (5). */
  tier: number
  division: Division | null
  min: number
}

/** The rank above Legendary Brawler I that only very few reach. */
export const TOP_RANK = { name: 'Legend of Vestroia', min: 5300 }

/** Every rank, lowest first: 6 tiers × 3 divisions, then the top rank. */
export const RANKS: Rank[] = [
  ...TIERS.flatMap((t, tier) =>
    (['III', 'II', 'I'] as const).map((division, k) => ({
      name: `${t.name} ${division}`,
      tier,
      division,
      min: t.min + k * DIVISION_SIZE[tier],
    })),
  ),
  { name: TOP_RANK.name, tier: TIERS.length - 1, division: null, min: TOP_RANK.min },
]

/**
 * Ranked rating, Elo-like. `swing` holds what a win gains and a loss costs against an equal opponent at the start
 * of each major tier, then at the top rank and 1,500 past it (in between it slides): higher ranks gain less and
 * lose more. A stronger opponent makes a win worth more and a loss cost less (and the other way round), up to
 * `maxGap` of score apart on an Elo scale of `scale`. Win streaks of 3+ add 1 per win, up to `streakCap`.
 * `win` and `loss` are the Rookie values, for rules texts.
 */
export const RATING = {
  win: 24,
  loss: 8,
  swing: [
    [24, 8],
    [22, 11],
    [20, 14],
    [18, 16.5],
    [16, 18.5],
    [15, 20],
    [13, 23],
    [8, 28],
  ],
  scale: 400,
  maxGap: 300,
  streakCap: 5,
}
const SWING_AT = [...TIERS.map((t) => t.min), TOP_RANK.min, TOP_RANK.min + 1500]

/** Rank score from experience: 1 point per `per` total XP, at most `max`, so playing alone cannot carry a rank. */
export const RANK_XP = { per: 200, max: 200 }

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
  /**
   * Bakugan XP when its current form's own cards began to unlock: an evolution with cards of its own starts again
   * from the first few and unlocks the rest with the XP earned since.
   */
  cardsFrom?: number
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
  /** Friends (profile or bot ids). A CPU brawler accepts a few seconds after the request: until `since` it is pending. */
  friends?: Friend[]
}

export interface Friend {
  id: string
  /** When the request was accepted (in the future while it is still pending). */
  since: number
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
  /** Rank score of the opponent (tag battles: the two opponents' average); left out = on the player's level. */
  foe?: number
}

export interface BattleReward {
  xp: Record<string, number>
  bp: number
  rating: number
  evolveReady: string[]
  newCards: Record<string, number>
  /** Bakugan unlocked by reaching a total-XP milestone. */
  unlocked: string[]
  /** New rank name (with its division, e.g. "Brawler II") when the player moved up a rank. */
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
  Math.min(
    abilitiesOf(bakuganById(owned.id), owned.form).length,
    START_CARDS + (owned.bonusCards ?? 0) + Math.floor(Math.max(0, owned.xp - (owned.cardsFrom ?? 0)) / CARD_XP),
  )

export const unlockedCards = (owned: OwnedBakugan) => abilitiesOf(bakuganById(owned.id), owned.form).slice(0, cardCount(owned))

/** XP at which ability card number `index` (0-based) unlocks. */
export const cardUnlockXp = (index: number) => Math.max(0, index - START_CARDS + 1) * CARD_XP

/** This Bakugan's XP at which its ability card number `index` (0-based) unlocks. */
export const cardXpFor = (owned: OwnedBakugan, index: number) =>
  (owned.cardsFrom ?? 0) + cardUnlockXp(index - (owned.bonusCards ?? 0))

/** XP at which the next ability card unlocks, or null when all are unlocked. */
export const nextCardXp = (owned: OwnedBakugan) => {
  const n = cardCount(owned)
  return n >= abilitiesOf(bakuganById(owned.id), owned.form).length ? null : cardXpFor(owned, n)
}

/** Season Bakugan of the running season are earned on the Season page, not bought. */
export const inShop = (bakuganId: string) => {
  if (!isReleased(bakuganId)) return false
  const s = seasonOfBakugan(bakuganId)
  return !s || s.season < currentSeason().id
}

/** The Bakugan a new player of this attribute starts with. */
export const starterFor = (element: ElementId) =>
  // the weakest launch Bakugan of the attribute: the rest are earned or bought
  BAKUGAN.filter((b) => b.element === element && LAUNCH.includes(b.id)).reduce((a, b) => (b.baseG < a.baseG ? b : a)).id

/** Guests (no profile) only get each attribute's starter. */
export const ownsBakugan = (p: Profile | null, id: string) =>
  p ? p.collection.some((o) => o.id === id) : starterFor(bakuganById(id).element) === id

/** The player's current form of a Bakugan (guests: base form only), or -1 if not owned. */
export const ownedForm = (p: Profile | null, id: string) =>
  p ? (p.collection.find((o) => o.id === id)?.form ?? -1) : ownsBakugan(null, id) ? 0 : -1

/** How a player gets a Bakugan they do not own yet. */
export function unlockHint(p: Profile | null, b: Bakugan): string {
  if (!isReleased(b.id)) return 'Not out yet: only you can see it'
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

/** Score the rank and leaderboard use: mostly ranked wins (through BR), plus a little, capped, for experience. */
export const rankScore = (p: Pick<Profile, 'rating' | 'xp'>) =>
  Math.max(0, p.rating) + Math.min(RANK_XP.max, Math.floor(Math.max(0, p.xp) / RANK_XP.per))

/**
 * The rank at a score. `index`, `name` and `next` are the major tier (index 0–5, for CPU strength and matchmaking);
 * `rank`, `division`, `step` and `nextRank` are the full rank with its division.
 */
export function tierOf(score: number) {
  let r = 0
  while (r + 1 < RANKS.length && score >= RANKS[r + 1].min) r++
  const rank = RANKS[r]
  const i = rank.tier
  return {
    index: i,
    name: TIERS[i].name,
    next: TIERS[i + 1] ?? null,
    /** E.g. "Battle Brawler II". */
    rank: rank.name,
    division: rank.division,
    /** Place on the whole ladder (index into RANKS): 0 = Rookie III. */
    step: r,
    /** Score this rank starts at. */
    min: rank.min,
    /** The next rank up, null at the top. */
    nextRank: RANKS[r + 1] ?? null,
    /** The top rank (above Legendary Brawler I). */
    top: r === RANKS.length - 1,
  }
}

/** What a ranked win gains and a loss costs against an equal opponent at a rank score. */
export function ratingSwing(score: number) {
  const s = Math.max(0, score)
  const k = SWING_AT.findIndex((_, j) => j + 1 >= SWING_AT.length || s < SWING_AT[j + 1])
  const [w0, l0] = RATING.swing[k]
  const [w1, l1] = RATING.swing[k + 1] ?? RATING.swing[k]
  const f = k + 1 < SWING_AT.length ? Math.min(1, (s - SWING_AT[k]) / (SWING_AT[k + 1] - SWING_AT[k])) : 0
  return { win: w0 + (w1 - w0) * f, loss: l0 + (l1 - l0) * f }
}

/**
 * Rating change of a ranked result at rank score `score` against an opponent of score `foe` (same level when left
 * out); `streak` counts the wins in a row with this one. Positive for a win, negative for a loss.
 */
export function ratingChange(score: number, won: boolean, foe = score, streak = 0) {
  const { win, loss } = ratingSwing(score)
  const gap = Math.max(-RATING.maxGap, Math.min(RATING.maxGap, foe - score))
  // the chance an Elo player of `score` had to beat one of `foe`
  const expected = 1 / (1 + 10 ** (gap / RATING.scale))
  if (!won) return -Math.max(1, Math.round(2 * loss * expected))
  return Math.max(1, Math.round(2 * win * (1 - expected))) + Math.min(RATING.streakCap, Math.max(0, streak - 2))
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
/** The next form; one with cards of its own starts them again from the first few (early unlocks do not carry over). */
const evolved = (o: OwnedBakugan): OwnedBakugan =>
  bakuganById(o.id).evolutions[o.form + 1]?.abilities
    ? { ...o, form: o.form + 1, cardsFrom: o.xp, bonusCards: 0 }
    : { ...o, form: o.form + 1 }
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
      return { ...p, collection: [...p.collection, own(id)], team: p.team.length ? p.team : [id] }
    }
    case 'bundle': {
      let next: Profile | null = p
      for (const item of r.items) next = next && grant(next, item, seasonId)
      return next
    }
  }
}

export const hasCosmetic = (p: Profile | null, key: string) => !!p?.cosmetics?.owned.includes(key)

export function friendStatus(p: Profile | null, id: string, now = Date.now()): 'none' | 'pending' | 'friend' {
  const f = p?.friends?.find((x) => x.id === id)
  return !f ? 'none' : f.since <= now ? 'friend' : 'pending'
}

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
  /** Gives the game owner's own Bakugan, every card unlocked, to each profile in this browser that lacks them. */
  grantOwnerBakugan: () => void
  /** Applies XP, BP, rating and stats for the active player; returns what was gained. */
  recordBattle: (report: BattleReport) => BattleReward | null
  /** Rolls the active player over into a new season when the old one has ended. */
  syncSeason: () => void
  dismissSeasonNotice: () => void
  /** Gives the active player rewards earned outside the pass (events). */
  grantRewards: (rewards: Reward[]) => boolean
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
  /** Sends a friend request: a CPU brawler accepts after a few seconds, another player on this device right away. */
  addFriend: (id: string) => void
  removeFriend: (id: string) => void
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
          profiles: s.profiles
            .filter((p) => p.id !== id)
            .map((p) => (p.friends?.some((f) => f.id === id) ? { ...p, friends: p.friends.filter((f) => f.id !== id) } : p)),
          activeId: s.activeId === id ? null : s.activeId,
        })),
      select: (activeId) => set({ activeId }),
      setTeam: (team) => set((s) => patchActive(s, (p) => ({ ...p, team: team.slice(0, 3) }))),
      evolve: (bakuganId) =>
        set((s) =>
          patchActive(s, (p) => ({
            ...p,
            collection: p.collection.map((o) => (o.id === bakuganId && canEvolve(o) ? evolved(o) : o)),
          })),
        ),
      grantOwnerBakugan: () => {
        const lacks = (p: Profile) => OWNER_ONLY.filter((id) => !p.collection.some((o) => o.id === id))
        // nothing to give: no change at all, so watching the store for new profiles cannot loop
        if (!get().profiles.some((p) => lacks(p).length)) return
        const gift = (id: string) => ({ ...own(id), bonusCards: bakuganById(id).abilities.length })
        set((s) => ({
          profiles: s.profiles.map((p) => (lacks(p).length ? { ...p, collection: [...p.collection, ...lacks(p).map(gift)] } : p)),
        }))
      },
      acquire: (bakuganId, how) => {
        const p = get().profiles.find((x) => x.id === get().activeId)
        if (!p || !isReleased(bakuganId) || p.collection.some((o) => o.id === bakuganId)) return false
        const price = priceOf(p, bakuganById(bakuganId))
        if (how === 'bp' ? p.bp < price.bp : p.xp < price.xp) return false
        set((s) =>
          patchActive(s, (x) => ({
            ...x,
            bp: how === 'bp' ? x.bp - price.bp : x.bp,
            collection: [...x.collection, own(bakuganId)],
            // the player picks how many Bakugan they brawl with; a new one only joins an empty team
            team: x.team.length ? x.team : [bakuganId],
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
        // Elo-like: the opponent's score and the player's own rank set the change; rating never goes below 0
        const score = rankScore(p)
        const foe = Number.isFinite(report.foe) ? report.foe! : score
        reward.rating = Math.max(-Math.max(0, p.rating), ratingChange(score, report.won, foe, streak))
        const xp = p.xp + Object.values(reward.xp).reduce((a, b) => a + b, 0)
        const rating = Math.max(0, p.rating) + reward.rating
        const before = tierOf(score)
        const after = tierOf(rankScore({ rating, xp }))
        if (after.step > before.step) reward.rankUp = after.rank
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
      grantRewards: (rewards) => {
        const p = get().profiles.find((x) => x.id === get().activeId)
        if (!p) return false
        const seasonId = seasonFor(p).id
        let next: Profile | null = p
        for (const r of rewards) next = next && grant(next, r, seasonId)
        if (!next) return false
        const done = next
        set((s) => patchActive(s, () => done))
        return true
      },
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
            // the player picks how many Bakugan they brawl with; a new one only joins an empty team
            team: x.team.length ? x.team : [bakuganId],
          })),
        )
        return true
      },
      applyCardKey: (bakuganId) =>
        set((s) =>
          patchActive(s, (p) => {
            const o = p.collection.find((x) => x.id === bakuganId)
            if (!o || (p.cardKeys ?? 0) < 1 || cardCount(o) >= abilitiesOf(bakuganById(o.id), o.form).length) return p
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
      addFriend: (id) =>
        set((s) => {
          const me = s.activeId
          if (!me || id === me) return {}
          const local = s.profiles.some((p) => p.id === id)
          const now = Date.now()
          const since = local ? now : now + 2500 + Math.floor(Math.random() * 3500)
          const add = (p: Profile, other: string) =>
            p.friends?.some((f) => f.id === other) ? p : { ...p, friends: [...(p.friends ?? []), { id: other, since }] }
          // players on this device become friends both ways
          return { profiles: s.profiles.map((p) => (p.id === me ? add(p, id) : local && p.id === id ? add(p, me) : p)) }
        }),
      removeFriend: (id) =>
        set((s) => {
          const drop = (p: Profile, other: string) => ({ ...p, friends: (p.friends ?? []).filter((f) => f.id !== other) })
          return {
            profiles: s.profiles.map((p) =>
              p.id === s.activeId ? drop(p, id) : p.id === id && s.activeId ? drop(p, s.activeId) : p,
            ),
          }
        }),
    }),
    {
      name: 'bakugan-profiles',
      version: 7,
      // v3 (new economy and rules): every earlier test profile is cleared so everyone starts from zero
      // v4: Tripod Epsilon left the roster; Robotallion (now Aquos) took its place, so it takes its owners too
      // v5: an evolution with cards of its own unlocks them with XP from when it was reached
      // v6: friends list (empty for existing profiles)
      // v7: a photo is a portrait on top of a look; a photo-only avatar takes the series character of its attribute
      migrate: (state, version) => {
        if (version < 3) return { profiles: [], activeId: null }
        let s = state as { profiles: Profile[]; activeId: string | null }
        if (version < 4) s = { ...s, profiles: s.profiles.map((p) => renameBakugan(p, 'tripod-epsilon', 'robotallion')) }
        if (version < 5)
          s = {
            ...s,
            profiles: s.profiles.map((p) => ({
              ...p,
              collection: p.collection.map((o) =>
                BAKUGAN.find((b) => b.id === o.id)?.evolutions[o.form]?.abilities && o.cardsFrom === undefined
                  ? { ...o, cardsFrom: o.xp, bonusCards: 0 }
                  : o,
              ),
            })),
          }
        if (version < 6) s = { ...s, profiles: s.profiles.map((p) => ({ ...p, friends: p.friends ?? [] })) }
        if (version < 7) s = { ...s, profiles: s.profiles.map((p) => ({ ...p, avatar: normalizeAvatar(p.avatar, p.element) })) }
        return s
      },
    },
  ),
)

/**
 * Moves a profile from a Bakugan that left the roster to the one that replaced it, owned and on the team.
 * Owning both keeps the one further along.
 */
function renameBakugan(p: Profile, from: string, to: string): Profile {
  const moved = p.collection.map((o) => (o.id === from ? { ...o, id: to } : o))
  const pick = moved.filter((o) => o.id === to).sort((a, b) => b.form - a.form || b.xp - a.xp)[0]
  const collection = moved.filter((o) => o.id !== to || o === pick)
  const team = [...new Set(p.team.map((id) => (id === from ? to : id)))]
  return { ...p, collection, team }
}

export const useActiveProfile = () => useProfiles((s) => s.profiles.find((p) => p.id === s.activeId) ?? null)
