import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { motion } from 'framer-motion'
import { Suspense, useState } from 'react'
import { playSfx } from '../audio/sfx'
import { Avatar } from '../components/Avatar'
import { GRID, GRID_SIZE } from '../components/grid'
import { PageNav } from '../components/PageNav'
import { formModels } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { DEFAULT_PARTS, type Accessory } from '../profile/avatar'
import {
  bakuganById,
  cardCount,
  nextCardXp,
  useActiveProfile,
  useProfiles,
  type OwnedBakugan,
  type Profile,
} from '../profile/useProfiles'
import { ACCESSORIES, FRAMES, OUTFITS, RARITY, SKIN_BY_ID, SKINS, skinFits, type Rarity } from '../season/season'
import { useGame } from '../store/useGame'
import { BlobShadow } from '../three/BlobShadow'
import { LiftDrag } from '../three/LiftDrag'
import { MonsterModel } from '../three/BakuganModels'

type Tab = 'skins' | 'avatar' | 'boosts' | 'equipment'
const TABS: [Tab, string][] = [
  ['skins', 'BAKUGAN SKINS'],
  ['avatar', 'AVATAR'],
  ['boosts', 'BOOSTS & KEYS'],
  ['equipment', 'EQUIPMENT'],
]

/** Everything the player owns: skins to try on and equip, avatar items, boosts, keys and equipment. */
export function InventoryScreen() {
  const profile = useActiveProfile()
  const [tab, setTab] = useState<Tab>('skins')
  return (
    <motion.div
      className="absolute inset-0 overflow-y-auto px-16 py-10"
      style={{ backgroundImage: GRID, backgroundSize: GRID_SIZE }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <PageNav current="inventory" />
      <h1 className="font-display mt-8 text-4xl font-black tracking-wider">INVENTORY</h1>
      <p className="mt-1 text-white/55">
        Everything you own: try skins on your Bakugan, dress your avatar, and use your boosts and keys.
      </p>
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
      {!profile ? (
        <p className="mt-10 text-white/60">Create a profile to collect items.</p>
      ) : tab === 'skins' ? (
        <Skins profile={profile} />
      ) : tab === 'avatar' ? (
        <AvatarItems profile={profile} />
      ) : tab === 'boosts' ? (
        <BoostsAndKeys profile={profile} />
      ) : (
        <Equipment />
      )}
    </motion.div>
  )
}

const owns = (p: Profile, key: string) => !!p.cosmetics?.owned.includes(key)

function RarityTag({ rarity }: { rarity: Rarity }) {
  return (
    <span className="font-display text-[9px] tracking-[0.3em]" style={{ color: RARITY[rarity].color }}>
      {RARITY[rarity].name.toUpperCase()}
    </span>
  )
}

function Empty({ text }: { text: string }) {
  const openPage = useGame((s) => s.openPage)
  return (
    <p className="mt-4 text-white/50">
      {text}{' '}
      <button onClick={() => openPage('shop')} className="underline hover:text-white">
        Visit the shop
      </button>{' '}
      or climb the{' '}
      <button onClick={() => openPage('pass')} className="underline hover:text-white">
        Season Pass
      </button>
      .
    </p>
  )
}

// ---------------------------------------------------------------- skins

function Skins({ profile }: { profile: Profile }) {
  const setSkin = useProfiles((s) => s.setSkin)
  const [bakuganId, setBakuganId] = useState(profile.collection[0]?.id)
  const owned = profile.collection.find((o) => o.id === bakuganId) ?? profile.collection[0]
  // model skins only fit their own Bakugan
  const skins = SKINS.filter((s) => owns(profile, `skin:${s.id}`) && (!owned || skinFits(s, owned.id)))
  // the skin being tried on: starts as the one the Bakugan wears
  const [trying, setTrying] = useState<string | undefined>(owned?.skin)
  if (!owned) return null
  const bakugan = bakuganById(owned.id)
  const element = ELEMENT_BY_ID[bakugan.element]
  const worn = owned.skin
  return (
    <section className="mt-6 grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-8">
      <div>
        <h2 className="font-display text-xs tracking-[0.5em] text-white/40">YOUR BAKUGAN</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {profile.collection.map((o) => (
            <button
              key={o.id}
              onClick={() => {
                setBakuganId(o.id)
                setTrying(o.skin)
              }}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${o.id === owned.id ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'}`}
              style={{
                borderColor: o.id === owned.id ? ELEMENT_BY_ID[bakuganById(o.id).element].color : 'rgba(255,255,255,0.15)',
              }}
            >
              {bakuganById(o.id).name}
              {o.skin && <span className="ml-1 text-white/40">· {SKIN_BY_ID[o.skin]?.name}</span>}
            </button>
          ))}
        </div>

        <h2 className="font-display mt-8 text-xs tracking-[0.5em] text-white/40">YOUR SKINS · {skins.length}</h2>
        {skins.length === 0 && <Empty text="You have no skins yet." />}
        <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
          {[undefined, ...skins].map((skin) => {
            const on = trying === skin?.id
            return (
              <button
                key={skin?.id ?? 'none'}
                onClick={() => {
                  playSfx('tick')
                  setTrying(skin?.id)
                }}
                className={`flex flex-col items-center rounded-xl border-2 bg-black/40 p-3 transition ${on ? 'scale-105' : 'opacity-75 hover:opacity-100'}`}
                style={{ borderColor: on ? (skin ? RARITY[skin.rarity].color : element.color) : 'rgba(255,255,255,0.1)' }}
              >
                <div
                  className="h-12 w-12 rounded-full"
                  style={{
                    background: skin
                      ? `radial-gradient(circle at 35% 30%, ${skin.glow}, ${skin.color} 45%, #05060a 100%)`
                      : `radial-gradient(circle at 35% 30%, ${element.glow}, ${element.color} 45%, #05060a 100%)`,
                  }}
                />
                <span className="mt-2 text-xs">{skin?.name ?? 'Original'}</span>
                {skin ? <RarityTag rarity={skin.rarity} /> : <span className="text-[9px] text-white/40">NO SKIN</span>}
                {worn === skin?.id && <span className="mt-1 text-[9px] text-emerald-300">WORN</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* try-on preview */}
      <div className="flex flex-col">
        <div className="relative h-[26rem] overflow-hidden rounded-2xl border border-white/10 bg-black/50">
          <Canvas camera={{ position: [0, 2.1, 5.8], fov: 40 }} dpr={[1, 2]}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[3, 6, 4]} intensity={2.2} />
            <pointLight position={[-3, 2.5, -2]} intensity={20} color={trying ? SKIN_BY_ID[trying].glow : element.glow} />
            <Suspense fallback={null}>
              <group
                key={`${owned.id}-${trying}`}
                scale={0.78 / Math.max(1, (formModels({ bakugan, form: owned.form })?.scale ?? 1) * (1 + owned.form * 0.12))}
              >
                <MonsterModel entrant={{ bakugan, form: owned.form, skin: trying }} />
              </group>
            </Suspense>
            <BlobShadow size={3.6} />
            <OrbitControls
              makeDefault
              target={[0, formModels({ bakugan, form: owned.form })?.fly ? 2 : 1.4, 0]}
              enablePan={false}
              minDistance={2}
              maxDistance={8}
              autoRotate
              autoRotateSpeed={1.5}
            />
            <LiftDrag
              max={6}
              base={formModels({ bakugan, form: owned.form })?.fly ? 2 : 1.4}
              resetKey={`${owned.id}-${trying}`}
            />
          </Canvas>
          <p className="font-display absolute top-4 left-5 text-xs tracking-[0.3em] text-white/60">
            {bakugan.evolutions[owned.form]?.name ?? bakugan.name} · {trying ? SKIN_BY_ID[trying].name : 'Original'}
          </p>
        </div>
        <button
          disabled={trying === worn}
          onClick={() => {
            setSkin(owned.id, trying)
            playSfx('victory')
          }}
          className="font-display mt-3 rounded-lg border-2 py-3 text-sm tracking-[0.3em] transition enabled:hover:bg-white/10 disabled:opacity-40"
          style={{ borderColor: element.color }}
        >
          {trying === worn ? 'WORN' : trying ? `EQUIP ${SKIN_BY_ID[trying].name.toUpperCase()}` : 'REMOVE SKIN'}
        </button>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- avatar

function AvatarItems({ profile }: { profile: Profile }) {
  const equip = useProfiles((s) => s.equip)
  const wear = useProfiles((s) => s.wearOnAvatar)
  const editProfile = useGame((s) => s.editProfile)
  const owned = profile.cosmetics?.owned ?? []
  const color = ELEMENT_BY_ID[profile.element].color
  const frames = Object.entries(FRAMES).filter(([id]) => owned.includes(`frame:${id}`))
  const titles = owned.filter((k) => k.startsWith('title:')).map((k) => k.slice(6))
  const outfits = Object.entries(OUTFITS).filter(([id]) => owned.includes(`outfit:${id}`))
  const accessories = Object.entries(ACCESSORIES).filter(([id]) => owned.includes(`acc:${id}`))
  const custom = profile.avatar.kind === 'custom' ? profile.avatar.parts : null
  return (
    <section className="mt-6 grid grid-cols-[16rem_minmax(0,1fr)] gap-10">
      <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-black/40 p-6 text-center">
        <Avatar avatar={profile.avatar} color={color} size={160} frame={profile.cosmetics?.frame} />
        <p className="font-display mt-4 text-xl font-bold">
          {profile.firstName} {profile.lastName}
        </p>
        {profile.cosmetics?.title && <p className="text-sm text-amber-200">{profile.cosmetics.title}</p>}
      </div>

      <div className="space-y-8">
        <Row title="FRAMES">
          {frames.length === 0 && <Empty text="No frames yet." />}
          {frames.length > 0 &&
            [undefined, ...frames].map((f) => (
              <ItemButton
                key={f?.[0] ?? 'none'}
                on={profile.cosmetics?.frame === f?.[0]}
                onClick={() => equip('frame', f?.[0])}
                label={f?.[1].name ?? 'No frame'}
                rarity={f?.[1].rarity}
              >
                <Avatar avatar={profile.avatar} color={color} size={56} frame={f?.[0]} />
              </ItemButton>
            ))}
        </Row>

        <Row title="TITLES">
          {titles.length === 0 ? (
            <p className="text-sm text-white/50">Titles come from the Season Pass and from your rank when a season ends.</p>
          ) : (
            [undefined, ...titles].map((t) => (
              <button
                key={t ?? 'none'}
                onClick={() => equip('title', t)}
                className="rounded-full border px-3 py-1.5 text-xs"
                style={{ borderColor: profile.cosmetics?.title === t ? '#fde68a' : 'rgba(255,255,255,0.15)' }}
              >
                {t ?? 'No title'}
              </button>
            ))
          )}
        </Row>

        <Row title="OUTFITS & ACCESSORIES">
          {outfits.length + accessories.length === 0 && <Empty text="No outfits or accessories yet." />}
          {outfits.map(([id, o]) => (
            <ItemButton
              key={id}
              on={custom?.outfit === o.color}
              disabled={!custom}
              onClick={() => wear('outfit', o.color)}
              label={o.name}
              rarity={o.rarity}
            >
              <span className="h-12 w-12 rounded-full border border-white/20" style={{ background: o.color }} />
            </ItemButton>
          ))}
          {accessories.map(([id, a]) => (
            <ItemButton
              key={id}
              on={custom?.accessory === id}
              disabled={!custom}
              onClick={() => wear('accessory', custom?.accessory === id ? 'none' : (id as Accessory))}
              label={a.name}
              rarity={a.rarity}
            >
              <Avatar
                avatar={{ kind: 'custom', parts: { ...(custom ?? DEFAULT_PARTS), accessory: id as Accessory } }}
                color={color}
                size={56}
              />
            </ItemButton>
          ))}
        </Row>
        {!custom && outfits.length + accessories.length > 0 && (
          <p className="-mt-4 text-sm text-amber-200/80">
            Outfits and accessories are worn by a drawn avatar.{' '}
            <button onClick={() => editProfile(profile.id)} className="underline hover:text-white">
              Build your own avatar
            </button>{' '}
            to wear them; they show on your brawler in the arena too.
          </p>
        )}
      </div>
    </section>
  )
}

function Row({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="font-display text-xs tracking-[0.5em] text-white/40">{title}</h2>
      <div className="mt-3 flex flex-wrap items-start gap-3">{children}</div>
    </div>
  )
}

function ItemButton({
  on,
  disabled,
  onClick,
  label,
  rarity,
  children,
}: {
  on: boolean
  disabled?: boolean
  onClick: () => void
  label: string
  rarity?: Rarity
  children: React.ReactNode
}) {
  return (
    <button
      disabled={disabled}
      onClick={() => {
        playSfx('tick')
        onClick()
      }}
      className={`flex w-28 flex-col items-center rounded-xl border-2 bg-black/40 p-3 text-center transition disabled:opacity-50 ${on ? '' : 'enabled:hover:bg-white/5'}`}
      style={{ borderColor: on ? '#fde68a' : rarity ? `${RARITY[rarity].color}66` : 'rgba(255,255,255,0.1)' }}
    >
      {children}
      <span className="mt-2 text-xs leading-tight">{label}</span>
      {rarity && <RarityTag rarity={rarity} />}
      {on && <span className="text-[9px] text-amber-200">EQUIPPED</span>}
    </button>
  )
}

// ---------------------------------------------------------------- boosts and keys

function BoostsAndKeys({ profile }: { profile: Profile }) {
  const setBoostsOn = useProfiles((s) => s.setBoostsOn)
  const boosts = profile.boosts ?? 0
  const keys = profile.cardKeys ?? 0
  const on = !profile.boostsOff
  return (
    <section className="mt-6 grid grid-cols-[22rem_minmax(0,1fr)] gap-10">
      <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
        <p className="font-display text-xs tracking-[0.4em] text-white/40">XP BOOSTS</p>
        <p className="font-display mt-2 text-5xl font-black text-sky-300">⇧ {boosts}</p>
        <p className="mt-2 text-sm text-white/60">
          Each one gives +50% Bakugan XP for one brawl. They are used one per brawl while switched on.
        </p>
        <button
          disabled={boosts === 0}
          onClick={() => setBoostsOn(!on)}
          className={`font-display mt-4 w-full rounded-lg border-2 py-2 text-xs tracking-[0.3em] transition disabled:opacity-40 ${
            on ? 'border-sky-300 bg-sky-300/15 text-sky-200' : 'border-white/25 text-white/60'
          }`}
        >
          {on ? 'ON · USING ONE PER BRAWL' : 'OFF · SAVING THEM'}
        </button>
        {boosts === 0 && <Empty text="No boosts left." />}
      </div>

      <div>
        <p className="font-display text-xs tracking-[0.4em] text-white/40">CARD KEYS · {keys}</p>
        <p className="mt-1 text-sm text-white/60">A Card Key unlocks the next ability card of a Bakugan right away.</p>
        {keys === 0 && <Empty text="No Card Keys right now." />}
        <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {profile.collection.map((o) => (
            <KeyTarget key={o.id} owned={o} keys={keys} />
          ))}
        </div>
      </div>
    </section>
  )
}

function KeyTarget({ owned, keys }: { owned: OwnedBakugan; keys: number }) {
  const applyCardKey = useProfiles((s) => s.applyCardKey)
  const bakugan = bakuganById(owned.id)
  const element = ELEMENT_BY_ID[bakugan.element]
  const have = cardCount(owned)
  const total = bakugan.abilities.length
  const next = nextCardXp(owned)
  const nextCard = bakugan.abilities[have]
  return (
    <div className="rounded-xl border bg-black/40 p-4" style={{ borderColor: `${element.color}55` }}>
      <div className="flex items-baseline justify-between">
        <p className="font-display text-lg font-bold">{bakugan.name}</p>
        <span className="text-xs text-white/50">
          {have}/{total} cards
        </span>
      </div>
      <p className="mt-1 min-h-8 text-xs text-white/50">
        {nextCard
          ? `Next: ${nextCard.name}${next !== null ? ` (or at ${next.toLocaleString('en')} Bakugan XP)` : ''}`
          : 'All cards unlocked'}
      </p>
      <button
        disabled={keys === 0 || !nextCard}
        onClick={() => {
          applyCardKey(owned.id)
          playSfx('gPower')
        }}
        className="font-display mt-2 w-full rounded border py-1.5 text-[10px] tracking-[0.3em] transition enabled:hover:bg-white/10 disabled:opacity-40"
        style={{ borderColor: element.color }}
      >
        🗝 USE CARD KEY
      </button>
    </div>
  )
}

// ---------------------------------------------------------------- equipment

function Equipment() {
  return (
    <section className="mt-6 rounded-2xl border border-dashed border-white/15 bg-black/30 p-10 text-center">
      <p className="text-4xl">⚙</p>
      <p className="font-display mt-3 text-xl font-bold">Battle Gear is on its way</p>
      <p className="mx-auto mt-2 max-w-lg text-white/55">
        Equipment that attaches to your Bakugan will be kept here. It arrives together with its 3D models.
      </p>
    </section>
  )
}
