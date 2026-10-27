import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { asset } from '../asset'
import { playSfx } from '../audio/sfx'
import { ELEMENT_BY_ID, ELEMENTS, type ElementInfo } from '../data/elements'
import { BOSSES, bossOpen, cupAt, dailyEvent, dayEnd } from '../events/catalog'
import { cupEntry, useEventsView, type EventsView } from '../events/progress'
import { useProfileEvents } from '../events/store'
import { CHARACTER_BY_ID, CHARACTERS } from '../profile/avatar'
import { isBot } from '../profile/bots'
import { brawlerOf, clanScore, TIER_COLORS } from '../profile/brawlers'
import { presenceOf } from '../profile/presence'
import { clanOf, useClans } from '../profile/useClans'
import { useFriendChat, useUnread } from '../profile/useFriendChat'
import { rankScore, seasonFor, tierOf, useProfiles, type Profile } from '../profile/useProfiles'
import { passLevel, timeLeft } from '../season/season'
import { useGame, type PageScreen } from '../store/useGame'
import { Avatar } from './Avatar'
import { ClanEmblem } from './ClanEmblem'
import { Trophy } from './EventArt'
import { MenuIcon } from './MenuIcon'
import { RankEmblem } from './RankEmblem'
import { BpIcon, RewardIcon } from './RewardIcon'

const PASS_COLOR = '#fcd34d'

const panel = 'rounded-2xl border border-white/10 bg-[#0b0c12]/75 backdrop-blur-md'
/** Hover and press for every clickable card on this side. */
const card =
  'menu-item group relative overflow-hidden text-left transition duration-200 hover:-translate-y-0.5 hover:border-white/35 hover:bg-white/[0.06] active:translate-y-0 active:scale-[0.98]'

const tierColor = (index: number) => TIER_COLORS[index] ?? TIER_COLORS[TIER_COLORS.length - 1]

function openAt(view: EventsView) {
  playSfx('select')
  useEventsView.getState().open(view)
  useGame.getState().openPage('events')
}

const openPage = (screen: PageScreen) => () => {
  playSfx('select')
  useGame.getState().openPage(screen)
}

/** Everything on the menu's right: the player, today's events, friends and clan, and the other pages. */
export function MenuSide({ profile, element, now }: { profile: Profile | null; element: ElementInfo; now: number }) {
  return (
    <div className="flex min-h-0 flex-col gap-2.5">
      <PlayerCard profile={profile} element={element} />
      <TodayPanel profile={profile} now={now} />
      {profile && (
        <div className="grid grid-cols-2 gap-2.5">
          <FriendsCard profile={profile} now={now} />
          <ClanCard profile={profile} now={now} />
        </div>
      )}
      <Destinations profile={profile} element={element} />
    </div>
  )
}

// ---------------------------------------------------------------- the player

/** Avatar, name and title; rank emblem with the progress to the next division; record, streak, BP and pass level. */
function PlayerCard({ profile, element }: { profile: Profile | null; element: ElementInfo }) {
  const clans = useClans((s) => s.clans)
  const [open, setOpen] = useState(false)
  if (!profile)
    return (
      <div className={`${panel} relative flex items-center gap-4 p-4`}>
        <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-white/30 text-white/50">
          <MenuIcon name="profile" size={26} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display font-black tracking-wide">NO BRAWLER</p>
          <p className="text-sm text-white/55">Make a profile to collect, rank up and keep your Bakugan.</p>
        </div>
        <SwitchButton open={open} setOpen={setOpen} label="CREATE" />
      </div>
    )
  const tier = tierOf(rankScore(profile))
  const color = tierColor(tier.index)
  const score = rankScore(profile)
  const into = tier.nextRank ? (score - tier.min) / (tier.nextRank.min - tier.min) : 1
  const clan = clanOf(clans, profile.id)
  const { wins, losses, streak } = profile.stats
  const level = passLevel(seasonFor(profile).passXp)
  return (
    <div
      className={`${panel} relative p-3.5`}
      style={{ borderColor: `${element.color}55`, boxShadow: `0 0 40px ${element.color}1f` }}
    >
      {/* the attribute's colour washing in from the corner */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-60"
        style={{ background: `radial-gradient(circle at 0% 0%, ${element.color}33, transparent 55%)` }}
      />
      <div className="relative flex items-center gap-3">
        <button
          data-menu-item
          onClick={openPage('profile')}
          title="Your profile"
          className="menu-item shrink-0 rounded-full transition hover:scale-105 hover:brightness-110 active:scale-95"
        >
          <Avatar avatar={profile.avatar} color={element.color} size={58} frame={profile.cosmetics?.frame} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-display truncate text-lg leading-tight font-black tracking-wide">
            {clan && <span className="mr-1.5 text-sm text-white/45">[{clan.tag}]</span>}
            {profile.firstName.toUpperCase()} {profile.lastName.toUpperCase()}
          </p>
          <p className="truncate text-xs text-amber-200/90">
            {profile.cosmetics?.title ? `✦ ${profile.cosmetics.title}` : `${element.name} Brawler`}
          </p>
        </div>
        <SwitchButton open={open} setOpen={setOpen} label="SWITCH" />
      </div>

      {/* rank */}
      <button
        data-menu-item
        onClick={openPage('rankings')}
        title="Rankings"
        className="menu-item group relative mt-3 flex w-full items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-2.5 py-2 text-left transition hover:border-white/30 hover:bg-white/[0.05]"
      >
        <RankEmblem color={color} tier={tier.index} division={tier.division} size={42} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="font-display truncate text-sm font-black tracking-wider" style={{ color }}>
              {tier.rank.toUpperCase()}
            </span>
            <span className="font-display shrink-0 text-[10px] tracking-[0.2em] text-white/50">
              {profile.rating.toLocaleString('en')} BR
            </span>
          </span>
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/10">
            <span
              className="block h-full rounded-full"
              style={{ width: `${Math.max(3, into * 100)}%`, background: `linear-gradient(90deg, ${color}88, ${color})` }}
            />
          </span>
          <span className="mt-1 block truncate text-[11px] text-white/45">
            {tier.nextRank
              ? `${(tier.nextRank.min - score).toLocaleString('en')} to ${tier.nextRank.name}`
              : 'The top of the ladder'}
          </span>
        </span>
      </button>

      {/* numbers */}
      <div className="relative mt-2.5 grid grid-cols-4 gap-1.5">
        <Stat label="RECORD">
          <span className="text-emerald-300">{wins}</span>
          <span className="text-white/35">–</span>
          <span className="text-rose-300">{losses}</span>
        </Stat>
        <Stat label="STREAK">
          <span style={{ color: streak > 1 ? '#fb923c' : undefined }}>{streak > 1 ? `🔥${streak}` : streak}</span>
        </Stat>
        <Stat label="BP">
          <span className="flex items-center gap-1">
            <BpIcon size={14} />
            {profile.bp.toLocaleString('en')}
          </span>
        </Stat>
        <Stat label="PASS">
          <span style={{ color: PASS_COLOR }}>LV {level}</span>
        </Stat>
      </div>
    </div>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-white/[0.04] px-2 py-1.5 text-center">
      <p className="font-display text-[8.5px] tracking-[0.25em] text-white/40">{label}</p>
      <p className="font-display mt-0.5 flex justify-center text-[13px] font-bold whitespace-nowrap">{children}</p>
    </div>
  )
}

/** The profiles on this device, and a new one. */
function SwitchButton({ open, setOpen, label }: { open: boolean; setOpen: (o: boolean) => void; label: string }) {
  const profiles = useProfiles((s) => s.profiles)
  const activeId = useProfiles((s) => s.activeId)
  const select = useProfiles((s) => s.select)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', esc)
    }
  }, [open, setOpen])
  return (
    <div ref={box} className="relative self-start">
      <button
        data-menu-item
        onClick={() => {
          playSfx('tick')
          setOpen(!open)
        }}
        title="Switch profile"
        aria-expanded={open}
        className="menu-item font-display flex items-center gap-1.5 rounded-full border border-white/20 bg-black/30 px-2.5 py-1 text-[9px] tracking-[0.25em] text-white/65 transition hover:border-white/50 hover:bg-white/10 hover:text-white"
      >
        <MenuIcon name="switch" size={13} /> {label}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute top-full right-0 z-30 mt-2 w-72 overflow-hidden rounded-xl border border-white/15 bg-[#0b0c12]/95 shadow-2xl backdrop-blur"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <p className="font-display px-4 pt-3 pb-1 text-[10px] tracking-[0.4em] text-white/40">BRAWLERS ON THIS DEVICE</p>
            {profiles.map((p) => {
              const el = ELEMENT_BY_ID[p.element]
              const on = p.id === activeId
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    playSfx('select')
                    select(p.id)
                    useGame.setState({ element: p.element })
                    setOpen(false)
                  }}
                  className={`flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-white/10 ${on ? 'bg-white/5' : ''}`}
                >
                  <Avatar avatar={p.avatar} color={el.color} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {p.firstName} {p.lastName}
                    </span>
                    <span className="text-xs" style={{ color: el.color }}>
                      {el.name} · {tierOf(rankScore(p)).rank}
                    </span>
                  </span>
                  {on && <span className="font-display text-[9px] tracking-[0.3em] text-white/45">PLAYING</span>}
                </button>
              )
            })}
            <button
              onClick={() => {
                playSfx('select')
                setOpen(false)
                useGame.getState().newProfile()
              }}
              className="font-display flex w-full items-center gap-2 border-t border-white/10 px-4 py-3 text-left text-xs tracking-[0.3em] text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              <MenuIcon name="plus" size={16} /> NEW BRAWLER
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ---------------------------------------------------------------- today

/** The cup, this week's boss and today's rule event, each opening its place on the events page. */
function TodayPanel({ profile, now }: { profile: Profile | null; now: number }) {
  const events = useProfileEvents(profile?.id)
  const cup = cupAt(now)
  const entry = cupEntry(events, now)
  const cupEl = ELEMENT_BY_ID[cup.element]
  const bossIndex = BOSSES.findIndex((_, i) => bossOpen(i, now))
  const boss = BOSSES[Math.max(0, bossIndex)]
  const bossEl = ELEMENT_BY_ID[boss.element]
  const bossLook = CHARACTER_BY_ID[boss.look]
  const cleared = events.bosses[boss.id]?.cleared.length ?? 0
  const rule = dailyEvent(now)
  const ruleEl = ELEMENT_BY_ID[rule.element]
  const prog = events.rules[rule.id]
  const wins = Math.min(rule.goal, prog?.wins ?? 0)
  const ready = !!prog && !prog.claimed && prog.wins >= rule.goal
  return (
    <div className={`${panel} p-2.5`}>
      <div className="flex items-center justify-between px-1">
        <p className="font-display text-[10px] tracking-[0.45em] text-white/55">TODAY</p>
        <p className="font-display text-[9px] tracking-[0.25em] text-white/35">
          NEW EVENTS IN {timeLeft(dayEnd(now) - now).toUpperCase()}
        </p>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <EventCard
          color={cupEl.color}
          kicker="TOURNAMENT"
          title={(events.cup?.name ?? cup.name).toUpperCase()}
          status={entry.running ? 'IN PROGRESS' : entry.enteredToday ? 'PLAYED TODAY' : 'ENTRY OPEN'}
          live={entry.running || !entry.enteredToday}
          art={<Trophy size={38} />}
          onClick={() => openAt({ kind: 'cup' })}
        />
        <EventCard
          color={bossEl.color}
          kicker="BOSS OF THE WEEK"
          title={boss.name.toUpperCase()}
          status={`${cleared}/3 CLEARED`}
          art={
            bossLook?.image ? (
              <img
                src={asset(bossLook.image)}
                alt=""
                draggable={false}
                className="h-12 w-12 rounded-full object-cover object-top"
                style={{
                  boxShadow: `0 0 16px ${bossEl.color}aa`,
                  background: `radial-gradient(circle, ${bossEl.color}, #07080d)`,
                }}
              />
            ) : (
              <img src={bossEl.icon} alt="" className="h-12 w-12" />
            )
          }
          onClick={() => openAt({ kind: 'boss', id: boss.id })}
        />
        <EventCard
          color={ruleEl.color}
          kicker="DAILY RULES"
          title={rule.name.toUpperCase()}
          status={ready ? 'REWARD READY' : `${wins}/${rule.goal} WINS`}
          live={ready}
          art={
            <span className="relative flex h-12 w-12 items-center justify-center">
              <img src={ruleEl.icon} alt="" className="h-11 w-11" style={{ filter: `drop-shadow(0 0 10px ${ruleEl.glow})` }} />
            </span>
          }
          onClick={() => openAt({ kind: 'board' })}
        />
      </div>
    </div>
  )
}

function EventCard({
  color,
  kicker,
  title,
  status,
  live,
  art,
  onClick,
}: {
  color: string
  kicker: string
  title: string
  status: string
  live?: boolean
  art: ReactNode
  onClick: () => void
}) {
  return (
    <button
      data-menu-item
      onClick={onClick}
      className={`${card} flex flex-col items-center rounded-xl border border-white/10 px-1.5 pt-2 pb-2`}
      style={{ background: `linear-gradient(170deg, ${color}2e, #0b0c1200 65%)` }}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5" style={{ background: color }} />
      <span className="font-display text-[7.5px] tracking-[0.2em] whitespace-nowrap text-white/50">{kicker}</span>
      <span className="my-1 flex h-12 items-center transition duration-300 group-hover:scale-110">{art}</span>
      <span className="font-display w-full truncate text-center text-[9.5px] leading-tight font-black tracking-normal">
        {title}
      </span>
      <span
        className="font-display mt-1 flex items-center gap-1 text-[8.5px] tracking-[0.15em] whitespace-nowrap"
        style={{ color: live ? color : 'rgba(255,255,255,0.45)' }}
      >
        {live && <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: color }} />}
        {status}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------- friends and clan

/** Friends' faces, online ones first with their status, and unread messages. */
function FriendsCard({ profile, now }: { profile: Profile; now: number }) {
  const profiles = useProfiles((s) => s.profiles)
  const all = profile.friends ?? []
  const unread = useUnread(
    profile.id,
    all.map((f) => f.id),
  )
  const friends = all
    .filter((f) => f.since <= now)
    .map((f) => {
      const b = brawlerOf(f.id, profiles, now)
      return b && { b, online: isBot(f.id) && presenceOf(f.id, now).online }
    })
    .filter((x) => !!x)
    .sort((a, b) => Number(b.online) - Number(a.online))
  const online = friends.filter((f) => f.online).length
  const first = friends[0]
  return (
    <button
      data-menu-item
      onClick={() => {
        // the page opens on the first friend online
        if (first?.online) useFriendChat.getState().setFocus(first.b.id)
        openPage('friends')()
      }}
      className={`${card} ${panel} flex flex-col gap-1.5 p-2.5`}
    >
      <span className="flex w-full items-center justify-between">
        <span className="font-display text-[10px] font-bold tracking-[0.3em]">FRIENDS</span>
        {unread > 0 && (
          <span className="font-display rounded-full bg-amber-400 px-1.5 text-[10px] leading-4 text-black">✉ {unread}</span>
        )}
      </span>
      <span className="flex h-8 items-center">
        {friends.length ? (
          friends.slice(0, 5).map(({ b, online }, i) => (
            <span key={b.id} className="relative -mr-1.5" style={{ zIndex: 10 - i }} title={b.name}>
              <Avatar avatar={b.avatar} color={ELEMENT_BY_ID[b.element].color} size={30} />
              <span
                className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-[#0b0c12]"
                style={{ background: online ? '#3ee07a' : '#5b6170' }}
              />
            </span>
          ))
        ) : (
          <span className="text-xs text-white/45">Find brawlers to add</span>
        )}
      </span>
      <span className="truncate text-[11px] font-semibold text-white/55">
        {online ? (
          <>
            <span className="text-emerald-300">● {online} online</span>
            {first && ` · ${first.b.firstName}`}
          </>
        ) : (
          `${friends.length} friend${friends.length === 1 ? '' : 's'} · none online`
        )}
      </span>
    </button>
  )
}

/** The player's clan with its place among all clans, or the way to join one. */
function ClanCard({ profile, now }: { profile: Profile; now: number }) {
  const clans = useClans((s) => s.clans)
  const profiles = useProfiles((s) => s.profiles)
  const clan = clanOf(clans, profile.id)
  const place = useMemo(() => {
    if (!clan) return 0
    const mine = clanScore(clan, profiles, now)
    return 1 + clans.filter((c) => c.id !== clan.id && clanScore(c, profiles, now) > mine).length
  }, [clan, clans, profiles, now])
  const el = ELEMENT_BY_ID[clan?.element ?? profile.element]
  return (
    <button
      data-menu-item
      onClick={openPage('clans')}
      className={`${card} ${panel} flex items-center gap-2.5 p-2.5`}
      style={{ background: `linear-gradient(135deg, ${el.color}22, transparent 60%)` }}
    >
      {clan ? (
        <ClanEmblem clan={clan} size={44} />
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-dashed border-white/30 text-white/50">
          <MenuIcon name="clans" size={22} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="font-display block text-[10px] font-bold tracking-[0.3em]">CLAN</span>
        <span className="block truncate text-sm font-bold">{clan ? `[${clan.tag}] ${clan.name}` : 'No clan yet'}</span>
        <span className="font-display block text-[9px] tracking-[0.2em] text-white/50">
          {clan ? `#${place} OF ${clans.length} CLANS` : 'JOIN OR FOUND ONE'}
        </span>
      </span>
    </button>
  )
}

// ---------------------------------------------------------------- the other pages

/** The remaining pages as illustrated tiles. */
function Destinations({ profile, element }: { profile: Profile | null; element: ElementInfo }) {
  const tier = profile ? tierOf(rankScore(profile)) : null
  const look = CHARACTERS.find((c) => c.element === element.id && c.image) ?? CHARACTERS[0]
  const others = ELEMENTS.filter((e) => e.id !== element.id).slice(0, 3)
  return (
    <div className="grid grid-cols-3 gap-2">
      <ArtTile
        title="PROFILE"
        sub="STATS · TEAM"
        color={element.color}
        disabled={!profile}
        onClick={openPage('profile')}
        art={profile && <Avatar avatar={profile.avatar} color={element.color} size={34} frame={profile.cosmetics?.frame} />}
      />
      <ArtTile
        title="INVENTORY"
        sub={profile ? `${profile.boosts ?? 0} BOOSTS` : 'NO BRAWLER'}
        color="#38bdf8"
        disabled={!profile}
        onClick={openPage('inventory')}
        art={<RewardIcon kind="skin" size={36} />}
      />
      <ArtTile
        title="RANKINGS"
        sub="TOP BRAWLERS"
        color={tier ? tierColor(tier.index) : '#f5c518'}
        onClick={openPage('rankings')}
        art={
          <RankEmblem
            color={tier ? tierColor(tier.index) : '#f5c518'}
            tier={tier?.index ?? 3}
            division={tier?.division ?? 'I'}
            size={36}
          />
        }
      />
      <ArtTile
        title="ENCYCLOPEDIA"
        sub="BAKUGAN & CARDS"
        color="#60a5fa"
        onClick={openPage('encyclopedia')}
        art={
          <span className="relative h-8 w-10">
            {others.map((e, i) => (
              <img
                key={e.id}
                src={e.icon}
                alt=""
                className="absolute top-1 h-6 w-6 transition duration-300 group-hover:scale-110"
                style={{ left: i * 8, zIndex: i, filter: 'drop-shadow(0 2px 3px #000)' }}
              />
            ))}
          </span>
        }
      />
      <ArtTile
        title="SHOWROOM"
        sub="BAKUGAN IN 3D"
        color={element.color}
        onClick={openPage('showroom')}
        art={
          <span className="relative flex h-9 w-9 items-center justify-center">
            <span
              className="menu-spin absolute inset-0 rounded-full border-2 border-dashed"
              style={{ borderColor: `${element.color}aa` }}
            />
            <img src={element.icon} alt="" className="h-6 w-6" />
          </span>
        }
      />
      <ArtTile
        title="BRAWLERS"
        sub="CHARACTERS IN 3D"
        color="#c084fc"
        onClick={openPage('characters')}
        art={
          look.image && (
            <img
              src={asset(look.image)}
              alt=""
              draggable={false}
              className="h-10 w-10 rounded-full object-cover object-top"
              style={{ background: `radial-gradient(circle, ${ELEMENT_BY_ID[look.element].color}, #07080d)` }}
            />
          )
        }
      />
    </div>
  )
}

function ArtTile({
  title,
  sub,
  color,
  art,
  onClick,
  disabled,
}: {
  title: string
  sub: string
  color: string
  art: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      data-menu-item
      onClick={onClick}
      disabled={disabled}
      title={disabled ? 'Make a profile first' : undefined}
      className={`${card} ${panel} flex flex-col items-center px-1.5 pt-2 pb-1.5 disabled:pointer-events-none disabled:opacity-40`}
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100"
        style={{ background: `radial-gradient(circle at 50% 30%, ${color}40, transparent 70%)` }}
      />
      <span
        className="pointer-events-none absolute inset-x-6 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
      />
      <span className="relative flex h-10 w-10 items-center justify-center transition duration-300 group-hover:scale-110">
        {art}
      </span>
      <span className="font-display relative mt-1 block w-full truncate text-center text-[9.5px] font-bold tracking-[0.12em]">
        {title}
      </span>
      <span className="relative block w-full truncate text-center text-[10.5px] font-semibold text-white/45">{sub}</span>
    </button>
  )
}
