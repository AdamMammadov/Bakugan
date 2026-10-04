import type { ElementId } from '../data/elements'
import { CHARACTERS } from './avatar'

/** CPU brawlers that fill the rankings next to the players on this device. */
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
  clan: string | null
}

const FIRST = ['Kai', 'Rena', 'Taro', 'Mira', 'Jin', 'Sora', 'Leo', 'Nia', 'Ryo', 'Yuna', 'Ken', 'Aya', 'Dex', 'Lia', 'Hiro', 'Zoe', 'Rin', 'Max', 'Eli', 'Noa']
const LAST = ['Arashi', 'Kurogane', 'Hoshino', 'Takeda', 'Mori', 'Sato', 'Fujimoto', 'Kanzaki', 'Ishida', 'Nakamura']
const CLANS = ['VEST', 'BRWL', 'DRGN', null, 'NOVA', null]

/** Deterministic, so the rankings look the same on every visit. */
export const BOTS: BotBrawler[] = FIRST.map((first, i) => {
  const c = CHARACTERS[i % CHARACTERS.length]
  const rating = Math.round(4200 * Math.pow(1 - i / FIRST.length, 1.6))
  const wins = Math.round(rating / 18 + (i % 4) * 3)
  return {
    id: `bot-${i}`,
    name: `${first} ${LAST[(i * 7) % LAST.length]}`,
    element: c.element,
    characterId: c.id,
    rating,
    xp: wins * 65 + (i % 5) * 400,
    wins,
    losses: Math.round(wins * (0.45 + (i % 3) * 0.15)),
    clan: CLANS[i % CLANS.length],
  }
})

/** CPU clans shown in the clan rankings. */
export const BOT_CLANS = [
  { tag: 'VEST', name: 'Vestroia Vanguard', element: 'pyrus' as ElementId },
  { tag: 'BRWL', name: 'Battle Brawlers Unbound', element: 'ventus' as ElementId },
  { tag: 'DRGN', name: 'Dragon Gate', element: 'darkus' as ElementId },
  { tag: 'NOVA', name: 'Nova Haos', element: 'haos' as ElementId },
]
