import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { playSfx } from '../audio/sfx'
import { Avatar } from '../components/Avatar'
import { BakuganPortrait } from '../components/BakuganPortrait'
import { LifeBalls, Stamp, Trophy } from '../components/EventArt'
import { EventBracket } from '../components/EventBracket'
import { GateChip } from '../components/GateChip'
import { GRID, GRID_SIZE } from '../components/grid'
import { PageNav } from '../components/PageNav'
import { RewardIcon } from '../components/RewardIcon'
import { BAKUGAN, formBrawlG, formOf, type Entrant } from '../data/bakugan'
import { ELEMENT_BY_ID, type ElementId } from '../data/elements'
import { COMMAND_GATES, GATE_BY_ID } from '../data/gates'
import {
  BOSS_BOUNTY,
  BOSSES,
  bossOpen,
  bossPrize,
  bossReturns,
  CUP_DAYS,
  cupAt,
  cupPrize,
  dailyEvent,
  dayEnd,
  DIFFICULTIES,
  DIFFICULTY_BY_ID,
  PLACE_NAME,
  ROUND_BOOST,
  ROUND_NAME,
  weekEnd,
  weeklyEvent,
  weekKey,
  type Boss,
  type CupStage,
  type Difficulty,
  type Place,
  type RuleEvent,
} from '../events/catalog'
import { bossTeam, eventTeam, playerTier } from '../events/matches'
import { claimRule, cupEntry, enterCup, playBoss, playCup, playRule, useEventsView } from '../events/progress'
import { EMPTY_BOSS, useProfileEvents, type CupRun, type ProfileEvents } from '../events/store'
import { myMatch } from '../events/tournament'
import { bakuganById, tierOf, TIERS, useActiveProfile, useProfiles, type Profile } from '../profile/useProfiles'
import { rewardLabel, timeLeft, type Reward } from '../season/season'
import { useGame } from '../store/useGame'

const GOLD = '#f5c518'

/** The clock, ticking every 30 seconds while the page is open (time left, rotations). */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  return now
}

export function EventsScreen() {
  const profile = useActiveProfile()
  const view = useEventsView((s) => s.view)
  const open = useEventsView((s) => s.open)
  const editProfile = useGame((s) => s.editProfile)
  const events = useProfileEvents(profile?.id)
  const now = useNow()
  const boss = view.kind === 'boss' ? BOSSES.find((b) => b.id === view.id) : undefined
  const accent = boss ? ELEMENT_BY_ID[boss.element].color : view.kind === 'cup' ? GOLD : '#7a5cff'

  return (
    <motion.div
      className="absolute inset-0 overflow-y-auto px-12 py-10"
      style={{
        backgroundImage: `radial-gradient(circle at 85% 0%, ${accent}26, transparent 45%), radial-gradient(circle at 0% 100%, ${GOLD}12, transparent 40%), ${GRID}`,
        backgroundSize: `100% 100%, 100% 100%, ${GRID_SIZE}`,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <PageNav current="events" />
      <header className="mt-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-display text-xs tracking-[0.5em] text-amber-300">TOURNAMENTS · BOSS BATTLES · RULE EVENTS</p>
          <h1 className="font-display text-5xl font-black tracking-wider">EVENTS</h1>
          <p className="mt-1 max-w-3xl text-white/55">
            More than the arena: knockout cups against brawlers of your rank, the villains of the anime with boosted teams, and
            matches with special Gate Card rules. New events every day.
          </p>
        </div>
        {profile && <Summary events={events} />}
      </header>

      {view.kind !== 'board' && (
        <button
          onClick={() => {
            playSfx('tick')
            open({ kind: 'board' })
          }}
          className="font-display mt-6 text-xs tracking-[0.4em] text-white/50 transition hover:text-white"
        >
          ← ALL EVENTS
        </button>
      )}

      {!profile && (
        <div className="mt-6 flex items-center gap-4 rounded-xl border border-amber-300/40 bg-black/50 px-6 py-4">
          <p className="flex-1 text-white/75">Events are played with your own Bakugan and pay into your profile.</p>
          <button
            onClick={() => editProfile(null)}
            className="font-display rounded border border-amber-300/70 px-4 py-2 text-xs tracking-[0.3em] text-amber-200 hover:bg-amber-300/10"
          >
            + CREATE PROFILE
          </button>
        </div>
      )}

      {view.kind === 'cup' && profile ? (
        <CupPanel profile={profile} events={events} now={now} />
      ) : boss && profile ? (
        <BossPanel key={boss.id} profile={profile} boss={boss} events={events} now={now} />
      ) : (
        <Board profile={profile} events={events} now={now} />
      )}
    </motion.div>
  )
}

function Summary({ events }: { events: ProfileEvents }) {
  const cups = events.trophies.filter((t) => t.place === 1).length
  const beaten = BOSSES.filter((b) => (events.bosses[b.id]?.cleared.length ?? 0) > 0).length
  return (
    <div className="flex gap-3">
      <div className="flex items-center gap-3 rounded-xl border border-amber-300/40 bg-black/50 px-4 py-2">
        <Trophy size={36} />
        <div>
          <p className="font-display text-2xl leading-none font-black">{cups}</p>
          <p className="font-display text-[9px] tracking-[0.3em] text-white/45">CUPS WON</p>
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-black/50 px-4 py-2">
        <span className="text-2xl">☠</span>
        <div>
          <p className="font-display text-2xl leading-none font-black">
            {beaten}
            <span className="text-sm text-white/40">/{BOSSES.length}</span>
          </p>
          <p className="font-display text-[9px] tracking-[0.3em] text-white/45">BOSSES DEFEATED</p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- the board

function Board({ profile, events, now }: { profile: Profile | null; events: ProfileEvents; now: number }) {
  const daily = dailyEvent(now)
  const weekly = weeklyEvent(now)
  const tomorrow = dailyEvent(dayEnd(now) + 1000)
  const order = BOSSES.map((b, i) => ({ b, i, open: bossOpen(i, now) })).sort((x, y) => Number(y.open) - Number(x.open))
  return (
    <>
      {profile && <TeamBar profile={profile} />}
      <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-5 xl:grid-cols-[1.5fr_1fr_1fr]">
        <CupCard profile={profile} events={events} now={now} />
        <RuleCard profile={profile} events={events} ev={daily} now={now} next={tomorrow} />
        <RuleCard profile={profile} events={events} ev={weekly} now={now} />
      </div>

      <div className="mt-10 flex items-baseline justify-between">
        <h2 className="font-display text-xs tracking-[0.5em] text-white/50">BOSS BATTLES · THIS WEEK</h2>
        <p className="font-display text-[10px] tracking-[0.3em] text-white/35">
          NEW LINE-UP IN {timeLeft(weekEnd(now) - now).toUpperCase()}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
        {order.map(({ b, i, open }) => (
          <BossCard key={b.id} boss={b} index={i} open={open} events={events} now={now} enabled={!!profile} />
        ))}
      </div>

      {profile && <Cabinet events={events} />}
    </>
  )
}

/** The team the player brings to every event match; the same one the face-off uses. */
function TeamBar({ profile }: { profile: Profile }) {
  const setTeam = useProfiles((s) => s.setTeam)
  const [editing, setEditing] = useState(false)
  const team = eventTeam(profile)
  const ids = team.map((e) => e.bakugan.id)
  const toggle = (id: string) => {
    playSfx('tick')
    if (ids.includes(id)) {
      if (ids.length > 1) setTeam(ids.filter((x) => x !== id))
    } else if (ids.length < 3) setTeam([...ids, id])
  }
  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-black/45 p-4 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        <p className="font-display text-[10px] tracking-[0.4em] text-white/40">YOUR EVENT TEAM</p>
        {team.map((e, i) => (
          <TeamChip key={e.bakugan.id} entrant={e} lead={i === 0} />
        ))}
        <button
          onClick={() => setEditing((v) => !v)}
          className="font-display ml-auto rounded border border-white/25 px-3 py-1.5 text-[10px] tracking-[0.3em] text-white/70 hover:bg-white/10"
        >
          {editing ? 'DONE' : 'CHANGE TEAM'}
        </button>
      </div>
      <AnimatePresence>
        {editing && (
          <motion.div
            className="overflow-hidden"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <p className="mt-3 text-xs text-white/45">
              Pick 1–3 of your Bakugan (lead first). As in the face-off, opponents bring as many as you do.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {profile.collection.map((o) => {
                const b = bakuganById(o.id)
                const on = ids.includes(o.id)
                const el = ELEMENT_BY_ID[b.element]
                return (
                  <button
                    key={o.id}
                    onClick={() => toggle(o.id)}
                    className="flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition"
                    style={{
                      borderColor: on ? el.color : 'rgba(255,255,255,0.12)',
                      background: on ? `${el.color}22` : 'transparent',
                      opacity: on || ids.length < 3 ? 1 : 0.4,
                    }}
                  >
                    <img src={el.icon} alt="" className="h-5 w-5" />
                    {b.evolutions[o.form]?.name ?? b.name}
                    {on && <span className="text-white/50">#{ids.indexOf(o.id) + 1}</span>}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function TeamChip({ entrant, lead }: { entrant: Entrant; lead?: boolean }) {
  const el = ELEMENT_BY_ID[entrant.bakugan.element]
  return (
    <span className="flex items-center gap-2 rounded-lg border bg-black/40 px-2 py-1" style={{ borderColor: `${el.color}88` }}>
      <img src={el.icon} alt="" className="h-6 w-6" />
      <span className="leading-tight">
        <span className="block text-sm font-bold">{formOf(entrant).name}</span>
        <span className="block text-[10px] text-white/45">
          {lead ? 'LEAD · ' : ''}
          {formBrawlG(entrant) + (entrant.bonusG ?? 0)}G
        </span>
      </span>
    </span>
  )
}

type Status = 'open' | 'running' | 'locked' | 'done' | 'claim'
const STATUS: Record<Status, { label: string; color: string }> = {
  open: { label: 'OPEN', color: '#3ee07a' },
  running: { label: 'IN PROGRESS', color: '#fcd34d' },
  claim: { label: 'REWARD READY', color: GOLD },
  done: { label: 'DONE', color: '#9aa3b5' },
  locked: { label: 'LOCKED', color: '#ff6b6b' },
}

function StatusPill({ status, label }: { status: Status; label?: string }) {
  const s = STATUS[status]
  return (
    <span
      className="font-display rounded-full border px-2 py-0.5 text-[9px] tracking-[0.25em]"
      style={{ borderColor: `${s.color}aa`, color: s.color, background: `${s.color}14` }}
    >
      {status === 'locked' ? '🔒 ' : status === 'done' ? '✓ ' : ''}
      {label ?? s.label}
    </span>
  )
}

function Rewards({ rewards, label = 'REWARDS' }: { rewards: Reward[]; label?: string }) {
  return (
    <div className="mt-3">
      <p className="font-display text-[9px] tracking-[0.4em] text-white/35">{label}</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {rewards.map((r, i) => (
          <span
            key={i}
            className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 py-0.5 pr-2.5 pl-0.5 text-[11px]"
          >
            <RewardIcon kind={r.kind} size={20} />
            {rewardLabel(r)}
          </span>
        ))}
      </div>
    </div>
  )
}

function Progress({ value, goal, color }: { value: number; goal: number; color: string }) {
  return (
    <div className="mt-3">
      <div className="flex justify-between text-[11px] text-white/55">
        <span>PROGRESS</span>
        <span className="font-display font-bold text-white">
          {Math.min(value, goal)}/{goal} WINS
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}, #fff8)` }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(1, value / goal) * 100}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

/** An event card: art on top, then what it is, its rules, rewards and progress. */
function Card({
  art,
  color,
  kind,
  status,
  statusLabel,
  time,
  name,
  children,
  wide,
  onClick,
}: {
  art: ReactNode
  color: string
  kind: string
  status: Status
  statusLabel?: string
  time?: string
  name: string
  children: ReactNode
  wide?: boolean
  onClick?: () => void
}) {
  return (
    <motion.div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => onClick && e.key === 'Enter' && onClick()}
      whileHover={onClick ? { y: -4 } : undefined}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-col overflow-hidden rounded-2xl border bg-black/55 backdrop-blur ${wide ? 'sm:col-span-2 xl:col-span-1' : ''} ${
        onClick ? 'cursor-pointer' : ''
      }`}
      style={{ borderColor: `${color}66`, boxShadow: `0 0 24px ${color}1f` }}
    >
      <div
        className="relative h-40 overflow-hidden"
        style={{ background: `radial-gradient(circle at 30% 30%, ${color}88, #07080d 75%)` }}
      >
        {art}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-[9px] tracking-[0.4em]" style={{ color }}>
            {kind}
          </span>
          <StatusPill status={status} label={statusLabel} />
          {time && <span className="font-display ml-auto text-[9px] tracking-[0.25em] text-white/45">⏱ {time}</span>}
        </div>
        <h3 className="font-display mt-1 text-xl font-black tracking-wide">{name}</h3>
        {children}
      </div>
    </motion.div>
  )
}

function ActionButton({
  label,
  color,
  onClick,
  disabled,
  title,
}: {
  label: string
  color: string
  onClick: () => void
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      disabled={disabled}
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="font-display mt-4 skew-x-[-10deg] border-2 px-5 py-2 text-sm font-black tracking-[0.2em] whitespace-nowrap transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
      style={{ borderColor: color, color: '#fff', background: `${color}22` }}
    >
      {label}
    </button>
  )
}

// ---------------------------------------------------------------- Bakugan Cup

function cupStatus(events: ProfileEvents, now: number): { status: Status; label?: string } {
  const entry = cupEntry(events, now)
  if (entry.running) return { status: 'running', label: ROUND_NAME[events.cup!.stage as CupStage].toUpperCase() }
  if (entry.enteredToday)
    return { status: 'done', label: events.cup?.place ? PLACE_NAME[events.cup.place].toUpperCase() : 'PLAYED TODAY' }
  return { status: 'open', label: 'ENTRY OPEN · FREE' }
}

function CupArt({ run, element }: { run: CupRun | null; element: ElementId }) {
  const el = ELEMENT_BY_ID[element]
  return (
    <>
      <div className="absolute inset-0" style={{ background: `linear-gradient(120deg, ${GOLD}33, transparent 60%)` }} />
      <img src={el.icon} alt="" className="absolute -right-6 -bottom-8 h-48 w-48 opacity-25" />
      <div className="absolute top-1/2 left-6 -translate-y-1/2">
        <Trophy size={110} />
      </div>
      {/* the eight brawlers */}
      <div className="absolute top-1/2 right-6 grid -translate-y-1/2 grid-cols-4 gap-2">
        {Array.from({ length: 8 }, (_, i) => {
          const e = run?.entrants[i]
          return e ? (
            <Avatar key={i} avatar={{ kind: 'preset', id: e.characterId }} color={ELEMENT_BY_ID[e.element].color} size={34} />
          ) : (
            <span
              key={i}
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-white/25 bg-black/40 text-xs text-white/40"
            >
              ?
            </span>
          )
        })}
      </div>
    </>
  )
}

function CupCard({ profile, events, now }: { profile: Profile | null; events: ProfileEvents; now: number }) {
  const open = useEventsView((s) => s.open)
  const cup = cupAt(now)
  const { status, label } = cupStatus(events, now)
  const run = events.cup
  const show = () => {
    if (!profile) return
    playSfx('select')
    open({ kind: 'cup' })
  }
  return (
    <Card
      wide
      art={<CupArt run={status === 'open' ? null : run} element={cup.element} />}
      color={GOLD}
      kind="TOURNAMENT · BAKUGAN CUP"
      status={status}
      statusLabel={label}
      time={`ENTRIES CLOSE IN ${timeLeft(cup.endsAt - now).toUpperCase()}`}
      name={cup.name}
      onClick={profile ? show : undefined}
    >
      <p className="mt-1 text-sm text-white/60">
        8 brawlers of your rank, single elimination: quarter-final, semi-final, final. Win three matches in a row to lift the cup.
        A new cup every {CUP_DAYS} days · one free entry a day.
      </p>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        {([1, 2, 3, 5] as Place[]).map((place) => (
          <div key={place} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
            <p
              className="font-display text-[9px] tracking-[0.25em]"
              style={{ color: place === 1 ? GOLD : 'rgba(255,255,255,0.5)' }}
            >
              {PLACE_NAME[place].toUpperCase()}
            </p>
            <div className="mt-1 flex justify-center gap-0.5">
              {cupPrize(place, cup.name).map((r, i) => (
                <span key={i} title={rewardLabel(r)}>
                  <RewardIcon kind={r.kind} size={22} />
                </span>
              ))}
            </div>
            <p className="mt-0.5 text-[10px] text-white/45">{rewardLabel(cupPrize(place, cup.name)[0])}</p>
          </div>
        ))}
      </div>
      {run && status === 'running' && (
        <p className="mt-3 text-sm text-amber-200">
          Your {ROUND_NAME[run.stage as CupStage].toLowerCase()} is waiting
          {myMatch(run) ? ` — against ${run.entrants[myMatch(run)!.foe].name}` : ''}.
        </p>
      )}
      {profile && (
        <div className="mt-auto">
          <ActionButton
            label={status === 'running' ? 'OPEN BRACKET' : status === 'open' ? 'ENTER THE CUP' : 'VIEW BRACKET'}
            color={GOLD}
            onClick={show}
          />
        </div>
      )}
    </Card>
  )
}

function CupPanel({ profile, events, now }: { profile: Profile; events: ProfileEvents; now: number }) {
  const cup = cupAt(now)
  const entry = cupEntry(events, now)
  const run = events.cup
  // the bracket of a run in progress or one played today; otherwise the entry screen
  const shown = run && (entry.running || entry.enteredToday) ? run : null
  const next = shown && entry.running ? myMatch(shown) : null
  const foe = next ? shown!.entrants[next.foe] : null
  const stage = shown?.stage as CupStage
  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-end gap-6">
        <Trophy size={72} />
        <div>
          <p className="font-display text-xs tracking-[0.5em]" style={{ color: GOLD }}>
            BAKUGAN CUP ·{' '}
            {shown && shown.cup !== cup.index ? 'EARLIER CUP' : `ENTRIES CLOSE IN ${timeLeft(cup.endsAt - now).toUpperCase()}`}
          </p>
          <h2 className="font-display text-4xl font-black tracking-wider">{(shown?.name ?? cup.name).toUpperCase()}</h2>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-[1fr_340px] gap-6">
        <div className="rounded-2xl border border-white/10 bg-black/45 p-5 backdrop-blur">
          {shown ? (
            <EventBracket run={shown} myAvatar={profile.avatar} />
          ) : (
            <div className="flex h-full min-h-[440px] flex-col items-center justify-center gap-4 text-center">
              <div className="flex gap-2">
                {Array.from({ length: 8 }, (_, i) => (
                  <span
                    key={i}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-dashed border-white/25 text-white/30"
                  >
                    ?
                  </span>
                ))}
              </div>
              <p className="max-w-md text-white/60">
                Seven brawlers near your rank are waiting. The bracket is drawn when you enter: the strongest are seeded apart.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {foe && next && (
            <div className="rounded-2xl border-2 border-amber-300/60 bg-black/55 p-5 backdrop-blur">
              <p className="font-display text-[10px] tracking-[0.4em] text-amber-300">YOUR {ROUND_NAME[stage].toUpperCase()}</p>
              <div className="mt-3 flex items-center gap-3">
                <Avatar avatar={{ kind: 'preset', id: foe.characterId }} color={ELEMENT_BY_ID[foe.element].color} size={56} />
                <div className="min-w-0">
                  <p className="font-display truncate text-lg font-black">{foe.name}</p>
                  <p className="text-xs text-white/50">
                    {TIERS[tierOf(foe.score).index].name} · {foe.score.toLocaleString('en')} pts
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-white/50">
                Brings{' '}
                {foe.team
                  .map((t) => BAKUGAN.find((b) => b.id === t.id)?.name)
                  .filter(Boolean)
                  .join(', ')}
                , levelled to your team{ROUND_BOOST[stage] ? ` +${ROUND_BOOST[stage]}G (later rounds are tougher)` : ''}.
              </p>
              <ActionButton
                label={`PLAY ${ROUND_NAME[stage].toUpperCase()}`}
                color={GOLD}
                onClick={() => {
                  playSfx('brawl')
                  playCup()
                }}
              />
            </div>
          )}

          {shown && shown.place && (
            <div
              className="rounded-2xl border-2 bg-black/55 p-5 text-center backdrop-blur"
              style={{ borderColor: shown.place === 1 ? GOLD : 'rgba(255,255,255,0.2)' }}
            >
              <div className="flex justify-center">
                <Trophy size={64} metal={shown.place === 1 ? 'gold' : shown.place === 2 ? 'silver' : 'bronze'} />
              </div>
              <p className="font-display mt-2 text-2xl font-black" style={{ color: shown.place === 1 ? GOLD : '#fff' }}>
                {shown.place === 1 ? 'CHAMPION!' : PLACE_NAME[shown.place].toUpperCase()}
              </p>
              <p className="mt-1 text-sm text-white/55">
                {shown.place === 1
                  ? 'Three wins in a row. The cup is yours.'
                  : `Out in the ${ROUND_NAME[(['qf', 'sf', 'final'] as CupStage[])[[5, 3, 2].indexOf(shown.place)]].toLowerCase()}.`}
              </p>
              <Rewards rewards={cupPrize(shown.place, shown.name)} label="PAID OUT" />
            </div>
          )}

          {!entry.running && (
            <div className="rounded-2xl border border-white/15 bg-black/55 p-5 backdrop-blur">
              {entry.enteredToday ? (
                <>
                  <p className="font-display text-[10px] tracking-[0.4em] text-white/45">NEXT ENTRY</p>
                  <p className="font-display mt-1 text-xl font-black">IN {timeLeft(dayEnd(now) - now).toUpperCase()}</p>
                  <p className="mt-1 text-xs text-white/45">One free entry a day.</p>
                </>
              ) : (
                <>
                  <p className="font-display text-[10px] tracking-[0.4em] text-emerald-300">ENTRY OPEN · FREE</p>
                  <p className="mt-1 text-sm text-white/60">
                    One entry a day. Lose once and you are out; your placement still pays. Leaving a match before it ends counts
                    as a loss.
                  </p>
                  <ActionButton
                    label="ENTER THE CUP"
                    color={GOLD}
                    onClick={() => {
                      playSfx('start')
                      enterCup()
                    }}
                  />
                </>
              )}
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-black/45 p-4 backdrop-blur">
            <p className="font-display text-[10px] tracking-[0.4em] text-white/40">PRIZES</p>
            {([1, 2, 3, 5] as Place[]).map((place) => (
              <div key={place} className="mt-2 flex items-center gap-2 text-xs">
                <span
                  className="font-display w-20 shrink-0 text-[10px] tracking-[0.2em]"
                  style={{ color: place === 1 ? GOLD : '#fff9' }}
                >
                  {PLACE_NAME[place].toUpperCase()}
                </span>
                <span className="text-white/60">
                  {cupPrize(place, shown?.name ?? cup.name)
                    .map((r) => rewardLabel(r))
                    .join(' · ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- rule events

function RuleArt({ ev }: { ev: RuleEvent }) {
  const el = ELEMENT_BY_ID[ev.element]
  const fan = (cards: { element: ElementId; label: string }[]) => (
    <div className="absolute inset-0 flex items-center justify-center">
      {cards.map((c, i) => {
        const ce = ELEMENT_BY_ID[c.element]
        const mid = (cards.length - 1) / 2
        return (
          <div
            key={i}
            className="-mx-3 flex h-28 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 bg-black/80 shadow-xl"
            style={{
              borderColor: ce.color,
              transform: `rotate(${(i - mid) * 9}deg) translateY(${Math.abs(i - mid) * 6}px)`,
              boxShadow: `0 0 14px ${ce.color}55`,
            }}
          >
            <img src={ce.icon} alt="" className="h-9 w-9" />
            <span className="font-display px-1 text-center text-[9px] leading-tight font-bold">{c.label}</span>
          </div>
        )
      })}
    </div>
  )
  switch (ev.rule) {
    case 'command-chaos':
      return fan(COMMAND_GATES.slice(0, 5).map((g) => ({ element: g.kind === 'command' ? g.element : 'pyrus', label: g.name })))
    case 'character-clash':
      return fan(
        ['dragonoid', 'hydranoid', 'skyress', 'preyas'].map((id) => {
          const b = bakuganById(id)
          return { element: b.element, label: `${b.name} ×1.5` }
        }),
      )
    case 'reactor':
      return (
        <>
          <img
            src={el.icon}
            alt=""
            className="absolute top-1/2 left-8 h-28 w-28 -translate-y-1/2"
            style={{ filter: `drop-shadow(0 0 24px ${el.glow})` }}
          />
          <div className="absolute top-1/2 right-6 flex -translate-y-1/2 flex-col gap-1.5">
            {[200, 150, 100].map((n) => {
              const g = GATE_BY_ID[`${ev.element}-${n}`]
              return g ? <GateChip key={n} gate={g} /> : null
            })}
          </div>
        </>
      )
    case 'low-g':
      return (
        <div className="absolute inset-0 flex items-center justify-center gap-5">
          <span className="font-display text-6xl font-black text-white/90 italic" style={{ textShadow: `0 0 24px ${el.glow}` }}>
            G↓
          </span>
          <div className="font-display text-left text-sm leading-tight font-black tracking-[0.2em] text-white/80">
            BASE
            <br />
            FORMS
            <br />
            ONLY
          </div>
        </div>
      )
    case 'sudden-death':
      return (
        <div className="absolute inset-0 flex items-center justify-center gap-6">
          <LifeBalls lives={1} color="#3ee07a" size={34} />
          <span className="font-display text-4xl font-black text-white/90 italic">VS</span>
          <LifeBalls lives={1} color="#ff3b5c" size={34} />
        </div>
      )
  }
}

function RuleCard({
  profile,
  events,
  ev,
  now,
  next,
}: {
  profile: Profile | null
  events: ProfileEvents
  ev: RuleEvent
  now: number
  next?: RuleEvent
}) {
  const prog = events.rules[ev.id] ?? { wins: 0, played: 0, claimed: false }
  const done = prog.wins >= ev.goal
  const status: Status = prog.claimed ? 'done' : done ? 'claim' : prog.played > 0 ? 'running' : 'open'
  const color = ELEMENT_BY_ID[ev.element].color
  return (
    <Card
      art={<RuleArt ev={ev} />}
      color={color}
      kind={ev.kind === 'daily' ? 'DAILY RULE EVENT' : 'WEEKLY RULE EVENT'}
      status={status}
      time={`${timeLeft(ev.endsAt - now).toUpperCase()} LEFT`}
      name={ev.name}
    >
      <p className="mt-1 text-sm text-white/60">{ev.blurb}</p>
      <ul className="mt-2 space-y-0.5 text-xs text-white/70">
        {ev.rules.map((r) => (
          <li key={r}>▸ {r}</li>
        ))}
        <li>▸ Win {ev.goal} matches for the reward (normal XP and BP too)</li>
      </ul>
      <Rewards rewards={ev.rewards} />
      <Progress value={prog.wins} goal={ev.goal} color={color} />
      {next && <p className="mt-2 text-[11px] text-white/35">Tomorrow: {next.name}</p>}
      {profile && (
        <div className="mt-auto flex gap-3">
          {status === 'claim' ? (
            <ActionButton
              label="CLAIM REWARD"
              color={GOLD}
              onClick={() => {
                if (claimRule(ev)) playSfx('victory')
              }}
            />
          ) : (
            <ActionButton
              label={prog.claimed ? 'PLAY AGAIN' : 'BRAWL'}
              color={color}
              onClick={() => {
                playSfx('brawl')
                playRule(ev)
              }}
            />
          )}
        </div>
      )}
    </Card>
  )
}

// ---------------------------------------------------------------- bosses

const leadOf = (boss: Boss): Entrant => {
  const t = boss.team[0]
  const bakugan = bakuganById(t.id)
  return { bakugan, form: Math.min(t.form, bakugan.evolutions.length - 1) }
}

function BossStamps({ cleared }: { cleared: Difficulty[] }) {
  return (
    <span className="flex gap-2.5">
      {DIFFICULTIES.map((d) => (
        <Stamp
          key={d.id}
          letter={d.name[0]}
          color={d.color}
          on={cleared.includes(d.id)}
          title={`${d.name}${cleared.includes(d.id) ? ': defeated' : ''}`}
        />
      ))}
    </span>
  )
}

function BossCard({
  boss,
  index,
  open,
  events,
  now,
  enabled,
}: {
  boss: Boss
  index: number
  open: boolean
  events: ProfileEvents
  now: number
  enabled: boolean
}) {
  const openView = useEventsView((s) => s.open)
  const prog = events.bosses[boss.id] ?? EMPTY_BOSS
  const el = ELEMENT_BY_ID[boss.element]
  const lead = useMemo(() => leadOf(boss), [boss])
  const defeated = prog.cleared.length > 0
  const status: Status = !open ? 'locked' : defeated ? 'done' : 'open'
  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={() => {
        if (!enabled) return
        playSfx('select')
        openView({ kind: 'boss', id: boss.id })
      }}
      whileHover={{ y: -4 }}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="cursor-pointer overflow-hidden rounded-2xl border bg-black/55 backdrop-blur"
      style={{ borderColor: `${el.color}${open ? '88' : '33'}` }}
    >
      <div className={`relative h-44 ${open ? '' : 'opacity-50 grayscale'}`}>
        <BakuganPortrait entrant={lead} />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent" />
        <img src={el.icon} alt="" className="absolute top-3 left-3 h-8 w-8" />
        {defeated && (
          <span className="font-display absolute top-3 right-3 rotate-6 rounded border-2 border-emerald-300 bg-black/70 px-2 py-0.5 text-[10px] font-black tracking-[0.25em] text-emerald-300">
            DEFEATED
          </span>
        )}
        <div className="absolute inset-x-3 bottom-2">
          <p className="font-display text-[9px] tracking-[0.4em]" style={{ color: el.color }}>
            BOSS BATTLE
          </p>
          <p className="font-display text-xl leading-tight font-black">{boss.name}</p>
          <p className="truncate text-[11px] text-white/55">
            {boss.team.map((t) => bakuganById(t.id).evolutions[t.form]?.name).join(' · ')}
          </p>
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-center justify-between">
          <StatusPill
            status={status}
            label={!open ? `RETURNS IN ${timeLeft(bossReturns(index, now) - now).toUpperCase()}` : undefined}
          />
          <BossStamps cleared={prog.cleared} />
        </div>
        <p className="mt-2 line-clamp-2 text-xs text-white/55 italic">“{boss.quote}”</p>
      </div>
    </motion.div>
  )
}

function BossPanel({ profile, boss, events, now }: { profile: Profile; boss: Boss; events: ProfileEvents; now: number }) {
  const index = BOSSES.indexOf(boss)
  const open = bossOpen(index, now)
  const prog = events.bosses[boss.id] ?? EMPTY_BOSS
  const el = ELEMENT_BY_ID[boss.element]
  // Hard opens once Normal is beaten, Brutal once Hard is
  const unlocked = (d: Difficulty) => d === 'normal' || prog.cleared.includes(d === 'hard' ? 'normal' : 'hard')
  const best = [...DIFFICULTIES].reverse().find((d) => unlocked(d.id) && !prog.cleared.includes(d.id))?.id ?? 'normal'
  const [picked, setPicked] = useState<Difficulty>(best)
  const info = DIFFICULTY_BY_ID[picked]
  const team = bossTeam(profile, boss, picked)
  const lead = useMemo(() => leadOf(boss), [boss])
  const bounty = prog.bounty !== weekKey(now)
  return (
    <div className="mt-4">
      <div className="grid grid-cols-[380px_1fr] gap-6">
        <div className="relative h-[380px] overflow-hidden rounded-2xl border-2" style={{ borderColor: `${el.color}88` }}>
          <BakuganPortrait entrant={lead} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
          <div className="absolute inset-x-4 bottom-4 flex items-center justify-between">
            <BossStamps cleared={prog.cleared} />
            <span className="font-display text-[10px] tracking-[0.3em] text-white/60">
              {prog.wins}W · {prog.losses}L
            </span>
          </div>
        </div>
        <div>
          <p className="font-display flex items-center gap-2 text-xs tracking-[0.5em]" style={{ color: el.color }}>
            <img src={el.icon} alt="" className="h-6 w-6" /> BOSS BATTLE · {el.name.toUpperCase()}
          </p>
          <h2 className="font-display mt-1 text-5xl font-black tracking-wider">{boss.name.toUpperCase()}</h2>
          <p className="mt-2 text-lg text-white/80 italic">“{boss.quote}”</p>
          <p className="mt-2 max-w-2xl text-white/55">{boss.bio}</p>
          {!open && (
            <p className="mt-3 inline-block rounded-lg border border-red-400/50 bg-red-500/10 px-3 py-1.5 text-sm text-red-200">
              🔒 Not in this week's line-up · returns in {timeLeft(bossReturns(index, now) - now)}
            </p>
          )}

          <p className="font-display mt-5 text-[10px] tracking-[0.4em] text-white/40">BOSS TEAM · {info.name.toUpperCase()}</p>
          <div className="mt-2 flex flex-wrap gap-3">
            {team.map((e) => (
              <div
                key={e.bakugan.id}
                className="flex items-center gap-3 rounded-xl border bg-black/50 p-2 pr-4"
                style={{ borderColor: `${ELEMENT_BY_ID[e.bakugan.element].color}66` }}
              >
                <div className="h-14 w-14 overflow-hidden rounded-lg">
                  <BakuganPortrait entrant={e} />
                </div>
                <div className="leading-tight">
                  <p className="font-bold">{formOf(e).name}</p>
                  <p className="text-xs text-white/50">
                    {formBrawlG(e) + (e.bonusG ?? 0)}G <span style={{ color: info.color }}>+{info.boost}G boss boost</span>
                  </p>
                  <p className="text-[10px] text-white/35">
                    {e.cards ? `${e.cards.length} ability cards` : 'every ability card'}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-white/40">
            The boss's Bakugan match your strongest one, then the boss boost goes on top.
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        {DIFFICULTIES.map((d) => {
          const can = unlocked(d.id)
          const cleared = prog.cleared.includes(d.id)
          const on = picked === d.id
          return (
            <button
              key={d.id}
              disabled={!can}
              onClick={() => {
                playSfx('tick')
                setPicked(d.id)
              }}
              className="rounded-2xl border-2 bg-black/55 p-4 text-left backdrop-blur transition disabled:opacity-40"
              style={{ borderColor: on ? d.color : 'rgba(255,255,255,0.12)', boxShadow: on ? `0 0 20px ${d.color}44` : 'none' }}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-xl font-black" style={{ color: d.color }}>
                  {!can && '🔒 '}
                  {d.name.toUpperCase()}
                </span>
                {cleared ? (
                  <StatusPill status="done" label="DEFEATED" />
                ) : can ? (
                  <StatusPill status="open" />
                ) : (
                  <StatusPill status="locked" />
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-white/65">
                <span>Boss boost</span>
                <span className="text-right font-bold text-white">+{d.boost}G each</span>
                <span>Lives</span>
                <span className="flex items-center justify-end gap-2">
                  <LifeBalls lives={d.lives[0]} color="#3ee07a" size={8} /> vs{' '}
                  <LifeBalls lives={d.lives[1]} color={d.color} size={8} />
                </span>
                <span>Boss plays like</span>
                <span className="text-right">{TIERS[Math.max(d.tier, playerTier(profile))].name}</span>
              </div>
              {!can && <p className="mt-2 text-[11px] text-white/45">Beat {d.id === 'hard' ? 'Normal' : 'Hard'} first.</p>}
              <Rewards rewards={bossPrize(boss, d.id)} label={cleared ? 'FIRST CLEAR · COLLECTED' : 'FIRST CLEAR'} />
            </button>
          )
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-6">
        <motion.button
          disabled={!open || !unlocked(picked)}
          onClick={() => {
            playSfx('brawl')
            playBoss(boss, picked)
          }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          className="font-display skew-x-[-12deg] border-2 px-12 py-4 text-xl font-black tracking-[0.3em] disabled:opacity-35"
          style={{ borderColor: info.color, background: `${info.color}22` }}
        >
          BRAWL {boss.name.split(' ')[0].toUpperCase()} · {info.name.toUpperCase()}
        </motion.button>
        <p className="text-sm text-white/55">
          {bounty ? (
            <>
              Weekly bounty: your first win against {boss.name} this week pays <b>{rewardLabel(BOSS_BOUNTY[0])}</b>.
            </>
          ) : (
            'Weekly bounty collected — back next week.'
          )}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- trophies

function Cabinet({ events }: { events: ProfileEvents }) {
  return (
    <div className="mt-10 grid grid-cols-[1fr_1fr] gap-5">
      <div className="rounded-2xl border border-amber-300/25 bg-black/45 p-5 backdrop-blur">
        <h2 className="font-display text-xs tracking-[0.5em] text-amber-300/80">TROPHY CABINET</h2>
        {events.trophies.length === 0 ? (
          <p className="mt-3 text-sm text-white/45">Reach a Bakugan Cup final to put your first trophy here.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-4">
            {[...events.trophies].reverse().map((t, i) => (
              <div key={i} className="flex w-28 flex-col items-center text-center">
                <Trophy size={56} metal={t.place === 1 ? 'gold' : 'silver'} />
                <p className="mt-1 text-xs leading-tight font-bold">{t.cup}</p>
                <p className="text-[10px] text-white/45">
                  {t.place === 1 ? 'Champion' : 'Runner-up'} · {new Date(t.at).toLocaleDateString('en-GB')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-2xl border border-white/10 bg-black/45 p-5 backdrop-blur">
        <h2 className="font-display text-xs tracking-[0.5em] text-white/50">BOSSES DEFEATED</h2>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2.5">
          {BOSSES.map((b) => (
            <div key={b.id} className="flex items-center gap-3">
              <img src={ELEMENT_BY_ID[b.element].icon} alt="" className="h-6 w-6" />
              <span className="flex-1 truncate text-sm">{b.name}</span>
              <BossStamps cleared={events.bosses[b.id]?.cleared ?? []} />
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-white/35">Brutal clears give a title to wear (Inventory → Titles).</p>
      </div>
    </div>
  )
}
