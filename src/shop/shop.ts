import { currentSeason } from '../season/current'
import { ACCESSORIES, dayKey, FRAMES, OUTFITS, SKINS, type CosmeticSource, type Rarity, type Reward } from '../season/season'

/**
 * The shop. Bakugan are bought with BP only (or unlocked with player XP), so money never buys
 * power. Cosmetics are priced by rarity: Common and Rare cost BP, Epic and Legendary cost real
 * money. XP Boosts come in a BP pack and two money packs; Card Keys cost BP.
 * Real-money purchases open with the online version (they need a server and payments).
 */

export type Price = { bp: number } | { usd: number }
export type CosmeticKind = 'skin' | 'outfit' | 'frame' | 'acc'

export interface ShopItem {
  /** Owned-cosmetic key ("skin:ruby") or pack id ("boost:5", "key:1"). */
  key: string
  kind: CosmeticKind | 'boost' | 'cardKey'
  name: string
  rarity: Rarity
  price: Price
  /** Boosts or Card Keys in the pack. */
  amount?: number
  /** Season whose pass first gave this cosmetic. */
  passSeason?: number
}

const COSMETIC_PRICES: Record<CosmeticKind, Record<Rarity, Price>> = {
  skin: { common: { bp: 4000 }, rare: { bp: 12000 }, epic: { usd: 3.99 }, legendary: { usd: 5.99 } },
  outfit: { common: { bp: 3000 }, rare: { bp: 9000 }, epic: { usd: 2.99 }, legendary: { usd: 4.99 } },
  frame: { common: { bp: 3000 }, rare: { bp: 9000 }, epic: { usd: 2.99 }, legendary: { usd: 4.99 } },
  acc: { common: { bp: 3000 }, rare: { bp: 9000 }, epic: { usd: 2.99 }, legendary: { usd: 4.99 } },
}

export const PACKS: ShopItem[] = [
  { key: 'boost:5', kind: 'boost', amount: 5, name: '5 XP Boosts', rarity: 'common', price: { bp: 2500 } },
  { key: 'boost:15', kind: 'boost', amount: 15, name: '15 XP Boosts', rarity: 'rare', price: { usd: 1.99 } },
  { key: 'boost:40', kind: 'boost', amount: 40, name: '40 XP Boosts', rarity: 'epic', price: { usd: 3.99 } },
  { key: 'key:1', kind: 'cardKey', amount: 1, name: 'Card Key', rarity: 'rare', price: { bp: 5000 } },
]

const cosmetic = (
  kind: CosmeticKind,
  id: string,
  c: { name: string; rarity: Rarity; from: CosmeticSource },
): ShopItem & {
  from: CosmeticSource
} => ({
  key: `${kind}:${id}`,
  kind,
  name: c.name,
  rarity: c.rarity,
  price: COSMETIC_PRICES[kind][c.rarity],
  passSeason: 'pass' in c.from ? c.from.pass : undefined,
  from: c.from,
})

/** Every cosmetic in the game with its shop price, whether it is on sale or not. */
export const ALL_COSMETICS = [
  ...SKINS.map((s) => cosmetic('skin', s.id, s)),
  ...Object.entries(OUTFITS).map(([id, o]) => cosmetic('outfit', id, o)),
  ...Object.entries(FRAMES).map(([id, f]) => cosmetic('frame', id, f)),
  ...Object.entries(ACCESSORIES).map(([id, a]) => cosmetic('acc', id, a)),
]
const COSMETIC_BY_KEY = Object.fromEntries(ALL_COSMETICS.map((c) => [c.key, c]))

/** Cosmetics on sale now: shop ones, plus pass ones once their season is over. Earned-only ones never are. */
export function cosmeticsOnSale(now = Date.now()): ShopItem[] {
  const season = currentSeason(now).id
  return ALL_COSMETICS.filter((c) => 'shop' in c.from || ('pass' in c.from && c.from.pass < season))
}

export const shopItem = (key: string): ShopItem | undefined => COSMETIC_BY_KEY[key] ?? PACKS.find((p) => p.key === key)

/** Six cosmetics in the spotlight today, the same for everyone. */
export function featuredToday(now = Date.now()): ShopItem[] {
  let h = 0
  for (const c of `shop-${dayKey(now)}`) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const pool = [...cosmeticsOnSale(now)]
  for (let i = pool.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0
    const j = h % (i + 1)
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, 6)
}

export const formatUsd = (usd: number) => `$${usd.toFixed(2)}`
export const formatPrice = (p: Price) => ('bp' in p ? `${p.bp.toLocaleString('en')} BP` : formatUsd(p.usd))

// ---------------------------------------------------------------- Season Pass price

const DAY = 86_400_000
export const PASS_PRICE_USD = 9.99
/** Unannounced: in the last week of a season the pass is 40% off. */
export const LAST_WEEK_DISCOUNT = 0.4

export function passPrice(now = Date.now()) {
  const lastWeek = currentSeason(now).endsAt - now <= 7 * DAY
  const price = lastWeek ? Math.floor(PASS_PRICE_USD * (1 - LAST_WEEK_DISCOUNT) * 100) / 100 : PASS_PRICE_USD
  return { full: PASS_PRICE_USD, price, discount: lastWeek ? LAST_WEEK_DISCOUNT : 0 }
}

// ---------------------------------------------------------------- what pass rewards are worth

/** A pass Bakugan is never sold for money; this is only its value when weighing the pass. */
const PASS_BAKUGAN_USD = 6.99
const BOOST_USD = 1.99 / 15
const CARD_KEY_BP = 5000

export interface Worth {
  usd: number
  bp: number
}

/** Shop value of a pass reward: money items in USD, BP items (and BP itself) in BP. */
export function rewardWorth(r: Reward): Worth {
  const price = (key: string): Worth => {
    const c = COSMETIC_BY_KEY[key]
    if (!c || 'earned' in c.from) return { usd: 0, bp: 0 }
    return 'usd' in c.price ? { usd: c.price.usd, bp: 0 } : { usd: 0, bp: c.price.bp }
  }
  switch (r.kind) {
    case 'bp':
      return { usd: 0, bp: r.amount }
    case 'boost':
      return { usd: r.amount * BOOST_USD, bp: 0 }
    case 'cardKey':
      return { usd: 0, bp: r.amount * CARD_KEY_BP }
    case 'title':
      return { usd: 0, bp: 0 }
    case 'frame':
      return price(`frame:${r.id}`)
    case 'skin':
      return price(`skin:${r.id}`)
    case 'outfit':
      return price(`outfit:${r.id}`)
    case 'accessory':
      return price(`acc:${r.id}`)
    case 'seasonBakugan':
      return { usd: PASS_BAKUGAN_USD, bp: 0 }
    case 'bundle':
      return r.items.map(rewardWorth).reduce((a, b) => ({ usd: a.usd + b.usd, bp: a.bp + b.bp }), { usd: 0, bp: 0 })
  }
}

/** Rarity of a cosmetic pass reward, if it is one. */
export function rewardRarity(r: Reward): Rarity | undefined {
  const key =
    r.kind === 'skin'
      ? `skin:${r.id}`
      : r.kind === 'outfit'
        ? `outfit:${r.id}`
        : r.kind === 'frame'
          ? `frame:${r.id}`
          : r.kind === 'accessory'
            ? `acc:${r.id}`
            : null
  return key ? COSMETIC_BY_KEY[key]?.rarity : undefined
}
