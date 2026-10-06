import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { playSfx } from '../audio/sfx'
import { Avatar } from '../components/Avatar'
import { GateChip } from '../components/GateChip'
import { GRID, GRID_SIZE } from '../components/grid'
import { PageNav } from '../components/PageNav'
import { clanOf, useClans } from '../profile/useClans'
import { abilityLabel, BAKUGAN, formBrawlG, type Bakugan } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { gateDeck } from '../data/gates'
import {
  canEvolve,
  cardCount,
  cardUnlockXp,
  nextCardXp,
  nextEvolveXp,
  rankScore,
  teamEntrants,
  tierOf,
  useActiveProfile,
  useProfiles,
  bakuganById,
  TIERS,
  type OwnedBakugan,
  type Profile,
} from '../profile/useProfiles'
import { SKINS, skinFits } from '../season/season'
import { useGame } from '../store/useGame'

export function ProfileScreen() {
  const profile = useActiveProfile()
  const profiles = useProfiles((s) => s.profiles)
  const select = useProfiles((s) => s.select)
  const remove = useProfiles((s) => s.remove)
  const editProfile = useGame((s) => s.editProfile)
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <motion.div
      className="absolute inset-0 overflow-y-auto px-16 py-10"
      style={{
        backgroundImage: `radial-gradient(circle at 15% 10%, ${profile ? ELEMENT_BY_ID[profile.element].color : '#9aa3b5'}30 0%, transparent 50%), ${GRID}`,
        backgroundSize: `100% 100%, ${GRID_SIZE}`,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <PageNav current="profile">
        {/* player switcher */}
        <div className="flex items-center gap-3">
          <span className="font-display text-[10px] tracking-[0.4em] text-white/40">PLAYERS</span>
          {profiles.map((p) => (
            <button
              key={p.id}
              title={`${p.firstName} ${p.lastName}`}
              onClick={() => {
                playSfx('tick')
                select(p.id)
              }}
              className={`rounded-full transition ${p.id === profile?.id ? '' : 'opacity-45 hover:opacity-90'}`}
            >
              <Avatar avatar={p.avatar} color={ELEMENT_BY_ID[p.element].color} size={40} />
            </button>
          ))}
          <button
            onClick={() => editProfile(null)}
            title="New player"
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-white/30 text-xl text-white/60 transition hover:border-white hover:text-white"
          >
            +
          </button>
        </div>
      </PageNav>

      {!profile ? (
        <div className="mt-24 text-center">
          <p className="font-display text-3xl font-black">NO PLAYER SELECTED</p>
          <p className="mt-2 text-white/50">Pick a player above or create a new brawler.</p>
        </div>
      ) : (
        <>
          <Header profile={profile} onEdit={() => editProfile(profile.id)} onDelete={() => setConfirmDelete(true)} />
          <Stats profile={profile} />
          <Team profile={profile} />
          <Collection profile={profile} />
          <Locker profile={profile} />
          <Cards profile={profile} />
        </>
      )}

      <AnimatePresence>
        {confirmDelete && profile && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="rounded-xl border border-white/15 bg-black/90 p-8 text-center">
              <p className="font-display text-xl font-bold">
                Delete {profile.firstName} {profile.lastName}?
              </p>
              <p className="mt-2 text-white/50">Their Bakugan, XP and battle record are removed from this device.</p>
              <div className="mt-6 flex justify-center gap-3">
                <button
                  onClick={() => {
                    useClans.getState().leave(profile.id)
                    remove(profile.id)
                    setConfirmDelete(false)
                  }}
                  className="font-display border-2 border-red-500/70 px-6 py-2 tracking-[0.3em] text-red-300 hover:bg-red-500/10"
                >
                  DELETE
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="font-display border-2 border-white/25 px-6 py-2 tracking-[0.3em] hover:bg-white/10"
                >
                  KEEP
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function Header({ profile, onEdit, onDelete }: { profile: Profile; onEdit: () => void; onDelete: () => void }) {
  const element = ELEMENT_BY_ID[profile.element]
  const clan = clanOf(
    useClans((s) => s.clans),
    profile.id,
  )
  return (
    <header className="mt-8 flex items-start gap-8">
      <Avatar avatar={profile.avatar} color={element.color} size={150} frame={profile.cosmetics?.frame} />
      <div className="min-w-0 flex-1">
        <RankBadge profile={profile} color={element.color} />
        {profile.cosmetics?.title && (
          <p className="font-display mt-1 text-sm tracking-[0.2em] text-amber-200">✦ {profile.cosmetics.title}</p>
        )}
        <h1 className="font-display text-5xl font-black tracking-wide">
          {clan && <span className="mr-3 text-3xl text-white/50">[{clan.tag}]</span>}
          {profile.firstName} {profile.lastName}
        </h1>
        <div className="mt-2 flex items-center gap-2">
          <img src={element.icon} alt="" className="h-7 w-7" style={{ filter: `drop-shadow(0 0 8px ${element.glow})` }} />
          <span className="font-display tracking-widest" style={{ color: element.color }}>
            {element.name.toUpperCase()}
          </span>
          <span className="text-white/40">
            · {element.attribute} · since {new Date(profile.createdAt).toLocaleDateString('en-GB')}
          </span>
        </div>
        <p className="mt-4 max-w-3xl leading-relaxed whitespace-pre-line text-white/75">{profile.bio || 'No bio yet.'}</p>
      </div>
      <div className="flex shrink-0 flex-col gap-2">
        <button
          onClick={onEdit}
          className="font-display border-2 border-white/40 px-5 py-2 text-xs tracking-[0.3em] hover:bg-white/10"
        >
          EDIT PROFILE
        </button>
        <button onClick={onDelete} className="font-display px-5 py-2 text-xs tracking-[0.3em] text-white/35 hover:text-red-300">
          DELETE
        </button>
      </div>
    </header>
  )
}

function Stats({ profile }: { profile: Profile }) {
  const s = profile.stats
  const items = [
    ['RATING', `${profile.rating} BR`],
    ['BATTLE POINTS', `${profile.bp.toLocaleString('en')} BP`],
    ['PLAYER XP', profile.xp.toLocaleString('en')],
    ['BATTLES', s.battles],
    ['WINS', s.wins],
    ['LOSSES', s.losses],
    ['WIN RATE', s.battles ? `${Math.round((s.wins / s.battles) * 100)}%` : '—'],
    ['KOs', s.kos],
    ['BEST STREAK', s.bestStreak],
  ] as const
  return (
    <div className="mt-8 grid grid-cols-9 gap-3">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-white/10 bg-black/40 px-4 py-3 backdrop-blur">
          <p className="font-display text-[10px] tracking-[0.3em] text-white/40">{label}</p>
          <p className="font-display mt-1 text-2xl font-black">{value}</p>
        </div>
      ))}
    </div>
  )
}

function Team({ profile }: { profile: Profile }) {
  const team = teamEntrants(profile)
  return (
    <section className="mt-10">
      <h2 className="font-display text-xs tracking-[0.5em] text-white/40">
        BATTLE TEAM · {team.reduce((n, e) => n + formBrawlG(e), 0)}G
      </h2>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {team.map((e, i) => {
          const el = ELEMENT_BY_ID[e.bakugan.element]
          return (
            <div
              key={e.bakugan.id}
              className="flex items-center gap-3 rounded-lg border-2 bg-black/40 px-4 py-2"
              style={{ borderColor: `${el.color}aa` }}
            >
              <span className="font-display text-[10px] tracking-widest text-white/40">{i === 0 ? 'LEAD' : `#${i + 1}`}</span>
              <img src={el.icon} alt="" className="h-8 w-8" />
              <span className="font-display font-bold">{e.bakugan.evolutions[e.form].name}</span>
            </div>
          )
        })}
        <span className="text-sm text-white/40">Change the team with the TEAM buttons below. Gate deck:</span>
        {gateDeck(team).map((g) => (
          <GateChip key={g.id} gate={g} />
        ))}
      </div>
    </section>
  )
}

function Collection({ profile }: { profile: Profile }) {
  const openPage = useGame((s) => s.openPage)
  return (
    <section className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xs tracking-[0.5em] text-white/40">
          BAKUGAN COLLECTION · {profile.collection.length}/{BAKUGAN.length}
        </h2>
        <button
          onClick={() => openPage('shop')}
          className="font-display rounded border border-white/25 px-4 py-1.5 text-xs tracking-[0.3em] hover:bg-white/10"
        >
          GET MORE IN THE SHOP →
        </button>
      </div>
      <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
        {profile.collection.map((owned) => (
          <OwnedCard key={owned.id} bakugan={bakuganById(owned.id)} owned={owned} profile={profile} />
        ))}
      </div>
    </section>
  )
}

function OwnedCard({ bakugan, owned, profile }: { bakugan: Bakugan; owned: OwnedBakugan; profile: Profile }) {
  const evolve = useProfiles((s) => s.evolve)
  const setTeam = useProfiles((s) => s.setTeam)
  const element = ELEMENT_BY_ID[bakugan.element]
  const need = nextEvolveXp(bakugan, owned)
  const prev = owned.form === 0 ? 0 : (nextEvolveXp(bakugan, { ...owned, form: owned.form - 1 }) ?? 0)
  const ready = canEvolve(owned)
  const inTeam = profile.team.indexOf(bakugan.id)
  const cardNext = nextCardXp(owned)
  const applyCardKey = useProfiles((s) => s.applyCardKey)
  const setSkin = useProfiles((s) => s.setSkin)
  const skins = SKINS.filter((sk) => profile.cosmetics?.owned.includes(`skin:${sk.id}`) && skinFits(sk, bakugan.id))
  const [flash, setFlash] = useState(0)

  function toggleTeam() {
    playSfx('tick')
    if (inTeam !== -1) {
      if (profile.team.length > 1) setTeam(profile.team.filter((id) => id !== bakugan.id))
    } else setTeam([...profile.team.slice(0, 2), bakugan.id])
  }

  return (
    <div
      className="relative overflow-hidden rounded-xl border bg-black/40 p-5 backdrop-blur"
      style={{ borderColor: `${element.color}55` }}
    >
      <AnimatePresence>
        {flash > 0 && (
          <motion.div
            key={flash}
            className="pointer-events-none absolute inset-0"
            style={{ background: `radial-gradient(circle, ${element.glow}cc, transparent 70%)` }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
          />
        )}
      </AnimatePresence>
      <div className="flex items-start gap-4">
        <img src={element.icon} alt="" className="h-14 w-14" style={{ filter: `drop-shadow(0 0 12px ${element.glow})` }} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl font-bold">{bakugan.evolutions[owned.form].name}</p>
          <p className="text-sm text-white/50">
            {element.name} · {formBrawlG({ bakugan, form: owned.form })}G · {owned.wins}W / {owned.battles} battles · {owned.kos}{' '}
            KOs
          </p>
        </div>
        <button
          onClick={toggleTeam}
          className="font-display rounded border px-2 py-1 text-[10px] tracking-widest transition"
          style={{
            borderColor: inTeam !== -1 ? element.color : 'rgba(255,255,255,0.2)',
            background: inTeam !== -1 ? `${element.color}33` : 'transparent',
          }}
        >
          {inTeam === -1 ? '+ TEAM' : inTeam === 0 ? '★ LEAD' : `TEAM #${inTeam + 1}`}
        </button>
      </div>

      {/* evolution chain */}
      <div className="mt-4 flex flex-wrap items-center gap-1 text-xs">
        {bakugan.evolutions.map((evo, i) => (
          <span key={`${evo.name}-${evo.series}`} className="flex items-center gap-1">
            {i > 0 && <span className="text-white/25">→</span>}
            <span
              className="rounded px-2 py-0.5"
              style={{
                background: i === owned.form ? `${element.color}55` : i < owned.form ? `${element.color}22` : 'transparent',
                border: `1px solid ${i <= owned.form ? element.color : 'rgba(255,255,255,0.12)'}`,
                color: i <= owned.form ? '#fff' : 'rgba(255,255,255,0.35)',
              }}
            >
              {evo.name}
              {evo.series !== 'Battle Brawlers' && <span className="text-white/40"> ({evo.series})</span>}
            </span>
          </span>
        ))}
      </div>

      {/* xp to next evolution */}
      <div className="mt-4">
        <div className="flex justify-between text-xs">
          <span className="font-display tracking-widest text-white/40">XP {owned.xp}</span>
          <span className="text-white/60">
            {need === null
              ? 'Final form reached'
              : ready
                ? 'Ready to evolve!'
                : `${need - owned.xp} XP to ${bakugan.evolutions[owned.form + 1].name}`}
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${need === null ? 100 : Math.min(100, ((owned.xp - prev) / (need - prev)) * 100)}%`,
              background: `linear-gradient(90deg, ${element.color}, ${element.glow})`,
            }}
          />
        </div>
      </div>
      {ready && (
        <motion.button
          onClick={() => {
            playSfx('gPower')
            setFlash(Date.now())
            evolve(bakugan.id)
          }}
          animate={{ boxShadow: [`0 0 0px ${element.glow}`, `0 0 24px ${element.glow}`, `0 0 0px ${element.glow}`] }}
          transition={{ repeat: Infinity, duration: 1.6 }}
          className="font-display mt-3 w-full border-2 py-2 font-black tracking-[0.3em]"
          style={{ borderColor: element.color, background: `${element.color}33` }}
        >
          EVOLVE → {bakugan.evolutions[owned.form + 1].name.toUpperCase()}
        </motion.button>
      )}
      <p className="mt-3 text-xs text-white/50">
        Ability cards {cardCount(owned)}/{bakugan.abilities.length}
        {cardNext !== null && ` · next card at ${cardNext} XP`}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        {cardNext !== null && (profile.cardKeys ?? 0) > 0 && (
          <button
            onClick={() => {
              playSfx('gPower')
              applyCardKey(bakugan.id)
            }}
            className="rounded border border-amber-300/60 px-2 py-1 text-amber-200 hover:bg-amber-300/10"
          >
            🗝 USE CARD KEY ({profile.cardKeys})
          </button>
        )}
        {skins.length > 0 && (
          <label className="flex items-center gap-1 text-white/50">
            SKIN
            <select
              value={owned.skin ?? ''}
              onChange={(e) => setSkin(bakugan.id, e.target.value || undefined)}
              className="rounded border border-white/20 bg-black/80 px-1 py-0.5 text-white"
            >
              <option value="">Original</option>
              {skins.map((sk) => (
                <option key={sk.id} value={sk.id}>
                  {sk.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  )
}

/** Short summary of what the player owns, opening the inventory. */
function Locker({ profile }: { profile: Profile }) {
  const openPage = useGame((s) => s.openPage)
  const owned = profile.cosmetics?.owned ?? []
  const count = (prefix: string) => owned.filter((k) => k.startsWith(prefix)).length
  return (
    <section className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/30 px-6 py-4">
      <p className="text-sm text-white/60">
        Inventory: {count('skin:')} skins · {count('frame:')} frames · {count('outfit:') + count('acc:')} outfits & accessories ·{' '}
        {profile.boosts ?? 0} XP Boosts · {profile.cardKeys ?? 0} Card Keys
      </p>
      <button
        onClick={() => openPage('inventory')}
        className="font-display rounded border border-white/25 px-4 py-1.5 text-xs tracking-[0.3em] hover:bg-white/10"
      >
        OPEN INVENTORY →
      </button>
    </section>
  )
}

/** Rank name with progress towards the next tier. */
export function RankBadge({ profile, color }: { profile: Profile; color: string }) {
  const score = rankScore(profile)
  const tier = tierOf(score)
  const from = TIERS[tier.index].min
  return (
    <div className="flex items-center gap-3">
      <p className="font-display text-xs tracking-[0.5em]" style={{ color }}>
        {tier.name.toUpperCase()}
      </p>
      {tier.next && (
        <>
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full"
              style={{ width: `${((score - from) / (tier.next.min - from)) * 100}%`, background: color }}
            />
          </div>
          <span className="text-xs text-white/40">
            {tier.next.min - score} to {tier.next.name}
          </span>
        </>
      )}
    </div>
  )
}

function Cards({ profile }: { profile: Profile }) {
  return (
    <section className="mt-10 pb-10">
      <h2 className="font-display text-xs tracking-[0.5em] text-white/40">ABILITY CARDS</h2>
      <div className="mt-3 space-y-5">
        {profile.collection.map((owned) => {
          const bakugan = BAKUGAN.find((b) => b.id === owned.id)!
          const element = ELEMENT_BY_ID[bakugan.element]
          const n = cardCount(owned)
          return (
            <div key={owned.id}>
              <p className="font-display text-sm font-bold" style={{ color: element.color }}>
                {bakugan.name}{' '}
                <span className="font-normal text-white/40">
                  · {n}/{bakugan.abilities.length}
                </span>
              </p>
              <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-2">
                {bakugan.abilities.map((a, i) => {
                  const locked = i >= n
                  return (
                    <div
                      key={a.id}
                      className="rounded-lg border bg-black/40 p-3"
                      style={{
                        borderColor: locked ? 'rgba(255,255,255,0.08)' : `${element.color}77`,
                        opacity: locked ? 0.45 : 1,
                      }}
                    >
                      <p
                        className="font-display text-[11px] font-bold tracking-wider"
                        style={{ color: locked ? '#888' : element.color }}
                      >
                        {locked ? `🔒 UNLOCKS AT ${cardUnlockXp(i)} XP` : abilityLabel(a)}
                      </p>
                      <p className="font-display mt-0.5 text-sm font-bold">{a.name}</p>
                      <p className="mt-1 line-clamp-3 text-xs text-white/60">{a.description}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
