import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { playSfx } from '../audio/sfx'
import { Avatar } from '../components/Avatar'
import { GRID, GRID_SIZE } from '../components/grid'
import { PageNav } from '../components/PageNav'
import { BAKUGAN, type Bakugan } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { DEFAULT_PARTS, type Accessory } from '../profile/avatar'
import { hasCosmetic, inShop, priceOf, useActiveProfile, useProfiles, type Profile } from '../profile/useProfiles'
import { FRAMES, OUTFITS, RARITY, SKIN_BY_ID, timeLeft, type Rarity } from '../season/season'
import { cosmeticsOnSale, featuredToday, formatPrice, PACKS, type ShopItem } from '../shop/shop'
import { useGame } from '../store/useGame'

type Tab = 'featured' | 'bakugan' | 'skins' | 'avatar' | 'boosts'
const TABS: [Tab, string][] = [
  ['featured', "TODAY'S PICKS"],
  ['bakugan', 'BAKUGAN'],
  ['skins', 'BAKUGAN SKINS'],
  ['avatar', 'AVATAR'],
  ['boosts', 'BOOSTS & KEYS'],
]
const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary']
const byRarity = (a: ShopItem, b: ShopItem) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)

const KIND_LABEL: Record<ShopItem['kind'], string> = {
  skin: 'Bakugan skin',
  outfit: 'Avatar outfit',
  frame: 'Avatar frame',
  acc: 'Avatar accessory',
  boost: 'XP Boost pack',
  cardKey: 'Card Key',
}
const KIND_HINT: Record<ShopItem['kind'], string> = {
  skin: 'Recolours a Bakugan you own. Equip it on your Profile.',
  outfit: 'Outfit colour in the avatar builder.',
  frame: 'A ring around your picture. Equip it on your Profile.',
  acc: 'Worn by your avatar and your brawler in the arena.',
  boost: 'Each one gives +50% Bakugan XP for one brawl.',
  cardKey: "Unlocks a Bakugan's next ability card right away.",
}

/** The shop: Bakugan for BP, cosmetics by rarity (BP or money), boosts and Card Keys. */
export function ShopScreen() {
  const profile = useActiveProfile()
  const [tab, setTab] = useState<Tab>('featured')
  const [moneyItem, setMoneyItem] = useState<ShopItem | null>(null)
  const onSale = cosmeticsOnSale()
  const [now] = useState(() => Date.now())
  const refresh = new Date(now).setUTCHours(24, 0, 0, 0) - now

  const grid = (items: ShopItem[]) => (
    <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-4">
      {items.map((item) => (
        <ItemCard key={item.key} item={item} profile={profile} onMoney={() => setMoneyItem(item)} />
      ))}
    </div>
  )

  return (
    <motion.div
      className="absolute inset-0 overflow-y-auto px-16 py-10"
      style={{ backgroundImage: GRID, backgroundSize: GRID_SIZE }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <PageNav current="shop">
        {profile && (
          <span className="font-display rounded-full border border-white/15 bg-black/40 px-4 py-1.5 text-xs tracking-[0.3em]">
            {profile.bp.toLocaleString('en')} BP
          </span>
        )}
      </PageNav>

      <h1 className="font-display mt-8 text-4xl font-black tracking-wider">SHOP</h1>
      <p className="mt-1 text-white/55">
        Bakugan are bought with Battle Points only, so money never buys power. Cosmetics come in four rarities:
      </p>
      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        {RARITY_ORDER.map((r) => (
          <span
            key={r}
            className="rounded-full border px-3 py-1"
            style={{ borderColor: RARITY[r].color, color: RARITY[r].color }}
          >
            {RARITY[r].name} · {r === 'common' || r === 'rare' ? 'Battle Points' : 'real money'}
          </span>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => {
              playSfx('tick')
              setTab(id)
            }}
            className={`font-display rounded border px-4 py-2 text-xs tracking-[0.3em] transition ${
              tab === id ? 'border-white bg-white/10 text-white' : 'border-white/15 text-white/50 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {!profile && <p className="mt-4 text-sm text-amber-300/80">Create a profile to buy things.</p>}

      {tab === 'featured' && (
        <section className="mt-6">
          <h2 className="font-display text-xs tracking-[0.5em] text-white/40">
            TODAY'S PICKS · NEW PICKS IN {timeLeft(refresh).toUpperCase()}
          </h2>
          {grid(featuredToday())}
        </section>
      )}
      {tab === 'bakugan' && <BakuganShelf profile={profile} />}
      {tab === 'skins' && (
        <section className="mt-6">
          <h2 className="font-display text-xs tracking-[0.5em] text-white/40">BAKUGAN SKINS</h2>
          {grid(onSale.filter((i) => i.kind === 'skin').sort(byRarity))}
        </section>
      )}
      {tab === 'avatar' &&
        (['outfit', 'frame', 'acc'] as const).map((kind) => {
          const items = onSale.filter((i) => i.kind === kind).sort(byRarity)
          return (
            items.length > 0 && (
              <section key={kind} className="mt-6">
                <h2 className="font-display text-xs tracking-[0.5em] text-white/40">{KIND_LABEL[kind].toUpperCase()}S</h2>
                {grid(items)}
              </section>
            )
          )
        })}
      {tab === 'boosts' && (
        <section className="mt-6">
          <h2 className="font-display text-xs tracking-[0.5em] text-white/40">BOOSTS & CARD KEYS</h2>
          {profile && (
            <p className="mt-1 text-sm text-white/50">
              You have {profile.boosts ?? 0} XP Boosts and {profile.cardKeys ?? 0} Card Keys.
            </p>
          )}
          {grid(PACKS)}
        </section>
      )}

      <AnimatePresence>
        {moneyItem && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMoneyItem(null)}
          >
            <div
              className="max-w-md rounded-2xl border border-white/15 bg-[#0b0c12] p-8 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="font-display text-xs tracking-[0.4em]" style={{ color: RARITY[moneyItem.rarity].color }}>
                {RARITY[moneyItem.rarity].name.toUpperCase()}
              </p>
              <h3 className="font-display mt-2 text-2xl font-bold">{moneyItem.name}</h3>
              <p className="mt-4 text-white/70">
                Purchases with real money open with the online version of the game. This item will cost{' '}
                {formatPrice(moneyItem.price)}.
              </p>
              <button
                onClick={() => setMoneyItem(null)}
                className="font-display mt-6 rounded border border-white/30 px-6 py-2 text-xs tracking-[0.3em] hover:bg-white/10"
              >
                OK
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function ItemCard({ item, profile, onMoney }: { item: ShopItem; profile: Profile | null; onMoney: () => void }) {
  const buy = useProfiles((s) => s.buyShopItem)
  const [bought, setBought] = useState(0)
  const rarity = RARITY[item.rarity]
  const pack = item.kind === 'boost' || item.kind === 'cardKey'
  const owned = !pack && hasCosmetic(profile, item.key)
  const short = profile && 'bp' in item.price ? item.price.bp - profile.bp : 0
  return (
    <div
      className={`flex flex-col rounded-xl border-2 bg-black/50 p-5 ${item.rarity === 'legendary' ? 'legendary-shine' : ''}`}
      style={{ borderColor: `${rarity.color}${item.rarity === 'common' ? '55' : 'aa'}` }}
    >
      <div className="flex items-start justify-between">
        <span className="font-display text-[10px] tracking-[0.3em]" style={{ color: rarity.color }}>
          {rarity.name.toUpperCase()}
        </span>
        <span className="text-[10px] text-white/40">{KIND_LABEL[item.kind]}</span>
      </div>
      <div className="my-4 flex h-24 items-center justify-center">
        <Preview item={item} profile={profile} />
      </div>
      <p className="font-display text-lg font-bold">{item.name}</p>
      <p className="mt-1 flex-1 text-xs text-white/50">
        {KIND_HINT[item.kind]}
        {item.passSeason && <span className="block text-amber-300/70">From the Season {item.passSeason} Pass</span>}
      </p>
      <button
        disabled={!profile || owned || short > 0}
        onClick={() => {
          if ('usd' in item.price) return onMoney()
          if (buy(item.key)) {
            playSfx('victory')
            setBought((n) => n + 1)
          }
        }}
        className="font-display mt-4 rounded border py-2 text-sm tracking-widest transition enabled:hover:bg-white/10 disabled:opacity-45"
        style={{ borderColor: rarity.color }}
      >
        {owned ? 'OWNED ✓' : formatPrice(item.price)}
        {!owned && short > 0 && (
          <span className="block text-[10px] tracking-normal text-white/50">{short.toLocaleString('en')} BP to go</span>
        )}
        {pack && bought > 0 && <span className="block text-[10px] tracking-normal text-emerald-300">bought ×{bought}</span>}
      </button>
    </div>
  )
}

function Preview({ item, profile }: { item: ShopItem; profile: Profile | null }) {
  const [kind, id] = item.key.split(':')
  const color = RARITY[item.rarity].color
  if (kind === 'skin') {
    const skin = SKIN_BY_ID[id]
    return (
      <div className="relative">
        <div
          className="h-20 w-20 rounded-full"
          style={{
            background: `radial-gradient(circle at 35% 30%, ${skin.glow}, ${skin.color} 45%, #05060a 100%)`,
            boxShadow: `0 0 28px ${skin.glow}88`,
          }}
        />
        {item.rarity === 'legendary' && <span className="absolute -top-2 -right-3 animate-pulse text-xl text-amber-200">✦</span>}
      </div>
    )
  }
  if (kind === 'frame')
    return (
      <Avatar
        avatar={profile?.avatar ?? { kind: 'custom', parts: DEFAULT_PARTS }}
        frame={FRAMES[id] ? id : undefined}
        size={84}
        color={color}
      />
    )
  if (kind === 'outfit')
    return <Avatar avatar={{ kind: 'custom', parts: { ...DEFAULT_PARTS, outfit: OUTFITS[id].color } }} size={84} color={color} />
  if (kind === 'acc')
    return <Avatar avatar={{ kind: 'custom', parts: { ...DEFAULT_PARTS, accessory: id as Accessory } }} size={84} color={color} />
  return (
    <span className="font-display text-5xl" style={{ color }}>
      {item.kind === 'boost' ? `⇧${item.amount}` : '🗝'}
    </span>
  )
}

function BakuganShelf({ profile }: { profile: Profile | null }) {
  const openPage = useGame((s) => s.openPage)
  const list = BAKUGAN.filter((b) => inShop(b.id) && !profile?.collection.some((o) => o.id === b.id)).sort(
    (a, b) => Number(b.element === profile?.element) - Number(a.element === profile?.element) || a.baseG - b.baseG,
  )
  return (
    <section className="mt-6">
      <h2 className="font-display text-xs tracking-[0.5em] text-white/40">BAKUGAN · BATTLE POINTS ONLY</h2>
      <p className="mt-1 text-sm text-white/50">
        Win brawls for Battle Points. Bakugan of your own attribute cost less, and high player XP unlocks them too. This season's
        Bakugan are earned on the{' '}
        <button onClick={() => openPage('pass')} className="underline hover:text-white">
          Season Pass page
        </button>
        .
      </p>
      {profile ? (
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
          {list.map((b) => (
            <BakuganOffer key={b.id} bakugan={b} profile={profile} />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-white/50">Create a profile to buy Bakugan.</p>
      )}
    </section>
  )
}

function BakuganOffer({ bakugan, profile }: { bakugan: Bakugan; profile: Profile }) {
  const acquire = useProfiles((s) => s.acquire)
  const element = ELEMENT_BY_ID[bakugan.element]
  const price = priceOf(profile, bakugan)
  const canBuy = profile.bp >= price.bp
  const canClaim = profile.xp >= price.xp
  const own = bakugan.element === profile.element
  return (
    <div className="rounded-xl border border-dashed bg-black/30 p-5" style={{ borderColor: `${element.color}55` }}>
      <div className="flex items-center gap-4">
        <img src={element.icon} alt="" className={`h-14 w-14 ${canBuy || canClaim ? '' : 'opacity-50 grayscale'}`} />
        <div>
          <p className="font-display text-2xl font-bold">{bakugan.name}</p>
          <p className="text-sm text-white/45">
            {element.name} · {bakugan.baseG}G · {own ? 'your attribute' : 'other attribute'}
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-center">
        <button
          disabled={!canBuy}
          onClick={() => acquire(bakugan.id, 'bp') && playSfx('victory')}
          className="rounded-md border px-2 py-2 text-xs transition enabled:hover:bg-white/10 disabled:opacity-40"
          style={{ borderColor: element.color }}
        >
          <span className="font-display block font-bold">{price.bp.toLocaleString('en')} BP</span>
          <span className="text-[10px] text-white/50">
            {canBuy ? 'BUY' : `${(price.bp - profile.bp).toLocaleString('en')} BP to go`}
          </span>
        </button>
        <button
          disabled={!canClaim}
          onClick={() => acquire(bakugan.id, 'xp') && playSfx('victory')}
          className="rounded-md border border-white/20 px-2 py-2 text-xs transition enabled:hover:bg-white/10 disabled:opacity-40"
        >
          <span className="font-display block font-bold">
            {Number.isFinite(price.xp) ? `${price.xp.toLocaleString('en')} XP` : '—'}
          </span>
          <span className="text-[10px] text-white/50">
            {!Number.isFinite(price.xp) ? 'season pass Bakugan: BP only' : canClaim ? 'CLAIM' : 'player XP needed'}
          </span>
        </button>
      </div>
    </div>
  )
}
