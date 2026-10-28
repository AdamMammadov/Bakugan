import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { playSfx } from '../audio/sfx'
import { Avatar } from '../components/Avatar'
import { ClanEmblem } from '../components/ClanEmblem'
import { GRID, GRID_SIZE } from '../components/grid'
import { PageNav } from '../components/PageNav'
import { PresenceDot } from '../components/PresenceBadge'
import { RewardIcon } from '../components/RewardIcon'
import { ELEMENT_BY_ID, ELEMENTS, type ElementId } from '../data/elements'
import { isBot } from '../profile/bots'
import { useMinute } from '../profile/botProgress'
import { brawlerOf, clanMembers, rankColor, type BrawlerView } from '../profile/brawlers'
import {
  ALL_GOALS_REWARD,
  clanFeed,
  clanLevel,
  clanTally,
  myTally,
  PERK_BOOST,
  PERKS,
  SHAPES,
  timeLeft,
  useClanProgress,
  warReward,
  warStandings,
  weekEnd,
  weekId,
  weeklyGoals,
  weekStart,
  type Goal,
  type WarRow,
} from '../profile/clanProgress'
import { botTally, CLAN_XP, joinedAt } from '../profile/clanStats'
import { isAvailable, statusOf, type PresenceState } from '../profile/presence'
import { clanOf, freeBots, MAX_MEMBERS, roleOf, useClanLife, useClans, type Clan, type ClanRole } from '../profile/useClans'
import { rewardLabel, type Reward } from '../season/season'
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
  const requests = mine && roleOf(mine, profile?.id ?? '') !== 'member' ? (mine.requests?.length ?? 0) : 0
  const inClan = !!profile && !!mine && view === 'mine'

  return (
    <motion.div
      // the clan page fills the screen and its panels scroll inside (ending above the corner buttons); finding clans
      // scrolls the page
      className={`absolute inset-0 flex flex-col overflow-y-auto px-16 ${inClan ? 'pt-6 pb-[4.5rem]' : 'py-10'}`}
      style={{ backgroundImage: GRID, backgroundSize: GRID_SIZE }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <PageNav current="clans" />
      {!inClan && (
        <div className="shrink-0">
          <h1 className="font-display mt-8 text-4xl font-black tracking-wider">CLANS</h1>
          <p className="mt-1 max-w-3xl text-sm text-white/45">
            Join a clan, meet its brawlers, add friends and talk in the clan chat. CPU clans are open to everyone; you can also
            found your own: free CPU brawlers ask to join it, and you can recruit them. Online clans with players everywhere
            arrive with the online PvP update.
          </p>
        </div>
      )}

      {!profile ? (
        <p className="mt-10 text-white/60">Create a player profile first.</p>
      ) : inClan ? (
        <ClanPage clan={mine} me={profile} now={now} onOpen={setOpenId} onBrowse={() => setView('browse')} requests={requests} />
      ) : (
        <div className="shrink-0">
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
          <div className="mt-8 grid grid-cols-[minmax(0,1fr)_400px] gap-8">
            <ClanBrowser clans={clans} me={profile} mine={mine} now={now} onOpen={setOpenId} onJoined={() => setView('mine')} />
            <aside className="space-y-6">
              {!mine && <CreateClan me={profile} />}
              <div className="rounded-xl border border-white/10 bg-black/40 p-5">
                <FriendsList onOpen={setOpenId} />
              </div>
            </aside>
          </div>
        </div>
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

const ROLE_TEXT: Record<ClanRole, React.ReactNode> = {
  leader: <span className="text-amber-200">★ Leader</span>,
  officer: <span className="text-sky-300">◆ Officer</span>,
  member: 'Member',
}

function MemberRow({
  m,
  clan,
  me,
  onOpen,
  week,
  presence,
  children,
}: {
  m: BrawlerView
  clan: Clan
  me: Profile
  onOpen: (id: string) => void
  /** Wins this week, when shown. */
  week?: number
  /** Online, in a match or offline, when shown. */
  presence?: PresenceState
  /** Role buttons. */
  children?: React.ReactNode
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
      <span className="relative shrink-0">
        <Avatar avatar={m.avatar} color={el.color} size={40} frame={m.frame} />
        {presence && <PresenceDot state={presence} size={11} />}
      </span>
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
          {ROLE_TEXT[roleOf(clan, m.id)]} · <span style={{ color: rankColor(tier) }}>{tier.rank}</span> · {m.rating} BR
          {week !== undefined ? ` · ${week} ${week === 1 ? 'win' : 'wins'} this week` : ` · ${m.wins} wins`}
        </p>
      </div>
      {children && (
        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
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

type Tab = 'overview' | 'members' | 'war' | 'goals' | 'activity'

/** Panels on the clan page: opaque enough to read over any page backdrop. */
const PANEL = 'rounded-xl border border-white/10 bg-[#0b0c12]/90 backdrop-blur'

const rewardText = (rewards: Reward[]) => rewards.map((r) => rewardLabel(r)).join(' + ')

/** "5 min ago", "3 h ago". */
function ago(ms: number) {
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.floor(min / 60)
  return h < 24 ? `${h} h ago` : `${Math.floor(h / 24)} d ago`
}

function ClanPage({
  clan,
  me,
  now,
  onOpen,
  onBrowse,
  requests,
}: {
  clan: Clan
  me: Profile
  now: number
  onOpen: (id: string) => void
  onBrowse: () => void
  requests: number
}) {
  const profiles = useProfiles((s) => s.profiles)
  const clans = useClans((s) => s.clans)
  const log = useClanProgress((s) => s.log)
  const claimed = useClanProgress((s) => s.claimed[me.id])
  const [tab, setTab] = useState<Tab>('overview')
  const members = useMemo(() => sortedMembers(clan, profiles, now), [clan, profiles, now])
  const level = useMemo(() => clanLevel(clan, now), [clan, now])
  const place = useMemo(
    () => rankedClans(clans, profiles, now).findIndex((r) => r.clan.id === clan.id) + 1,
    [clans, profiles, now, clan.id],
  )
  const war = useMemo(() => warStandings(clans, weekStart(now), now, log), [clans, now, log])
  const goals = useMemo(() => weeklyGoals(clan, me.id, now, log), [clan, me.id, now, log])
  // who can talk now: the player and CPU members online and not in a brawl (only they answer in the chat)
  const presence = new Map<string, PresenceState>(
    members.map((m) => [m.id, m.id === me.id ? 'online' : m.cpu ? statusOf(m.id, now).state : 'offline']),
  )
  const online = new Set(members.filter((m) => presence.get(m.id) === 'online').map((m) => m.id))
  const inMatch = members.filter((m) => presence.get(m.id) === 'match').length
  const week = weekId(weekStart(now))
  const has = (key: string) => !!claimed?.includes(`${week}:${key}`)
  const toClaim =
    goals.filter((g) => g.progress >= g.target && !has(g.id)).length +
    Number(goals.every((g) => g.progress >= g.target) && !has('all')) +
    Number(level.level >= 7 && !has('perk'))
  const tabs: [Tab, string, number?][] = [
    ['overview', 'OVERVIEW'],
    ['members', `MEMBERS · ${members.length}`, requests],
    ['war', 'CLAN WAR'],
    ['goals', 'WEEKLY GOALS', toClaim],
    ['activity', 'ACTIVITY'],
  ]

  return (
    <div className="mt-5 flex min-h-[540px] flex-1 flex-col gap-4">
      <ClanHeader
        clan={clan}
        me={me}
        level={level}
        place={place}
        warPlace={war.findIndex((r) => r.clan.id === clan.id) + 1}
        online={online.size}
        members={members.length}
        onBrowse={onBrowse}
      />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(340px,440px)] gap-5">
        <section className={`flex min-h-0 flex-col overflow-hidden ${PANEL}`}>
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 px-3 pt-3" role="tablist">
            {tabs.map(([id, label, badge]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => {
                  playSfx('tick')
                  setTab(id)
                }}
                className={`font-display -mb-px shrink-0 rounded-t-md border-b-2 px-3 py-2 text-[11px] tracking-[0.25em] whitespace-nowrap transition ${
                  tab === id
                    ? 'border-white bg-white/10 text-white'
                    : 'border-transparent text-white/45 hover:bg-white/5 hover:text-white'
                }`}
              >
                {label}
                {!!badge && (
                  <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 text-[10px] tracking-normal text-black">{badge}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="min-h-0 flex-1 overflow-y-auto p-5" data-testid="clan-tab">
            {tab === 'overview' && (
              <Overview clan={clan} me={me} now={now} level={level} members={members} war={war} goals={goals} onOpen={onOpen} />
            )}
            {tab === 'members' && <Members clan={clan} me={me} now={now} members={members} presence={presence} onOpen={onOpen} />}
            {tab === 'war' && <War clan={clan} me={me} now={now} war={war} />}
            {tab === 'goals' && <Goals clan={clan} me={me} level={level.level} goals={goals} has={has} week={week} />}
            {tab === 'activity' && <Activity clan={clan} me={me} now={now} onOpen={onOpen} />}
          </div>
        </section>
        <ClanChat clan={clan} me={me} now={now} online={online.size} inMatch={inMatch} onOpen={onOpen} />
      </div>
    </div>
  )
}

function ClanHeader({
  clan,
  me,
  level,
  place,
  warPlace,
  online,
  members,
  onBrowse,
}: {
  clan: Clan
  me: Profile
  level: ReturnType<typeof clanLevel>
  place: number
  warPlace: number
  online: number
  members: number
  onBrowse: () => void
}) {
  const leave = useClans((s) => s.leave)
  const [sure, setSure] = useState(false)
  const el = ELEMENT_BY_ID[clan.element]
  const color = clan.emblem?.color ?? el.color
  const alone = clan.leaderId === me.id && clan.members.filter((id) => id !== me.id && !isBot(id)).length === 0
  const stat = (label: string, value: React.ReactNode, title?: string) => (
    <div className="text-center" title={title}>
      <p className="font-display text-xl leading-none font-black">{value}</p>
      <p className="font-display mt-1 text-[9px] tracking-[0.3em] text-white/40">{label}</p>
    </div>
  )
  return (
    <header
      className={`flex shrink-0 items-center gap-5 px-5 py-4 ${PANEL}`}
      style={{ borderColor: `${color}55`, backgroundImage: `radial-gradient(circle at 0% 50%, ${color}26, transparent 45%)` }}
      data-testid="clan-header"
    >
      <ClanEmblem clan={clan} size={76} />
      <div className="min-w-0 flex-1">
        <p className="font-display flex items-center gap-2 text-[10px] tracking-[0.4em]" style={{ color }}>
          {el.name.toUpperCase()} CLAN · FOUNDED {new Date(clan.createdAt).toLocaleDateString('en-GB')}
          {clan.cpu && <CpuChip />}
        </p>
        <h2 className="font-display truncate text-3xl font-black">
          [{clan.tag}] {clan.name}
        </h2>
        <p className="truncate text-sm text-white/55 italic">“{clan.motto || 'No motto yet'}”</p>
      </div>
      <div
        className="w-52 shrink-0"
        title={`${level.into.toLocaleString('en')} / ${level.need.toLocaleString('en')} XP to level ${level.level + 1}`}
      >
        <p className="font-display flex items-baseline justify-between text-xs tracking-[0.3em] text-white/60">
          CLAN LEVEL <span className="text-2xl font-black tracking-normal text-white">{level.level}</span>
        </p>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full" style={{ width: `${(level.into / level.need) * 100}%`, background: color }} />
        </div>
        <p className="mt-1 text-[10px] text-white/40">
          {level.into.toLocaleString('en')} / {level.need.toLocaleString('en')} XP
        </p>
      </div>
      <div className="flex shrink-0 gap-5 border-l border-white/10 pl-5">
        {stat('RANK', `#${place}`, 'Place in the clan rankings (members’ rank scores)')}
        {stat('WAR', `#${warPlace}`, 'Place in this week’s clan war')}
        {stat(
          'ONLINE',
          <span>
            <span className="text-emerald-300">{online}</span>
            <span className="text-sm text-white/40">/{members}</span>
          </span>,
          'Members online now',
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-2">
        <button
          onClick={onBrowse}
          className="font-display rounded border border-white/25 px-3 py-1.5 text-[10px] tracking-[0.3em] text-white/70 transition hover:border-white/60 hover:bg-white/10 hover:text-white"
        >
          FIND CLANS
        </button>
        <button
          onClick={() => (sure ? leave(me.id) : setSure(true))}
          onMouseLeave={() => setSure(false)}
          className="font-display rounded border border-white/15 px-3 py-1.5 text-[10px] tracking-[0.3em] text-white/50 transition hover:border-red-400 hover:text-red-300"
        >
          {sure ? 'SURE?' : alone ? 'DISBAND' : 'LEAVE CLAN'}
        </button>
      </div>
    </header>
  )
}

const H = ({ children }: { children: React.ReactNode }) => (
  <h3 className="font-display text-[11px] tracking-[0.4em] text-white/40">{children}</h3>
)

function Overview({
  clan,
  me,
  now,
  level,
  members,
  war,
  goals,
  onOpen,
}: {
  clan: Clan
  me: Profile
  now: number
  level: ReturnType<typeof clanLevel>
  members: BrawlerView[]
  war: WarRow[]
  goals: Goal[]
  onOpen: (id: string) => void
}) {
  const log = useClanProgress((s) => s.log)
  const from = weekStart(now)
  const tally = clanTally(clan, from, now, log)
  const mine = war.find((r) => r.clan.id === clan.id)
  const top = members
    .map((m) => ({
      m,
      wins: (isBot(m.id) ? botTally(m.id, Math.max(from, joinedAt(clan, m.id)), now) : myTally(clan, m.id, from, now, log)).wins,
    }))
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 5)
  const next = PERKS.find((p) => p.level > level.level)
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-white/10 bg-black/30 p-4">
          <H>THIS WEEK · ENDS IN {timeLeft(weekEnd(now) - now).toUpperCase()}</H>
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            {[
              ['WINS', tally.wins],
              ['KOs', tally.kos],
              ['WAR POINTS', mine?.points ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md bg-white/5 py-2">
                <p className="font-display text-xl font-black">{Number(value).toLocaleString('en')}</p>
                <p className="font-display text-[9px] tracking-[0.3em] text-white/40">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-white/60">
            Goals done: <b className="text-white">{goals.filter((g) => g.progress >= g.target).length}</b> / {goals.length} · War:
            #{war.findIndex((r) => r.clan.id === clan.id) + 1} of {war.length}
          </p>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 p-4">
          <H>TOP BRAWLERS THIS WEEK</H>
          <div className="mt-2 space-y-1">
            {top.map(({ m, wins }, i) => (
              <button
                key={m.id}
                onClick={() => onOpen(m.id)}
                className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition hover:bg-white/5"
              >
                <span className="font-display w-4 text-xs text-white/40">{i + 1}</span>
                <Avatar avatar={m.avatar} color={ELEMENT_BY_ID[m.element].color} size={26} />
                <span className="min-w-0 flex-1 truncate text-sm">{m.id === me.id ? 'You' : m.name}</span>
                <span className="text-xs text-white/55">{wins} wins</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <H>CLAN PERKS · LEVEL {level.level}</H>
        <p className="mt-1 text-xs text-white/40">
          Members’ brawls earn clan XP: {CLAN_XP.win} per win, {CLAN_XP.loss} per loss, {CLAN_XP.ko} per KO.
          {next && ` Next perk at level ${next.level}.`}
        </p>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {PERKS.map((p) => {
            const on = level.level >= p.level
            return (
              <div
                key={p.name}
                className={`flex items-center gap-3 rounded-lg border p-3 ${on ? 'border-emerald-400/40 bg-emerald-400/5' : 'border-white/10 bg-black/30 opacity-60'}`}
              >
                <span className="font-display w-12 shrink-0 text-center text-[10px] tracking-[0.2em] text-white/50">
                  LV {p.level}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-white/50">{p.text}</p>
                </div>
                <span className={on ? 'text-emerald-300' : 'text-white/40'}>{on ? '✓' : '🔒'}</span>
              </div>
            )
          })}
        </div>
      </div>

      {!clan.cpu && clan.leaderId === me.id && <Customise clan={clan} level={level.level} />}
    </div>
  )
}

const COLOURS = ['#ff4d4d', '#ffb648', '#f5c518', '#3ee07a', '#4dc3ff', '#b36bff', '#ff6bd5', '#e8e8f0']

/** The leader changes the clan badge (shapes unlock with clan level) and the motto. */
function Customise({ clan, level }: { clan: Clan; level: number }) {
  const customise = useClans((s) => s.customise)
  const [motto, setMotto] = useState(clan.motto)
  const shape = clan.emblem?.shape ?? 'hex'
  const color = clan.emblem?.color
  return (
    <div data-testid="customise">
      <H>CUSTOMISE THE CLAN</H>
      <div className="mt-3 flex flex-wrap items-center gap-6">
        <ClanEmblem clan={clan} size={64} />
        <div>
          <p className="text-[10px] tracking-[0.3em] text-white/40">SHAPE</p>
          <div className="mt-1 flex gap-1.5">
            {SHAPES.map(([s, need]) => (
              <button
                key={s}
                disabled={level < need}
                title={level < need ? `Unlocks at clan level ${need}` : s}
                onClick={() => customise(clan.id, { emblem: { ...clan.emblem, shape: s } })}
                className={`relative rounded-md border-2 p-1 transition enabled:hover:border-white/60 disabled:opacity-35 ${shape === s ? 'border-white' : 'border-transparent'}`}
              >
                <ClanEmblem clan={{ ...clan, emblem: { ...clan.emblem, shape: s } }} size={30} />
                {level < need && <span className="absolute -right-1 -bottom-1 text-[10px]">🔒</span>}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-[10px] tracking-[0.3em] text-white/40">COLOUR</p>
          <div className="mt-1 flex gap-1.5">
            <button
              title="Attribute colour"
              onClick={() => customise(clan.id, { emblem: { ...clan.emblem, color: undefined } })}
              className={`h-7 w-7 rounded-full border-2 transition hover:scale-110 ${!color ? 'border-white' : 'border-white/20'}`}
              style={{ background: ELEMENT_BY_ID[clan.element].color }}
            />
            {COLOURS.map((c) => (
              <button
                key={c}
                onClick={() => customise(clan.id, { emblem: { ...clan.emblem, color: c } })}
                className={`h-7 w-7 rounded-full border-2 transition hover:scale-110 ${color === c ? 'border-white' : 'border-white/20'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
      </div>
      <form
        className="mt-3 flex max-w-xl gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          customise(clan.id, { motto: motto.trim() })
          playSfx('select')
        }}
      >
        <input
          value={motto}
          maxLength={80}
          onChange={(e) => setMotto(e.target.value)}
          placeholder="Clan motto"
          className="flex-1 rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/50"
        />
        <button
          disabled={motto.trim() === clan.motto}
          className="font-display rounded-md border border-white/40 px-4 text-[10px] tracking-[0.3em] transition enabled:hover:bg-white/10 disabled:opacity-40"
        >
          SAVE MOTTO
        </button>
      </form>
    </div>
  )
}

function Members({
  clan,
  me,
  now,
  members,
  presence,
  onOpen,
}: {
  clan: Clan
  me: Profile
  now: number
  members: BrawlerView[]
  presence: Map<string, PresenceState>
  onOpen: (id: string) => void
}) {
  const profiles = useProfiles((s) => s.profiles)
  const clans = useClans((s) => s.clans)
  const log = useClanProgress((s) => s.log)
  const { kick, recruit, answerRequest, setOpen, setRole } = useClans.getState()
  const role = roleOf(clan, me.id)
  const manage = !clan.cpu && role !== 'member'
  const full = clan.members.length >= MAX_MEMBERS
  const free = freeBots(clans).length
  const from = weekStart(now)
  const requests = (clan.requests ?? [])
    .map((r) => ({ ...r, b: brawlerOf(r.id, profiles, now) }))
    .filter((r): r is typeof r & { b: BrawlerView } => !!r.b)
  const small = 'font-display rounded border px-2 py-1 text-[9px] tracking-[0.2em] transition'
  return (
    <div>
      {manage && (
        <JoinRequests
          clan={clan}
          requests={requests}
          full={full}
          leader={role === 'leader'}
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
        <H>
          MEMBERS · {members.length}
          {!clan.cpu && <span className="text-white/25"> / {MAX_MEMBERS}</span>}
        </H>
        {role === 'leader' && !clan.cpu && (
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
      <p className="mt-1 text-xs text-white/35">
        Click a member for their profile.{' '}
        {clan.cpu
          ? 'This CPU clan is run by its leader and officers.'
          : 'The leader makes officers; officers can take in new members and remove members.'}
      </p>
      <div className="mt-3 space-y-2">
        {members.map((m) => {
          const r = roleOf(clan, m.id)
          const week = (
            isBot(m.id) ? botTally(m.id, Math.max(from, joinedAt(clan, m.id)), now) : myTally(clan, m.id, from, now, log)
          ).wins
          const canKick = manage && m.id !== me.id && (role === 'leader' ? r !== 'leader' : r === 'member')
          return (
            <MemberRow key={m.id} m={m} clan={clan} me={me} onOpen={onOpen} week={week} presence={presence.get(m.id)}>
              {role === 'leader' && !clan.cpu && r === 'member' && (
                <button
                  onClick={() => {
                    playSfx('select')
                    setRole(clan.id, m.id, 'officer')
                  }}
                  className={`${small} border-sky-300/50 text-sky-300 hover:bg-sky-300/10`}
                >
                  PROMOTE
                </button>
              )}
              {role === 'leader' && !clan.cpu && r === 'officer' && (
                <button
                  onClick={() => setRole(clan.id, m.id, 'member')}
                  className={`${small} border-white/25 text-white/60 hover:bg-white/10`}
                >
                  DEMOTE
                </button>
              )}
              {canKick && (
                <button
                  onClick={() => kick(clan.id, m.id)}
                  className={`${small} border-transparent text-white/35 hover:border-red-400/50 hover:text-red-300`}
                >
                  KICK
                </button>
              )}
            </MemberRow>
          )
        })}
      </div>
    </div>
  )
}

function War({ clan, me, now, war }: { clan: Clan; me: Profile; now: number; war: WarRow[] }) {
  const log = useClanProgress((s) => s.log)
  const claimed = useClanProgress((s) => s.claimed[me.id])
  const claim = useClanProgress((s) => s.claim)
  const from = weekStart(now)
  const lastFrom = weekStart(from - 1)
  const last = useMemo(() => warStandings(useClans.getState().clans, lastFrom, from, log), [lastFrom, from, log])
  const lastPlace = last.findIndex((r) => r.clan.id === clan.id) + 1
  const key = `${weekId(lastFrom)}:war:${clan.id}`
  // members since before last week ended, whose clan scored, collect last week's reward
  const eligible = joinedAt(clan, me.id) < from && (last[lastPlace - 1]?.points ?? 0) > 0
  const reward = warReward(lastPlace)
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <H>CLAN WAR · WEEK OF {new Date(from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase()}</H>
          <p className="mt-1 max-w-2xl text-xs text-white/45">
            Every clan, CPU clans too, scores war points from its members’ ranked brawls: 10 per win and 2 per KO. The top three
            clans of the week win BP (and the title War Champion for first place).
          </p>
        </div>
        <p className="font-display text-xs tracking-[0.3em] text-amber-200">
          ENDS IN {timeLeft(weekEnd(now) - now).toUpperCase()}
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border border-white/10" data-testid="war-table">
        {war.map((r, i) => {
          const el = ELEMENT_BY_ID[r.clan.element]
          const ours = r.clan.id === clan.id
          return (
            <div
              key={r.clan.id}
              className={`flex items-center gap-3 border-b border-white/5 px-3 py-2 last:border-0 ${ours ? 'bg-white/10' : 'bg-black/30'}`}
            >
              <span className={`font-display w-7 text-center font-black ${i < 3 ? 'text-amber-200' : 'text-white/40'}`}>
                {i + 1}
              </span>
              <ClanEmblem clan={r.clan} size={30} />
              <span className="min-w-0 flex-1 truncate text-sm">
                <span style={{ color: r.clan.emblem?.color ?? el.color }}>[{r.clan.tag}]</span> {r.clan.name}
                {ours && <span className="font-display ml-2 text-[9px] tracking-[0.3em] text-white/60">YOUR CLAN</span>}
              </span>
              <span className="w-24 text-right text-xs text-white/45">{r.wins} ranked wins</span>
              <span className="font-display w-20 text-right font-black">{r.points.toLocaleString('en')}</span>
            </div>
          )
        })}
      </div>
      <div className="rounded-lg border border-white/10 bg-black/30 p-4">
        <H>LAST WEEK</H>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          {last.slice(0, 3).map((r, i) => (
            <span key={r.clan.id} className="flex items-center gap-2 text-sm">
              <span className="font-display text-amber-200">{['🥇', '🥈', '🥉'][i]}</span>
              <ClanEmblem clan={r.clan} size={24} />[{r.clan.tag}]{' '}
              <span className="text-white/45">{r.points.toLocaleString('en')}</span>
            </span>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-white/60">
            [{clan.tag}] finished #{lastPlace} of {last.length}.
          </span>
          {eligible ? (
            <ClaimButton done={!!claimed?.includes(key)} onClaim={() => claim(me.id, key, reward)} label={rewardText(reward)} />
          ) : (
            <span className="text-xs text-white/40">Members who were in the clan last week collect its war reward.</span>
          )}
        </div>
      </div>
    </div>
  )
}

function ClaimButton({
  done,
  ready = true,
  onClaim,
  label,
}: {
  done: boolean
  ready?: boolean
  onClaim: () => boolean
  label: string
}) {
  if (done) return <span className="font-display text-[10px] tracking-[0.3em] text-emerald-300">✓ COLLECTED · {label}</span>
  return (
    <button
      disabled={!ready}
      onClick={() => onClaim() && playSfx('victory')}
      className="font-display rounded border-2 border-amber-300/80 bg-amber-300/10 px-3 py-1.5 text-[10px] tracking-[0.25em] text-amber-200 transition enabled:hover:bg-amber-300/25 disabled:border-white/15 disabled:bg-transparent disabled:text-white/40"
    >
      {ready ? 'CLAIM' : 'REWARD'} · {label}
    </button>
  )
}

function Goals({
  clan,
  me,
  level,
  goals,
  has,
  week,
}: {
  clan: Clan
  me: Profile
  level: number
  goals: Goal[]
  has: (key: string) => boolean
  week: string
}) {
  const claim = useClanProgress((s) => s.claim)
  const all = goals.every((g) => g.progress >= g.target)
  return (
    <div className="space-y-5">
      <div>
        <H>WEEKLY GOALS · [{clan.tag}]</H>
        <p className="mt-1 text-xs text-white/45">
          New goals every Monday. Clan goals count every member’s brawls (CPU members brawl around the clock); your own goals
          count the brawls you play while in the clan.
        </p>
      </div>
      <div className="space-y-2" data-testid="goals">
        {goals.map((g) => {
          const done = g.progress >= g.target
          return (
            <div
              key={g.id}
              className={`rounded-lg border p-3 ${done ? 'border-amber-300/40 bg-amber-300/5' : 'border-white/10 bg-black/30'}`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`font-display rounded px-1.5 py-0.5 text-[9px] tracking-[0.25em] ${g.scope === 'clan' ? 'bg-sky-400/15 text-sky-300' : 'bg-fuchsia-400/15 text-fuchsia-300'}`}
                >
                  {g.scope === 'clan' ? 'CLAN' : 'YOU'}
                </span>
                <span className="min-w-0 flex-1 text-sm font-semibold">{g.text}</span>
                <span className="flex items-center gap-1">
                  {g.reward.map((r, i) => (
                    <RewardIcon key={i} kind={r.kind} size={22} />
                  ))}
                </span>
                <ClaimButton
                  done={has(g.id)}
                  ready={done}
                  onClaim={() => claim(me.id, `${week}:${g.id}`, g.reward)}
                  label={rewardText(g.reward)}
                />
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, (g.progress / g.target) * 100)}%`,
                      background: done ? '#f5c518' : '#7ec8e3',
                    }}
                  />
                </div>
                <span className="w-20 text-right text-xs text-white/55 tabular-nums">
                  {Math.min(g.progress, g.target)} / {g.target}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-black/30 p-3">
        <span className="min-w-0 flex-1 text-sm">
          <b>All four done:</b> <span className="text-white/60">a bonus for the whole week’s work</span>
        </span>
        <ClaimButton
          done={has('all')}
          ready={all}
          onClaim={() => claim(me.id, `${week}:all`, ALL_GOALS_REWARD)}
          label={rewardText(ALL_GOALS_REWARD)}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-black/30 p-3">
        <span className="min-w-0 flex-1 text-sm">
          <b>Weekly XP Boost</b> <span className="text-white/60">· clan perk from level 7</span>
        </span>
        <ClaimButton
          done={has('perk')}
          ready={level >= 7}
          onClaim={() => claim(me.id, `${week}:perk`, PERK_BOOST)}
          label={rewardText(PERK_BOOST)}
        />
      </div>
    </div>
  )
}

function Activity({ clan, me, now, onOpen }: { clan: Clan; me: Profile; now: number; onOpen: (id: string) => void }) {
  const profiles = useProfiles((s) => s.profiles)
  const log = useClanProgress((s) => s.log)
  const feed = useMemo(() => clanFeed(clan, me.id, now, log), [clan, me.id, now, log])
  const TONE = { win: 'text-white/85', gold: 'text-amber-200', muted: 'text-white/40' }
  return (
    <div>
      <H>CLAN ACTIVITY · LAST 48 HOURS</H>
      {feed.length === 0 && <p className="mt-3 text-sm text-white/40">Nothing yet. Brawl, and your clan’s news shows up here.</p>}
      <div className="mt-3 space-y-1" data-testid="feed">
        {feed.map((f, i) => {
          const who = f.who ? brawlerOf(f.who, profiles, now) : null
          return (
            <div key={`${f.at}-${i}`} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-white/5">
              <span className="w-4 shrink-0 text-center text-sm text-white/50">{f.icon}</span>
              {who ? (
                <button onClick={() => onOpen(who.id)} className="shrink-0" title={who.name}>
                  <Avatar avatar={who.avatar} color={ELEMENT_BY_ID[who.element].color} size={24} />
                </button>
              ) : (
                <ClanEmblem clan={clan} size={24} />
              )}
              <span className={`min-w-0 flex-1 truncate text-sm ${TONE[f.tone ?? 'win']}`}>{f.text}</span>
              <span className="shrink-0 text-[11px] text-white/35">{ago(now - f.at)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** The clan chat: fills its column, newest message at the bottom, the box to write in always in view. */
function ClanChat({
  clan,
  me,
  now,
  online,
  inMatch,
  onOpen,
}: {
  clan: Clan
  me: Profile
  now: number
  /** The player and the members who can answer now. */
  online: number
  inMatch: number
  onOpen: (id: string) => void
}) {
  const profiles = useProfiles((s) => s.profiles)
  const clans = useClans((s) => s.clans)
  const typing = useClans((s) => s.typing[clan.id])
  const waiting = useClans((s) => s.waiting[clan.id])
  const { send, chatter } = useClans.getState()
  const [text, setText] = useState('')
  const log = useRef<HTMLDivElement>(null)
  // only members online type (the store only lets them), never one shown offline
  const typingNames = (typing ?? [])
    .filter((id) => isAvailable(id, now))
    .map((id) => brawlerOf(id, profiles, now)?.firstName)
    .filter(Boolean)
  const cpuMembers = clan.members.filter(isBot).length
  const free = freeBots(clans).length

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
    <section className={`flex min-h-0 flex-col overflow-hidden ${PANEL}`} data-testid="clan-chat">
      <h3 className="font-display flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3 text-xs tracking-[0.5em] text-white/40">
        CLAN CHAT
        <span className="text-[10px] tracking-[0.2em] text-emerald-300/80" data-testid="chat-online">
          ● {online} ONLINE
          {inMatch > 0 && <span className="text-amber-300/80"> · {inMatch} IN A MATCH</span>}
        </span>
      </h3>
      <div ref={log} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
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
          const r = roleOf(clan, msg.author)
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${own ? 'flex-row-reverse' : ''}`}>
              {author && (
                <button onClick={() => onOpen(author.id)} className="shrink-0" title={author.name}>
                  <Avatar avatar={author.avatar} color={ELEMENT_BY_ID[author.element].color} size={28} />
                </button>
              )}
              <div className={`max-w-[78%] rounded-xl px-3 py-2 ${own ? 'bg-white/15' : 'bg-white/5'}`}>
                <p className="text-[10px] text-white/45">
                  {author ? (
                    <button onClick={() => onOpen(author.id)} className="hover:text-white hover:underline">
                      {author.firstName}
                    </button>
                  ) : (
                    'Former member'
                  )}
                  {r === 'leader' && <span className="text-amber-200/80"> ★</span>}
                  {r === 'officer' && <span className="text-sky-300/80"> ◆</span>} · {stamp(msg.at)}
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
        {cpuMembers > 0 && online <= 1 && (
          <p className="text-center text-xs text-white/40" data-testid="chat-nobody">
            {waiting
              ? 'Nobody else is online right now. Your message waits: the next member to come on reads it.'
              : 'Nobody else is online right now: messages wait for the next member to come on.'}
          </p>
        )}
        {cpuMembers === 0 && (
          <p className="text-center text-xs text-white/40">
            Nobody else is in [{clan.tag}] yet, so nobody can answer. CPU brawlers will ask to join soon
            {clan.leaderId === me.id && free > 0 && ' — or recruit one now'}.
          </p>
        )}
      </div>
      <form onSubmit={submit} className="flex shrink-0 gap-2 border-t border-white/10 p-3">
        <input
          value={text}
          maxLength={400}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message as ${me.firstName}…`}
          data-testid="clan-input"
          className="min-w-0 flex-1 rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm outline-none focus:border-white/50"
        />
        <button className="font-display rounded-md border border-white/40 px-4 text-xs tracking-[0.3em] transition hover:bg-white/10">
          SEND
        </button>
      </form>
    </section>
  )
}

/** The leader's box for CPU brawlers asking to join, and whether the clan takes them in without asking. */
function JoinRequests({
  clan,
  requests,
  full,
  leader,
  onAnswer,
  onOpenChange,
  onOpen,
}: {
  clan: Clan
  requests: { id: string; at: number; b: BrawlerView }[]
  full: boolean
  /** Only the leader opens the clan or makes it ask first. */
  leader: boolean
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
              disabled={!leader}
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
                    <span style={{ color: rankColor(tier) }}>{tier.rank}</span> · {b.rating} BR
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
