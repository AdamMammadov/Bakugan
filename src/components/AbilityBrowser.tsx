import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { playSfx } from '../audio/sfx'
import { abilitiesOf, abilityLabel, type Ability, type AbilityType, type Bakugan, type Entrant } from '../data/bakugan'
import { ELEMENT_BY_ID, type ElementInfo } from '../data/elements'
import { bakuganById, cardCount, cardXpFor, nextCardXp, type OwnedBakugan, type Profile } from '../profile/useProfiles'
import { BakuganThumb } from './BakuganThumb'
import { entrantOf } from './collection'

/**
 * Every ability card of the player's Bakugan, quick to browse even with 20+ Bakugan: pick a Bakugan on the left (or
 * all of them), filter by card type, locked or unlocked and text, and read one line per card (a click shows its full
 * text). The picks are kept in this browser.
 */

const TYPES: { id: AbilityType; label: string; color: string }[] = [
  { id: 'attack', label: 'ATTACK', color: '#ff5a4a' },
  { id: 'boost', label: 'BOOST', color: '#4ade80' },
  { id: 'weaken', label: 'WEAKEN', color: '#c084fc' },
  { id: 'drain', label: 'STEAL', color: '#fbbf24' },
  { id: 'shield', label: 'NULLIFY', color: '#38bdf8' },
  { id: 'finisher', label: 'FINISHER', color: '#f472b6' },
]
const TYPE_BY_ID = Object.fromEntries(TYPES.map((t) => [t.id, t])) as Record<AbilityType, (typeof TYPES)[number]>

type State = 'all' | 'unlocked' | 'locked'
interface Prefs {
  /** A Bakugan id, or 'all'; empty: the team's lead. */
  bakugan: string
  type: AbilityType | 'all'
  state: State
}
const PREFS_KEY = 'bakugan-ability-browser'
const DEFAULTS: Prefs = { bakugan: '', type: 'all', state: 'all' }

function loadPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<Prefs> | null
    if (!p || typeof p !== 'object') return DEFAULTS
    return {
      bakugan: typeof p.bakugan === 'string' ? p.bakugan : '',
      type: p.type && (p.type === 'all' || p.type in TYPE_BY_ID) ? p.type : 'all',
      state: p.state === 'locked' || p.state === 'unlocked' ? p.state : 'all',
    }
  } catch {
    return DEFAULTS
  }
}

function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p))
  } catch {
    // storage unavailable: the picks are just not remembered
  }
}

interface Mon {
  owned: OwnedBakugan
  bakugan: Bakugan
  element: ElementInfo
  entrant: Entrant
  name: string
  unlocked: number
  total: number
  team: number
}

interface CardRow {
  key: string
  ability: Ability
  mon: Mon
  locked: boolean
  /** XP at which a locked card unlocks. */
  at: number
  /** Lower-case text the search looks in. */
  text: string
}

export function AbilityBrowser({ profile, onOpen }: { profile: Profile; onOpen: (id: string, list: string[]) => void }) {
  const [prefs, setPrefs] = useState(loadPrefs)
  useEffect(() => savePrefs(prefs), [prefs])
  const set = (patch: Partial<Prefs>) => {
    playSfx('tick')
    setPrefs((p) => ({ ...p, ...patch }))
  }
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  // the team first (lead, #2, #3), then by name
  const mons = useMemo<Mon[]>(
    () =>
      profile.collection
        .map((owned) => {
          const bakugan = bakuganById(owned.id)
          return {
            owned,
            bakugan,
            element: ELEMENT_BY_ID[bakugan.element],
            entrant: entrantOf(owned.id, owned.form, owned.skin),
            name: bakugan.evolutions[owned.form]?.name ?? bakugan.name,
            unlocked: cardCount(owned),
            total: abilitiesOf(bakugan, owned.form).length,
            team: profile.team.indexOf(owned.id),
          }
        })
        .sort((a, b) => (a.team === -1 ? 9 : a.team) - (b.team === -1 ? 9 : b.team) || a.name.localeCompare(b.name)),
    [profile],
  )
  const cards = useMemo<CardRow[]>(
    () =>
      mons.flatMap((mon) =>
        abilitiesOf(mon.bakugan, mon.owned.form).map((ability, i) => ({
          key: `${mon.owned.id}:${ability.id}`,
          ability,
          mon,
          locked: i >= mon.unlocked,
          at: cardXpFor(mon.owned, i),
          text: `${ability.name} ${ability.description} ${abilityLabel(ability)} ${mon.name}`.toLowerCase(),
        })),
      ),
    [mons],
  )

  // a remembered Bakugan the player no longer has: the lead
  const picked = prefs.bakugan === 'all' ? 'all' : (mons.find((m) => m.owned.id === prefs.bakugan) ?? mons[0])
  const q = query.trim().toLowerCase()
  const byText = (c: CardRow) => !q || c.text.includes(q)
  const byType = (c: CardRow) => prefs.type === 'all' || c.ability.type === prefs.type
  const byState = (c: CardRow) => prefs.state === 'all' || (prefs.state === 'locked') === c.locked
  const matching = cards.filter((c) => byText(c) && byType(c) && byState(c))
  const scope = picked === 'all' ? cards : cards.filter((c) => c.mon === picked)
  const shown = picked === 'all' ? matching : matching.filter((c) => c.mon === picked)
  const filtered = !!q || prefs.type !== 'all' || prefs.state !== 'all'
  const matchesOf = (m: Mon) => matching.filter((c) => c.mon === m).length
  const typeCount = (t: AbilityType) => scope.filter((c) => byText(c) && byState(c) && c.ability.type === t).length
  const stateCount = (s: State) =>
    scope.filter((c) => byText(c) && byType(c) && (s === 'all' || (s === 'locked') === c.locked)).length
  const clear = () => {
    setQuery('')
    set({ type: 'all', state: 'all' })
  }
  const unlocked = mons.reduce((n, m) => n + m.unlocked, 0)
  const total = mons.reduce((n, m) => n + m.total, 0)
  if (!mons.length) return null

  return (
    <section className="mt-10 pb-10">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-xs tracking-[0.5em] text-white/40">
          ABILITY CARDS · {unlocked}/{total} UNLOCKED
        </h2>
        <span className="text-xs text-white/40">across {mons.length} Bakugan · click a card for its full text</span>
      </div>

      <div className="mt-3 grid grid-cols-[250px_minmax(0,1fr)] items-start gap-4">
        {/* the Bakugan */}
        <div className="max-h-[560px] overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-1.5">
          <MonButton
            on={picked === 'all'}
            onClick={() => set({ bakugan: 'all' })}
            title="Every Bakugan's cards"
            matches={filtered ? matching.length : null}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-base">
              ▦
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-display block text-xs font-bold tracking-[0.2em]">ALL BAKUGAN</span>
              <Progress done={unlocked} of={total} color="#e8ecf5" />
            </span>
          </MonButton>
          {mons.map((m) => {
            const n = matchesOf(m)
            return (
              <MonButton
                key={m.owned.id}
                on={picked === m}
                color={m.element.color}
                dim={filtered && n === 0}
                onClick={() => set({ bakugan: m.owned.id })}
                title={`${m.name}: ${m.unlocked} of ${m.total} cards unlocked`}
                matches={filtered ? n : null}
              >
                <span className="h-9 w-9 shrink-0 overflow-hidden rounded-md">
                  <BakuganThumb entrant={m.entrant} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-bold">{m.name}</span>
                    {m.team === 0 && <span className="text-[10px] text-[#f5c542]">★</span>}
                  </span>
                  <Progress done={m.unlocked} of={m.total} color={m.element.color} />
                </span>
              </MonButton>
            )
          })}
        </div>

        <div className="min-w-0">
          {/* filters */}
          <div className="rounded-xl border border-white/10 bg-[#0b0d14] p-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="group relative flex h-9 w-60 items-center">
                <span className="pointer-events-none absolute left-3 text-white/35 transition group-focus-within:text-white/80">
                  ⌕
                </span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
                  placeholder="Search cards…"
                  aria-label="Search ability cards"
                  className="h-full w-full rounded-lg border border-white/15 bg-black/50 pr-9 pl-8 text-sm text-white transition outline-none placeholder:text-white/30 hover:border-white/35 focus:border-white/60"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    title="Clear the search"
                    className="absolute right-2 flex h-6 w-6 items-center justify-center rounded text-white/50 transition hover:bg-white/15 hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </label>
              <div className="ml-auto flex items-center rounded-lg border border-white/15 bg-black/40 p-0.5">
                {(['all', 'unlocked', 'locked'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => prefs.state !== s && set({ state: s })}
                    aria-pressed={prefs.state === s}
                    className={`font-display flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] tracking-[0.2em] transition ${
                      prefs.state === s ? 'bg-white/15 text-white' : 'text-white/45 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {s === 'locked' ? '🔒 ' : s === 'unlocked' ? '✓ ' : ''}
                    {s.toUpperCase()}
                    <span className="rounded-full bg-white/10 px-1.5 text-[9px] text-white/70">{stateCount(s)}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <TypeChip on={prefs.type === 'all'} color="#ffffff" onClick={() => set({ type: 'all' })}>
                ALL TYPES
              </TypeChip>
              {TYPES.map((t) => {
                const n = typeCount(t.id)
                if (!n && prefs.type !== t.id) return null
                return (
                  <TypeChip
                    key={t.id}
                    on={prefs.type === t.id}
                    color={t.color}
                    onClick={() => set({ type: prefs.type === t.id ? 'all' : t.id })}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
                    {t.label}
                    <span className="rounded-full bg-white/10 px-1.5 text-[9px] text-white/70">{n}</span>
                  </TypeChip>
                )
              })}
              {filtered && (
                <button
                  onClick={clear}
                  className="font-display px-2 text-[10px] tracking-[0.25em] text-white/45 underline-offset-4 transition hover:text-white hover:underline"
                >
                  CLEAR FILTERS
                </button>
              )}
            </div>
          </div>

          {/* the picked Bakugan */}
          {picked !== 'all' && (
            <div
              className="mt-3 flex items-center gap-3 rounded-xl border bg-black/40 p-2 pr-3"
              style={{ borderColor: `${picked.element.color}55` }}
            >
              <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg">
                <BakuganThumb entrant={picked.entrant} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display truncate font-bold">{picked.name}</p>
                <p className="text-xs text-white/50">
                  {picked.unlocked} of {picked.total} cards unlocked
                  {nextCardXp(picked.owned) !== null &&
                    ` · next at ${nextCardXp(picked.owned)!.toLocaleString('en')} XP (now ${picked.owned.xp.toLocaleString('en')})`}
                </p>
              </div>
              <button
                onClick={() => {
                  playSfx('select')
                  onOpen(
                    picked.owned.id,
                    mons.map((m) => m.owned.id),
                  )
                }}
                className="font-display shrink-0 rounded-lg border border-white/25 px-3 py-1.5 text-[10px] tracking-[0.25em] transition hover:border-white/60 hover:bg-white/10"
              >
                DETAILS →
              </button>
            </div>
          )}

          {/* the cards */}
          {shown.length === 0 ? (
            <div className="mt-3 flex flex-col items-center rounded-xl border border-dashed border-white/15 bg-black/30 px-6 py-10 text-center">
              <p className="font-display font-bold tracking-wider">No ability cards match these filters</p>
              <p className="mt-1 text-sm text-white/50">
                {picked !== 'all' && matching.length > 0
                  ? `${matching.length} other Bakugan's cards do: pick ALL BAKUGAN to see them.`
                  : 'Try fewer filters.'}
              </p>
              <button
                onClick={clear}
                className="font-display mt-4 rounded border border-white/30 px-4 py-1.5 text-xs tracking-[0.3em] transition hover:border-white/70 hover:bg-white/10"
              >
                CLEAR FILTERS
              </button>
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-black/40">
              {shown.map((c, i) => (
                <div key={c.key}>
                  {picked === 'all' && shown[i - 1]?.mon !== c.mon && (
                    <button
                      onClick={() => set({ bakugan: c.mon.owned.id })}
                      title={`Only ${c.mon.name}'s cards`}
                      className="group flex w-full items-center gap-2 border-b border-white/10 bg-white/[0.04] px-3 py-1.5 text-left transition hover:bg-white/[0.08]"
                    >
                      <img src={c.mon.element.icon} alt="" className="h-4 w-4" />
                      <span className="font-display text-xs font-bold" style={{ color: c.mon.element.color }}>
                        {c.mon.name}
                      </span>
                      <span className="text-[11px] text-white/40">
                        {c.mon.unlocked}/{c.mon.total} unlocked
                      </span>
                      <span className="font-display ml-auto text-[9px] tracking-[0.25em] text-white/30 transition group-hover:text-white/70">
                        ONLY THIS ONE →
                      </span>
                    </button>
                  )}
                  <CardLine card={c} open={expanded === c.key} onToggle={() => setExpanded(expanded === c.key ? null : c.key)} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function MonButton({
  on,
  color = '#e8ecf5',
  dim = false,
  title,
  matches,
  onClick,
  children,
}: {
  on: boolean
  color?: string
  dim?: boolean
  title: string
  /** Matching cards while a filter is on. */
  matches: number | null
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={`flex w-full items-center gap-2.5 rounded-lg border px-2 py-1.5 text-left transition hover:bg-white/[0.07] ${
        on ? 'border-[color:var(--c)] bg-white/[0.08]' : 'border-transparent'
      } ${dim ? 'opacity-35 hover:opacity-80' : ''}`}
      style={{ '--c': `${color}aa` } as CSSProperties}
    >
      {children}
      {matches !== null && (
        <span className="shrink-0 rounded-full bg-white/10 px-1.5 text-[10px] text-white/75" title="Matching cards">
          {matches}
        </span>
      )}
    </button>
  )
}

function Progress({ done, of, color }: { done: number; of: number; color: string }) {
  return (
    <span className="mt-1 flex items-center gap-2">
      <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
        <span className="block h-full rounded-full" style={{ width: `${(done / Math.max(1, of)) * 100}%`, background: color }} />
      </span>
      <span className="text-[10px] text-white/50">
        {done}/{of}
      </span>
    </span>
  )
}

function TypeChip({
  on,
  color,
  onClick,
  children,
}: {
  on: boolean
  color: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`font-display flex h-7 items-center gap-1.5 rounded-full border px-3 text-[10px] tracking-[0.2em] transition hover:-translate-y-px hover:border-[color:var(--c)] hover:text-white ${
        on
          ? 'border-[color:var(--c)] bg-[color:var(--bg)] text-white'
          : 'border-white/15 bg-black/35 text-white/60 hover:bg-white/5'
      }`}
      style={{ '--c': color, '--bg': `${color}2a` } as CSSProperties}
    >
      {children}
    </button>
  )
}

/** One card on one line; a click shows its full text. */
function CardLine({ card, open, onToggle }: { card: CardRow; open: boolean; onToggle: () => void }) {
  const t = TYPE_BY_ID[card.ability.type]
  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={open}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        onToggle()
      }}
      className={`border-b border-white/5 px-3 transition outline-none last:border-b-0 hover:bg-white/[0.06] focus-visible:bg-white/[0.06] ${
        open ? 'bg-white/[0.05]' : ''
      } ${card.locked ? 'text-white/55' : ''}`}
    >
      <div className="grid grid-cols-[84px_minmax(130px,1fr)_minmax(0,2fr)_92px_118px] items-center gap-3 py-2">
        <span
          className="font-display w-fit rounded px-1.5 py-0.5 text-[9px] font-bold tracking-[0.15em]"
          style={{ color: t.color, background: `${t.color}1f`, border: `1px solid ${t.color}55` }}
        >
          {t.label}
        </span>
        <span className="font-display truncate text-[13px] font-bold" title={card.ability.name}>
          {card.ability.name}
        </span>
        <span className={`truncate text-xs text-white/45 ${open ? 'invisible' : ''}`}>{card.ability.description}</span>
        <span className="font-display text-xs font-bold" style={{ color: card.locked ? undefined : t.color }}>
          {abilityLabel(card.ability)}
        </span>
        <span className={`text-right text-[11px] ${card.locked ? 'text-white/45' : 'text-emerald-300/80'}`}>
          {card.locked ? `🔒 at ${card.at.toLocaleString('en')} XP` : '✓ unlocked'}
        </span>
      </div>
      {open && (
        <p className="pb-3 pl-[96px] text-sm leading-snug text-white/75">
          {card.ability.description}
          {card.ability.estimated && <span className="ml-2 text-xs text-white/35">(value picked for balance)</span>}
        </p>
      )}
    </div>
  )
}
