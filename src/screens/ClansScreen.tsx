import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { playSfx } from '../audio/sfx'
import { Avatar } from '../components/Avatar'
import { ClanEmblem } from '../components/ClanEmblem'
import { GRID, GRID_SIZE } from '../components/grid'
import { PageNav } from '../components/PageNav'
import { ELEMENT_BY_ID, ELEMENTS, type ElementId } from '../data/elements'
import { isBot } from '../profile/bots'
import { useMinute } from '../profile/botProgress'
import { brawlerOf, clanMembers, TIER_COLORS, type BrawlerView } from '../profile/brawlers'
import { clanOf, freeBots, MAX_MEMBERS, useClanLife, useClans, type Clan } from '../profile/useClans'
import { friendStatus, tierOf, useActiveProfile, useProfiles, type Profile } from '../profile/useProfiles'
import { BrawlerProfileModal, FriendsList } from './BrawlerProfile'

export function ClansScreen() {
  const profile = useActiveProfile()
  const clans = useClans((s) => s.clans)
  const mine = clanOf(clans, profile?.id)
  const [view, setView] = useState<'mine' | 'browse'>('mine')
  const [openId, setOpenId] = useState<string | null>(null)
  // CPU brawlers keep joining, leaving and brawling while the page is open
  useClanLife()
  const now = useMinute()
  const requests = mine && mine.leaderId === profile?.id ? (mine.requests?.length ?? 0) : 0

  return (
    <motion.div
      className="absolute inset-0 overflow-y-auto px-16 py-10"
      style={{ backgroundImage: GRID, backgroundSize: GRID_SIZE }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <PageNav current="clans" />
      <h1 className="font-display mt-8 text-4xl font-black tracking-wider">CLANS</h1>
      <p className="mt-1 max-w-3xl text-sm text-white/45">
        Join a clan, meet its brawlers, add friends and talk in the clan chat. CPU clans are open to everyone; you can also found
        your own: free CPU brawlers ask to join it, and you can recruit them. Online clans with players everywhere arrive with the
        online PvP update.
      </p>

      {!profile ? (
        <p className="mt-10 text-white/60">Create a player profile first.</p>
      ) : (
        <>
          {mine && (
            <div className="mt-6 flex gap-2">
              {(
                [
                  ['mine', `MY CLAN · [${mine.tag}]`],
                  ['browse', 'FIND CLANS'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => {
                    playSfx('tick')
                    setView(id)
                  }}
                  className={`font-display rounded border px-4 py-2 text-xs tracking-[0.3em] transition ${
                    view === id ? 'border-white bg-white/10 text-white' : 'border-white/15 text-white/50 hover:text-white'
                  }`}
                >
                  {label}
                  {id === 'mine' && requests > 0 && (
                    <span className="ml-2 rounded-full bg-amber-400 px-1.5 text-[10px] tracking-normal text-black">
                      {requests} {requests === 1 ? 'REQUEST' : 'REQUESTS'}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          {mine && view === 'mine' ? (
            <ClanPage clan={mine} me={profile} now={now} onOpen={setOpenId} />
          ) : (
            <div className="mt-8 grid grid-cols-[minmax(0,1fr)_400px] gap-8">
              <ClanBrowser clans={clans} me={profile} mine={mine} now={now} onOpen={setOpenId} onJoined={() => setView('mine')} />
              <aside className="space-y-6">
                {!mine && <CreateClan me={profile} />}
                <div className="rounded-xl border border-white/10 bg-black/40 p-5">
                  <FriendsList onOpen={setOpenId} />
                </div>
              </aside>
            </div>
          )}
        </>
      )}

      <BrawlerProfileModal id={openId} onClose={() => setOpenId(null)} />
    </motion.div>
  )
}

/** "14:05" for today's messages, "16 Oct 14:05" for older ones. */
function stamp(at: number) {
  const d = new Date(at)
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return d.toDateString() === new Date().toDateString()
    ? time
    : `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${time}`
}

const CpuChip = () => <span className="rounded bg-white/10 px-1.5 text-[10px] tracking-widest text-white/50">CPU</span>

/** Members in the order a clan page lists them: leader first, then by rank score. */
function sortedMembers(clan: Clan, profiles: Profile[], now: number) {
  return clanMembers(clan, profiles, now).sort(
    (a, b) => Number(b.id === clan.leaderId) - Number(a.id === clan.leaderId) || b.score - a.score,
  )
}

/** Every clan with its members, score and rank, strongest first. */
function rankedClans(clans: Clan[], profiles: Profile[], now: number) {
  return clans
    .map((clan) => {
      const members = sortedMembers(clan, profiles, now)
      return { clan, members, score: members.reduce((n, m) => n + m.score, 0) }
    })
    .sort((a, b) => b.score - a.score)
}

function MemberRow({
  m,
  clan,
  me,
  onOpen,
  onKick,
}: {
  m: BrawlerView
  clan: Clan
  me: Profile
  onOpen: (id: string) => void
  onKick?: () => void
}) {
  const el = ELEMENT_BY_ID[m.element]
  const tier = tierOf(m.score)
  const friend = friendStatus(me, m.id) === 'friend'
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => {
        playSfx('tick')
        onOpen(m.id)
      }}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(m.id)}
      className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-black/40 p-2 transition hover:border-white/40 hover:bg-white/5"
      style={m.id === me.id ? { borderColor: `${el.color}aa` } : undefined}
    >
      <Avatar avatar={m.avatar} color={el.color} size={40} frame={m.frame} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate font-semibold">
          <span className="truncate">{m.name}</span>
          {m.cpu && <CpuChip />}
          {m.id === me.id && (
            <span className="rounded px-1.5 text-[10px] tracking-widest" style={{ background: el.color }}>
              YOU
            </span>
          )}
          {friend && (
            <span title="Friend" className="text-xs text-emerald-300">
              ✓
            </span>
          )}
        </p>
        <p className="truncate text-xs text-white/50">
          {clan.leaderId === m.id ? <span className="text-amber-200">★ Leader</span> : 'Member'} ·{' '}
          <span style={{ color: TIER_COLORS[tier.index] }}>{tier.name}</span> · {m.rating} BR · {m.wins} wins
        </p>
      </div>
      {onKick && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onKick()
          }}
          className="px-1 text-xs text-white/35 hover:text-red-300"
        >
          KICK
        </button>
      )}
    </div>
  )
}

function ClanBrowser({
  clans,
  me,
  mine,
  now,
  onOpen,
  onJoined,
}: {
  clans: Clan[]
  me: Profile
  mine: Clan | null
  now: number
  onOpen: (id: string) => void
  onJoined: () => void
}) {
  const profiles = useProfiles((s) => s.profiles)
  const join = useClans((s) => s.join)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [confirm, setConfirm] = useState<string | null>(null)
  // switching away from a clan you run alone disbands it, so that asks twice
  const disbands = !!mine && !mine.cpu && mine.members.filter((id) => !isBot(id)).length === 1
  return (
    <section>
      <h2 className="font-display text-xs tracking-[0.5em] text-white/40">ALL CLANS · {clans.length}</h2>
      <div className="mt-3 space-y-3">
        {rankedClans(clans, profiles, now).map(({ clan: c, members, score }, i) => {
          const el = ELEMENT_BY_ID[c.element]
          const leader = members.find((m) => m.id === c.leaderId)
          const isMine = mine?.id === c.id
          const open = expanded === c.id
          return (
            <div
              key={c.id}
              className="rounded-xl border bg-black/40 p-4"
              style={{ borderColor: isMine ? `${el.color}aa` : 'rgba(255,255,255,0.1)' }}
            >
              <div className="flex items-center gap-4">
                <span className="font-display w-7 text-center text-lg font-black text-white/50">{i + 1}</span>
                <ClanEmblem clan={c} />
                <div className="min-w-0 flex-1">
                  <p className="font-display flex items-center gap-2 text-xl font-bold">
                    <span className="truncate">
                      <span style={{ color: el.color }}>[{c.tag}]</span> {c.name}
                    </span>
                    {c.cpu && <CpuChip />}
                  </p>
                  <p className="truncate text-sm text-white/50 italic">“{c.motto || 'No motto'}”</p>
                  <p className="mt-0.5 truncate text-xs text-white/40">
                    {members.length} members · {score.toLocaleString('en')} score
                    {leader && ` · led by ${leader.name}`}
                  </p>
                </div>
                {/* the strongest members at a glance */}
                <div className="flex -space-x-3">
                  {members.slice(0, 5).map((m) => (
                    <Avatar key={m.id} avatar={m.avatar} color={ELEMENT_BY_ID[m.element].color} size={34} />
                  ))}
                </div>
                <button
                  onClick={() => {
                    playSfx('tick')
                    setExpanded(open ? null : c.id)
                  }}
                  className="font-display rounded border border-white/20 px-3 py-2 text-[10px] tracking-[0.3em] text-white/70 hover:bg-white/10"
                >
                  MEMBERS {open ? '▴' : '▾'}
                </button>
                {isMine ? (
                  <span className="font-display w-32 text-center text-[10px] tracking-[0.3em]" style={{ color: el.color }}>
                    YOUR CLAN
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      if (mine && disbands && confirm !== c.id) return setConfirm(c.id)
                      playSfx('victory')
                      join(c.id, me.id)
                      setConfirm(null)
                      onJoined()
                    }}
                    className="font-display w-32 border-2 border-white/40 py-2 text-xs tracking-[0.3em] hover:bg-white/10"
                  >
                    {!mine ? 'JOIN' : confirm === c.id ? 'SURE?' : 'SWITCH'}
                  </button>
                )}
              </div>
              {confirm === c.id && (
                <p className="mt-2 text-right text-xs text-amber-300/80">
                  You run [{mine?.tag}] alone: switching disbands it. Press SURE? to switch.
                </p>
              )}
              {open && (
                <div className="mt-4 grid grid-cols-2 gap-2">
                  {members.map((m) => (
                    <MemberRow key={m.id} m={m} clan={c} me={me} onOpen={onOpen} />
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

function CreateClan({ me }: { me: Profile }) {
  const create = useClans((s) => s.create)
  const [name, setName] = useState('')
  const [tag, setTag] = useState('')
  const [motto, setMotto] = useState('')
  const [element, setElement] = useState<ElementId>(me.element)
  const valid = name.trim().length >= 3 && tag.trim().length >= 2
  return (
    <section className="rounded-xl border border-white/10 bg-black/40 p-6">
      <h2 className="font-display text-xs tracking-[0.5em] text-white/40">FOUND A CLAN</h2>
      <div className="mt-4 flex items-center gap-4">
        <ClanEmblem clan={{ element, tag }} size={64} />
        <p className="font-display text-xl font-bold">
          <span style={{ color: ELEMENT_BY_ID[element].color }}>[{tag.toUpperCase() || 'TAG'}]</span> {name || 'Clan name'}
        </p>
      </div>
      <input
        value={name}
        maxLength={28}
        onChange={(e) => setName(e.target.value)}
        placeholder="Clan name"
        className="mt-4 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 outline-none focus:border-white/50"
      />
      <input
        value={tag}
        maxLength={5}
        onChange={(e) => setTag(e.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())}
        placeholder="Tag (2–5 letters)"
        className="mt-3 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 outline-none focus:border-white/50"
      />
      <input
        value={motto}
        maxLength={80}
        onChange={(e) => setMotto(e.target.value)}
        placeholder="Motto"
        className="mt-3 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 outline-none focus:border-white/50"
      />
      <div className="mt-3 flex gap-2">
        {ELEMENTS.map((e) => (
          <button
            key={e.id}
            onClick={() => setElement(e.id)}
            className="rounded-md border-2 p-1"
            style={{ borderColor: element === e.id ? e.color : 'transparent' }}
            title={e.name}
          >
            <img src={e.icon} alt={e.name} className="h-8 w-8" />
          </button>
        ))}
      </div>
      <button
        disabled={!valid}
        onClick={() => {
          playSfx('victory')
          create(me.id, { name: name.trim(), tag: tag.trim(), motto: motto.trim(), element })
        }}
        className="font-display mt-5 w-full border-2 border-white/60 py-3 tracking-[0.3em] transition enabled:hover:bg-white/10 disabled:opacity-40"
      >
        FOUND CLAN
      </button>
      <p className="mt-2 text-xs text-white/40">
        Once it is founded, free CPU brawlers ask to join it, and you can recruit them yourself.
      </p>
    </section>
  )
}

function ClanPage({ clan, me, now, onOpen }: { clan: Clan; me: Profile; now: number; onOpen: (id: string) => void }) {
  const profiles = useProfiles((s) => s.profiles)
  const clans = useClans((s) => s.clans)
  const typing = useClans((s) => s.typing[clan.id])
  const { leave, kick, send, recruit, chatter, answerRequest, setOpen } = useClans.getState()
  const [text, setText] = useState('')
  const log = useRef<HTMLDivElement>(null)
  const el = ELEMENT_BY_ID[clan.element]
  const members = sortedMembers(clan, profiles, now)
  const leader = clan.leaderId === me.id
  const otherPlayers = clan.members.filter((id) => id !== me.id && !isBot(id)).length
  const ranked = rankedClans(clans, profiles, now)
  const place = ranked.findIndex((r) => r.clan.id === clan.id) + 1
  const score = ranked[place - 1]?.score ?? 0
  const full = clan.members.length >= MAX_MEMBERS
  const free = freeBots(clans).length
  const cpuMembers = clan.members.filter(isBot).length
  const requests = (clan.requests ?? [])
    .map((r) => ({ ...r, b: brawlerOf(r.id, profiles, now) }))
    .filter((r): r is typeof r & { b: BrawlerView } => !!r.b)
  const typingNames = (typing ?? []).map((id) => brawlerOf(id, profiles, now)?.firstName).filter(Boolean)

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight })
  }, [clan.messages.length, typingNames.length])

  // CPU members chat on their own now and then while the chat is open
  useEffect(() => {
    const t = window.setInterval(() => chatter(clan.id), 20_000)
    return () => clearInterval(t)
  }, [clan.id, chatter])

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    send(clan.id, me.id, text.trim())
    setText('')
  }

  return (
    <div className="mt-8">
      <header className="flex items-center gap-6">
        <ClanEmblem clan={clan} size={96} />
        <div className="min-w-0 flex-1">
          <p className="font-display flex items-center gap-2 text-xs tracking-[0.5em]" style={{ color: el.color }}>
            {el.name.toUpperCase()} CLAN · FOUNDED {new Date(clan.createdAt).toLocaleDateString('en-GB')}
            {clan.cpu && <CpuChip />}
          </p>
          <h2 className="font-display text-4xl font-black">
            [{clan.tag}] {clan.name}
          </h2>
          <p className="mt-1 text-white/60 italic">“{clan.motto || 'No motto yet'}”</p>
          <p className="mt-1 text-sm text-white/45">
            #{place} in the clan rankings · {score.toLocaleString('en')} score · {members.length}{' '}
            {members.length === 1 ? 'member' : 'members'}
          </p>
        </div>
        <button
          onClick={() => leave(me.id)}
          className="font-display border-2 border-white/25 px-5 py-2 text-xs tracking-[0.3em] text-white/70 hover:border-red-400 hover:text-red-300"
        >
          {leader && otherPlayers === 0 ? 'DISBAND' : 'LEAVE CLAN'}
        </button>
      </header>

      <div className="mt-8 grid grid-cols-[380px_minmax(0,1fr)] gap-8">
        <section>
          {!clan.cpu && leader && (
            <JoinRequests
              clan={clan}
              requests={requests}
              full={full}
              onAnswer={(id, yes) => {
                if (answerRequest(clan.id, id, yes) && yes) playSfx('select')
              }}
              onOpenChange={(open) => {
                playSfx('tick')
                setOpen(clan.id, open)
              }}
              onOpen={onOpen}
            />
          )}
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-xs tracking-[0.4em] whitespace-nowrap text-white/40">
              MEMBERS · {members.length}
              {!clan.cpu && <span className="text-white/25"> / {MAX_MEMBERS}</span>}
            </h3>
            {leader && !clan.cpu && (
              <button
                disabled={free === 0 || full}
                onClick={() => recruit(clan.id) && playSfx('select')}
                title={
                  full ? 'Your clan is full' : free ? 'Adds a free CPU brawler to your clan' : 'No CPU brawler is free right now'
                }
                className="font-display rounded border border-white/30 px-3 py-1 text-[10px] tracking-[0.3em] whitespace-nowrap transition enabled:hover:bg-white/10 disabled:opacity-40"
              >
                + RECRUIT CPU
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-white/35">Click a member to see their profile and add them as a friend.</p>
          <div className="mt-3 max-h-[30rem] space-y-2 overflow-y-auto pr-1">
            {members.map((m) => (
              <MemberRow
                key={m.id}
                m={m}
                clan={clan}
                me={me}
                onOpen={onOpen}
                onKick={leader && m.id !== me.id ? () => kick(clan.id, m.id) : undefined}
              />
            ))}
          </div>
          <div className="mt-8">
            <FriendsList onOpen={onOpen} />
          </div>
        </section>

        <section className="flex h-[36rem] flex-col rounded-xl border border-white/10 bg-black/40">
          <h3 className="font-display border-b border-white/10 px-4 py-3 text-xs tracking-[0.5em] text-white/40">CLAN CHAT</h3>
          <div ref={log} className="flex-1 space-y-3 overflow-y-auto p-4">
            {clan.messages.length === 0 && <p className="text-sm text-white/40">No messages yet. Say hi to your clan!</p>}
            {clan.messages.map((msg) => {
              if (msg.system)
                return (
                  <p key={msg.id} className="text-center text-[11px] text-white/40">
                    <span className="rounded-full bg-white/5 px-3 py-1">
                      {msg.text} · {stamp(msg.at)}
                    </span>
                  </p>
                )
              const author = brawlerOf(msg.author, profiles, now)
              const own = msg.author === me.id
              return (
                <div key={msg.id} className={`flex items-end gap-2 ${own ? 'flex-row-reverse' : ''}`}>
                  {author && (
                    <button onClick={() => onOpen(author.id)} className="shrink-0" title={author.name}>
                      <Avatar avatar={author.avatar} color={ELEMENT_BY_ID[author.element].color} size={28} />
                    </button>
                  )}
                  <div className={`max-w-[70%] rounded-xl px-3 py-2 ${own ? 'bg-white/15' : 'bg-white/5'}`}>
                    <p className="text-[10px] text-white/45">
                      {author ? (
                        <button onClick={() => onOpen(author.id)} className="hover:text-white hover:underline">
                          {author.firstName}
                        </button>
                      ) : (
                        'Former member'
                      )}
                      {msg.author === clan.leaderId && <span className="text-amber-200/80"> ★</span>} · {stamp(msg.at)}
                    </p>
                    <p className="text-sm break-words whitespace-pre-wrap">{msg.text}</p>
                  </div>
                </div>
              )
            })}
            {typingNames.length > 0 && (
              <p className="animate-pulse text-xs text-white/40">
                {typingNames.join(' and ')} {typingNames.length > 1 ? 'are' : 'is'} typing…
              </p>
            )}
            {cpuMembers === 0 && (
              <p className="text-center text-xs text-white/40">
                Nobody else is in [{clan.tag}] yet, so nobody can answer. CPU brawlers will ask to join soon
                {leader && free > 0 && ' — or recruit one now'}.
              </p>
            )}
          </div>
          <form onSubmit={submit} className="flex gap-2 border-t border-white/10 p-3">
            <input
              value={text}
              maxLength={400}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Message as ${me.firstName}…`}
              className="flex-1 rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/50"
            />
            <button className="font-display rounded-md border border-white/40 px-4 text-xs tracking-[0.3em] hover:bg-white/10">
              SEND
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}

/** The leader's box for CPU brawlers asking to join, and whether the clan takes them in without asking. */
function JoinRequests({
  clan,
  requests,
  full,
  onAnswer,
  onOpenChange,
  onOpen,
}: {
  clan: Clan
  requests: { id: string; at: number; b: BrawlerView }[]
  full: boolean
  onAnswer: (id: string, yes: boolean) => void
  onOpenChange: (open: boolean) => void
  onOpen: (id: string) => void
}) {
  return (
    <div className="mb-6 rounded-xl border border-white/10 bg-black/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-xs tracking-[0.3em] whitespace-nowrap text-white/40">
          JOIN REQUESTS · {requests.length}
        </h3>
        <div className="flex rounded-full border border-white/15 p-0.5 text-[10px]">
          {(
            [
              [false, 'ASK FIRST'],
              [true, 'OPEN'],
            ] as const
          ).map(([open, label]) => (
            <button
              key={label}
              onClick={() => !!clan.open !== open && onOpenChange(open)}
              className={`font-display rounded-full px-2.5 py-1 tracking-[0.15em] whitespace-nowrap transition ${
                !!clan.open === open ? 'bg-white/15 text-white' : 'text-white/45 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-1 text-xs text-white/35">
        {clan.open
          ? 'Open clan: free CPU brawlers join right away.'
          : 'Free CPU brawlers ask to join now and then. Requests stay for a day.'}
        {full && ' Your clan is full.'}
      </p>
      {requests.length === 0 ? (
        !clan.open && <p className="mt-3 text-sm text-white/40">No requests right now.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {requests.map(({ id, at, b }) => {
            const tier = tierOf(b.score)
            return (
              <div key={id} className="flex items-center gap-3 rounded-lg border border-amber-300/30 bg-amber-300/5 p-2">
                <button onClick={() => onOpen(id)} title={`${b.name}'s profile`}>
                  <Avatar avatar={b.avatar} color={ELEMENT_BY_ID[b.element].color} size={36} />
                </button>
                <div className="min-w-0 flex-1" title={`Asked ${stamp(at)}`}>
                  <p className="truncate text-sm font-semibold">{b.name}</p>
                  <p className="truncate text-[11px] text-white/45">
                    <span style={{ color: TIER_COLORS[tier.index] }}>{tier.name}</span> · {b.rating} BR
                  </p>
                </div>
                <button
                  disabled={full}
                  onClick={() => onAnswer(id, true)}
                  className="font-display rounded border border-emerald-400/60 px-2 py-1 text-[10px] tracking-[0.2em] text-emerald-300 transition enabled:hover:bg-emerald-400/10 disabled:opacity-40"
                >
                  ACCEPT
                </button>
                <button
                  onClick={() => onAnswer(id, false)}
                  className="font-display rounded border border-white/20 px-2 py-1 text-[10px] tracking-[0.2em] text-white/50 transition hover:text-red-300"
                >
                  DECLINE
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
