import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { playSfx } from '../audio/sfx'
import { Avatar } from '../components/Avatar'
import { formBrawlG } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { useMinute } from '../profile/botProgress'
import { brawlerOf, TIER_COLORS } from '../profile/brawlers'
import { clanOf, useClans } from '../profile/useClans'
import { bakuganById, friendStatus, tierOf, useActiveProfile, useProfiles } from '../profile/useProfiles'
import { useGame } from '../store/useGame'

/** The time for friend statuses: it moves on when the next waiting request gets accepted. */
function useFriendClock() {
  const me = useActiveProfile()
  const [now, setNow] = useState(() => Date.now())
  const next = me?.friends
    ?.map((f) => f.since)
    .filter((t) => t > now)
    .sort((a, b) => a - b)[0]
  useEffect(() => {
    if (next === undefined) return
    const t = window.setTimeout(() => setNow(Date.now()), Math.max(0, next - Date.now()) + 50)
    return () => clearTimeout(t)
  }, [next])
  return now
}

/** A brawler's profile card (another player on this device or a CPU brawler), with Add friend. */
export function BrawlerProfileModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {id && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <BrawlerCard id={id} onClose={onClose} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function BrawlerCard({ id, onClose }: { id: string; onClose: () => void }) {
  const profiles = useProfiles((s) => s.profiles)
  const me = useActiveProfile()
  const clans = useClans((s) => s.clans)
  const openPage = useGame((s) => s.openPage)
  const now = useMinute()
  const b = brawlerOf(id, profiles, now)
  if (!b) return null
  const el = ELEMENT_BY_ID[b.element]
  const tier = tierOf(b.score)
  const clan = clanOf(clans, id)
  const battles = b.wins + b.losses
  const stats: [string, string | number][] = [
    ['RANK SCORE', b.score.toLocaleString('en')],
    ['RATING', `${b.rating} BR`],
    ['PLAYER XP', b.xp.toLocaleString('en')],
    ['WINS', b.wins],
    ['LOSSES', b.losses],
    ['WIN RATE', battles ? `${Math.round((b.wins / battles) * 100)}%` : '—'],
  ]
  return (
    <motion.div
      className="relative max-h-[90vh] w-[640px] max-w-[92vw] overflow-y-auto rounded-2xl border border-white/15 bg-[#0b0c12] p-8"
      style={{ backgroundImage: `radial-gradient(circle at 15% 0%, ${el.color}33, transparent 55%)` }}
      initial={{ scale: 0.95, y: 10 }}
      animate={{ scale: 1, y: 0 }}
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={onClose} className="absolute top-4 right-5 text-xl text-white/40 hover:text-white" title="Close">
        ✕
      </button>
      <div className="flex items-start gap-6">
        <Avatar avatar={b.avatar} color={el.color} size={120} frame={b.frame} />
        <div className="min-w-0 flex-1">
          <p className="font-display flex items-center gap-2 text-xs tracking-[0.4em]" style={{ color: TIER_COLORS[tier.index] }}>
            {tier.name.toUpperCase()}
            {b.cpu && <span className="rounded bg-white/10 px-1.5 text-[10px] tracking-widest text-white/50">CPU</span>}
          </p>
          {b.title && <p className="font-display mt-1 text-xs tracking-[0.2em] text-amber-200">✦ {b.title}</p>}
          <h2 className="font-display mt-1 text-3xl font-black">
            {clan && <span className="mr-2 text-xl text-white/50">[{clan.tag}]</span>}
            {b.name}
          </h2>
          <div className="mt-1 flex items-center gap-2 text-sm">
            <img src={el.icon} alt="" className="h-5 w-5" />
            <span className="font-display tracking-widest" style={{ color: el.color }}>
              {el.name.toUpperCase()}
            </span>
            <span className="text-white/40">
              {b.since ? `· since ${new Date(b.since).toLocaleDateString('en-GB')}` : '· CPU brawler'}
              {clan && ` · ${clan.leaderId === id ? 'leader' : 'member'} of ${clan.name}`}
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed whitespace-pre-line text-white/70">{b.bio || 'No bio yet.'}</p>
          {b.cpu && (
            <p className="mt-2 text-xs text-white/40">
              {b.today ? `${b.today} ${b.today === 1 ? 'brawl' : 'brawls'} today` : 'No brawls yet today'}
              {b.lastBattle && ` · last brawl ${ago(now - b.lastBattle)}`}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2">
            <p className="font-display text-[10px] tracking-[0.3em] text-white/40">{label}</p>
            <p className="font-display mt-0.5 text-xl font-black">{value}</p>
          </div>
        ))}
      </div>

      <h3 className="font-display mt-6 text-xs tracking-[0.5em] text-white/40">BATTLE TEAM</h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {b.team.length === 0 && <p className="text-sm text-white/40">No team picked.</p>}
        {b.team.map((t, i) => {
          const bakugan = bakuganById(t.id)
          const bel = ELEMENT_BY_ID[bakugan.element]
          return (
            <div
              key={t.id}
              className="flex items-center gap-2 rounded-lg border-2 bg-black/40 px-3 py-1.5"
              style={{ borderColor: `${bel.color}aa` }}
            >
              <span className="font-display text-[10px] tracking-widest text-white/40">{i === 0 ? 'LEAD' : `#${i + 1}`}</span>
              <img src={bel.icon} alt="" className="h-6 w-6" />
              <span className="font-display text-sm font-bold">{bakugan.evolutions[t.form]?.name ?? bakugan.name}</span>
              <span className="text-xs text-white/45">{formBrawlG({ bakugan, form: t.form })}G</span>
            </div>
          )
        })}
      </div>

      <div className="mt-7 flex items-center gap-3">
        {me && me.id === id ? (
          <>
            <span className="font-display text-xs tracking-[0.3em] text-white/50">THIS IS YOU</span>
            <button
              onClick={() => {
                onClose()
                openPage('profile')
              }}
              className="font-display rounded border border-white/30 px-5 py-2 text-xs tracking-[0.3em] hover:bg-white/10"
            >
              OPEN MY PROFILE
            </button>
          </>
        ) : (
          me && <FriendButton id={id} name={b.firstName} />
        )}
      </div>
    </motion.div>
  )
}

/** "just now", "25 min ago", "3 h ago", "2 days ago". */
function ago(ms: number) {
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.floor(min / 60)
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} ${h < 48 ? 'day' : 'days'} ago`
}

/** Add friend → request sent → friends (with remove). */
export function FriendButton({ id, name, small }: { id: string; name: string; small?: boolean }) {
  const me = useActiveProfile()
  const addFriend = useProfiles((s) => s.addFriend)
  const removeFriend = useProfiles((s) => s.removeFriend)
  const now = useFriendClock()
  const status = friendStatus(me, id, now)
  const size = small ? 'px-3 py-1 text-[10px]' : 'px-5 py-2 text-xs'
  if (!me || me.id === id) return null
  if (status === 'none')
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          playSfx('select')
          addFriend(id)
        }}
        className={`font-display rounded border-2 border-white/60 tracking-[0.3em] hover:bg-white/10 ${size}`}
      >
        + ADD FRIEND
      </button>
    )
  if (status === 'pending')
    return (
      <span className={`font-display animate-pulse rounded border-2 border-white/20 tracking-[0.3em] text-white/60 ${size}`}>
        REQUEST SENT…{!small && <span className="ml-2 tracking-normal text-white/40">waiting for {name}</span>}
      </span>
    )
  return (
    <span className="flex items-center gap-3">
      <span className={`font-display rounded border-2 border-emerald-400/70 tracking-[0.3em] text-emerald-300 ${size}`}>
        ✓ FRIENDS
      </span>
      {!small && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            removeFriend(id)
          }}
          className="text-xs text-white/35 hover:text-red-300"
        >
          REMOVE
        </button>
      )}
    </span>
  )
}

/** The active player's friends (and requests still waiting); a click opens their profile. */
export function FriendsList({ onOpen }: { onOpen: (id: string) => void }) {
  const me = useActiveProfile()
  const profiles = useProfiles((s) => s.profiles)
  const now = useFriendClock()
  const list = (me?.friends ?? []).map((f) => ({ f, b: brawlerOf(f.id, profiles, now) })).filter((x) => !!x.b)
  return (
    <section>
      <h3 className="font-display text-xs tracking-[0.5em] text-white/40">
        FRIENDS · {list.filter(({ f }) => f.since <= now).length}
      </h3>
      {list.length === 0 && (
        <p className="mt-2 text-sm text-white/40">No friends yet. Open a clan member’s profile and add them.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {list.map(({ f, b }) => {
          const el = ELEMENT_BY_ID[b!.element]
          const waiting = f.since > now
          return (
            <button
              key={f.id}
              onClick={() => onOpen(f.id)}
              className={`flex items-center gap-2 rounded-full border border-white/10 bg-black/40 py-1 pr-3 pl-1 text-left transition hover:border-white/40 ${waiting ? 'opacity-60' : ''}`}
            >
              <Avatar avatar={b!.avatar} color={el.color} size={30} />
              <span className="text-sm font-semibold">{b!.firstName}</span>
              {waiting && <span className="text-[10px] text-white/45">pending…</span>}
            </button>
          )
        })}
      </div>
    </section>
  )
}
