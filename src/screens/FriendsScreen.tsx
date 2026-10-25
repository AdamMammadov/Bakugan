import { motion } from 'framer-motion'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { playSfx } from '../audio/sfx'
import { Avatar } from '../components/Avatar'
import { ClanEmblem } from '../components/ClanEmblem'
import { GRID, GRID_SIZE } from '../components/grid'
import { PageNav } from '../components/PageNav'
import { PresenceDot, PresenceLabel, PresencePill } from '../components/PresenceBadge'
import { BAKUGAN, formBrawlG } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { BOTS } from '../profile/bots'
import { useMinute } from '../profile/botProgress'
import { brawlerOf, rankColor, type BrawlerView } from '../profile/brawlers'
import { fold } from '../profile/chatBrain'
import { dndUntil, FOREVER, MUTE_OPTIONS, muteUntil, startFriendly, useInvites, type InviteKind } from '../profile/invites'
import { ago, statusOf, type PresenceState, type Status } from '../profile/presence'
import { clanOf, useClans } from '../profile/useClans'
import { noteText, seenBy, threadKey, unreadFrom, useFriendChat, type InviteNote } from '../profile/useFriendChat'
import { bakuganById, friendStatus, tierOf, useActiveProfile, useProfiles, type Profile } from '../profile/useProfiles'
import { useGame } from '../store/useGame'
import { useFriendClock } from '../profile/useFriendClock'
import { FriendButton } from './BrawlerProfile'
import { RankBadge } from './ProfileScreen'

// the 3D stage pulls in three.js, so it loads with the first profile shown
const FriendStage = lazy(() => import('../components/FriendStage'))

/** Friends online first, then those in a match, players here, and the ones offline. */
const ORDER: Record<PresenceState, number> = { online: 0, match: 1, local: 2, offline: 3 }

const CpuChip = () => <span className="rounded bg-white/10 px-1.5 text-[10px] tracking-widest text-white/50">CPU</span>

/** Friends: the list (with who is online), their full profiles, direct messages, and finding new ones. */
export function FriendsScreen() {
  const me = useActiveProfile()
  const focus = useFriendChat((s) => s.focus)
  const setFocus = useFriendChat((s) => s.setFocus)
  const hello = useFriendChat((s) => s.hello)
  const clock = useFriendClock()
  const friends = useMemo(() => me?.friends ?? [], [me])
  // the page can be opened for one brawler (from a profile card); else the one picked here, or the first friend
  const [picked, setPicked] = useState<string | null>(null)
  const selected = focus ?? picked ?? friends[0]?.id ?? null
  const setSelected = (id: string | null) => {
    setFocus(null)
    setPicked(id)
  }

  // a CPU brawler who accepted says hello once
  useEffect(() => {
    if (!me) return
    for (const f of friends) if (f.since <= clock) hello(me.id, f.id, f.since + 1500)
  }, [me, friends, clock, hello])

  return (
    <motion.div
      className="absolute inset-0 overflow-y-auto px-16 py-10"
      style={{ backgroundImage: GRID, backgroundSize: GRID_SIZE }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <PageNav current="friends" />
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-black tracking-wider">FRIENDS</h1>
          <p className="mt-1 max-w-3xl text-sm text-white/45">
            Your friends, who is online, their profiles and your messages. Online friends answer messages and battle invites in a
            few seconds; offline ones read your messages when they are back. Find brawlers by name and send a request. Friends
            online from other devices arrive with the online PvP update.
          </p>
        </div>
        {me && <DndControl me={me} />}
      </div>
      {!me ? (
        <p className="mt-10 text-white/60">Create a player profile first.</p>
      ) : (
        <div className="mt-8 grid grid-cols-[320px_minmax(0,1fr)] gap-8">
          <aside className="space-y-6">
            <FriendList me={me} clock={clock} selected={selected} onSelect={setSelected} />
            <FindBrawlers me={me} onOpen={setSelected} />
          </aside>
          <main className="min-w-0">
            {selected ? (
              <FriendPage key={selected} id={selected} me={me} clock={clock} onGone={() => setSelected(null)} />
            ) : (
              <div className="rounded-xl border border-dashed border-white/15 p-12 text-center text-white/45">
                <p className="font-display text-xl font-bold text-white/70">NO FRIEND OPEN</p>
                <p className="mt-2 text-sm">Pick a friend on the left, or find brawlers to add.</p>
              </div>
            )}
          </main>
        </div>
      )}
    </motion.div>
  )
}

function FriendList({
  me,
  clock,
  selected,
  onSelect,
}: {
  me: Profile
  clock: number
  selected: string | null
  onSelect: (id: string) => void
}) {
  const profiles = useProfiles((s) => s.profiles)
  const clans = useClans((s) => s.clans)
  const chats = useFriendChat((s) => s)
  const now = useMinute()
  const rows = (me.friends ?? [])
    .map((f) => {
      const b = brawlerOf(f.id, profiles, now)
      if (!b) return null
      const status = statusOf(f.id, now)
      return { f, b, status, pending: f.since > clock, unread: unreadFrom(chats, me.id, f.id) }
    })
    .filter((r): r is NonNullable<typeof r> => !!r)
    // pending last; online first; then by name
    .sort(
      (a, b) =>
        Number(a.pending) - Number(b.pending) ||
        ORDER[a.status.state] - ORDER[b.status.state] ||
        b.unread - a.unread ||
        a.b.name.localeCompare(b.b.name),
    )
  const online = rows.filter((r) => !r.pending && (r.status.state === 'online' || r.status.state === 'match')).length
  return (
    <section>
      <h2 className="font-display text-xs tracking-[0.5em] text-white/40">
        FRIENDS · {rows.filter((r) => !r.pending).length}
        <span className="ml-2 text-emerald-300/70">{online} ONLINE</span>
      </h2>
      {rows.length === 0 && (
        <p className="mt-3 text-sm text-white/40">No friends yet. Find brawlers below, or add clan members from their profile.</p>
      )}
      <div className="mt-3 space-y-2">
        {rows.map(({ f, b, status, pending, unread }) => {
          const el = ELEMENT_BY_ID[b.element]
          const tier = tierOf(b.score)
          const clan = clanOf(clans, f.id)
          return (
            <button
              key={f.id}
              onClick={() => {
                playSfx('tick')
                onSelect(f.id)
              }}
              className={`flex w-full items-center gap-3 rounded-lg border bg-black/40 p-2 text-left transition hover:border-white/40 ${pending ? 'opacity-60' : ''}`}
              style={{ borderColor: selected === f.id ? `${el.color}cc` : 'rgba(255,255,255,0.1)' }}
            >
              <span className="relative shrink-0">
                <Avatar avatar={b.avatar} color={el.color} size={44} frame={b.frame} />
                {!pending && <PresenceDot state={status.state} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 truncate font-semibold">
                  <span className="truncate">{b.name}</span>
                  {clan && <span className="text-xs text-white/40">[{clan.tag}]</span>}
                  {b.cpu && <CpuChip />}
                </span>
                <span className="flex text-xs" data-testid="friend-status">
                  {pending ? <span className="text-white/50">Request sent…</span> : <PresenceLabel status={status} />}
                </span>
                <span className="block truncate text-[11px]" style={{ color: rankColor(tier) }}>
                  {tier.rank}
                </span>
              </span>
              {unread > 0 && (
                <span className="rounded-full bg-amber-400 px-2 text-xs font-bold text-black" title="Unread messages">
                  {unread}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

/** Search CPU brawlers (and other players here) by name; with no search, a few suggestions. */
function FindBrawlers({ me, onOpen }: { me: Profile; onOpen: (id: string) => void }) {
  const profiles = useProfiles((s) => s.profiles)
  const clans = useClans((s) => s.clans)
  const now = useMinute()
  const [query, setQuery] = useState('')
  const mine = clanOf(clans, me.id)
  const known = new Set([me.id, ...(me.friends ?? []).map((f) => f.id)])
  const everyone = [...profiles.filter((p) => p.id !== me.id).map((p) => p.id), ...BOTS.map((b) => b.id)]
  const q = fold(query)
  const ids = q
    ? everyone.filter((id) => fold(brawlerOf(id, profiles, now)?.name ?? '').includes(q)).slice(0, 8)
    : [
        // clan mates first, then the strongest brawlers
        ...(mine?.members ?? []).filter((id) => !known.has(id)),
        ...BOTS.map((b) => brawlerOf(b.id, profiles, now)!)
          .sort((a, b) => b.score - a.score)
          .map((b) => b.id)
          .filter((id) => !known.has(id)),
      ]
        .filter((id, i, all) => all.indexOf(id) === i)
        .slice(0, 5)
  return (
    <section className="rounded-xl border border-white/10 bg-black/40 p-4">
      <h2 className="font-display text-xs tracking-[0.5em] text-white/40">FIND BRAWLERS</h2>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name…"
        className="mt-3 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/50"
      />
      <p className="mt-3 text-[10px] tracking-[0.3em] text-white/35">{q ? 'RESULTS' : 'SUGGESTED'}</p>
      {ids.length === 0 && <p className="mt-2 text-sm text-white/40">Nobody by that name.</p>}
      <div className="mt-2 space-y-1.5">
        {ids.map((id) => {
          const b = brawlerOf(id, profiles, now)
          if (!b) return null
          const tier = tierOf(b.score)
          const clan = clanOf(clans, id)
          return (
            <div
              key={id}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(id)}
              onKeyDown={(e) => e.key === 'Enter' && onOpen(id)}
              className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 transition hover:bg-white/5"
            >
              <Avatar avatar={b.avatar} color={ELEMENT_BY_ID[b.element].color} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{b.name}</span>
                <span className="block truncate text-[11px] text-white/45">
                  <span style={{ color: rankColor(tier) }}>{tier.rank}</span>
                  {clan && ` · [${clan.tag}]`}
                  {mine && clan?.id === mine.id && ' · your clan'}
                </span>
              </span>
              <FriendButton id={id} name={b.firstName} small />
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** The ⚔ INVITE TO BATTLE / ⚔⚔ TAG BATTLE button, with why it is off (or the friend busy) under its label. */
function BattleButton({
  label,
  color,
  disabled,
  sub,
  title,
  onClick,
}: {
  label: string
  color: string
  disabled: boolean
  sub: string | null
  title: string
  onClick: () => void
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      title={title}
      className="font-display rounded border-2 px-5 py-2 text-left text-xs tracking-[0.3em] transition enabled:hover:-translate-y-0.5 enabled:hover:bg-white/10 disabled:opacity-50"
      style={{ borderColor: color, background: `${color}26` }}
    >
      <span className="block">{label}</span>
      {sub && <span className="font-body mt-0.5 block text-[11px] tracking-normal text-white/60">{sub}</span>}
    </button>
  )
}

function FriendPage({ id, me, clock, onGone }: { id: string; me: Profile; clock: number; onGone: () => void }) {
  const profiles = useProfiles((s) => s.profiles)
  const clans = useClans((s) => s.clans)
  const removeFriend = useProfiles((s) => s.removeFriend)
  const openPage = useGame((s) => s.openPage)
  const waiting = useInvites((s) => s.outgoing?.state === 'waiting')
  const now = useMinute()
  const chat = useRef<HTMLInputElement>(null)
  const [confirm, setConfirm] = useState(false)
  const b = brawlerOf(id, profiles, now)
  if (!b) return null
  const el = ELEMENT_BY_ID[b.element]
  const status = friendStatus(me, id, clock)
  const live = statusOf(id, now)
  const clan = clanOf(clans, id)
  const battles = b.wins + b.losses
  const stats: [string, string | number][] = [
    ['RANK SCORE', b.score.toLocaleString('en')],
    ['RATING', `${b.rating} BR`],
    ['PLAYER XP', b.xp.toLocaleString('en')],
    ['BATTLES', battles.toLocaleString('en')],
    ['WINS', b.wins.toLocaleString('en')],
    ['LOSSES', b.losses.toLocaleString('en')],
    ['WIN RATE', battles ? `${Math.round((b.wins / battles) * 100)}%` : '—'],
    ['KOs', b.kos.toLocaleString('en')],
    b.cpu ? ['TODAY', `${b.today ?? 0} ${b.today === 1 ? 'brawl' : 'brawls'}`] : ['BEST STREAK', b.bestStreak ?? 0],
  ]
  const teamG = b.team.reduce((n, t) => n + formBrawlG({ bakugan: bakuganById(t.id), form: t.form }), 0)
  const friend = status === 'friend'
  const offline = friend && live.state === 'offline'
  const canBattle = friend && me.team.length > 0 && !offline && !waiting
  // why the buttons are off, or that the friend may not answer straight away
  const sub = !friend
    ? null
    : offline
      ? `Offline · ${live.text.toLowerCase()}`
      : live.state === 'match'
        ? 'In a match · may answer later'
        : me.team.length
          ? null
          : 'Pick a team first'
  // CPU friends get an invite to answer; another player on this device is right here
  const battle = (kind: InviteKind) => {
    if (b.cpu) useInvites.getState().invite(me.id, id, kind)
    else if (kind === 'duel') startFriendly(me.id, id)
    else {
      playSfx('select')
      useInvites.getState().openTag(id)
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        <header className="flex items-start gap-6">
          <span className="relative shrink-0">
            <Avatar avatar={b.avatar} color={el.color} size={132} frame={b.frame} />
            {friend && <PresenceDot state={live.state} size={22} />}
          </span>
          <div className="min-w-0 flex-1">
            <RankBadge profile={b} color={rankColor(tierOf(b.score))} />
            {b.title && <p className="font-display mt-1 text-sm tracking-[0.2em] text-amber-200">✦ {b.title}</p>}
            <h2 className="font-display mt-1 flex flex-wrap items-center gap-3 text-4xl font-black tracking-wide">
              {clan && <span className="text-2xl text-white/50">[{clan.tag}]</span>}
              {b.name}
              {b.cpu && <CpuChip />}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <img src={el.icon} alt="" className="h-6 w-6" style={{ filter: `drop-shadow(0 0 8px ${el.glow})` }} />
              <span className="font-display tracking-widest" style={{ color: el.color }}>
                {el.name.toUpperCase()}
              </span>
              <span className="text-white/40">
                · {el.attribute} · {b.since ? `since ${new Date(b.since).toLocaleDateString('en-GB')}` : 'CPU brawler'}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm" data-testid="friend-presence">
              <PresencePill status={live} />
              {b.cpu && b.lastBattle ? <span className="text-white/40">last brawl {ago(now - b.lastBattle)}</span> : null}
            </div>
            <p className="mt-3 max-w-2xl leading-relaxed whitespace-pre-line text-white/75">{b.bio || 'No bio yet.'}</p>
          </div>
        </header>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {friend && (
            <button
              onClick={() => chat.current?.focus()}
              className="font-display self-stretch rounded border-2 border-white/50 px-5 py-2 text-xs tracking-[0.3em] transition hover:bg-white/10"
            >
              ✉ MESSAGE
            </button>
          )}
          <BattleButton
            label="⚔ INVITE TO BATTLE"
            color={el.color}
            disabled={!canBattle}
            sub={sub}
            onClick={() => battle('duel')}
            title={
              !friend
                ? 'Become friends first'
                : offline
                  ? `${b.firstName} is offline`
                  : `Invite ${b.firstName} to a friendly brawl against their team: no rating at stake`
            }
          />
          <BattleButton
            label="⚔⚔ TAG BATTLE"
            color="#ffc94a"
            disabled={!canBattle}
            sub={sub}
            onClick={() => battle('tag')}
            title={
              !friend
                ? 'Become friends first'
                : offline
                  ? `${b.firstName} is offline`
                  : `Invite ${b.firstName} to a 2 vs 2: you two against two CPU brawlers of your level`
            }
          />
          {friend ? (
            confirm ? (
              <span className="flex items-center gap-2 text-xs">
                <span className="text-white/60">Remove {b.firstName}?</span>
                <button
                  onClick={() => {
                    removeFriend(id)
                    setConfirm(false)
                    onGone()
                  }}
                  className="font-display rounded border border-red-400/70 px-3 py-1.5 tracking-[0.2em] text-red-300 hover:bg-red-400/10"
                >
                  REMOVE
                </button>
                <button onClick={() => setConfirm(false)} className="px-2 py-1.5 tracking-[0.2em] text-white/50 hover:text-white">
                  KEEP
                </button>
              </span>
            ) : (
              <button onClick={() => setConfirm(true)} className="px-2 text-xs tracking-[0.2em] text-white/35 hover:text-red-300">
                REMOVE FRIEND
              </button>
            )
          ) : (
            <FriendButton id={id} name={b.firstName} />
          )}
        </div>
        {friend && (
          <p className="mt-2 text-xs text-white/35">
            {b.cpu
              ? `${b.firstName} gets your invite and accepts or declines in a few seconds. Invite to battle: a friendly brawl, no rating at stake. Tag battle: you and ${b.firstName} against two CPU brawlers of your level, 2 vs 2 (friendly too).`
              : `Invite to battle: a friendly brawl, no rating at stake. Tag battle: you and ${b.firstName} against two CPU brawlers of your level, 2 vs 2 (friendly too).`}
          </p>
        )}

        <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-2">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 backdrop-blur">
              <p className="font-display text-[10px] tracking-[0.3em] text-white/40">{label}</p>
              <p className="font-display mt-0.5 text-xl font-black">{value}</p>
            </div>
          ))}
        </div>

        <section className="mt-8">
          <h3 className="font-display text-xs tracking-[0.5em] text-white/40">BATTLE TEAM · {teamG}G</h3>
          <div
            className="relative mt-3 h-72 overflow-hidden rounded-xl border border-white/10"
            style={{ background: `radial-gradient(circle at 50% 40%, ${el.color}33, #05060a 70%)` }}
          >
            <Suspense fallback={<p className="p-4 text-xs text-white/40">Loading 3D…</p>}>
              <FriendStage avatar={b.avatar} element={b.element} lead={b.team[0]} />
            </Suspense>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {b.team.length === 0 && <p className="text-sm text-white/40">No team picked.</p>}
            {b.team.map((t, i) => {
              const bakugan = bakuganById(t.id)
              const bel = ELEMENT_BY_ID[bakugan.element]
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-lg border-2 bg-black/40 px-4 py-2"
                  style={{ borderColor: `${bel.color}aa` }}
                >
                  <span className="font-display text-[10px] tracking-widest text-white/40">{i === 0 ? 'LEAD' : `#${i + 1}`}</span>
                  <img src={bel.icon} alt="" className="h-8 w-8" />
                  <span>
                    <span className="font-display block font-bold">{bakugan.evolutions[t.form]?.name ?? bakugan.name}</span>
                    <span className="block text-xs text-white/45">
                      {bel.name} · {formBrawlG({ bakugan, form: t.form })}G
                    </span>
                  </span>
                </div>
              )
            })}
          </div>
        </section>

        <Collection b={b} />

        <section className="mt-8 pb-10">
          <h3 className="font-display text-xs tracking-[0.5em] text-white/40">CLAN</h3>
          {clan ? (
            <div className="mt-3 flex items-center gap-4 rounded-xl border border-white/10 bg-black/40 p-4">
              <ClanEmblem clan={clan} size={56} />
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-bold">
                  <span style={{ color: ELEMENT_BY_ID[clan.element].color }}>[{clan.tag}]</span> {clan.name}
                </p>
                <p className="truncate text-sm text-white/50 italic">“{clan.motto || 'No motto'}”</p>
                <p className="text-xs text-white/40">
                  {clan.leaderId === id ? '★ Leader' : 'Member'} · {clan.members.length} members
                  {clanOf(clans, me.id)?.id === clan.id && ' · your clan'}
                </p>
              </div>
              <button
                onClick={() => openPage('clans')}
                className="font-display rounded border border-white/25 px-4 py-1.5 text-xs tracking-[0.3em] hover:bg-white/10"
              >
                CLANS →
              </button>
            </div>
          ) : (
            <p className="mt-2 text-sm text-white/40">Not in a clan.</p>
          )}
        </section>
      </div>

      <DirectChat me={me} b={b} status={status} inputRef={chat} live={live} />
    </div>
  )
}

/** Their Bakugan, furthest evolved first. */
function Collection({ b }: { b: BrawlerView }) {
  const [all, setAll] = useState(false)
  const list = all ? b.collection : b.collection.slice(0, 8)
  return (
    <section className="mt-8">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xs tracking-[0.5em] text-white/40">COLLECTION · {b.collection.length} BAKUGAN</h3>
        {b.collection.length > 8 && (
          <button onClick={() => setAll(!all)} className="text-xs text-white/45 hover:text-white">
            {all ? 'Show fewer' : `Show all ${b.collection.length}`}
          </button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2">
        {list.map((c) => {
          const bakugan = BAKUGAN.find((x) => x.id === c.id)
          if (!bakugan) return null
          const bel = ELEMENT_BY_ID[bakugan.element]
          const forms = bakugan.evolutions.length
          return (
            <div key={c.id} className="rounded-lg border bg-black/40 p-3" style={{ borderColor: `${bel.color}55` }}>
              <div className="flex items-center gap-2">
                <img src={bel.icon} alt="" className="h-7 w-7" />
                <div className="min-w-0">
                  <p className="font-display truncate text-sm font-bold">{bakugan.evolutions[c.form]?.name ?? bakugan.name}</p>
                  <p className="text-[11px] text-white/45">
                    {bel.name} · {formBrawlG({ bakugan, form: c.form })}G
                  </p>
                </div>
              </div>
              {forms > 1 && (
                <div className="mt-2 flex gap-1" title={`Form ${c.form + 1} of ${forms}`}>
                  {bakugan.evolutions.map((e, i) => (
                    <span
                      key={`${e.name}-${i}`}
                      className="h-1.5 flex-1 rounded-full"
                      style={{ background: i <= c.form ? bel.color : 'rgba(255,255,255,0.12)' }}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** "14:05" for today's messages, "16 Oct 14:05" for older ones. */
function stamp(at: number, now: number) {
  const d = new Date(at)
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return d.toDateString() === new Date(now).toDateString()
    ? time
    : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${time}`
}

/** Invite notes in the thread, coloured by what happened. */
const NOTE_TONE: Record<InviteNote['event'], string> = {
  sent: 'text-amber-200/90 border-amber-300/25',
  accepted: 'text-emerald-300/90 border-emerald-300/25',
  declined: 'text-red-300/80 border-red-300/20',
  missed: 'text-white/55 border-white/15',
  cancelled: 'text-white/45 border-white/10',
}

function DirectChat({
  me,
  b,
  status,
  live,
  inputRef,
}: {
  me: Profile
  b: BrawlerView
  status: 'none' | 'pending' | 'friend'
  live: Status
  inputRef: React.RefObject<HTMLInputElement | null>
}) {
  const key = threadKey(me.id, b.id)
  const messages = useFriendChat((s) => s.threads[key])
  const typing = useFriendChat((s) => s.typing[key])
  const seen = useFriendChat((s) => seenBy(s, me.id, b.id))
  const { send, markRead } = useFriendChat.getState()
  const now = useMinute()
  const [text, setText] = useState('')
  const log = useRef<HTMLDivElement>(null)
  const el = ELEMENT_BY_ID[b.element]
  const list = messages ?? []
  // Delivered / Seen goes under the player's newest message
  const lastOwn = list.findLast((m) => m.author === me.id && !m.invite)?.id
  const away = b.cpu && live.state !== 'online'

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight })
    markRead(me.id, b.id)
  }, [list.length, typing, me.id, b.id, markRead])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || status !== 'friend') return
    send(me.id, b.id, text.trim())
    setText('')
  }

  return (
    <section className="flex h-[40rem] flex-col rounded-xl border border-white/10 bg-black/40 xl:sticky xl:top-0">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
        <span className="relative">
          <Avatar avatar={b.avatar} color={el.color} size={34} />
          {status === 'friend' && <PresenceDot state={typing ? 'online' : live.state} size={11} />}
        </span>
        <div className="min-w-0">
          <p className="font-display truncate text-xs tracking-[0.3em] text-white/60">MESSAGES · {b.firstName.toUpperCase()}</p>
          <p className="flex min-w-0 text-[11px]" data-testid="dm-status">
            {typing ? (
              <span className="animate-pulse text-emerald-300">typing…</span>
            ) : (
              <>
                <PresenceLabel status={live} />
                {status === 'friend' && away && (
                  <span className="ml-1 shrink-0 text-white/35">
                    · {live.state === 'match' ? 'answers after the match' : 'answers when back online'}
                  </span>
                )}
              </>
            )}
          </p>
        </div>
      </header>
      <div ref={log} className="flex-1 space-y-3 overflow-y-auto p-4" data-testid="dm-log">
        {list.length === 0 && (
          <p className="text-sm text-white/40">
            {status === 'friend'
              ? `No messages yet. Say hi to ${b.firstName}!`
              : status === 'pending'
                ? `Waiting for ${b.firstName} to accept your request.`
                : `Add ${b.firstName} as a friend to send messages.`}
          </p>
        )}
        {list.map((m) => {
          if (m.invite)
            return (
              <div key={m.id} className="flex justify-center" data-testid="dm-note">
                <p
                  className={`rounded-full border bg-white/[0.03] px-3 py-1 text-center text-[11px] ${NOTE_TONE[m.invite.event]}`}
                >
                  {noteText(m.invite, me.id, b.firstName)}
                  <span className="ml-1.5 text-white/30">{stamp(m.at, now)}</span>
                </p>
              </div>
            )
          const own = m.author === me.id
          return (
            <div key={m.id} className={`flex items-end gap-2 ${own ? 'flex-row-reverse' : ''}`}>
              <Avatar avatar={own ? me.avatar : b.avatar} color={own ? ELEMENT_BY_ID[me.element].color : el.color} size={26} />
              <div className={`max-w-[78%] rounded-xl px-3 py-2 ${own ? 'bg-white/15' : 'bg-white/5'}`}>
                <p className="text-sm break-words whitespace-pre-wrap">{m.text}</p>
                <p className="mt-0.5 text-[10px] text-white/35">
                  {stamp(m.at, now)}
                  {m.id === lastOwn && (
                    <span className={`ml-1.5 ${seen >= m.at ? 'text-sky-300/80' : ''}`} data-testid="dm-receipt">
                      {seen >= m.at ? '✓✓ Seen' : '✓ Delivered'}
                    </span>
                  )}
                </p>
              </div>
            </div>
          )
        })}
        {typing && <p className="animate-pulse text-xs text-white/40">{b.firstName} is typing…</p>}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-3">
        <input
          ref={inputRef}
          data-testid="dm-input"
          value={text}
          maxLength={400}
          disabled={status !== 'friend'}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            status !== 'friend' ? 'Friends only' : away ? `Leave ${b.firstName} a message…` : `Message ${b.firstName}…`
          }
          className="flex-1 rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/50 disabled:opacity-50"
        />
        <button
          disabled={status !== 'friend'}
          className="font-display rounded-md border border-white/40 px-4 text-xs tracking-[0.3em] enabled:hover:bg-white/10 disabled:opacity-40"
        >
          SEND
        </button>
      </form>
    </section>
  )
}

/** "14:05", or "16 Oct 14:05" when not today. */
const clockTime = (at: number) => stamp(at, Date.now())

/** Do not disturb: friends' battle invites on, or muted for a while (they then only leave a note in the messages). */
function DndControl({ me }: { me: Profile }) {
  const dnd = useInvites((s) => s.dnd)
  const setDnd = useInvites((s) => s.setDnd)
  const now = useMinute()
  const [open, setOpen] = useState(false)
  const until = dndUntil(dnd, me.id, now)
  return (
    <div
      className="rounded-xl border bg-black/40 px-4 py-3"
      style={{ borderColor: until ? '#ffb64888' : 'rgba(255,255,255,0.1)' }}
      data-testid="dnd"
    >
      <p className="font-display text-[10px] tracking-[0.4em] text-white/40">BATTLE INVITES</p>
      {until ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <span className="text-sm text-amber-200">
            🔕 Do not disturb {until === FOREVER ? 'until you turn it off' : `until ${clockTime(until)}`}
          </span>
          <button
            onClick={() => setDnd(me.id, 0)}
            className="font-display rounded border border-amber-300/60 px-3 py-1 text-[10px] tracking-[0.25em] text-amber-200 transition hover:bg-amber-300/15"
          >
            TURN OFF
          </button>
        </div>
      ) : (
        <div className="mt-1.5 flex flex-wrap items-center gap-3">
          <span className="text-sm text-emerald-300">🔔 On: online friends can invite you</span>
          <button
            onClick={() => setOpen(!open)}
            className="font-display rounded border border-white/25 px-3 py-1 text-[10px] tracking-[0.25em] text-white/70 transition hover:border-white/60 hover:bg-white/10 hover:text-white"
          >
            🔕 DO NOT DISTURB
          </button>
        </div>
      )}
      {open && !until && (
        <div className="mt-2 flex flex-wrap gap-2">
          {MUTE_OPTIONS.map(([label, ms]) => (
            <button
              key={label}
              onClick={() => {
                setDnd(me.id, muteUntil(ms))
                setOpen(false)
              }}
              className="font-display rounded border border-white/20 px-3 py-1.5 text-[10px] tracking-[0.2em] transition hover:border-white/60 hover:bg-white/10"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
