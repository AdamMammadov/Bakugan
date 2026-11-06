import type { Reward } from './season'

/**
 * The Glory store. Glory is paid at the end of each ranked season for the best rank reached in it (see gloryFor in
 * useProfiles) and buys rewards that are sold nowhere else. Some ask for a rank reached in some season (`tier`: the
 * major tier, 0 Rookie … 5 Legendary); the packs can be bought again and again.
 */
export interface GloryItem {
  key: string
  price: number
  reward: Reward
  /** The major tier the player must have reached in some season. */
  tier?: number
  /** Can be bought more than once. */
  repeat?: boolean
}

export const GLORY_STORE: GloryItem[] = [
  { key: 'title:Arena Veteran', price: 300, reward: { kind: 'title', name: 'Arena Veteran' } },
  { key: 'frame:valor', price: 700, reward: { kind: 'frame', id: 'valor' }, tier: 2 },
  { key: 'skin:victor', price: 1200, reward: { kind: 'skin', id: 'victor' }, tier: 2 },
  { key: 'title:Conqueror', price: 1500, reward: { kind: 'title', name: 'Conqueror' }, tier: 4 },
  { key: 'frame:conqueror', price: 2200, reward: { kind: 'frame', id: 'conqueror' }, tier: 4 },
  { key: 'skin:eclipse', price: 2800, reward: { kind: 'skin', id: 'eclipse' }, tier: 5 },
  { key: 'pack:bp', price: 400, reward: { kind: 'bp', amount: 5000 }, repeat: true },
  { key: 'pack:boost', price: 350, reward: { kind: 'boost', amount: 10 }, repeat: true },
  { key: 'pack:key', price: 450, reward: { kind: 'cardKey', amount: 1 }, repeat: true },
]

export const gloryItem = (key: string) => GLORY_STORE.find((i) => i.key === key)
