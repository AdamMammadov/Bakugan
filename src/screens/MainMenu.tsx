import { AnimatePresence, motion } from 'framer-motion'
import { lazy, Suspense, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { playSfx } from '../audio/sfx'
import { Avatar } from '../components/Avatar'
import { useEventsLine } from '../components/eventsLine'
import { MenuIcon, type MenuIconName } from '../components/MenuIcon'
import { BpIcon } from '../components/RewardIcon'
import { BAKUGAN, formBrawlG, formOf } from '../data/bakugan'
import { ELEMENT_BY_ID, type ElementInfo } from '../data/elements'
import { openEvents } from '../events/nav'
import { TIER_COLORS } from '../profile/brawlers'
import { isBot } from '../profile/bots'
import { presenceOf } from '../profile/presence'
import { clanOf, useClans } from '../profile/useClans'
import { useUnread } from '../profile/useFriendChat'
import { rankScore, seasonFor, starterFor, tierOf, useActiveProfile, useProfiles, type Profile } from '../profile/useProfiles'
import { currentSeason } from '../season/current'
import { LEVEL_XP, PASS_LEVELS, passLevel, timeLeft } from '../season/season'
import { useGame, type PageScreen } from '../store/useGame'

// the 3D stage pulls in three.js: the menu shows at once and the Bakugan joins when it has loaded
const MenuStage = lazy(() => import('../components/MenuStage'))

const EVENTS_COLOR = '#a78bfa'
const PASS_COLOR = '#fcd34d'
const SHOP_COLOR = '#34d399'

/** Dark text on light attribute colours (Haos), white on the rest. */
function ink(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.55 ? '#0b0c12' : '#ffffff'
}

/** The Bakugan the player leads with: the first of their team, else their first; a guest's is the starter. */
function leadOf(profile: Profile | null, element: ElementInfo) {
  const owned = profile && (profile.collection.find((o) => o.id === profile.team[0]) ?? profile.collection[0])
  const id = owned?.id ?? starterFor(element.id)
  const bakugan = BAKUGAN.find((b) => b.id === id) ?? BAKUGAN[0]
  const form = owned?.form ?? 0
  return { bakugan, form, skin: owned?.skin, name: formOf({ bakugan, form }).name, g: formBrawlG({ bakugan, form }) }
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

/** Friends and who of them is online, and unread messages. */
function useFriendsInfo(profile: Profile | null, now: number) {
  const all = profile?.friends ?? []
  const friends = all.filter((f) => f.since <= now)
  const online = friends.filter((f) => isBot(f.id) && presenceOf(f.id, now).online).length
  const unread = useUnread(
    profile?.id,
    all.map((f) => f.id),
  )
  return { count: friends.length, online, unread }
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
  const newProfile = useGame((s) => s.newProfile)
  const element = ELEMENT_BY_ID[profile?.element ?? chosen ?? 'pyrus']
  const lead = leadOf(profile, element)
  const root = useRef<HTMLDivElement>(null)

  const events = useEventsLine()
  const now = useNow()
  const friends = useFriendsInfo(profile, now)
  const clans = useClans((s) => s.clans)
  const clan = clanOf(clans, profile?.id)
  const season = currentSeason(now)
  const level = profile ? passLevel(seasonFor(profile).passXp) : 0
  const owned = profile?.collection.length ?? 1

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

  const page = (screen: PageScreen) => () => {
    playSfx('select')
    openPage(screen)
  }
  const brawl = () => {
    playSfx('select')
    compareWith(lead.bakugan.id, lead.form)
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

      {/* the lead Bakugan, centre stage */}
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[min(54rem,62vw)] -translate-x-1/2">
        <Suspense fallback={<StageFallback color={element.color} />}>
          <MenuStage id={lead.bakugan.id} form={lead.form} skin={lead.skin} />
        </Suspense>
      </div>

      <div className="relative z-10 grid min-h-full grid-cols-1 gap-8 px-6 py-8 lg:h-full lg:grid-cols-[minmax(19rem,25rem)_1fr_minmax(19rem,26.5rem)] lg:px-10 xl:px-14 2xl:grid-cols-[minmax(19rem,30rem)_1fr_minmax(19rem,30rem)]">
        {/* left: the logo, BRAWL and the main places */}
        <motion.div
          className="flex flex-col gap-5"
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <Logo element={element} />
          <motion.button
            data-menu-item
            autoFocus
            onClick={brawl}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="menu-item menu-pulse group relative mt-2 w-full skew-x-[-8deg] overflow-hidden rounded-lg border-2 px-6 py-4 text-left"
            style={{
              borderColor: element.glow,
              color: ink(element.color),
              background: `linear-gradient(100deg, ${element.color} 0%, ${element.color}cc 55%, ${element.glow}aa 100%)`,
            }}
          >
            <span className="menu-sweep pointer-events-none absolute inset-0" />
            <span className="relative flex skew-x-[8deg] items-center gap-4">
              <MenuIcon name="brawl" size={40} className="shrink-0 transition group-hover:scale-110" />
              <span className="min-w-0 flex-1">
                <span className="font-display block text-[clamp(2.2rem,3.4vw,3.4rem)] leading-none font-black tracking-[0.14em] italic">
                  BRAWL
                </span>
                <span className="font-display mt-1.5 block truncate text-[10px] font-bold tracking-[0.3em] opacity-80">
                  FACE-OFF WITH {lead.name.toUpperCase()}
                </span>
              </span>
              <span className="font-display text-3xl transition group-hover:translate-x-1">›</span>
            </span>
          </motion.button>

          <div className="grid gap-2.5 lg:max-h-[25rem] lg:flex-1 lg:auto-rows-fr 2xl:max-h-[31rem]">
            <PrimaryTile
              icon="bakugan"
              color={element.color}
              title="BAKUGAN"
              sub={`${owned} OWNED · ${element.name.toUpperCase()} ROSTER`}
              onClick={() => {
                playSfx('select')
                go('hub')
              }}
              delay={0.1}
            />
            <PrimaryTile
              icon="events"
              color={EVENTS_COLOR}
              title="EVENTS"
              sub={events.line}
              badge={events.ready ? <Dot color={EVENTS_COLOR} /> : undefined}
              onClick={() => {
                playSfx('select')
                openEvents()
              }}
              delay={0.15}
            />
            <PrimaryTile
              icon="pass"
              color={PASS_COLOR}
              title="SEASON PASS"
              sub={`${profile ? `LEVEL ${level} / ${PASS_LEVELS} · ` : ''}ENDS IN ${timeLeft(season.endsAt - now).toUpperCase()}`}
              onClick={page('pass')}
              delay={0.2}
            />
            <PrimaryTile
              icon="shop"
              color={SHOP_COLOR}
              title="SHOP"
              sub="BAKUGAN · SKINS · PACKS"
              onClick={page('shop')}
              delay={0.25}
            />
          </div>
          <p className="mt-auto hidden text-[11px] text-white/25 lg:block">
            Non-commercial fan project. Bakugan is a trademark of Spin Master Ltd. and Sega Toys.
          </p>
        </motion.div>

        {/* middle: the lead Bakugan's name plate under the stage */}
        <div className="relative hidden min-h-[16rem] flex-col items-center justify-end pb-2 lg:flex">
          <motion.button
            data-menu-item
            onClick={() => {
              playSfx('select')
              openBakugan(lead.bakugan.id)
            }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.97 }}
            title={`Inspect ${lead.name} in 3D`}
            className="menu-item group flex items-center gap-4 rounded-full border border-white/15 bg-black/55 py-2 pr-6 pl-2 backdrop-blur transition hover:border-[var(--menu-accent)] hover:bg-black/75"
          >
            <img src={ELEMENT_BY_ID[lead.bakugan.element].icon} alt="" className="h-10 w-10" />
            <span className="text-left whitespace-nowrap">
              <span className="font-display block text-[10px] tracking-[0.25em] text-white/45">
                LEAD BAKUGAN · <span className="transition group-hover:text-white">INSPECT →</span>
              </span>
              <span className="font-display block text-lg leading-tight font-black tracking-wider">
                {lead.name.toUpperCase()}
                <span className="ml-3 text-base" style={{ color: ELEMENT_BY_ID[lead.bakugan.element].color }}>
                  {lead.g}G
                </span>
              </span>
            </span>
          </motion.button>
        </div>

        {/* right: the player and every other place */}
        <motion.div
          className="flex flex-col gap-4 lg:pb-16"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: 0.05 }}
        >
          <PlayerCard profile={profile} element={element} clanTag={clan?.tag} level={level} onNew={newProfile} />
          <div className="grid grid-cols-2 gap-2 lg:max-h-[26rem] lg:flex-1 lg:auto-rows-fr 2xl:max-h-[34rem]">
            <Tile
              icon="profile"
              title="PROFILE"
              sub={profile ? 'STATS · TEAM · LOCKER' : 'NO BRAWLER'}
              onClick={page('profile')}
              disabled={!profile}
            />
            <Tile
              icon="inventory"
              title="INVENTORY"
              sub={profile ? `${profile.boosts ?? 0} BOOSTS · ${profile.cardKeys ?? 0} KEYS` : 'NO BRAWLER'}
              onClick={page('inventory')}
              disabled={!profile}
            />
            <Tile
              icon="rankings"
              title="RANKINGS"
              sub={profile ? `${profile.rating.toLocaleString('en')} BR` : 'TOP BRAWLERS'}
              onClick={page('rankings')}
            />
            <Tile
              icon="clans"
              title="CLANS"
              sub={clan ? `[${clan.tag}] ${clan.name.toUpperCase()}` : 'JOIN OR FOUND ONE'}
              onClick={page('clans')}
            />
            <Tile
              icon="friends"
              title="FRIENDS"
              sub={profile ? `${friends.online} ONLINE · ${friends.count} FRIEND${friends.count === 1 ? '' : 'S'}` : 'NO BRAWLER'}
              badge={friends.unread > 0 ? <Count n={friends.unread} /> : undefined}
              onClick={page('friends')}
              disabled={!profile}
            />
            <Tile
              icon="live"
              title="LIVE MATCHES"
              sub="WATCH CPU BRAWLS"
              badge={<Dot color="#ef4444" />}
              onClick={() => {
                playSfx('select')
                watchLive()
              }}
            />
            <Tile icon="encyclopedia" title="ENCYCLOPEDIA" sub="EVERY BAKUGAN & CARD" onClick={page('encyclopedia')} />
            <Tile icon="showroom" title="BAKUGAN SHOWROOM" sub="ALL MODELS IN 3D" onClick={page('showroom')} />
            <Tile icon="characters" title="BRAWLER SHOWROOM" sub="SERIES CHARACTERS" onClick={page('characters')} />
            <Tile icon="plus" title="NEW BRAWLER" sub="ANOTHER PROFILE" onClick={newProfile} />
          </div>
        </motion.div>
      </div>
    </motion.div>
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
      <div className="min-w-0">
        <h1
          className="menu-logo font-display pr-2 text-[3.2rem] leading-none font-black tracking-[0.04em] italic 2xl:text-[3.75rem]"
          style={{ filter: `drop-shadow(0 3px 0 #000) drop-shadow(0 0 22px ${element.color}aa)` }}
        >
          BAKUGAN
        </h1>
        <div
          className="mt-2 inline-block skew-x-[-14deg] px-3 py-0.5"
          style={{ background: element.color, color: ink(element.color) }}
        >
          <span className="font-display block skew-x-[14deg] text-[11px] font-bold tracking-[0.6em]">BRAWL VAULT</span>
        </div>
      </div>
    </div>
  )
}

/** Avatar, name, rank, BP and pass level; switching to another profile or making a new one. */
function PlayerCard({
  profile,
  element,
  clanTag,
  level,
  onNew,
}: {
  profile: Profile | null
  element: ElementInfo
  clanTag?: string
  level: number
  onNew: () => void
}) {
  const profiles = useProfiles((s) => s.profiles)
  const select = useProfiles((s) => s.select)
  const openPage = useGame((s) => s.openPage)
  const [open, setOpen] = useState(false)
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
  }, [open])

  const tier = profile ? tierOf(rankScore(profile)) : null
  const pass = profile ? seasonFor(profile).passXp : 0
  const into = level >= PASS_LEVELS ? 1 : (pass - LEVEL_XP[level]) / (LEVEL_XP[level + 1] - LEVEL_XP[level])

  return (
    <div ref={box} className="relative">
      <div
        className="rounded-2xl border bg-black/55 p-4 backdrop-blur-md"
        style={{ borderColor: `${element.color}66`, boxShadow: `0 0 30px ${element.color}22` }}
      >
        {profile && tier ? (
          <>
            <div className="flex items-center gap-3">
              <button
                data-menu-item
                onClick={() => {
                  playSfx('select')
                  openPage('profile')
                }}
                title="Your profile"
                className="menu-item shrink-0 rounded-full transition hover:scale-105 hover:brightness-110"
              >
                <Avatar avatar={profile.avatar} color={element.color} size={60} frame={profile.cosmetics?.frame} />
              </button>
              <div className="min-w-0 flex-1">
                <p className="font-display truncate text-lg leading-tight font-black tracking-wide">
                  {clanTag && <span className="mr-1.5 text-sm text-white/45">[{clanTag}]</span>}
                  {profile.firstName.toUpperCase()} {profile.lastName.toUpperCase()}
                </p>
                {profile.cosmetics?.title && <p className="truncate text-xs text-amber-200">✦ {profile.cosmetics.title}</p>}
                <p className="font-display mt-0.5 text-[10px] tracking-[0.3em]">
                  <span style={{ color: TIER_COLORS[tier.index] }}>{tier.name.toUpperCase()}</span>
                  <span className="text-white/40"> · {profile.rating.toLocaleString('en')} BR</span>
                </p>
              </div>
              <button
                data-menu-item
                onClick={() => {
                  playSfx('tick')
                  setOpen((o) => !o)
                }}
                title="Switch profile"
                aria-expanded={open}
                className="menu-item font-display flex shrink-0 items-center gap-1.5 self-start rounded-full border border-white/20 px-2.5 py-1 text-[9px] tracking-[0.25em] text-white/60 transition hover:border-white/50 hover:bg-white/10 hover:text-white"
              >
                <MenuIcon name="switch" size={13} /> SWITCH
              </button>
            </div>
            <div className="mt-3 flex items-center gap-4 border-t border-white/10 pt-3">
              <span className="font-display flex items-center gap-1.5 text-sm font-bold">
                <BpIcon size={18} /> {profile.bp.toLocaleString('en')}
                <span className="text-[9px] tracking-[0.3em] text-white/40">BP</span>
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="font-display shrink-0 text-[10px] tracking-[0.25em]" style={{ color: PASS_COLOR }}>
                  PASS LV {level}
                </span>
                <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/10">
                  <span className="block h-full rounded-full" style={{ width: `${into * 100}%`, background: PASS_COLOR }} />
                </span>
              </span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-white/30 text-white/50">
              <MenuIcon name="profile" size={26} />
            </div>
            <div className="flex-1">
              <p className="font-display font-black tracking-wide">NO BRAWLER</p>
              <p className="text-sm text-white/50">Make a profile to collect, rank up and keep your Bakugan.</p>
            </div>
            {profiles.length > 0 && (
              <button
                data-menu-item
                onClick={() => setOpen((o) => !o)}
                className="menu-item font-display rounded-full border border-white/20 px-3 py-1 text-[9px] tracking-[0.25em] text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                SWITCH
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-white/15 bg-[#0b0c12]/95 backdrop-blur"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <p className="font-display px-4 pt-3 pb-1 text-[10px] tracking-[0.4em] text-white/40">BRAWLERS ON THIS DEVICE</p>
            {profiles.map((p) => {
              const el = ELEMENT_BY_ID[p.element]
              const on = p.id === profile?.id
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
                      {el.name} · {tierOf(rankScore(p)).name}
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
                onNew()
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

/** A wide tile for the main places, in its own colour. */
function PrimaryTile({
  icon,
  color,
  title,
  sub,
  badge,
  onClick,
  delay,
}: {
  icon: MenuIconName
  color: string
  title: string
  sub: string
  badge?: ReactNode
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
      className="menu-item group relative flex w-full items-center gap-4 overflow-hidden rounded-xl border border-white/10 bg-black/50 px-4 py-3 text-left backdrop-blur transition-colors hover:bg-black/70"
    >
      {/* the tile's colour runs in from the left on hover */}
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: `linear-gradient(90deg, ${color}33, transparent 70%)`, boxShadow: `inset 0 0 0 1px ${color}aa` }}
      />
      <span className="absolute inset-y-0 left-0 w-1 transition-all group-hover:w-1.5" style={{ background: color }} />
      <span
        className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border transition group-hover:scale-110"
        style={{ borderColor: `${color}88`, color, background: `${color}1a` }}
      >
        <MenuIcon name={icon} />
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="font-display flex items-center gap-2 text-lg leading-tight font-black tracking-[0.12em]">
          {title}
          {badge}
        </span>
        <span className="font-display block truncate text-[10px] tracking-[0.25em]" style={{ color }}>
          {sub}
        </span>
      </span>
      <span className="font-display relative text-2xl text-white/30 transition group-hover:translate-x-1 group-hover:text-white">
        ›
      </span>
    </motion.button>
  )
}

/** A smaller tile for the other pages. */
function Tile({
  icon,
  title,
  sub,
  badge,
  onClick,
  disabled,
}: {
  icon: MenuIconName
  title: string
  sub: string
  badge?: ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <motion.button
      data-menu-item
      onClick={onClick}
      disabled={disabled}
      title={disabled ? 'Make a profile first' : undefined}
      whileHover={disabled ? undefined : { y: -3 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      className="menu-item group relative flex min-w-0 items-center gap-2.5 rounded-xl border border-white/10 bg-black/50 px-3 py-2.5 text-left backdrop-blur transition-colors hover:border-[var(--menu-accent)] hover:bg-white/[0.07] disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:bg-black/50"
    >
      <span className="shrink-0 text-white/55 transition group-hover:text-[var(--menu-accent)] group-disabled:text-white/40">
        <MenuIcon name={icon} size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="font-display flex items-center gap-1.5 text-[10px] leading-tight font-bold tracking-[0.1em]">
          <span>{title}</span>
          {badge}
        </span>
        <span className="block truncate text-[11px] font-semibold tracking-wider text-white/45">{sub}</span>
      </span>
    </motion.button>
  )
}

/** A pulsing dot: something live or waiting. */
const Dot = ({ color }: { color: string }) => (
  <span className="relative flex h-2 w-2 shrink-0">
    <span className="absolute inset-0 animate-ping rounded-full opacity-75" style={{ background: color }} />
    <span className="relative h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
  </span>
)

/** Unread messages. */
const Count = ({ n }: { n: number }) => (
  <span className="shrink-0 rounded-full bg-amber-400 px-1.5 text-[10px] leading-4 tracking-normal text-black">{n}</span>
)

/** While three.js loads: the Bakugan's ball, glowing on the stand. */
function StageFallback({ color }: { color: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <motion.div
        className="h-28 w-28 rounded-full border-4"
        style={{ borderColor: color, boxShadow: `0 0 50px ${color}, inset 0 0 30px ${color}88` }}
        animate={{ scale: [0.92, 1.05, 0.92], opacity: [0.6, 1, 0.6] }}
        transition={{ repeat: Infinity, duration: 1.6 }}
      />
    </div>
  )
}
