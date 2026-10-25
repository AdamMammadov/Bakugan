import type { ElementId } from '../data/elements'
import { dayKey, weekKey, type Reward } from '../season/season'

/**
 * Every event and when it runs. Nothing needs a server: what is on comes from the clock, so every player
 * sees the same board on the same day.
 *
 * - Bakugan Cup: a new 8-brawler knockout cup every CUP_DAYS days, one free entry a day.
 * - Boss battles: villains of the anime with a boosted team; 4 of the 7 are in each week, the rest return later.
 * - Rule events: a daily one (rules change every day) and a weekly attribute reactor (a new attribute each week).
 */

const DAY = 86_400_000

// ---------------------------------------------------------------- the clock

/** Days are UTC days, as the daily challenges count them (dayKey). */
export const dayIndex = (now = Date.now()) => Math.floor(now / DAY)
export const dayEnd = (now = Date.now()) => (dayIndex(now) + 1) * DAY

/** Weeks start on Monday, as the weekly challenges count them (weekKey). */
export function weekStart(now = Date.now()) {
  const d = new Date(now)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7)).getTime()
}
export function weekEnd(now = Date.now()) {
  const s = new Date(weekStart(now))
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7).getTime()
}
/** Monday of the first season's first week. */
const FIRST_MONDAY = new Date(2026, 9, 5).getTime()
/** Weeks since the first season began (rounded, so a clock change does not shift it). */
export const weekIndex = (now = Date.now()) => Math.round((weekStart(now) - FIRST_MONDAY) / (7 * DAY))

export { dayKey, weekKey }

// ---------------------------------------------------------------- Bakugan Cup

export const CUP_DAYS = 3
const CUP_EPOCH = Date.UTC(2026, 9, 5)

const CUPS: { name: string; element: ElementId }[] = [
  { name: 'Vestroia Cup', element: 'pyrus' },
  { name: 'Doom Dimension Cup', element: 'darkus' },
  { name: 'Wardington Cup', element: 'haos' },
  { name: 'New Vestroia Cup', element: 'ventus' },
  { name: 'Alpha City Cup', element: 'aquos' },
  { name: 'Bakugan Interspace Cup', element: 'subterra' },
  { name: 'Neathia Cup', element: 'haos' },
  { name: 'Gundalia Cup', element: 'darkus' },
]

export interface CupInfo {
  index: number
  name: string
  element: ElementId
  startsAt: number
  endsAt: number
}

/** The cup open for entries at `now`. */
export function cupAt(now = Date.now()): CupInfo {
  const len = CUP_DAYS * DAY
  const index = Math.max(0, Math.floor((now - CUP_EPOCH) / len))
  const c = CUPS[index % CUPS.length]
  return { index, ...c, startsAt: CUP_EPOCH + index * len, endsAt: CUP_EPOCH + (index + 1) * len }
}

export type CupStage = 'qf' | 'sf' | 'final'
export const CUP_ROUNDS: CupStage[] = ['qf', 'sf', 'final']
export const ROUND_NAME: Record<CupStage, string> = { qf: 'Quarter-final', sf: 'Semi-final', final: 'Final' }
/** Extra G for the CPU in each round: the field gets tougher. */
export const ROUND_BOOST: Record<CupStage, number> = { qf: 0, sf: 20, final: 40 }

/** Where a run ended: 1 champion, 2 runner-up, 3 semi-finalist, 5 quarter-finalist. */
export type Place = 1 | 2 | 3 | 5
export const PLACE_NAME: Record<Place, string> = { 1: 'Champion', 2: 'Runner-up', 3: '3rd–4th', 5: '5th–8th' }

export function cupPrize(place: Place, cupName: string): Reward[] {
  switch (place) {
    case 1:
      return [
        { kind: 'bp', amount: 1500 },
        { kind: 'boost', amount: 3 },
        { kind: 'title', name: `${cupName} Champion` },
      ]
    case 2:
      return [
        { kind: 'bp', amount: 800 },
        { kind: 'boost', amount: 2 },
      ]
    case 3:
      return [
        { kind: 'bp', amount: 400 },
        { kind: 'boost', amount: 1 },
      ]
    case 5:
      return [{ kind: 'bp', amount: 150 }]
  }
}

// ---------------------------------------------------------------- bosses

export type Difficulty = 'normal' | 'hard' | 'brutal'

export interface DifficultyInfo {
  id: Difficulty
  name: string
  /** Extra G for each boss Bakugan. */
  boost: number
  /** Lives [player, boss]. */
  lives: [number, number]
  /** Lowest CPU rank tier (sharper play); the player's own when it is higher. */
  tier: number
  /** The boss brings every ability card, not just as many as the player. */
  allCards: boolean
  color: string
}

export const DIFFICULTIES: DifficultyInfo[] = [
  { id: 'normal', name: 'Normal', boost: 40, lives: [3, 3], tier: 1, allCards: false, color: '#3ee07a' },
  { id: 'hard', name: 'Hard', boost: 90, lives: [3, 4], tier: 3, allCards: true, color: '#ff9a2f' },
  { id: 'brutal', name: 'Brutal', boost: 150, lives: [3, 5], tier: 5, allCards: true, color: '#ff3b5c' },
]
export const DIFFICULTY_BY_ID = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d])) as Record<Difficulty, DifficultyInfo>

export interface Boss {
  id: string
  name: string
  element: ElementId
  /** Series character whose look and voice the boss borrows in the arena. */
  look: string
  /** Bakugan and forms the boss brings (released ones only). */
  team: { id: string; form: number }[]
  quote: string
  bio: string
  /** Title for beating the boss on Brutal. */
  title: string
}

/** Villains of the anime, with their own Bakugan. */
export const BOSSES: Boss[] = [
  {
    id: 'masquerade',
    name: 'Masquerade',
    element: 'darkus',
    look: 'masquerade',
    team: [
      { id: 'hydranoid', form: 2 },
      { id: 'laserman', form: 0 },
    ],
    quote: 'Your Bakugan will be sent to the Doom Dimension!',
    bio: 'The masked brawler who sent Bakugan to the Doom Dimension, with Alpha Hydranoid at his side.',
    title: 'Unmasker',
  },
  {
    id: 'shadow',
    name: 'Shadow Prove',
    element: 'darkus',
    look: 'klaus',
    team: [{ id: 'hades', form: 0 }],
    quote: 'Hya-ha-ha! Let me hear you scream!',
    bio: 'The wildest of the Vexos. His three-headed Hades never stops coming.',
    title: 'Shadow Hunter',
  },
  {
    id: 'mylene',
    name: 'Mylene Farrow',
    element: 'aquos',
    look: 'runo',
    team: [{ id: 'elico', form: 1 }],
    quote: 'Brawling is not a game. It is a duty.',
    bio: 'The ice-cold Vexos strategist. Blast Elico drowns every attack in its tide.',
    title: 'Tidebreaker',
  },
  {
    id: 'lync',
    name: 'Lync Volan',
    element: 'ventus',
    look: 'marucho',
    team: [{ id: 'altair', form: 0 }],
    quote: "Oh, you thought this would be easy? That's so cute.",
    bio: "The Vexos' sly youngest brawler, riding the wind with Altair.",
    title: 'Windcatcher',
  },
  {
    id: 'volt',
    name: 'Volt Luster',
    element: 'haos',
    look: 'shuji',
    team: [{ id: 'brontes', form: 1 }],
    quote: 'A true warrior meets his rival head-on.',
    bio: 'The Vexos powerhouse. Alto Brontes bends light into crushing blows.',
    title: 'Lightning Rod',
  },
  {
    id: 'gus',
    name: 'Gus Grav',
    element: 'subterra',
    look: 'shun',
    team: [{ id: 'premo-vulcan', form: 1 }],
    quote: 'For Master Spectra, I will not lose.',
    bio: "Spectra's loyal right hand. Rex Vulcan stands like a mountain.",
    title: 'Mountain Mover',
  },
  {
    id: 'spectra',
    name: 'Spectra Phantom',
    element: 'pyrus',
    look: 'masquerade',
    team: [
      { id: 'helios', form: 2 },
      { id: 'premo-vulcan', form: 1 },
    ],
    quote: 'Power is everything. Helios, show them!',
    bio: 'The masked leader of the Vexos, chasing ultimate power with Helios MK2 — and Gus at his side.',
    title: 'Phantom Slayer',
  },
]
export const BOSS_BY_ID = Object.fromEntries(BOSSES.map((b) => [b.id, b])) as Record<string, Boss>

/** How many bosses are in each week. */
const BOSSES_OPEN = 4

/** Whether a boss is in this week: each one comes 4 weeks out of 7, half the line-up changing each week. */
export const bossOpen = (bossIndex: number, now = Date.now()) => (((bossIndex + 2 * weekIndex(now)) % 7) + 7) % 7 < BOSSES_OPEN

/** When a boss that is out this week comes back. */
export function bossReturns(bossIndex: number, now = Date.now()) {
  let at = weekEnd(now)
  for (let i = 0; i < 7 && !bossOpen(bossIndex, at); i++) at = weekEnd(at)
  return at
}

/** First clear of each difficulty. */
export function bossPrize(boss: Boss, d: Difficulty): Reward[] {
  if (d === 'normal')
    return [
      { kind: 'bp', amount: 500 },
      { kind: 'boost', amount: 1 },
    ]
  if (d === 'hard')
    return [
      { kind: 'bp', amount: 1000 },
      { kind: 'boost', amount: 3 },
    ]
  return [
    { kind: 'bp', amount: 2000 },
    { kind: 'cardKey', amount: 1 },
    { kind: 'title', name: boss.title },
  ]
}

/** The first win against a boss each week, at any difficulty. */
export const BOSS_BOUNTY: Reward[] = [{ kind: 'bp', amount: 200 }]

// ---------------------------------------------------------------- rule events

export type RuleId = 'command-chaos' | 'character-clash' | 'low-g' | 'sudden-death' | 'reactor'

export interface RuleEvent {
  /** Unique per run of the event (its rule and its day or week), so progress starts again each time. */
  id: string
  rule: RuleId
  kind: 'daily' | 'weekly'
  name: string
  blurb: string
  /** The rules, one line each. */
  rules: string[]
  /** Wins needed for the reward. */
  goal: number
  rewards: Reward[]
  element: ElementId
  startsAt: number
  endsAt: number
}

const DAILY_RULES: RuleId[] = ['command-chaos', 'character-clash', 'low-g', 'sudden-death']
const REACTOR_ORDER: ElementId[] = ['pyrus', 'aquos', 'darkus', 'subterra', 'haos', 'ventus']
const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

const DAILY_PRIZE: Reward[] = [
  { kind: 'bp', amount: 400 },
  { kind: 'boost', amount: 2 },
]

function dailyOf(rule: RuleId, now: number): Omit<RuleEvent, 'id' | 'startsAt' | 'endsAt' | 'kind'> {
  switch (rule) {
    case 'command-chaos':
      return {
        rule,
        name: 'Command Chaos',
        blurb: 'Only Command Gate Cards are on the field today. Level Down, Energy Merge, Super Pyrus…',
        rules: ['Both brawlers set Command Gate Cards only', 'A random hand of four commands each match'],
        goal: 3,
        rewards: DAILY_PRIZE,
        element: 'subterra',
      }
    case 'character-clash':
      return {
        rule,
        name: 'Character Clash',
        blurb: "Only Character Gate Cards: bring Bakugan that have one, and watch out for your rival's.",
        rules: ["Gate Cards are the Character cards of both teams' Bakugan", 'A Character card raises its Bakugan by half'],
        goal: 3,
        rewards: DAILY_PRIZE,
        element: 'pyrus',
      }
    case 'low-g':
      return {
        rule,
        name: 'Low-G Challenge',
        blurb: 'No evolutions today: every Bakugan on both sides brawls in its base form.',
        rules: ['All Bakugan brawl in their base form', "Only the base form's ability cards"],
        goal: 3,
        rewards: DAILY_PRIZE,
        element: 'ventus',
      }
    case 'sudden-death':
      return {
        rule,
        name: 'Sudden Death',
        blurb: 'One life each. A single battle decides the match.',
        rules: ['Both brawlers have 1 life', 'Win the battle, win the match'],
        goal: 4,
        rewards: DAILY_PRIZE,
        element: 'darkus',
      }
    case 'reactor': {
      const el = REACTOR_ORDER[((weekIndex(now) % 6) + 6) % 6]
      return {
        rule,
        name: `${cap(el)} Reactor Week`,
        blurb: `The field runs on ${cap(el)} energy: only ${cap(el)} Attribute Gate Cards all week.`,
        rules: [`Only ${cap(el)} Attribute Gate Cards (+100, +150, +200)`, `${cap(el)} Bakugan get the most out of them`],
        goal: 8,
        rewards: [
          { kind: 'bp', amount: 2000 },
          { kind: 'cardKey', amount: 1 },
          { kind: 'boost', amount: 2 },
        ],
        element: el,
      }
    }
  }
}

/** Today's rule event. */
export function dailyEvent(now = Date.now()): RuleEvent {
  const rule = DAILY_RULES[dayIndex(now) % DAILY_RULES.length]
  return {
    ...dailyOf(rule, now),
    kind: 'daily',
    id: `daily:${dayKey(now)}:${rule}`,
    startsAt: dayIndex(now) * DAY,
    endsAt: dayEnd(now),
  }
}

/** This week's attribute reactor. */
export function weeklyEvent(now = Date.now()): RuleEvent {
  const e = dailyOf('reactor', now)
  return { ...e, kind: 'weekly', id: `weekly:${weekKey(now)}:${e.element}`, startsAt: weekStart(now), endsAt: weekEnd(now) }
}

/** The rule event a stored id belongs to, if it is still running. */
export function ruleEventById(id: string, now = Date.now()): RuleEvent | null {
  return [dailyEvent(now), weeklyEvent(now)].find((e) => e.id === id) ?? null
}
