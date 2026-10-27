import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { playSfx } from '../audio/sfx'
import { ELEMENTS } from '../data/elements'
import type { Profile } from '../profile/useProfiles'
import { released } from '../season/release'
import { useGame } from '../store/useGame'
import { BakuganThumb } from './BakuganThumb'
import {
  filterRows,
  loadPrefs,
  QUICK,
  rowOf,
  savePrefs,
  scrollParent,
  short,
  sortRows,
  SORTS,
  type Prefs,
  type Row,
  type SortId,
} from './collection'

/**
 * The profile's Bakugan collection: search, attribute and quick filters and sorts above a dense grid of pictures
 * (or a list), quick to scan even with every Bakugan owned. A click opens the Bakugan's details.
 */
export function CollectionBrowser({
  profile,
  openId,
  onOpen,
}: {
  profile: Profile
  /** The Bakugan whose details are open, marked in the grid. */
  openId: string | null
  /** Opens a Bakugan's details; `list` is the order its arrows step through. */
  onOpen: (id: string, list: string[]) => void
}) {
  const openPage = useGame((s) => s.openPage)
  const [prefs, setPrefs] = useState(loadPrefs)
  useEffect(() => savePrefs(prefs), [prefs])
  const set = (patch: Partial<Prefs>) => {
    playSfx('tick')
    setPrefs((p) => ({ ...p, ...patch }))
  }
  const [query, setQuery] = useState('')
  const search = useRef<HTMLInputElement>(null)
  // the toolbar gets its own opaque backing only while it is stuck to the top of the page
  const sentinel = useRef<HTMLDivElement>(null)
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    const el = sentinel.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([e]) => setStuck(!e.isIntersecting && e.boundingClientRect.top < (e.rootBounds?.top ?? 0)),
      { root: scrollParent(el) },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const rows = useMemo(() => profile.collection.map((o, i) => rowOf(o, profile, i)), [profile])
  const present = ELEMENTS.filter((e) => rows.some((r) => r.bakugan.element === e.id))
  // a remembered attribute this player has none of shows everything
  const element = prefs.element !== 'all' && present.some((e) => e.id === prefs.element) ? prefs.element : 'all'
  const shown = useMemo(
    () => sortRows(filterRows(rows, { query, element, quick: prefs.quick }), prefs.sort, prefs.reverse),
    [rows, query, element, prefs.quick, prefs.sort, prefs.reverse],
  )
  const filtered = !!query.trim() || element !== 'all' || prefs.quick.length > 0
  const open = (id: string) => {
    playSfx('select')
    onOpen(
      id,
      shown.map((r) => r.owned.id),
    )
  }
  const pickSort = (id: SortId) => set(id === prefs.sort ? { reverse: !prefs.reverse } : { sort: id, reverse: false })
  const clear = () => {
    setQuery('')
    set({ element: 'all', quick: [] })
  }

  // "/" jumps to the search box
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.key !== '/' || openId || t?.closest('input, textarea, select, [contenteditable]')) return
      e.preventDefault()
      search.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openId])

  return (
    <section className="mt-10">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xs tracking-[0.5em] text-white/40">
          BAKUGAN COLLECTION · {profile.collection.length}/{released().length}
        </h2>
        <button
          onClick={() => openPage('shop')}
          className="font-display cursor-pointer rounded border border-white/25 px-4 py-1.5 text-xs tracking-[0.3em] transition hover:border-white/60 hover:bg-white/10"
        >
          GET MORE IN THE SHOP →
        </button>
      </div>

      {/* toolbar: stays in view while the grid scrolls, on a full-width band (-mx-16: the page's side padding) that hides
          the tiles passing under it */}
      <div ref={sentinel} className="mt-3 h-px" />
      <div
        className={`sticky top-0 z-20 -mx-16 px-16 py-2.5 transition-[background-color,box-shadow] duration-200 ${
          stuck ? 'bg-[#07080d]/95 shadow-[inset_0_-1px_0_rgba(255,255,255,0.08),0_16px_28px_-16px_#000] backdrop-blur-md' : ''
        }`}
      >
        <div className="rounded-xl border border-white/10 bg-[#0b0d14] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="group relative flex h-9 w-60 items-center">
              <span className="pointer-events-none absolute left-3 text-white/35 transition group-focus-within:text-white/80">
                ⌕
              </span>
              <input
                ref={search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setQuery('')
                    e.currentTarget.blur()
                  }
                }}
                placeholder="Search Bakugan…"
                aria-label="Search Bakugan by name"
                className="h-full w-full rounded-lg border border-white/15 bg-black/50 pr-14 pl-8 text-sm text-white transition outline-none placeholder:text-white/30 hover:border-white/35 focus:border-white/60 focus:bg-black/70"
              />
              {query ? (
                <button
                  onClick={() => {
                    setQuery('')
                    search.current?.focus()
                  }}
                  title="Clear the search"
                  className="absolute right-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded text-white/50 transition hover:bg-white/15 hover:text-white"
                >
                  ✕
                </button>
              ) : (
                <kbd className="pointer-events-none absolute right-2.5 rounded border border-white/15 px-1.5 text-[10px] text-white/35">
                  /
                </kbd>
              )}
            </label>

            {/* attributes the player has, with how many of each */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip on={element === 'all'} onClick={() => set({ element: 'all' })} title="Every attribute">
                ALL <Count n={rows.length} />
              </Chip>
              {present.map((e) => (
                <Chip
                  key={e.id}
                  on={element === e.id}
                  color={e.color}
                  onClick={() => set({ element: element === e.id ? 'all' : e.id })}
                  title={element === e.id ? 'Show every attribute' : `Only ${e.name}`}
                >
                  <img src={e.icon} alt="" className="h-4 w-4" />
                  {e.name.toUpperCase()}
                  <Count n={rows.filter((r) => r.bakugan.element === e.id).length} />
                </Chip>
              ))}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {QUICK.map((k) => {
              const on = prefs.quick.includes(k.id)
              return (
                <Chip
                  key={k.id}
                  on={on}
                  color="#f5c542"
                  title={k.hint}
                  onClick={() => set({ quick: on ? prefs.quick.filter((q) => q !== k.id) : [...prefs.quick, k.id] })}
                >
                  <span className="text-[11px] leading-none">{on ? '✓' : '+'}</span>
                  {k.label}
                  <Count n={rows.filter(k.test).length} />
                </Chip>
              )
            })}
            {filtered && (
              <button
                onClick={clear}
                className="font-display cursor-pointer px-2 text-[10px] tracking-[0.25em] text-white/45 underline-offset-4 transition hover:text-white hover:underline"
              >
                CLEAR FILTERS
              </button>
            )}

            <div className="ml-auto flex items-center gap-2">
              <span className="font-display text-[10px] tracking-[0.3em] text-white/35">SORT</span>
              <div className="flex flex-wrap items-center rounded-lg border border-white/15 bg-black/40 p-0.5">
                {SORTS.map((s) => {
                  const on = prefs.sort === s.id
                  return (
                    <button
                      key={s.id}
                      onClick={() => pickSort(s.id)}
                      title={on ? `${s.hint} · click again to reverse` : s.hint}
                      aria-pressed={on}
                      className={`font-display cursor-pointer rounded-md px-2.5 py-1.5 text-[10px] tracking-[0.2em] transition ${
                        on ? 'bg-white/15 text-white' : 'text-white/45 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      {s.label}
                      {on && <span className="ml-1 text-white/70">{prefs.reverse ? '↑' : '↓'}</span>}
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center rounded-lg border border-white/15 bg-black/40 p-0.5">
                {(['grid', 'list'] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => prefs.view !== v && set({ view: v })}
                    title={v === 'grid' ? 'Pictures in a grid' : 'A detailed list'}
                    aria-pressed={prefs.view === v}
                    className={`font-display flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-[10px] tracking-[0.25em] transition ${
                      prefs.view === v ? 'bg-white/15 text-white' : 'text-white/45 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className="text-sm leading-none">{v === 'grid' ? '▦' : '☰'}</span>
                    {v.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="mb-2 px-1 text-xs text-white/40">
        {filtered ? `Showing ${shown.length} of ${rows.length} Bakugan` : `${rows.length} Bakugan`} · click one for its details,
        team and skins
      </p>

      {shown.length === 0 ? (
        <div className="mt-3 flex flex-col items-center rounded-xl border border-dashed border-white/15 bg-black/30 px-6 py-14 text-center">
          <p className="text-4xl opacity-40">⌕</p>
          <p className="font-display mt-3 text-lg font-bold tracking-wider">No Bakugan match these filters</p>
          <p className="mt-1 text-sm text-white/50">
            {query.trim() ? `Nothing called “${query.trim()}”` : 'None of your Bakugan fit all of them'}. Try fewer filters.
          </p>
          <button
            onClick={clear}
            className="font-display mt-5 cursor-pointer rounded border border-white/30 px-5 py-2 text-xs tracking-[0.3em] transition hover:border-white/70 hover:bg-white/10"
          >
            CLEAR FILTERS
          </button>
        </div>
      ) : prefs.view === 'grid' ? (
        <div className="mt-1 grid grid-cols-[repeat(auto-fill,minmax(184px,1fr))] gap-3">
          {shown.map((r) => (
            <Tile key={r.owned.id} row={r} selected={openId === r.owned.id} onOpen={open} />
          ))}
        </div>
      ) : (
        <List rows={shown} openId={openId} onOpen={open} sort={prefs.sort} reverse={prefs.reverse} onSort={pickSort} />
      )}
    </section>
  )
}

function Chip({
  on,
  color = '#ffffff',
  title,
  onClick,
  children,
}: {
  on: boolean
  color?: string
  title?: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={on}
      className={`font-display flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[10px] tracking-[0.2em] transition hover:-translate-y-px hover:border-[color:var(--c)] hover:text-white ${
        on
          ? 'border-[color:var(--c)] bg-[color:var(--bg)] text-white shadow-[0_0_14px_-4px_var(--c)]'
          : 'border-white/15 bg-black/35 text-white/60 hover:bg-white/5'
      }`}
      style={{ '--c': color, '--bg': `${color}2e` } as CSSProperties}
    >
      {children}
    </button>
  )
}

const Count = ({ n }: { n: number }) => <span className="rounded-full bg-white/10 px-1.5 text-[9px] text-white/70">{n}</span>

/** Enter or Space opens a focused tile or row, like a button. */
const activate = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key !== 'Enter' && e.key !== ' ') return
  e.preventDefault()
  fn()
}

function TeamBadge({ team, className = '' }: { team: number; className?: string }) {
  if (team === -1) return null
  return (
    <span
      className={`font-display rounded px-1.5 py-0.5 text-[9px] font-bold tracking-[0.15em] ${className}`}
      style={
        team === 0
          ? { background: '#f5c542', color: '#1a1300', boxShadow: '0 0 12px -2px #f5c542' }
          : { background: 'rgba(0,0,0,0.7)', color: '#fff', border: '1px solid rgba(255,255,255,0.45)' }
      }
    >
      {team === 0 ? '★ LEAD' : `TEAM #${team + 1}`}
    </span>
  )
}

/** Filled dots for the forms reached. */
function FormPips({ row }: { row: Row }) {
  const forms = row.bakugan.evolutions.length
  return (
    <span className="flex items-center gap-[3px]" title={`Form ${row.owned.form + 1} of ${forms}`}>
      {Array.from({ length: forms }, (_, i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: i <= row.owned.form ? row.element.color : 'rgba(255,255,255,0.16)' }}
        />
      ))}
    </span>
  )
}

function XpBar({ row, className = 'h-1' }: { row: Row; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-full bg-white/10 ${className}`}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{
          width: `${row.progress * 100}%`,
          background: `linear-gradient(90deg, ${row.element.color}, ${row.element.glow})`,
        }}
      />
    </div>
  )
}

/** What is left to the next form, in a few characters. */
const toGo = (r: Row) => (r.need === null ? 'FINAL FORM' : r.ready ? 'READY!' : `${short(r.need - r.owned.xp)} TO EVOLVE`)

function Tile({ row, selected, onOpen }: { row: Row; selected: boolean; onOpen: (id: string) => void }) {
  const { owned, element: el } = row
  return (
    <motion.div
      layout="position"
      transition={{ duration: 0.25 }}
      role="button"
      tabIndex={0}
      aria-label={`${row.name}: details`}
      onClick={() => onOpen(owned.id)}
      onKeyDown={activate(() => onOpen(owned.id))}
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-[color:var(--b)] bg-black/55 transition-[translate,border-color,box-shadow] duration-200 outline-none hover:-translate-y-1 hover:border-[color:var(--c)] hover:shadow-[0_10px_28px_-8px_var(--g)] focus-visible:border-[color:var(--c)] active:translate-y-0"
      style={
        {
          '--c': el.color,
          '--g': el.glow,
          '--b': selected ? el.color : `${el.color}40`,
          boxShadow: selected ? `0 0 0 1px ${el.color}, 0 0 26px -6px ${el.glow}` : undefined,
        } as CSSProperties
      }
    >
      <div className="relative aspect-[5/4] overflow-hidden">
        <div className="h-full w-full transition-transform duration-300 group-hover:scale-[1.07]">
          <BakuganThumb entrant={row.entrant} />
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 to-transparent" />
        <span
          className="absolute top-2 left-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 ring-1"
          style={{ '--tw-ring-color': `${el.color}88` } as CSSProperties}
          title={el.name}
        >
          <img src={el.icon} alt={el.name} className="h-5 w-5" />
        </span>
        <TeamBadge team={row.team} className="absolute top-2 right-2" />
        <p className="font-display absolute bottom-1.5 left-2.5 text-lg leading-none font-black drop-shadow">
          {row.g}
          <span className="text-[10px] text-white/60">G</span>
        </p>
        {row.ready && (
          <motion.span
            className="font-display absolute right-2 bottom-1.5 rounded px-1.5 py-0.5 text-[9px] font-black tracking-[0.15em]"
            style={{ background: el.color, color: '#fff' }}
            animate={{ boxShadow: [`0 0 0px ${el.glow}`, `0 0 14px ${el.glow}`, `0 0 0px ${el.glow}`] }}
            transition={{ repeat: Infinity, duration: 1.6 }}
          >
            EVOLVE!
          </motion.span>
        )}
      </div>
      <div className="px-3 pt-2 pb-2.5">
        <p className="font-display truncate text-sm font-bold" title={row.name}>
          {row.name}
        </p>
        <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-white/45">
          <span className="flex items-center gap-1.5">
            <FormPips row={row} />
            FORM {owned.form + 1}/{row.bakugan.evolutions.length}
          </span>
          <span
            title={`${row.cards} of ${row.cardsTotal} ability cards unlocked`}
            className={row.cards < row.cardsTotal ? '' : 'text-white/70'}
          >
            {row.cards < row.cardsTotal ? '🔒' : '▤'} {row.cards}/{row.cardsTotal}
          </span>
        </div>
        <XpBar row={row} className="mt-2 h-1" />
        <div className="mt-1 flex justify-between text-[9px] tracking-wider text-white/40">
          <span>{short(owned.xp)} XP</span>
          <span style={row.ready ? { color: el.glow } : undefined}>{toGo(row)}</span>
        </div>
      </div>
    </motion.div>
  )
}

const LIST_COLS = 'grid-cols-[56px_minmax(150px,1.5fr)_minmax(90px,0.8fr)_64px_minmax(150px,1.5fr)_minmax(100px,0.9fr)_64px_88px]'

function List({
  rows,
  openId,
  onOpen,
  sort,
  reverse,
  onSort,
}: {
  rows: Row[]
  openId: string | null
  onOpen: (id: string) => void
  sort: SortId
  reverse: boolean
  onSort: (id: SortId) => void
}) {
  const head = (label: string, id?: SortId) =>
    id ? (
      <button
        onClick={() => onSort(id)}
        title={sort === id ? 'Click again to reverse' : `Sort by ${label.toLowerCase()}`}
        className={`cursor-pointer text-left transition hover:text-white ${sort === id ? 'text-white' : ''}`}
      >
        {label}
        {sort === id && <span className="ml-1">{reverse ? '↑' : '↓'}</span>}
      </button>
    ) : (
      <span>{label}</span>
    )
  return (
    <div className="mt-1 overflow-x-auto rounded-xl border border-white/10 bg-black/40 backdrop-blur">
      <div className="min-w-[860px]">
        <div
          className={`font-display grid ${LIST_COLS} items-center gap-4 border-b border-white/10 px-3 py-2.5 text-[10px] tracking-[0.25em] text-white/40`}
        >
          <span />
          {head('NAME', 'name')}
          <span>ATTRIBUTE</span>
          {head('G', 'g')}
          {head('EVOLUTION', 'evolve')}
          {head('WINS', 'wins')}
          <span>CARDS</span>
          {head('TEAM', 'recent')}
        </div>
        {rows.map((r) => (
          <motion.div
            layout="position"
            transition={{ duration: 0.25 }}
            key={r.owned.id}
            role="button"
            tabIndex={0}
            aria-label={`${r.name}: details`}
            onClick={() => onOpen(r.owned.id)}
            onKeyDown={activate(() => onOpen(r.owned.id))}
            className={`group grid ${LIST_COLS} cursor-pointer items-center gap-4 border-b border-l-2 border-b-white/5 px-3 py-1.5 transition outline-none last:border-b-0 hover:bg-white/[0.07] focus-visible:bg-white/[0.07]`}
            style={{
              borderLeftColor: openId === r.owned.id ? r.element.color : 'transparent',
              background: openId === r.owned.id ? `${r.element.color}1f` : undefined,
            }}
          >
            <div
              className="h-12 w-12 overflow-hidden rounded-lg ring-1 ring-white/10 transition group-hover:ring-[color:var(--c)]"
              style={{ '--c': r.element.color } as CSSProperties}
            >
              <BakuganThumb entrant={r.entrant} />
            </div>
            <div className="min-w-0">
              <p className="font-display truncate text-sm font-bold">{r.name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/45">
                <FormPips row={r} /> FORM {r.owned.form + 1}/{r.bakugan.evolutions.length}
                {r.owned.skin && <span className="text-white/35">· skin</span>}
              </p>
            </div>
            <span className="flex items-center gap-1.5 text-xs" style={{ color: r.element.color }}>
              <img src={r.element.icon} alt="" className="h-5 w-5" />
              {r.element.name}
            </span>
            <span className="font-display text-sm font-black">{r.g}G</span>
            <div className="min-w-0">
              <XpBar row={r} className="h-1.5" />
              <div className="mt-1 flex justify-between text-[10px] text-white/45">
                <span>{r.owned.xp.toLocaleString('en')} XP</span>
                <span style={r.ready ? { color: r.element.glow } : undefined}>{toGo(r)}</span>
              </div>
            </div>
            <span className="text-xs text-white/60">
              {r.owned.wins}W / {r.owned.battles} · {r.owned.kos} KO
            </span>
            <span className="text-xs text-white/60">
              {r.cards < r.cardsTotal ? '🔒' : '▤'} {r.cards}/{r.cardsTotal}
            </span>
            <span>{r.team === -1 ? <span className="text-xs text-white/25">—</span> : <TeamBadge team={r.team} />}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
