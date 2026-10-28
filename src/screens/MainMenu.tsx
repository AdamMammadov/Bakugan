import { AnimatePresence, motion } from 'framer-motion'
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { playSfx } from '../audio/sfx'
import { GAME_SUBTITLE, GAME_TITLE } from '../brand'
import { Trophy } from '../components/EventArt'
import { useEventsLine } from '../components/eventsLine'
import { leadKey, leadOf, leadPicture, preloadLead } from '../components/menuLead'
import { MenuIcon, type MenuIconName } from '../components/MenuIcon'
import { MenuSide } from '../components/MenuSide'
import { MuteButton } from '../components/MuteButton'
import { BpIcon } from '../components/RewardIcon'
import { ELEMENT_BY_ID, type ElementInfo } from '../data/elements'
import { openEvents } from '../events/nav'
import { seasonFor, useActiveProfile } from '../profile/useProfiles'
import { currentSeason } from '../season/current'
import { LEVEL_XP, PASS_LEVELS, passLevel, timeLeft } from '../season/season'
import { useGame } from '../store/useGame'

// the 3D stage pulls in three.js: the menu shows at once, with a saved picture of the lead until its model is in
const MenuStage = lazy(() => import('../components/MenuStage'))

const EVENTS_COLOR = '#a78bfa'
const PASS_COLOR = '#fcd34d'
const SHOP_COLOR = '#34d399'
const LIVE_COLOR = '#f43f5e'

/** Dark text on light attribute colours (Haos), white on the rest. */
function ink(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? '#0b0c12' : '#ffffff'
}

/** The time, moving on every half minute (countdowns, who is online). */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  return now
}

/** The home screen: the player, their lead Bakugan, BRAWL, and the way to every other place in the game. */
export function MainMenu() {
  const profile = useActiveProfile()
  const chosen = useGame((s) => s.element)
  const go = useGame((s) => s.go)
  const openPage = useGame((s) => s.openPage)
  const compareWith = useGame((s) => s.compareWith)
  const openBakugan = useGame((s) => s.openBakugan)
  const watchLive = useGame((s) => s.watchLive)
  const element = ELEMENT_BY_ID[profile?.element ?? chosen ?? 'pyrus']
  const lead = leadOf(profile, element.id)
  const leadEl = ELEMENT_BY_ID[lead.bakugan.element]
  const root = useRef<HTMLDivElement>(null)

  const events = useEventsLine()
  const now = useNow()
  const season = currentSeason(now)
  const pass = profile ? seasonFor(profile).passXp : 0
  const level = passLevel(pass)
  const into = level >= PASS_LEVELS ? 1 : (pass - LEVEL_XP[level]) / (LEVEL_XP[level + 1] - LEVEL_XP[level])
  const owned = profile?.collection.length ?? 1

  // the lead's model first, ahead of every other download
  useEffect(() => preloadLead(lead.bakugan.id, lead.form, lead.skin), [lead.bakugan.id, lead.form, lead.skin])

  // arrow keys walk through the menu (Tab works too); the BRAWL button has the focus to begin with
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key]
      const box = root.current
      if (!step || !box) return
      const active = document.activeElement
      if (active && active !== document.body && !box.contains(active)) return
      const items = [...box.querySelectorAll<HTMLElement>('[data-menu-item]:not(:disabled)')]
      const i = items.indexOf(active as HTMLElement)
      e.preventDefault()
      items[i < 0 ? 0 : (i + step + items.length) % items.length]?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const select = (fn: () => void) => () => {
    playSfx('select')
    fn()
  }

  const vars = {
    '--menu-accent': element.color,
    '--menu-glow': `${element.color}99`,
    '--menu-line': `${element.color}38`,
  } as CSSProperties

  return (
    <motion.div
      ref={root}
      className="absolute inset-0 overflow-x-hidden overflow-y-auto bg-[#05060a] lg:overflow-hidden"
      style={vars}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Backdrop element={element} />

      <div className="relative z-10 grid min-h-full grid-cols-1 gap-6 px-6 py-6 lg:h-full lg:grid-cols-[minmax(19rem,24rem)_1fr_minmax(24rem,28rem)] lg:gap-7 lg:px-9 xl:px-12 2xl:grid-cols-[minmax(19rem,29rem)_1fr_minmax(24rem,33rem)]">
        {/* left: the logo, BRAWL and the main places */}
        <motion.div
          className="flex min-h-0 flex-col gap-4"
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <Logo element={element} />
          <motion.button
            data-menu-item
            autoFocus
            onClick={select(() => compareWith(lead.bakugan.id, lead.form))}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="menu-item menu-pulse group relative mt-1 w-full skew-x-[-8deg] overflow-hidden rounded-lg border-2 px-6 py-3.5 text-left"
            style={{
              borderColor: element.glow,
              color: ink(element.color),
              background: `linear-gradient(100deg, ${element.color} 0%, ${element.color}cc 55%, ${element.glow}aa 100%)`,
            }}
          >
            <span className="menu-sweep pointer-events-none absolute inset-0" />
            <span className="relative flex skew-x-[8deg] items-center gap-4">
              <MenuIcon
                name="brawl"
                size={38}
                className="shrink-0 transition duration-300 group-hover:scale-125 group-hover:rotate-6"
              />
              <span className="min-w-0 flex-1">
                <span className="font-display block text-[clamp(2.1rem,3.2vw,3.3rem)] leading-none font-black tracking-[0.14em] italic">
                  BRAWL
                </span>
                <span className="font-display mt-1.5 block truncate text-[10px] font-bold tracking-[0.28em] opacity-85">
                  {profile ? 'RANKED' : 'PRACTICE'} · WITH {lead.name.toUpperCase()}
                </span>
              </span>
              <span className="font-display text-3xl transition duration-300 group-hover:translate-x-1.5">›</span>
            </span>
          </motion.button>

          <div className="grid min-h-0 gap-2 lg:max-h-[24rem] lg:flex-1 lg:auto-rows-fr 2xl:max-h-[30rem]">
            <PrimaryTile
              icon="bakugan"
              color={element.color}
              title="BAKUGAN"
              sub={`${element.name.toUpperCase()} ROSTER & MORE`}
              meta={<Meta value={owned} label="OWNED" />}
              onClick={select(() => go('hub'))}
              delay={0.08}
            />
            <PrimaryTile
              icon="events"
              color={EVENTS_COLOR}
              title="EVENTS"
              sub={events.line}
              meta={<Trophy size={30} />}
              alert={events.ready}
              onClick={select(openEvents)}
              delay={0.13}
            />
            <PrimaryTile
              icon="pass"
              color={PASS_COLOR}
              title="SEASON PASS"
              sub={`SEASON ${season.id} · ENDS IN ${timeLeft(season.endsAt - now).toUpperCase()}`}
              meta={<LevelRing level={level} into={into} />}
              onClick={select(() => openPage('pass'))}
              delay={0.18}
            />
            <PrimaryTile
              icon="shop"
              color={SHOP_COLOR}
              title="SHOP"
              sub="BAKUGAN · SKINS · PACKS"
              meta={
                profile && (
                  <span className="font-display flex items-center gap-1 text-xs font-bold">
                    <BpIcon size={16} /> {profile.bp.toLocaleString('en')}
                  </span>
                )
              }
              onClick={select(() => openPage('shop'))}
              delay={0.23}
            />
            <PrimaryTile
              icon="live"
              color={LIVE_COLOR}
              title="LIVE MATCHES"
              sub="TOP BRAWLERS NOW"
              meta={
                <span className="font-display flex items-center gap-1.5 rounded-full border border-rose-500/60 bg-rose-500/15 px-2 py-0.5 text-[9px] font-bold tracking-[0.25em] text-rose-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500 shadow-[0_0_6px_#f43f5e]" /> LIVE
                </span>
              }
              onClick={select(watchLive)}
              delay={0.28}
            />
          </div>
          <div className="mt-auto flex justify-end">
            <MuteButton />
          </div>
        </motion.div>

        {/* middle: the lead Bakugan on its stand, and its name plate */}
        <div className="relative hidden min-h-0 flex-col items-center lg:flex">
          <LeadStage lead={lead} />
          <motion.button
            data-menu-item
            onClick={select(() => openBakugan(lead.bakugan.id))}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.97 }}
            title={`Inspect ${lead.name} in 3D`}
            className="menu-item group mt-2 flex shrink-0 items-center gap-3 rounded-full border border-white/15 bg-black/60 py-1.5 pr-5 pl-1.5 backdrop-blur transition hover:border-[var(--menu-accent)] hover:bg-black/80"
          >
            <img src={leadEl.icon} alt="" className="h-9 w-9" />
            <span className="text-left whitespace-nowrap">
              <span className="font-display block text-[9px] tracking-[0.25em] text-white/45">
                LEAD BAKUGAN · <span className="transition group-hover:text-white">INSPECT →</span>
              </span>
              <span className="font-display block text-base leading-tight font-black tracking-wider">
                {lead.name.toUpperCase()}
                <span className="ml-2.5 text-sm" style={{ color: leadEl.color }}>
                  {lead.g}G
                </span>
              </span>
            </span>
          </motion.button>
        </div>

        {/* right: the player, today's events, friends and clan, the other pages */}
        <motion.div
          // a big screen shows the same panels larger
          className="min-h-0 2xl:[zoom:1.2]"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.05 }}
        >
          <MenuSide profile={profile} element={element} now={now} />
        </motion.div>
      </div>
    </motion.div>
  )
}

/**
 * The lead in 3D, fitted into the middle column. Until its model is in, the picture saved last time (or a glowing
 * ball in its colours on a first visit) stands in, then fades over to the model.
 */
function LeadStage({ lead }: { lead: ReturnType<typeof leadOf> }) {
  const key = leadKey(lead.bakugan.id, lead.form, lead.skin)
  const picture = useMemo(() => leadPicture(key), [key])
  const [ready, setReady] = useState<string | null>(null)
  const shown = ready === key
  const el = ELEMENT_BY_ID[lead.bakugan.element]
  return (
    <div className="pointer-events-none relative min-h-0 w-full flex-1">
      <AnimatePresence>
        {!shown && (
          <motion.div
            key={key}
            className="absolute inset-0 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.6 } }}
          >
            {picture ? (
              <img src={picture} alt="" draggable={false} className="h-full w-full object-contain" />
            ) : (
              <StageFallback color={el.color} icon={el.icon} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <Suspense fallback={null}>
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: shown ? 1 : 0 }}
          transition={{ duration: 0.6 }}
        >
          <MenuStage key={key} id={lead.bakugan.id} form={lead.form} skin={lead.skin} onReady={() => setReady(key)} />
        </motion.div>
      </Suspense>
    </div>
  )
}

/** A first visit, before the model is in: the Bakugan's ball, glowing on its stand. */
function StageFallback({ color, icon }: { color: string; icon: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-end pb-[8%]">
      <motion.div
        className="relative flex h-28 w-28 items-center justify-center rounded-full"
        style={{
          background: `radial-gradient(circle at 35% 30%, #fff8, ${color} 45%, #07080d 100%)`,
          boxShadow: `0 0 60px ${color}`,
        }}
        animate={{ y: [0, -10, 0] }}
        transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
      >
        <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-black/50" />
        <img src={icon} alt="" className="relative h-12 w-12" />
      </motion.div>
      <div className="mt-6 h-6 w-64 rounded-[50%] border-2" style={{ borderColor: color, boxShadow: `0 0 30px ${color}` }} />
    </div>
  )
}

/** A wide tile for the main places, in its own colour, with something to show on its right. */
function PrimaryTile({
  icon,
  color,
  title,
  sub,
  meta,
  alert,
  onClick,
  delay,
}: {
  icon: MenuIconName
  color: string
  title: string
  sub: string
  meta?: ReactNode
  alert?: boolean
  onClick: () => void
  delay: number
}) {
  return (
    <motion.button
      data-menu-item
      onClick={onClick}
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      whileHover={{ x: 6 }}
      whileTap={{ scale: 0.97 }}
      className="menu-item group relative flex min-h-[3.4rem] w-full items-center gap-3.5 overflow-hidden rounded-xl border border-white/10 bg-[#0b0c12]/70 px-3.5 text-left backdrop-blur transition-colors hover:bg-[#0b0c12]/90"
    >
      {/* the tile's colour runs in from the left on hover */}
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, ${color}30, transparent 75%)`, boxShadow: `inset 0 0 0 1px ${color}aa` }}
      />
      <span
        className="absolute inset-y-0 left-0 w-1 transition-all duration-300 group-hover:w-1.5"
        style={{ background: color, boxShadow: `0 0 12px ${color}` }}
      />
      <span
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition duration-300 group-hover:scale-110 group-hover:rotate-[-4deg]"
        style={{
          borderColor: `${color}99`,
          color,
          background: `linear-gradient(145deg, ${color}38, ${color}0d)`,
          boxShadow: `0 0 14px ${color}33`,
        }}
      >
        <MenuIcon name={icon} />
        {alert && (
          <span
            className="absolute -top-1 -right-1 h-2.5 w-2.5 animate-pulse rounded-full"
            style={{ background: color, boxShadow: `0 0 8px ${color}` }}
          />
        )}
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="font-display block text-base leading-tight font-black tracking-[0.12em]">{title}</span>
        <span className="font-display block truncate text-[9.5px] tracking-[0.2em]" style={{ color }}>
          {sub}
        </span>
      </span>
      {meta && <span className="relative shrink-0">{meta}</span>}
      <span className="font-display relative text-xl text-white/25 transition group-hover:translate-x-1 group-hover:text-white">
        ›
      </span>
    </motion.button>
  )
}

/** A number with a small label under it. */
const Meta = ({ value, label }: { value: number; label: string }) => (
  <span className="font-display flex flex-col items-center leading-none">
    <span className="text-lg font-black">{value}</span>
    <span className="mt-0.5 text-[7.5px] tracking-[0.25em] text-white/45">{label}</span>
  </span>
)

/** The pass level in a ring that fills towards the next one. */
function LevelRing({ level, into }: { level: number; into: number }) {
  const r = 15
  const c = 2 * Math.PI * r
  return (
    <span className="relative flex h-10 w-10 items-center justify-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#ffffff1a" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke={PASS_COLOR}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${c * into} ${c}`}
        />
      </svg>
      <span className="font-display text-[11px] font-black" style={{ color: PASS_COLOR }}>
        {level}
      </span>
    </span>
  )
}

/** Drifting attribute light, turning rays and emblem, a rolling floor grid and rising motes. */
function Backdrop({ element }: { element: ElementInfo }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="menu-drift absolute -top-1/4 -left-1/4 h-[80vh] w-[80vh] rounded-full opacity-50 blur-3xl"
        style={{ background: `radial-gradient(circle, ${element.color} 0%, transparent 65%)` }}
      />
      <div
        className="menu-drift absolute -right-1/4 -bottom-1/3 h-[90vh] w-[90vh] rounded-full opacity-35 blur-3xl"
        style={{ background: `radial-gradient(circle, ${element.glow} 0%, transparent 65%)`, animationDelay: '-9s' }}
      />
      {/* rays and the attribute emblem behind the Bakugan */}
      <div className="absolute top-[42%] left-1/2 h-[150vh] w-[150vh] -translate-x-1/2 -translate-y-1/2">
        <div
          className="menu-spin h-full w-full rounded-full opacity-[0.16]"
          style={{
            background: `repeating-conic-gradient(${element.color} 0deg 5deg, transparent 5deg 20deg)`,
            maskImage: 'radial-gradient(circle, #000 0%, transparent 60%)',
          }}
        />
      </div>
      <img
        src={element.icon}
        alt=""
        draggable={false}
        className="menu-spin-rev absolute top-[44%] left-1/2 h-[62vh] w-[62vh] -translate-x-1/2 -translate-y-1/2 opacity-[0.07]"
        style={{ filter: `drop-shadow(0 0 40px ${element.glow})` }}
      />
      <div className="menu-floor absolute inset-x-[-50%] bottom-0 h-[55%]" />
      {Array.from({ length: 22 }, (_, i) => (
        <span
          key={i}
          className="menu-mote"
          style={{
            left: `${(i * 37 + 11) % 100}%`,
            width: 3 + (i % 4) * 2,
            height: 3 + (i % 4) * 2,
            background: i % 3 ? element.glow : '#fff',
            boxShadow: `0 0 10px ${element.glow}`,
            animationDuration: `${9 + ((i * 7) % 9)}s`,
            animationDelay: `${-((i * 13) % 17)}s`,
          }}
        />
      ))}
      {/* darker edges keep the text readable */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,#05060acc_100%)]" />
      <div className="absolute inset-y-0 left-0 w-[34rem] max-w-[60%] bg-gradient-to-r from-[#05060a] via-[#05060a99] to-transparent" />
      <div className="absolute inset-y-0 right-0 w-[30rem] max-w-[55%] bg-gradient-to-l from-[#05060a] via-[#05060a99] to-transparent" />
    </div>
  )
}

/** The game's name, in the player's colours. */
function Logo({ element }: { element: ElementInfo }) {
  return (
    <div className="flex items-center gap-4">
      <motion.img
        src={element.icon}
        alt=""
        draggable={false}
        className="h-16 w-16 shrink-0 2xl:h-20 2xl:w-20"
        style={{ filter: `drop-shadow(0 0 22px ${element.glow})` }}
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ repeat: Infinity, duration: 2.6, ease: 'easeInOut' }}
      />
      {/* the name shrinks to fit the column, whatever the brand name's length */}
      <div className="@container min-w-0 flex-1">
        <h1
          className="menu-logo font-display pr-2 leading-none font-black tracking-[0.04em] whitespace-nowrap italic"
          style={{
            fontSize: `min(3.75rem, ${(100 / (GAME_TITLE.length * 0.9 + 0.4)).toFixed(2)}cqw)`,
            filter: `drop-shadow(0 3px 0 #000) drop-shadow(0 0 22px ${element.color}aa)`,
          }}
        >
          {GAME_TITLE.toUpperCase()}
        </h1>
        <div
          className="mt-2 inline-block skew-x-[-14deg] px-3 py-0.5"
          style={{ background: element.color, color: ink(element.color) }}
        >
          <span className="font-display block skew-x-[14deg] text-[11px] font-bold tracking-[0.6em]">
            {GAME_SUBTITLE.toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  )
}
