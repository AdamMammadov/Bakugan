import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { AnimatePresence, motion } from 'framer-motion'
import { Suspense, useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { playSfx } from '../audio/sfx'
import { abilitiesOf, abilityLabel, formModels } from '../data/bakugan'
import { cardXpFor, nextEvolveXp, useProfiles, type OwnedBakugan, type Profile } from '../profile/useProfiles'
import { SKIN_BY_ID, SKINS, skinFits } from '../season/season'
import { useGame } from '../store/useGame'
import { BlobShadow } from '../three/BlobShadow'
import { MonsterModel } from '../three/BakuganModels'
import { BakuganThumb } from './BakuganThumb'
import { entrantOf, joinTeam, leadTeam, leaveTeam, rowOf, short, type Row } from './collection'
import { RewardIcon } from './RewardIcon'

/**
 * A Bakugan's details, sliding in from the right: the Bakugan in 3D, its team place, evolution path, XP, ability
 * cards and skins. The arrows (or ← →) step through the list it was opened from; Esc closes it.
 */
export function BakuganDrawer({
  profile,
  open,
  onNavigate,
  onClose,
}: {
  profile: Profile
  open: { id: string; list: string[] } | null
  onNavigate: (id: string) => void
  onClose: () => void
}) {
  const owned = open ? profile.collection.find((o) => o.id === open.id) : undefined
  const list = (open?.list ?? []).filter((id) => profile.collection.some((o) => o.id === id))
  const at = owned ? list.indexOf(owned.id) : -1
  const stepTo = (d: number) => (list.length > 1 ? list[(Math.max(at, 0) + d + list.length) % list.length] : null)
  const prevId = stepTo(-1)
  const nextId = stepTo(1)
  const go = (id: string | null) => {
    if (!id) return
    playSfx('tick')
    onNavigate(id)
  }

  useEffect(() => {
    if (!owned) return
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest('input, textarea, select')) return
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft' && prevId) {
        playSfx('tick')
        onNavigate(prevId)
      } else if (e.key === 'ArrowRight' && nextId) {
        playSfx('tick')
        onNavigate(nextId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [owned, prevId, nextId, onClose, onNavigate])

  const row = owned ? rowOf(owned, profile, 0) : null
  return createPortal(
    <AnimatePresence>
      {row && (
        <motion.div
          key="drawer"
          className="fixed inset-0 z-[60]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute inset-0 bg-black/50" onClick={onClose} />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 34, stiffness: 340 }}
            className="absolute top-0 right-0 flex h-full w-[480px] max-w-full flex-col border-l bg-[#07080d]/95 shadow-[-30px_0_60px_-24px_#000] backdrop-blur-xl"
            style={{ borderColor: `${row.element.color}77` }}
            aria-label={`${row.name} details`}
          >
            <header className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
              <NavButton label="‹" title="Previous (←)" disabled={!prevId} onClick={() => go(prevId)} />
              <NavButton label="›" title="Next (→)" disabled={!nextId} onClick={() => go(nextId)} />
              <span className="font-display ml-1 text-[10px] tracking-[0.3em] text-white/40">
                {at >= 0 ? `${at + 1} / ${list.length}` : 'BAKUGAN'}
              </span>
              <button
                onClick={onClose}
                title="Close (Esc)"
                className="ml-auto flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-white/15 text-white/60 transition hover:border-white/50 hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </header>
            <div className="flex-1 overflow-y-auto">
              <Stage row={row} />
              <Details key={row.owned.id} row={row} profile={profile} />
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

function NavButton({
  label,
  title,
  disabled,
  onClick,
}: {
  label: string
  title: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 text-lg leading-none text-white/70 transition enabled:hover:border-white/50 enabled:hover:bg-white/10 enabled:hover:text-white disabled:opacity-30"
    >
      {label}
    </button>
  )
}

/** The Bakugan in 3D, turning slowly (drag to turn it), as the inventory's try-on shows it. */
function Stage({ row }: { row: Row }) {
  const { entrant, element: el } = row
  const models = formModels(entrant)
  const skin = row.owned.skin ? SKIN_BY_ID[row.owned.skin] : undefined
  const form = row.bakugan.evolutions[row.owned.form]
  return (
    <div
      className="relative h-72 cursor-grab overflow-hidden active:cursor-grabbing"
      style={{ background: `radial-gradient(circle at 50% 45%, ${el.color}66, #07080d 72%)` }}
    >
      <Canvas camera={{ position: [0, 2.1, 5.8], fov: 40 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 6, 4]} intensity={2.2} />
        <pointLight position={[-3, 2.5, -2]} intensity={20} color={skin?.glow ?? el.glow} />
        <Suspense fallback={null}>
          <group
            key={`${entrant.bakugan.id}-${entrant.form}-${entrant.skin ?? ''}`}
            scale={0.78 / Math.max(1, (models?.scale ?? 1) * (1 + entrant.form * 0.12))}
          >
            <MonsterModel entrant={entrant} showcase />
          </group>
        </Suspense>
        <BlobShadow size={3.6} />
        <OrbitControls
          makeDefault
          target={[0, models?.fly ? 2.3 : 1.4, 0]}
          enablePan={false}
          enableZoom={false}
          autoRotate
          autoRotateSpeed={1.5}
        />
      </Canvas>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#07080d] to-transparent" />
      <div className="pointer-events-none absolute top-3 left-4 flex items-center gap-2">
        <img src={el.icon} alt="" className="h-7 w-7" style={{ filter: `drop-shadow(0 0 8px ${el.glow})` }} />
        <span className="font-display text-xs tracking-[0.3em]" style={{ color: el.color }}>
          {el.name.toUpperCase()}
        </span>
      </div>
      {skin && (
        <span className="font-display pointer-events-none absolute top-3.5 right-4 rounded-full border border-white/20 bg-black/50 px-2 py-0.5 text-[9px] tracking-[0.2em] text-white/70">
          SKIN · {skin.name.toUpperCase()}
        </span>
      )}
      <div className="pointer-events-none absolute inset-x-4 bottom-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display truncate text-3xl leading-tight font-black">{row.name}</p>
          <p className="truncate text-xs text-white/50">
            {form?.series ?? row.bakugan.series} · {row.bakugan.brawler}
          </p>
        </div>
        <p className="font-display shrink-0 text-3xl leading-none font-black" style={{ textShadow: `0 0 18px ${el.glow}` }}>
          {row.g}
          <span className="text-sm text-white/60">G</span>
        </p>
      </div>
    </div>
  )
}

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-[10px] tracking-[0.4em] text-white/40">{title}</h3>
        {aside && <span className="text-[11px] text-white/50">{aside}</span>}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function Details({ row, profile }: { row: Row; profile: Profile }) {
  const { owned, bakugan, element: el } = row
  const evolve = useProfiles((s) => s.evolve)
  const setTeam = useProfiles((s) => s.setTeam)
  const applyCardKey = useProfiles((s) => s.applyCardKey)
  const setSkin = useProfiles((s) => s.setSkin)
  const openPage = useGame((s) => s.openPage)
  const skins = SKINS.filter((sk) => profile.cosmetics?.owned.includes(`skin:${sk.id}`) && skinFits(sk, bakugan.id))
  const abilities = abilitiesOf(bakugan, owned.form)
  const [flash, setFlash] = useState(0)
  const team = profile.team
  const changeTeam = (next: string[]) => {
    playSfx('tick')
    setTeam(next)
  }
  // a full team gives up its last place to a newcomer
  const bumped = team.length >= 3 && row.team === -1 ? rowName(profile, team[2]) : null

  return (
    <div className="relative px-5 pb-8">
      <AnimatePresence>
        {flash > 0 && (
          <motion.div
            key={flash}
            className="pointer-events-none absolute inset-0 z-10"
            style={{ background: `radial-gradient(circle at 50% 20%, ${el.glow}cc, transparent 70%)` }}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.2 }}
          />
        )}
      </AnimatePresence>

      {/* team */}
      <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
        <p className="text-sm text-white/70">
          {row.team === 0
            ? '★ Leads your battle team'
            : row.team > 0
              ? `In your battle team as #${row.team + 1}`
              : 'Not in your battle team'}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {row.team === 0 ? (
            <span
              className="font-display rounded-lg border border-[#f5c542] bg-[#f5c542]/20 px-3 py-1.5 text-[11px] tracking-[0.2em]"
              title="Brawls first in every battle"
            >
              ★ LEAD
            </span>
          ) : (
            <ActionButton
              color="#f5c542"
              onClick={() => changeTeam(leadTeam(team, owned.id))}
              title="Brawls first in every battle"
            >
              ★ MAKE LEAD
            </ActionButton>
          )}
          {row.team === -1 ? (
            <ActionButton
              color={el.color}
              onClick={() => changeTeam(joinTeam(team, owned.id))}
              title={bumped ? `Takes ${bumped}'s place` : 'Add to the battle team'}
            >
              + ADD TO TEAM
            </ActionButton>
          ) : (
            <ActionButton
              color="#ff6b6b"
              disabled={team.length <= 1}
              onClick={() => changeTeam(leaveTeam(team, owned.id))}
              title={team.length <= 1 ? 'A team needs at least one Bakugan' : 'Take out of the battle team'}
            >
              − REMOVE FROM TEAM
            </ActionButton>
          )}
        </div>
        {bumped && <p className="mt-2 text-[11px] text-white/40">Your team is full: adding it replaces {bumped}.</p>}
      </div>

      {/* record */}
      <div className="mt-4 grid grid-cols-4 gap-2">
        {(
          [
            ['WINS', owned.wins],
            ['BATTLES', owned.battles],
            ['KOs', owned.kos],
            ['WIN RATE', owned.battles ? `${Math.round((owned.wins / owned.battles) * 100)}%` : '—'],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-lg border border-white/10 bg-black/40 px-3 py-2">
            <p className="font-display text-[9px] tracking-[0.25em] text-white/40">{label}</p>
            <p className="font-display mt-0.5 text-lg font-black">{value}</p>
          </div>
        ))}
      </div>

      <Section title="EVOLUTION PATH">
        <div className="flex items-stretch gap-1">
          {bakugan.evolutions.map((evo, i) => {
            const reached = i <= owned.form
            const at = i === 0 ? 0 : (nextEvolveXp(bakugan, { ...owned, form: i - 1 }) ?? 0)
            return (
              <div key={`${evo.name}-${evo.series}`} className="flex max-w-[112px] min-w-0 flex-1 items-center gap-1">
                {i > 0 && <span className={reached ? 'text-white/60' : 'text-white/20'}>›</span>}
                <div
                  className="min-w-0 flex-1 self-stretch rounded-lg border p-1.5"
                  style={{
                    borderColor: i === owned.form ? el.color : reached ? `${el.color}55` : 'rgba(255,255,255,0.08)',
                    background: i === owned.form ? `${el.color}22` : 'rgba(0,0,0,0.35)',
                  }}
                  title={reached ? evo.name : `${evo.name}: evolves at ${at.toLocaleString('en')} XP`}
                >
                  <div
                    className="relative aspect-square overflow-hidden rounded-md"
                    style={reached ? undefined : { filter: 'grayscale(1) brightness(0.5)' }}
                  >
                    <BakuganThumb entrant={entrantOf(bakugan.id, i, owned.skin)} />
                    {!reached && <span className="absolute inset-0 flex items-center justify-center text-lg">🔒</span>}
                  </div>
                  <p className={`mt-1 line-clamp-2 text-[11px] leading-tight font-bold ${reached ? '' : 'text-white/40'}`}>
                    {evo.name}
                  </p>
                  <p className="text-[9px] text-white/35">{i === owned.form ? 'NOW' : reached ? 'REACHED' : `${short(at)} XP`}</p>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <Section
        title="EXPERIENCE"
        aside={
          row.need === null
            ? 'Final form reached'
            : row.ready
              ? 'Ready to evolve!'
              : `${(row.need - owned.xp).toLocaleString('en')} XP to ${bakugan.evolutions[owned.form + 1].name}`
        }
      >
        <div className="flex items-center gap-3">
          <span className="font-display text-sm font-black">{owned.xp.toLocaleString('en')} XP</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${row.progress * 100}%`, background: `linear-gradient(90deg, ${el.color}, ${el.glow})` }}
            />
          </div>
          {row.need !== null && <span className="text-[11px] text-white/40">{row.need.toLocaleString('en')}</span>}
        </div>
        {row.ready && (
          <motion.button
            onClick={() => {
              playSfx('gPower')
              setFlash(Date.now())
              evolve(bakugan.id)
            }}
            animate={{ boxShadow: [`0 0 0px ${el.glow}`, `0 0 24px ${el.glow}`, `0 0 0px ${el.glow}`] }}
            transition={{ repeat: Infinity, duration: 1.6 }}
            className="font-display mt-3 w-full cursor-pointer rounded-lg border-2 py-2.5 font-black tracking-[0.3em] transition hover:brightness-125"
            style={{ borderColor: el.color, background: `${el.color}33` }}
          >
            EVOLVE → {bakugan.evolutions[owned.form + 1].name.toUpperCase()}
          </motion.button>
        )}
      </Section>

      <Section
        title={`ABILITY CARDS · ${row.cards}/${row.cardsTotal}`}
        aside={row.nextCard !== null ? `next card at ${row.nextCard.toLocaleString('en')} XP` : 'all unlocked'}
      >
        {row.nextCard !== null && (profile.cardKeys ?? 0) > 0 && (
          <button
            onClick={() => {
              playSfx('gPower')
              applyCardKey(bakugan.id)
            }}
            className="mb-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-300/60 px-3 py-1.5 text-xs text-amber-200 transition hover:border-amber-200 hover:bg-amber-300/10"
          >
            <RewardIcon kind="cardKey" size={16} /> USE CARD KEY ({profile.cardKeys}) · unlock the next card now
          </button>
        )}
        <div className="grid grid-cols-2 gap-2">
          {abilities.map((a, i) => {
            const locked = i >= row.cards
            return (
              <div
                key={a.id}
                title={a.description}
                className="rounded-lg border bg-black/40 p-2.5"
                style={{ borderColor: locked ? 'rgba(255,255,255,0.08)' : `${el.color}66`, opacity: locked ? 0.5 : 1 }}
              >
                <p className="font-display text-[10px] font-bold tracking-wider" style={{ color: locked ? '#8a8f9c' : el.color }}>
                  {locked ? `🔒 AT ${cardXpFor(owned, i).toLocaleString('en')} XP` : abilityLabel(a)}
                </p>
                <p className="font-display mt-0.5 text-[13px] leading-tight font-bold">{a.name}</p>
                <p className="mt-1 line-clamp-3 text-[11px] leading-snug text-white/55">{a.description}</p>
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="SKIN" aside={owned.skin ? SKIN_BY_ID[owned.skin]?.name : 'Original'}>
        {skins.length === 0 ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-white/15 px-3 py-2.5">
            <p className="text-xs text-white/45">No skins for this Bakugan yet.</p>
            <button
              onClick={() => openPage('shop')}
              className="font-display cursor-pointer text-[10px] tracking-[0.25em] text-white/60 transition hover:text-white hover:underline"
            >
              SHOP →
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {[undefined, ...skins].map((sk) => {
              const on = owned.skin === sk?.id
              const color = sk?.color ?? el.color
              const glow = sk?.glow ?? el.glow
              return (
                <button
                  key={sk?.id ?? 'original'}
                  onClick={() => {
                    if (on) return
                    playSfx('tick')
                    setSkin(bakugan.id, sk?.id)
                  }}
                  title={on ? 'Worn' : `Wear ${sk?.name ?? 'the original colours'}`}
                  aria-pressed={on}
                  className={`flex w-[76px] cursor-pointer flex-col items-center gap-1.5 rounded-lg border px-1.5 py-2 transition hover:-translate-y-0.5 hover:border-[color:var(--c)] hover:bg-white/5 ${
                    on ? 'border-[color:var(--c)] bg-white/[0.06]' : 'border-white/10'
                  }`}
                  style={{ '--c': glow } as CSSProperties}
                >
                  <span
                    className="h-9 w-9 rounded-full"
                    style={{
                      background: `radial-gradient(circle at 35% 30%, ${glow}, ${color} 45%, #05060a 100%)`,
                      boxShadow: on ? `0 0 0 2px #07080d, 0 0 0 4px ${glow}` : undefined,
                    }}
                  />
                  <span className={`w-full truncate text-center text-[10px] ${on ? 'text-white' : 'text-white/55'}`}>
                    {sk?.name ?? 'Original'}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </Section>
    </div>
  )
}

function ActionButton({
  color,
  disabled = false,
  title,
  onClick,
  children,
}: {
  color: string
  disabled?: boolean
  title?: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="font-display rounded-lg border border-[color:var(--b)] px-3 py-1.5 text-[11px] tracking-[0.2em] text-[color:var(--c)] transition enabled:hover:-translate-y-px enabled:hover:border-[color:var(--c)] enabled:hover:bg-[color:var(--h)] disabled:opacity-35"
      style={{ '--c': color, '--b': `${color}88`, '--h': `${color}26` } as CSSProperties}
    >
      {children}
    </button>
  )
}

const rowName = (profile: Profile, id: string) => {
  const o: OwnedBakugan | undefined = profile.collection.find((x) => x.id === id)
  return o ? rowOf(o, profile, 0).name : id
}
