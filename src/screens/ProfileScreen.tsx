import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useState, type CSSProperties } from 'react'
import { playSfx } from '../audio/sfx'
import { AbilityBrowser } from '../components/AbilityBrowser'
import { Avatar } from '../components/Avatar'
import { BakuganDrawer } from '../components/BakuganDrawer'
import { BakuganThumb } from '../components/BakuganThumb'
import { entrantOf } from '../components/collection'
import { CollectionBrowser } from '../components/CollectionBrowser'
import { GateChip } from '../components/GateChip'
import { GRID, GRID_SIZE } from '../components/grid'
import { PageNav } from '../components/PageNav'
import { rankColor } from '../profile/brawlers'
import { clanOf, useClans } from '../profile/useClans'
import { useFriendChat } from '../profile/useFriendChat'
import { formBrawlG } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { gateDeck } from '../data/gates'
import { rankScore, teamEntrants, tierOf, useActiveProfile, useProfiles, type Profile } from '../profile/useProfiles'
import { useGame } from '../store/useGame'
import { EventTrophies } from '../components/EventTrophies'
import { BrawlerProfileModal, FriendsList } from './BrawlerProfile'

export function ProfileScreen() {
  const profile = useActiveProfile()
  const profiles = useProfiles((s) => s.profiles)
  const select = useProfiles((s) => s.select)
  const remove = useProfiles((s) => s.remove)
  const editProfile = useGame((s) => s.editProfile)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [friendId, setFriendId] = useState<string | null>(null)
  // the Bakugan whose details are open, and the list its arrows step through
  const [detail, setDetail] = useState<{ id: string; list: string[] } | null>(null)
  const openDetail = useCallback((id: string, list: string[]) => setDetail({ id, list }), [])
  const stepDetail = useCallback((id: string) => setDetail((d) => (d ? { ...d, id } : d)), [])
  const closeDetail = useCallback(() => setDetail(null), [])

  return (
    <motion.div
      // no top padding on the scroller itself: Chrome would hold the sticky collection toolbar that far down
      className="absolute inset-0 overflow-y-auto px-16 pb-10"
      style={{
        backgroundImage: `radial-gradient(circle at 15% 10%, ${profile ? ELEMENT_BY_ID[profile.element].color : '#9aa3b5'}30 0%, transparent 50%), ${GRID}`,
        backgroundSize: `100% 100%, ${GRID_SIZE}`,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="pt-10">
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
      </div>

      {!profile ? (
        <div className="mt-24 text-center">
          <p className="font-display text-3xl font-black">NO PLAYER SELECTED</p>
          <p className="mt-2 text-white/50">Pick a player above or create a new brawler.</p>
        </div>
      ) : (
        <>
          <Header profile={profile} onEdit={() => editProfile(profile.id)} onDelete={() => setConfirmDelete(true)} />
          <Stats profile={profile} />
          <div className="mt-8">
            <FriendsList onOpen={setFriendId} />
          </div>
          <Team profile={profile} onOpen={openDetail} />
          <CollectionBrowser profile={profile} openId={detail?.id ?? null} onOpen={openDetail} />
          <Locker profile={profile} />
          <AbilityBrowser profile={profile} onOpen={openDetail} />
          <BakuganDrawer profile={profile} open={detail} onNavigate={stepDetail} onClose={closeDetail} />
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
                    useFriendChat.getState().forget(profile.id)
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
      <BrawlerProfileModal id={friendId} onClose={() => setFriendId(null)} />
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
        <RankBadge profile={profile} />
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
        <EventTrophies profileId={profile.id} />
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

function Team({ profile, onOpen }: { profile: Profile; onOpen: (id: string, list: string[]) => void }) {
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
            <button
              key={e.bakugan.id}
              onClick={() => {
                playSfx('select')
                onOpen(e.bakugan.id, profile.team)
              }}
              title={`${e.bakugan.evolutions[e.form].name}: details`}
              className="group flex cursor-pointer items-center gap-3 rounded-xl border-2 border-[color:var(--b)] bg-black/40 p-1.5 pr-5 text-left transition hover:-translate-y-0.5 hover:border-[color:var(--c)] hover:bg-white/[0.06] hover:shadow-[0_8px_24px_-8px_var(--c)]"
              style={{ '--b': `${el.color}88`, '--c': el.color } as CSSProperties}
            >
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                <div className="h-full w-full transition-transform duration-300 group-hover:scale-110">
                  <BakuganThumb entrant={entrantOf(e.bakugan.id, e.form, e.skin)} />
                </div>
              </div>
              <div className="leading-tight">
                <span
                  className="font-display text-[10px] tracking-widest"
                  style={{ color: i === 0 ? '#f5c542' : 'rgba(255,255,255,0.4)' }}
                >
                  {i === 0 ? '★ LEAD' : `#${i + 1}`}
                </span>
                <p className="font-display font-bold">{e.bakugan.evolutions[e.form].name}</p>
                <p className="flex items-center gap-1 text-xs text-white/45">
                  <img src={el.icon} alt="" className="h-3.5 w-3.5" />
                  {formBrawlG(e)}G
                </p>
              </div>
            </button>
          )
        })}
        {Array.from({ length: Math.max(0, 3 - team.length) }, (_, i) => (
          <div
            key={i}
            className="flex h-[4.75rem] w-40 items-center justify-center rounded-xl border-2 border-dashed border-white/15 px-3 text-center text-[11px] text-white/35"
          >
            Empty slot · add a Bakugan from below
          </div>
        ))}
        <span className="text-sm text-white/40">Click a Bakugan to change the team. Gate deck:</span>
        {gateDeck(team).map((g) => (
          <GateChip key={g.id} gate={g} />
        ))}
      </div>
    </section>
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

/** Rank (with its division) and progress towards the next one, in the rank's colour. */
export function RankBadge({ profile, color }: { profile: Pick<Profile, 'rating' | 'xp'>; color?: string }) {
  const score = rankScore(profile)
  const tier = tierOf(score)
  const c = color ?? rankColor(tier)
  return (
    <div className="flex items-center gap-3">
      <p className="font-display text-xs tracking-[0.5em]" style={{ color: c }}>
        {tier.rank.toUpperCase()}
      </p>
      {tier.nextRank && (
        <>
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full"
              style={{ width: `${((score - tier.min) / (tier.nextRank.min - tier.min)) * 100}%`, background: c }}
            />
          </div>
          <span className="text-xs text-white/40">
            {tier.nextRank.min - score} to {tier.nextRank.name}
          </span>
        </>
      )}
    </div>
  )
}
