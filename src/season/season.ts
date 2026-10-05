/**
 * Seasons and the Season Pass.
 *
 * - A season lasts 35 days. Each one brings 12 new Bakugan: 4 come from the pass (premium
 *   levels) and 8 are earned in play (wins, pass level and BP; easier for the player's own
 *   attribute). When the season ends, the pass Bakugan go to the shop at a high price.
 * - The pass has 50 levels: 27 free and 23 premium, interleaved. The XP a level costs rises
 *   every 5 levels, and battle XP is capped per day, so even the most active player needs
 *   about two weeks to finish it.
 */

export const SEASON_DAYS = 35
const DAY = 86_400_000
export const PASS_LEVELS = 50

export type SeasonRole = 'pass' | 'challenge'

export interface SeasonInfo {
  id: number
  startsAt: number
  endsAt: number
}

/** The season running at `now`, counted from the first season's start date. */
export function seasonAt(firstStart: string, now = Date.now()): SeasonInfo {
  const start = new Date(`${firstStart}T00:00:00`).getTime()
  const len = SEASON_DAYS * DAY
  const index = Math.max(0, Math.floor((now - start) / len))
  return { id: index + 1, startsAt: start + index * len, endsAt: start + (index + 1) * len }
}

export function timeLeft(ms: number) {
  const d = Math.floor(ms / DAY)
  const h = Math.floor((ms % DAY) / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`
}

// ---------------------------------------------------------------- pass levels

/** XP needed to go from `level - 1` to `level`: 400–500 for 1–5, 600–700 for 6–10, … */
export const levelCost = (level: number) => 400 + 200 * Math.floor((level - 1) / 5) + 25 * ((level - 1) % 5)

/** Total pass XP needed to reach each level (index = level). */
export const LEVEL_XP = Array.from({ length: PASS_LEVELS + 1 }, (_, l) => {
  let sum = 0
  for (let i = 1; i <= l; i++) sum += levelCost(i)
  return sum
})
export const PASS_TOTAL_XP = LEVEL_XP[PASS_LEVELS]

export const passLevel = (xp: number) => {
  let l = 0
  while (l < PASS_LEVELS && xp >= LEVEL_XP[l + 1]) l++
  return l
}

/** Pass XP from battles, and the daily cap on it. */
export const PASS_XP = { win: 250, loss: 100, dailyBattleCap: 2500 }

// ---------------------------------------------------------------- cosmetics

export interface Skin {
  id: string
  name: string
  color: string
  glow: string
}

/** Colour variants for Bakugan, shown in the viewer and the arena. */
export const SKINS: Skin[] = [
  { id: 'ember', name: 'Ember', color: '#ff6a00', glow: '#ffb347' },
  { id: 'frost', name: 'Frost', color: '#7fd8ff', glow: '#e0f7ff' },
  { id: 'shadow', name: 'Shadow', color: '#2a1f3d', glow: '#9a6cff' },
  { id: 'storm', name: 'Storm', color: '#2f5fa8', glow: '#9ad0ff' },
  { id: 'crystal', name: 'Crystal', color: '#cfefff', glow: '#ffffff' },
  { id: 'gold', name: 'Golden', color: '#d4af37', glow: '#fff1a8' },
  { id: 'neon', name: 'Neon', color: '#1fdc6a', glow: '#b6ff9e' },
]
export const SKIN_BY_ID = Object.fromEntries(SKINS.map((s) => [s.id, s])) as Record<string, Skin>

/** Avatar frames: a ring drawn around the player's picture. */
export const FRAMES: Record<string, { name: string; ring: string }> = {
  bronze: { name: 'Bronze Frame', ring: 'linear-gradient(135deg,#8a5a2b,#e0a46a,#6b3f1a)' },
  silver: { name: 'Silver Frame', ring: 'linear-gradient(135deg,#8e9aa8,#f2f6fa,#6f7a86)' },
  gold: { name: 'Gold Frame', ring: 'linear-gradient(135deg,#a8801c,#ffe58a,#8a6510)' },
  amethyst: { name: 'Amethyst Frame', ring: 'linear-gradient(135deg,#5b2a86,#d6a8ff,#3d1a5c)' },
  royal: { name: 'Royal Frame', ring: 'conic-gradient(#d4af37,#7a2cff,#d4af37,#ff3b6b,#d4af37)' },
  season: { name: 'Season Legend Frame', ring: 'conic-gradient(#ff3b2f,#f5c518,#3ee07a,#2a62c8,#7a2cff,#ff3b2f)' },
  champion: { name: 'Champion Frame', ring: 'conic-gradient(#fff1a8,#d4af37,#fff,#d4af37,#fff1a8)' },
}

/** Brawler outfit colours for the avatar builder. */
export const OUTFITS: Record<string, { name: string; color: string }> = {
  royal: { name: 'Royal Violet Set', color: '#5b2a86' },
  gold: { name: 'Gold Rush Set', color: '#c9a227' },
  obsidian: { name: 'Obsidian Set', color: '#15151c' },
}

/** Avatar accessories that are earned in the pass. */
export const PASS_ACCESSORIES: Record<string, string> = { visor: 'Battle Visor', crown: 'Brawler Crown', halo: 'Light Halo' }

// ---------------------------------------------------------------- rewards

export type Reward =
  | { kind: 'bp'; amount: number }
  | { kind: 'boost'; amount: number }
  | { kind: 'cardKey'; amount: number }
  | { kind: 'title'; name: string }
  | { kind: 'frame'; id: string }
  | { kind: 'skin'; id: string }
  | { kind: 'outfit'; id: string }
  | { kind: 'accessory'; id: string }
  | { kind: 'seasonBakugan'; slot: number }
  | { kind: 'bundle'; items: Reward[] }

/** Premium levels come in the pattern free-free-free-PASS-PASS-free-free-PASS-PASS-PASS (23 in all). */
const PREMIUM = new Set([4, 5, 8, 9, 10, 14, 15, 18, 19, 20, 24, 25, 28, 29, 30, 34, 35, 38, 39, 40, 44, 45, 48])
export const isPremiumLevel = (level: number) => PREMIUM.has(level)

export function passRewards(season: number): Reward[] {
  const t = (name: string): Reward => ({ kind: 'title', name: `Season ${season} ${name}` })
  // index = level (index 0 unused)
  return [
    { kind: 'bp', amount: 0 },
    { kind: 'bp', amount: 300 },
    { kind: 'boost', amount: 2 },
    t('Contender'),
    { kind: 'skin', id: 'ember' },
    { kind: 'bp', amount: 1000 },
    { kind: 'cardKey', amount: 1 },
    { kind: 'frame', id: 'bronze' },
    { kind: 'outfit', id: 'royal' },
    { kind: 'boost', amount: 5 },
    { kind: 'seasonBakugan', slot: 0 },
    { kind: 'bp', amount: 500 },
    { kind: 'skin', id: 'frost' },
    { kind: 'boost', amount: 3 },
    { kind: 'accessory', id: 'visor' },
    t('Elite'),
    { kind: 'cardKey', amount: 1 },
    { kind: 'bp', amount: 750 },
    { kind: 'skin', id: 'shadow' },
    { kind: 'frame', id: 'amethyst' },
    { kind: 'seasonBakugan', slot: 1 },
    { kind: 'frame', id: 'silver' },
    { kind: 'bp', amount: 1000 },
    { kind: 'boost', amount: 3 },
    { kind: 'outfit', id: 'gold' },
    { kind: 'bp', amount: 2000 },
    { kind: 'skin', id: 'storm' },
    { kind: 'cardKey', amount: 2 },
    { kind: 'accessory', id: 'crown' },
    { kind: 'skin', id: 'crystal' },
    { kind: 'seasonBakugan', slot: 2 },
    t('Veteran'),
    { kind: 'bp', amount: 1250 },
    { kind: 'boost', amount: 4 },
    { kind: 'frame', id: 'royal' },
    { kind: 'cardKey', amount: 3 },
    { kind: 'frame', id: 'gold' },
    { kind: 'bp', amount: 1500 },
    { kind: 'skin', id: 'gold' },
    { kind: 'outfit', id: 'obsidian' },
    { kind: 'seasonBakugan', slot: 3 },
    { kind: 'skin', id: 'neon' },
    { kind: 'cardKey', amount: 2 },
    { kind: 'bp', amount: 2000 },
    { kind: 'accessory', id: 'halo' },
    { kind: 'bp', amount: 3000 },
    { kind: 'boost', amount: 5 },
    t('Master'),
    { kind: 'frame', id: 'season' },
    { kind: 'bp', amount: 2500 },
    { kind: 'bundle', items: [t('Champion'), { kind: 'frame', id: 'champion' }, { kind: 'bp', amount: 5000 }] },
  ]
}

export function rewardLabel(r: Reward, seasonBakuganName?: (slot: number) => string | null): string {
  switch (r.kind) {
    case 'bp':
      return `${r.amount.toLocaleString('en')} BP`
    case 'boost':
      return `XP Boost ×${r.amount}`
    case 'cardKey':
      return `Card Key ×${r.amount}`
    case 'title':
      return `Title: ${r.name}`
    case 'frame':
      return FRAMES[r.id]?.name ?? 'Frame'
    case 'skin':
      return `${SKIN_BY_ID[r.id]?.name ?? r.id} Skin`
    case 'outfit':
      return OUTFITS[r.id]?.name ?? 'Outfit'
    case 'accessory':
      return PASS_ACCESSORIES[r.id] ?? 'Accessory'
    case 'seasonBakugan':
      return seasonBakuganName?.(r.slot) ?? 'Season Bakugan'
    case 'bundle':
      return r.items.map((i) => rewardLabel(i, seasonBakuganName)).join(' + ')
  }
}

export const rewardIcon = (r: Reward): string =>
  ({ bp: '◈', boost: '⇧', cardKey: '🗝', title: '✦', frame: '◯', skin: '◆', outfit: '👕', accessory: '♛', seasonBakugan: '⬢', bundle: '★' })[r.kind]

// ---------------------------------------------------------------- challenges

export type ChallengeStat = 'wins' | 'battles' | 'kos' | 'abilities' | 'ownWins' | 'flawless'

export interface Challenge {
  id: string
  text: string
  stat: ChallengeStat
  goal: number
  xp: number
}

const DAILY: Challenge[] = [
  { id: 'd-win3', text: 'Win 3 brawls', stat: 'wins', goal: 3, xp: 500 },
  { id: 'd-play5', text: 'Play 5 brawls', stat: 'battles', goal: 5, xp: 400 },
  { id: 'd-ko6', text: 'Defeat 6 Bakugan', stat: 'kos', goal: 6, xp: 450 },
  { id: 'd-cards10', text: 'Activate 10 ability cards', stat: 'abilities', goal: 10, xp: 400 },
  { id: 'd-own2', text: 'Win 2 brawls with a Bakugan of your attribute', stat: 'ownWins', goal: 2, xp: 450 },
  { id: 'd-flawless1', text: 'Win a brawl without losing a Bakugan', stat: 'flawless', goal: 1, xp: 500 },
]

const WEEKLY: Challenge[] = [
  { id: 'w-win20', text: 'Win 20 brawls', stat: 'wins', goal: 20, xp: 3000 },
  { id: 'w-ko40', text: 'Defeat 40 Bakugan', stat: 'kos', goal: 40, xp: 2500 },
  { id: 'w-cards60', text: 'Activate 60 ability cards', stat: 'abilities', goal: 60, xp: 2500 },
  { id: 'w-play30', text: 'Play 30 brawls', stat: 'battles', goal: 30, xp: 2000 },
  { id: 'w-flawless8', text: 'Win 8 brawls without losing a Bakugan', stat: 'flawless', goal: 8, xp: 3000 },
]

export const dayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10)
/** Weeks are counted from Monday. */
export const weekKey = (now = Date.now()) => {
  const d = new Date(now)
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
  return monday.toISOString().slice(0, 10)
}

function pick<T>(pool: T[], key: string, n: number): T[] {
  // the same three challenges for everyone on the same day/week
  let h = 0
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const a = [...pool]
  for (let i = a.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0
    const j = h % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}

export const dailyChallenges = (now = Date.now()) => pick(DAILY, dayKey(now), 3)
export const weeklyChallenges = (now = Date.now()) => pick(WEEKLY, weekKey(now), 3)

// ---------------------------------------------------------------- season Bakugan

/** What an in-play season Bakugan asks for; the player's own attribute is easier. */
export function challengeRequirement(ownElement: boolean) {
  return ownElement ? { wins: 15, level: 8, bp: 3000 } : { wins: 35, level: 20, bp: 8000 }
}

/** Shop price of a pass Bakugan once its season is over. */
export const PASS_BAKUGAN_PRICE = 30000
