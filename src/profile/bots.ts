import { BAKUGAN } from '../data/bakugan'
import type { ElementId } from '../data/elements'
import { LAUNCH } from '../season/release'
import { CHARACTERS } from './avatar'
import { botAt, type LiveBot } from './botProgress'

/** CPU brawlers that fill the rankings and the CPU clans next to the players on this device. */
export interface BotBrawler {
  id: string
  name: string
  element: ElementId
  /** Series character whose look the bot borrows. */
  characterId: string
  rating: number
  xp: number
  wins: number
  losses: number
  kos: number
  /** Tag of the CPU clan the bot starts in; null for free brawlers. Members move around later (useClans). */
  clan: string | null
  bio: string
}

const FIRST = [
  ...['Kai', 'Rena', 'Taro', 'Mira', 'Jin', 'Sora', 'Leo', 'Nia', 'Ryo', 'Yuna', 'Ken', 'Aya', 'Dex', 'Lia', 'Hiro', 'Zoe'],
  ...['Rin', 'Max', 'Eli', 'Noa', 'Akio', 'Mei', 'Toby', 'Kira', 'Sam', 'Luca', 'Ivy', 'Omar', 'Nina', 'Rafa', 'Emi', 'Jax'],
  ...['Suki', 'Teo', 'Ada', 'Finn', 'Hana', 'Riku', 'Lena', 'Goro', 'Maya', 'Ozzy', 'Tia', 'Yuki', 'Ari', 'Cleo', 'Dino', 'Saya'],
]
const LAST = ['Arashi', 'Kurogane', 'Hoshino', 'Takeda', 'Mori', 'Sato', 'Fujimoto', 'Kanzaki', 'Ishida', 'Nakamura']
/** Clan of each bot in turn; null = free brawler. */
const CLAN_CYCLE = ['VEST', 'BRWL', 'DRGN', null, 'NOVA', 'TIDE', 'TITN', null]

const BIOS = [
  'Brawling since the first card fell from the sky.',
  'Gate Card set! I never skip a training brawl.',
  'Saving every Battle Point for my next Bakugan.',
  'My lead Bakugan and I are going all the way to the top.',
  'Strategy first, power second. Ask me about Gate Cards.',
  'Friendly brawls any time. Bring your best team.',
  'Collector of skins, breaker of streaks.',
  'One more win and I evolve. Probably.',
  'Ability cards are my thing. Timing is everything.',
  'Here for the brawls, staying for the clan chat.',
  'Never give up — a brawl is not over until the last Bakugan stands.',
  'Season Pass grinder. Daily challenges done before breakfast.',
]

/**
 * Starting rating by place (bot index → BR), drawn between these points: one Legendary, a few Masters, and most
 * bots in the low and middle tiers (see TIERS in useProfiles.ts).
 */
const START_RATING: [number, number][] = [
  [0, 4120],
  [1, 3560],
  [4, 2980],
  [11, 2120],
  [22, 1340],
  [35, 590],
  [47, 40],
]

function startRating(i: number) {
  const k = START_RATING.findIndex((_, j) => j + 1 >= START_RATING.length || i < START_RATING[j + 1][0])
  const [a, ra] = START_RATING[k]
  const [b, rb] = START_RATING[k + 1] ?? START_RATING[k]
  const f = b > a ? (i - a) / (b - a) : 0
  // a little seeded wobble so neighbours are not evenly spaced
  return Math.max(0, Math.round(ra + (rb - ra) * f + ((i * 37) % 11) * 4 - 20))
}

/** Where each bot stood when they started brawling on their own (see botProgress.ts for since then). */
export const BOTS: BotBrawler[] = FIRST.map((first, i) => {
  const c = CHARACTERS[i % CHARACTERS.length]
  const rating = startRating(i)
  // climbing takes many brawls under the ranked rules; lower bots win a smaller share
  const wins = Math.round(rating / 8 + 6 + (i % 4) * 4)
  return {
    id: `bot-${i}`,
    name: `${first} ${LAST[(i * 7) % LAST.length]}`,
    element: c.element,
    characterId: c.id,
    rating,
    xp: wins * 65 + (i % 5) * 400,
    wins,
    losses: Math.round(wins * (0.6 + (0.45 * i) / FIRST.length + (i % 3) * 0.08)),
    kos: Math.round(wins * (1.4 + (i % 4) * 0.2)),
    clan: CLAN_CYCLE[i % CLAN_CYCLE.length],
    bio: BIOS[(i * 5) % BIOS.length],
  }
})

const BOT_BY_ID = Object.fromEntries(BOTS.map((b) => [b.id, b]))
export const botById = (id: string): BotBrawler | undefined => BOT_BY_ID[id]
export const isBot = (id: string) => id.startsWith('bot-')

/** A bot's record at `now`: rating, XP and wins keep moving with the clock. */
export const botNow = (bot: BotBrawler, now: number): LiveBot => botAt(bot, BOTS.length, now)

export interface BotClan {
  tag: string
  name: string
  element: ElementId
  motto: string
  /** Day the clan was founded (YYYY-MM-DD). */
  founded: string
}

/** CPU clans: shown in the clan rankings and open to join. Their members are the bots with the same tag. */
export const BOT_CLANS: BotClan[] = [
  { tag: 'VEST', name: 'Vestroia Vanguard', element: 'pyrus', motto: 'First to the field, last to fall.', founded: '2026-10-05' },
  { tag: 'BRWL', name: 'Battle Brawlers Unbound', element: 'ventus', motto: 'Brawl hard, brawl fair.', founded: '2026-10-05' },
  { tag: 'DRGN', name: 'Dragon Gate', element: 'darkus', motto: 'Every Gate Card hides a dragon.', founded: '2026-10-06' },
  { tag: 'NOVA', name: 'Nova Haos', element: 'haos', motto: 'Shine brighter every brawl.', founded: '2026-10-07' },
  { tag: 'TIDE', name: 'Tidebreakers', element: 'aquos', motto: 'Go with the flow, then crash the wave.', founded: '2026-10-09' },
  { tag: 'TITN', name: 'Subterra Titans', element: 'subterra', motto: 'Solid ground, solid wins.', founded: '2026-10-11' },
]

/** Member ids of a CPU clan, strongest first (the first one leads it). */
export const botClanMembers = (tag: string) => BOTS.filter((b) => b.clan === tag).map((b) => b.id)

/**
 * The Bakugan a bot brings (launch Bakugan only, so it never shows one that is not out yet):
 * one of its attribute leads, stronger bots bring more and further evolved ones.
 */
export function botTeam(bot: BotBrawler): { id: string; form: number }[] {
  const n = Number(bot.id.slice(4))
  const launch = BAKUGAN.filter((b) => LAUNCH.includes(b.id))
  const own = launch.filter((b) => b.element === bot.element)
  const size = bot.rating >= 2500 ? 3 : bot.rating >= 900 ? 2 : 1
  const picks = [own[n % own.length]]
  for (let k = 1; picks.length < size && k < launch.length; k++) {
    const b = launch[(n * 7 + k * 5) % launch.length]
    if (!picks.includes(b)) picks.push(b)
  }
  const stage = bot.rating >= 3000 ? 2 : bot.rating >= 1500 ? 1 : 0
  return picks.map((b) => ({ id: b.id, form: Math.min(stage, b.evolutions.length - 1) }))
}
