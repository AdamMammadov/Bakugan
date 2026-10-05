import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { BUILT_IN } from '../admin/apply'
import { deleteFile, IDB_PREFIX, saveFile } from '../admin/files'
import { hashPin, useAdmin, type BakuganOverride } from '../admin/useAdmin'
import { GRID, GRID_SIZE } from '../components/grid'
import { abilityLabel, type Ability, type AbilityType, type Bakugan, type EffectPreset, type Evolution } from '../data/bakugan'
import { loadCards, type DbCard } from '../data/cardDb'
import { ELEMENT_BY_ID, ELEMENTS, type ElementId } from '../data/elements'
import { BAKUGAN } from '../data/bakugan'
import { seasonFor, useActiveProfile, useProfiles } from '../profile/useProfiles'
import { currentSeason } from '../season/current'
import { SEASON_DAYS, type SeasonRole } from '../season/season'
import { useGame } from '../store/useGame'

const TYPES: AbilityType[] = ['attack', 'boost', 'weaken', 'drain', 'shield']
const EFFECTS: EffectPreset[] = ['fireball', 'flameWave', 'waterSphere', 'waterJet', 'quake', 'tornado', 'lightBeam', 'shadowOrb', 'shieldDome', 'aura']
const ELEMENT_EFFECT: Record<ElementId, EffectPreset> = {
  pyrus: 'fireball',
  aquos: 'waterJet',
  subterra: 'quake',
  ventus: 'tornado',
  haos: 'lightBeam',
  darkus: 'shadowOrb',
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const input = 'w-full rounded-md border border-white/15 bg-black/50 px-3 py-2 text-sm outline-none focus:border-white/50'
const label = 'font-display mb-1 block text-[10px] tracking-[0.3em] text-white/45'

/** Turns a card-database card into a battle ability, guessing its effect from the card text. */
function abilityFromCard(card: DbCard, element: ElementId): Ability {
  const t = card.text
  const num = (re: RegExp) => Number(t.match(re)?.[1] ?? 0)
  let type: AbilityType = 'attack'
  let amount = 100
  if (/transfer/i.test(t) && num(/(\d+)\s*G/)) [type, amount] = ['drain', num(/(\d+)\s*G/)]
  else if (/opponent.*loses?\s*-?(\d+)/i.test(t)) [type, amount] = ['weaken', num(/loses?\s*-?(\d+)/i)]
  else if (/gains?\s*\+?(\d+)/i.test(t)) [type, amount] = ['boost', num(/gains?\s*\+?(\d+)/i)]
  else if (/negat|nullif|cancel|block/i.test(t)) [type, amount] = ['shield', 0]
  return {
    id: slug(card.name),
    name: card.name,
    description: t,
    type,
    amount,
    effect: type === 'boost' ? 'aura' : type === 'shield' ? 'shieldDome' : ELEMENT_EFFECT[element],
    estimated: type === 'attack',
  }
}

export function AdminScreen() {
  const pinHash = useAdmin((s) => s.pinHash)
  const [unlocked, setUnlocked] = useState(() => sessionStorage.getItem('bakugan-admin-ok') === '1')
  const go = useGame((s) => s.go)

  return (
    <motion.div
      className="absolute inset-0 overflow-y-auto px-16 py-10"
      style={{ backgroundImage: GRID, backgroundSize: GRID_SIZE }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button onClick={() => go('hub')} className="font-display text-xs tracking-[0.4em] text-white/50 transition hover:text-white">
        ← BACK
      </button>
      <h1 className="font-display mt-4 text-4xl font-black tracking-wider">ADMIN PANEL</h1>
      {unlocked ? (
        <Panel />
      ) : (
        <PinGate
          hasPin={pinHash !== null}
          onOk={() => {
            sessionStorage.setItem('bakugan-admin-ok', '1')
            setUnlocked(true)
          }}
        />
      )}
    </motion.div>
  )
}

function PinGate({ hasPin, onOk }: { hasPin: boolean; onOk: () => void }) {
  const pinHash = useAdmin((s) => s.pinHash)
  const setPin = useAdmin((s) => s.setPin)
  const [pin, setPinText] = useState('')
  const [error, setError] = useState('')
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (pin.length < 4) return setError('Use at least 4 characters.')
    const h = await hashPin(pin)
    if (!hasPin) {
      setPin(h)
      onOk()
    } else if (h === pinHash) onOk()
    else setError('Wrong PIN.')
  }
  return (
    <form onSubmit={submit} className="mt-8 max-w-sm rounded-xl border border-white/10 bg-black/50 p-6">
      <p className="text-white/70">{hasPin ? 'Enter the admin PIN.' : 'Choose an admin PIN for this device.'}</p>
      <input type="password" value={pin} onChange={(e) => setPinText(e.target.value)} className={`${input} mt-4`} autoFocus />
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      <button className="font-display mt-4 w-full border-2 border-white/50 py-2 tracking-[0.3em] hover:bg-white/10">
        {hasPin ? 'UNLOCK' : 'SET PIN'}
      </button>
      <p className="mt-4 text-xs text-white/40">
        The PIN only keeps casual visitors out of this screen on this device; it is not server security.
      </p>
    </form>
  )
}

function Panel() {
  const custom = useAdmin((s) => s.custom)
  const overrides = useAdmin((s) => s.overrides)
  const importData = useAdmin((s) => s.importData)
  const [editing, setEditing] = useState<{ bakugan: Bakugan; builtIn: boolean } | null>(null)
  const [dirty, setDirty] = useState(false)

  function exportData() {
    const { seasonStart, seasonRoles } = useAdmin.getState()
    const blob = new Blob([JSON.stringify({ custom, overrides, seasonStart, seasonRoles }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'bakugan-admin.json'
    a.click()
  }
  async function importFile(file: File | undefined) {
    if (!file) return
    const data = JSON.parse(await file.text())
    if (!Array.isArray(data.custom) || typeof data.overrides !== 'object') return alert('Not an admin export file.')
    importData(data)
    setDirty(true)
  }

  if (editing) {
    return (
      <Editor
        initial={editing.bakugan}
        builtIn={editing.builtIn}
        onDone={(changed) => {
          setEditing(null)
          if (changed) setDirty(true)
        }}
      />
    )
  }

  return (
    <>
      <p className="mt-2 max-w-4xl text-white/55">
        Add new Bakugan, edit the built-in ones, attach ability cards from the card database and upload .glb 3D models
        (ball and monster). Changes are saved in this browser; use EXPORT to hand them over so they can be built into the
        game for every player.
      </p>
      {dirty && (
        <div className="mt-4 flex items-center gap-4 rounded-lg border border-amber-400/50 bg-amber-400/10 p-3">
          <p className="flex-1 text-sm">Saved. Reload the game to see the changes everywhere.</p>
          <button onClick={() => location.reload()} className="font-display border border-white/50 px-4 py-1.5 text-xs tracking-[0.3em]">
            RELOAD NOW
          </button>
        </div>
      )}
      <div className="mt-6 flex flex-wrap gap-3">
        <button
          onClick={() =>
            setEditing({
              builtIn: false,
              bakugan: {
                id: '',
                name: '',
                element: 'pyrus',
                brawler: '',
                series: 'Battle Brawlers',
                baseG: 350,
                brawlG: 450,
                description: '',
                abilities: [],
                evolutions: [{ name: '', series: 'Battle Brawlers', gPower: 350 }],
              },
            })
          }
          className="font-display border-2 border-white/60 bg-white/10 px-5 py-2 text-xs tracking-[0.3em] hover:bg-white/20"
        >
          + NEW BAKUGAN
        </button>
        <button onClick={exportData} className="font-display border border-white/30 px-5 py-2 text-xs tracking-[0.3em] hover:bg-white/10">
          EXPORT DATA
        </button>
        <label className="font-display cursor-pointer border border-white/30 px-5 py-2 text-xs tracking-[0.3em] hover:bg-white/10">
          IMPORT DATA
          <input type="file" accept="application/json" className="hidden" onChange={(e) => importFile(e.target.files?.[0])} />
        </label>
      </div>

      <SeasonAdmin />

      <h2 className="font-display mt-8 text-xs tracking-[0.5em] text-white/40">BUILT-IN BAKUGAN</h2>
      <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
        {BUILT_IN.map((b) => (
          <Row
            key={b.id}
            bakugan={{ ...b, ...overrides[b.id] }}
            note={overrides[b.id] ? 'edited' : undefined}
            onEdit={() => setEditing({ builtIn: true, bakugan: { ...structuredClone(b), ...structuredClone(overrides[b.id] ?? {}) } })}
          />
        ))}
      </div>
      <h2 className="font-display mt-8 text-xs tracking-[0.5em] text-white/40">ADDED BY ADMIN · {custom.length}</h2>
      {custom.length === 0 && <p className="mt-2 text-sm text-white/45">None yet.</p>}
      <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3">
        {custom.map((b) => (
          <Row key={b.id} bakugan={b} note="custom" onEdit={() => setEditing({ builtIn: false, bakugan: structuredClone(b) })} />
        ))}
      </div>
    </>
  )
}

function Row({ bakugan, note, onEdit }: { bakugan: Bakugan; note?: string; onEdit: () => void }) {
  const el = ELEMENT_BY_ID[bakugan.element]
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-black/40 p-3" style={{ borderColor: `${el.color}55` }}>
      <img src={el.icon} alt="" className="h-10 w-10" />
      <div className="min-w-0 flex-1">
        <p className="font-display font-bold">
          {bakugan.name} {note && <span className="ml-1 rounded bg-white/10 px-1.5 text-[10px] font-normal text-white/60">{note}</span>}
        </p>
        <p className="text-xs text-white/50">
          {bakugan.baseG}G · {bakugan.abilities.length} cards · {bakugan.models?.monster ? '3D monster' : 'placeholder'}
        </p>
      </div>
      <button onClick={onEdit} className="font-display border border-white/30 px-3 py-1.5 text-[10px] tracking-[0.3em] hover:bg-white/10">
        EDIT
      </button>
    </div>
  )
}

function Editor({ initial, builtIn, onDone }: { initial: Bakugan; builtIn: boolean; onDone: (changed: boolean) => void }) {
  const saveCustom = useAdmin((s) => s.saveCustom)
  const removeCustom = useAdmin((s) => s.removeCustom)
  const saveOverride = useAdmin((s) => s.saveOverride)
  const resetOverride = useAdmin((s) => s.resetOverride)
  const [b, setB] = useState<Bakugan>(initial)
  const [error, setError] = useState('')
  const [picker, setPicker] = useState(false)
  const set = <K extends keyof Bakugan>(k: K, v: Bakugan[K]) => setB((x) => ({ ...x, [k]: v }))
  const el = ELEMENT_BY_ID[b.element]

  async function upload(kind: 'ball' | 'monster', file: File | undefined) {
    if (!file) return
    if (!/\.glb$/i.test(file.name)) return setError('Upload a .glb file (binary glTF).')
    const key = `${slug(b.name) || 'bakugan'}-${kind}-${Date.now()}`
    await saveFile(key, file)
    const old = b.models?.[kind]
    if (old?.startsWith(IDB_PREFIX)) await deleteFile(old.slice(IDB_PREFIX.length))
    set('models', { ...b.models, [kind]: IDB_PREFIX + key })
    setError('')
  }

  function save() {
    if (!b.name.trim()) return setError('Give the Bakugan a name.')
    if (!b.evolutions.length || b.evolutions.some((e) => !e.name.trim())) return setError('Every form needs a name.')
    const id = builtIn ? b.id : b.id || slug(b.name)
    const final: Bakugan = { ...b, id, brawlG: b.baseG + 100, evolutions: b.evolutions.map((e, i) => (i === 0 ? { ...e, gPower: b.baseG } : e)) }
    if (builtIn) {
      const o: BakuganOverride = {
        name: final.name,
        brawler: final.brawler,
        series: final.series,
        baseG: final.baseG,
        description: final.description,
        abilities: final.abilities,
        evolutions: final.evolutions,
        models: final.models,
      }
      saveOverride(id, o)
    } else saveCustom(final)
    onDone(true)
  }

  return (
    <div className="mt-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <img src={el.icon} alt="" className="h-14 w-14" />
        <h2 className="font-display text-3xl font-black">{builtIn ? `EDIT ${initial.name.toUpperCase()}` : initial.id ? 'EDIT BAKUGAN' : 'NEW BAKUGAN'}</h2>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <div>
          <span className={label}>NAME</span>
          <input className={input} value={b.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div>
          <span className={label}>BRAWLER</span>
          <input className={input} value={b.brawler} onChange={(e) => set('brawler', e.target.value)} />
        </div>
        <div>
          <span className={label}>SERIES</span>
          <input className={input} value={b.series} onChange={(e) => set('series', e.target.value)} />
        </div>
        <div>
          <span className={label}>ATTRIBUTE</span>
          <div className="flex gap-1">
            {ELEMENTS.map((e) => (
              <button
                key={e.id}
                disabled={builtIn}
                onClick={() => set('element', e.id)}
                className="rounded-md border-2 p-0.5 disabled:cursor-not-allowed"
                style={{ borderColor: b.element === e.id ? e.color : 'transparent', opacity: builtIn && b.element !== e.id ? 0.3 : 1 }}
              >
                <img src={e.icon} alt={e.name} className="h-8 w-8" />
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className={label}>BASE G-POWER</span>
          <input type="number" className={input} value={b.baseG} onChange={(e) => set('baseG', Number(e.target.value))} />
        </div>
        <div />
        <div className="col-span-3">
          <span className={label}>DESCRIPTION</span>
          <textarea rows={3} className={`${input} resize-none`} value={b.description} onChange={(e) => set('description', e.target.value)} />
        </div>
      </div>

      <h3 className="font-display mt-6 text-xs tracking-[0.5em] text-white/40">FORMS (EVOLUTIONS)</h3>
      <div className="mt-2 space-y-2">
        {b.evolutions.map((evo, i) => (
          <div key={i} className="flex gap-2">
            <input
              className={input}
              placeholder={i === 0 ? 'Base form name' : 'Evolution name'}
              value={evo.name}
              onChange={(e) => set('evolutions', b.evolutions.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            />
            <input
              className={`${input} w-56`}
              placeholder="Series"
              value={evo.series}
              onChange={(e) => set('evolutions', b.evolutions.map((x, j) => (j === i ? { ...x, series: e.target.value } : x)))}
            />
            <input
              type="number"
              className={`${input} w-28`}
              disabled={i === 0}
              title={i === 0 ? 'The base form uses the base G-Power' : 'G-Power of this form'}
              value={i === 0 ? b.baseG : evo.gPower}
              onChange={(e) => set('evolutions', b.evolutions.map((x, j) => (j === i ? { ...x, gPower: Number(e.target.value) } : x)))}
            />
            {i > 0 && (
              <button onClick={() => set('evolutions', b.evolutions.filter((_, j) => j !== i))} className="px-2 text-white/40 hover:text-red-300">
                ✕
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => set('evolutions', [...b.evolutions, { name: '', series: b.series, gPower: b.baseG + 100 } satisfies Evolution])}
          className="text-xs text-white/60 underline hover:text-white"
        >
          + add evolution
        </button>
      </div>

      <h3 className="font-display mt-6 text-xs tracking-[0.5em] text-white/40">ABILITY CARDS · {b.abilities.length}</h3>
      <div className="mt-2 space-y-2">
        {b.abilities.map((a, i) => {
          const upd = (patch: Partial<Ability>) => set('abilities', b.abilities.map((x, j) => (j === i ? { ...x, ...patch } : x)))
          return (
            <div key={i} className="grid grid-cols-[1.2fr_2fr_7rem_5rem_8rem_auto] items-center gap-2">
              <input className={input} value={a.name} onChange={(e) => upd({ name: e.target.value, id: slug(e.target.value) })} />
              <input className={input} value={a.description} onChange={(e) => upd({ description: e.target.value })} />
              <select className={input} value={a.type} onChange={(e) => upd({ type: e.target.value as AbilityType })}>
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <input type="number" className={input} value={a.amount} onChange={(e) => upd({ amount: Number(e.target.value) })} />
              <select className={input} value={a.effect} onChange={(e) => upd({ effect: e.target.value as EffectPreset })}>
                {EFFECTS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <button onClick={() => set('abilities', b.abilities.filter((_, j) => j !== i))} className="px-2 text-white/40 hover:text-red-300">
                ✕
              </button>
            </div>
          )
        })}
        <div className="flex gap-4">
          <button onClick={() => setPicker(true)} className="text-xs text-white/60 underline hover:text-white">
            + add from the card database
          </button>
          <button
            onClick={() =>
              set('abilities', [
                ...b.abilities,
                { id: `card-${b.abilities.length + 1}`, name: 'New card', description: '', type: 'attack', amount: 100, effect: ELEMENT_EFFECT[b.element] },
              ])
            }
            className="text-xs text-white/60 underline hover:text-white"
          >
            + add blank card
          </button>
        </div>
      </div>
      {picker && (
        <CardPicker
          bakugan={b}
          onPick={(card) => set('abilities', [...b.abilities, abilityFromCard(card, b.element)])}
          onClose={() => setPicker(false)}
        />
      )}

      <h3 className="font-display mt-6 text-xs tracking-[0.5em] text-white/40">3D MODELS (.GLB)</h3>
      <div className="mt-2 grid grid-cols-2 gap-4">
        {(['ball', 'monster'] as const).map((kind) => (
          <label key={kind} className="cursor-pointer rounded-lg border border-dashed border-white/25 p-4 hover:border-white/60">
            <span className={label}>{kind === 'ball' ? 'BALL FORM' : 'MONSTER FORM'}</span>
            <span className="text-sm text-white/70">
              {b.models?.[kind] ? (b.models[kind]!.startsWith(IDB_PREFIX) ? '✓ uploaded model' : `✓ ${b.models[kind]}`) : 'No model — placeholder is used'}
            </span>
            <span className="mt-1 block text-xs text-white/40">Click to upload a .glb</span>
            <input type="file" accept=".glb" className="hidden" onChange={(e) => upload(kind, e.target.files?.[0])} />
          </label>
        ))}
      </div>

      {error && <p className="mt-4 text-red-300">{error}</p>}
      <div className="mt-8 flex gap-3 pb-16">
        <button onClick={save} className="font-display border-2 border-white/70 bg-white/10 px-8 py-3 tracking-[0.3em] hover:bg-white/20">
          SAVE
        </button>
        <button onClick={() => onDone(false)} className="font-display border border-white/25 px-6 py-3 tracking-[0.3em] text-white/70 hover:bg-white/10">
          CANCEL
        </button>
        {builtIn ? (
          <button
            onClick={() => {
              resetOverride(b.id)
              onDone(true)
            }}
            className="font-display ml-auto px-6 py-3 text-xs tracking-[0.3em] text-white/40 hover:text-amber-300"
          >
            RESET TO ORIGINAL
          </button>
        ) : (
          initial.id && (
            <button
              onClick={() => {
                if (!confirm(`Delete ${initial.name}?`)) return
                removeCustom(initial.id)
                onDone(true)
              }}
              className="font-display ml-auto px-6 py-3 text-xs tracking-[0.3em] text-white/40 hover:text-red-300"
            >
              DELETE
            </button>
          )
        )}
      </div>
    </div>
  )
}

function CardPicker({ bakugan, onPick, onClose }: { bakugan: Bakugan; onPick: (c: DbCard) => void; onClose: () => void }) {
  const [cards, setCards] = useState<DbCard[]>([])
  const [q, setQ] = useState(bakugan.name)
  useEffect(() => {
    loadCards().then(setCards)
  }, [])
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return cards
      .filter((c) => c.type === 'character' || c.type === 'ability')
      .filter((c) => !s || `${c.name} ${c.user ?? ''} ${c.text}`.toLowerCase().includes(s))
      .slice(0, 60)
  }, [cards, q])
  const owned = new Set(bakugan.abilities.map((a) => a.name))
  return (
    <div className="mt-3 rounded-xl border border-white/15 bg-black/80 p-4">
      <div className="flex gap-2">
        <input className={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search cards…" autoFocus />
        <button onClick={onClose} className="font-display border border-white/30 px-4 text-xs tracking-[0.3em]">
          DONE
        </button>
      </div>
      <div className="mt-3 grid max-h-80 grid-cols-2 gap-2 overflow-y-auto">
        {shown.map((c) => {
          const a = abilityFromCard(c, bakugan.element)
          const has = owned.has(c.name)
          return (
            <button
              key={c.id}
              disabled={has}
              onClick={() => onPick(c)}
              className="rounded-md border border-white/10 p-2 text-left transition enabled:hover:border-white/50 disabled:opacity-35"
            >
              <p className="text-sm font-bold">
                {c.name} <span className="text-xs font-normal text-white/50">{has ? '· added' : `· ${abilityLabel(a)}`}</span>
              </p>
              <p className="text-xs text-white/45">{c.user ?? 'Any Bakugan'}</p>
              <p className="line-clamp-2 text-xs text-white/60">{c.text}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Season settings: start date, which Bakugan each season brings, and test tools. */
function SeasonAdmin() {
  const seasonStart = useAdmin((s) => s.seasonStart)
  const setSeasonStart = useAdmin((s) => s.setSeasonStart)
  const seasonRoles = useAdmin((s) => s.seasonRoles)
  const setSeasonRole = useAdmin((s) => s.setSeasonRole)
  const profile = useActiveProfile()
  const adminSetPremium = useProfiles((s) => s.adminSetPremium)
  const adminAddPassXp = useProfiles((s) => s.adminAddPassXp)
  const current = currentSeason()
  const [season, setSeason] = useState(current.id)
  const roles = seasonRoles[season] ?? {}
  const count = (r: SeasonRole) => Object.values(roles).filter((x) => x === r).length
  const shift = (days: number) => {
    const d = new Date(`${seasonStart}T00:00:00`)
    d.setDate(d.getDate() + days)
    setSeasonStart(d.toISOString().slice(0, 10))
  }

  return (
    <section className="mt-8 rounded-xl border border-amber-300/30 bg-black/40 p-5">
      <h2 className="font-display text-xs tracking-[0.5em] text-amber-300">SEASONS</h2>
      <div className="mt-3 flex flex-wrap items-end gap-4">
        <label>
          <span className={label}>SEASON 1 STARTS</span>
          <input type="date" className={input} value={seasonStart} onChange={(e) => e.target.value && setSeasonStart(e.target.value)} />
        </label>
        <p className="text-sm text-white/60">
          Now: <b>Season {current.id}</b> · ends {new Date(current.endsAt).toLocaleDateString('en-GB')} (every season lasts {SEASON_DAYS} days)
        </p>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <span className={label}>EDIT SEASON</span>
        {[current.id, current.id + 1].map((id) => (
          <button
            key={id}
            onClick={() => setSeason(id)}
            className={`rounded border px-3 py-1 text-xs ${season === id ? 'border-white text-white' : 'border-white/20 text-white/50'}`}
          >
            Season {id}
            {id === current.id ? ' (now)' : ' (next)'}
          </button>
        ))}
        <span className="text-xs text-white/50">
          pass {count('pass')}/4 · in play {count('challenge')}/8
        </span>
      </div>
      <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2">
        {BAKUGAN.map((b) => {
          const elsewhere = Object.entries(seasonRoles).find(([sid, r]) => Number(sid) !== season && r[b.id])
          return (
            <label key={b.id} className="flex items-center gap-2 rounded border border-white/10 px-2 py-1.5 text-sm">
              <img src={ELEMENT_BY_ID[b.element].icon} alt="" className="h-6 w-6" />
              <span className="flex-1 truncate">{b.name}</span>
              {elsewhere ? (
                <span className="text-xs text-white/40">Season {elsewhere[0]}</span>
              ) : (
                <select
                  value={roles[b.id] ?? ''}
                  onChange={(e) => setSeasonRole(season, b.id, (e.target.value || null) as SeasonRole | null)}
                  className="rounded border border-white/20 bg-black/80 px-1 text-xs"
                >
                  <option value="">base game</option>
                  <option value="pass" disabled={roles[b.id] !== 'pass' && count('pass') >= 4}>
                    season pass
                  </option>
                  <option value="challenge" disabled={roles[b.id] !== 'challenge' && count('challenge') >= 8}>
                    earned in play
                  </option>
                </select>
              )}
            </label>
          )
        })}
      </div>

      <h3 className={`${label} mt-5`}>TEST TOOLS (ACTIVE PLAYER{profile ? `: ${profile.firstName.toUpperCase()}` : ''})</h3>
      <div className="flex flex-wrap gap-2">
        <button disabled={!profile} onClick={() => adminSetPremium(!(profile && seasonFor(profile).premium))} className="rounded border border-amber-300/50 px-3 py-1.5 text-xs text-amber-200 disabled:opacity-40">
          {profile && seasonFor(profile).premium ? 'Remove premium pass' : 'Give premium pass'}
        </button>
        <button disabled={!profile} onClick={() => adminAddPassXp(5000)} className="rounded border border-white/30 px-3 py-1.5 text-xs disabled:opacity-40">
          +5,000 pass XP
        </button>
        <button onClick={() => shift(-SEASON_DAYS)} className="rounded border border-white/30 px-3 py-1.5 text-xs">
          Jump to next season
        </button>
        <button onClick={() => shift(SEASON_DAYS)} className="rounded border border-white/30 px-3 py-1.5 text-xs">
          Go back a season
        </button>
      </div>
    </section>
  )
}
