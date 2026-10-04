import { motion } from 'framer-motion'
import { useRef, useState } from 'react'
import { playSfx } from '../audio/sfx'
import { Avatar, AvatarDrawing } from '../components/Avatar'
import { GRID, GRID_SIZE } from '../components/grid'
import { ELEMENT_BY_ID, ELEMENTS, type ElementId } from '../data/elements'
import {
  ACCESSORIES,
  CHARACTER_BY_ID,
  CHARACTERS,
  DEFAULT_PARTS,
  EYE_COLORS,
  EYE_STYLES,
  HAIR_COLORS,
  HAIR_STYLES,
  OUTFITS,
  photoToDataUrl,
  SKINS,
  type Avatar as AvatarValue,
  type AvatarParts,
} from '../profile/avatar'
import { useProfiles } from '../profile/useProfiles'
import { useGame } from '../store/useGame'

type Tab = 'characters' | 'build' | 'photo'
const BIO_MAX = 280

export function ProfileEditor() {
  const editId = useGame((s) => s.editProfileId)
  const back = useGame((s) => s.back)
  const chosenElement = useGame((s) => s.element)
  const go = useGame((s) => s.go)
  const existing = useProfiles((s) => s.profiles.find((p) => p.id === editId) ?? null)
  const hasProfiles = useProfiles((s) => s.profiles.length > 0)
  const create = useProfiles((s) => s.create)
  const update = useProfiles((s) => s.update)

  const [firstName, setFirstName] = useState(existing?.firstName ?? '')
  const [lastName, setLastName] = useState(existing?.lastName ?? '')
  const [bio, setBio] = useState(existing?.bio ?? '')
  const [element, setElement] = useState<ElementId>(existing?.element ?? chosenElement ?? 'pyrus')
  const [avatar, setAvatar] = useState<AvatarValue>(existing?.avatar ?? { kind: 'preset', id: 'dan' })
  const [parts, setParts] = useState<AvatarParts>(
    avatar.kind === 'custom' ? avatar.parts : avatar.kind === 'preset' ? CHARACTER_BY_ID[avatar.id].parts : DEFAULT_PARTS,
  )
  const [tab, setTab] = useState<Tab>(avatar.kind === 'photo' ? 'photo' : avatar.kind === 'custom' ? 'build' : 'characters')
  const [error, setError] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const color = ELEMENT_BY_ID[element].color
  const valid = firstName.trim() && lastName.trim()

  const setPart = <K extends keyof AvatarParts>(key: K, value: AvatarParts[K]) => {
    playSfx('tick')
    const next = { ...parts, [key]: value }
    setParts(next)
    setAvatar({ kind: 'custom', parts: next })
  }

  async function upload(f: File | undefined) {
    if (!f) return
    try {
      setAvatar({ kind: 'photo', dataUrl: await photoToDataUrl(f) })
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function save() {
    if (!valid) return setError('Enter a first name and a last name.')
    playSfx('select')
    const input = { firstName: firstName.trim(), lastName: lastName.trim(), bio: bio.trim(), element, avatar }
    if (existing) update(existing.id, input)
    else create(input)
    useGame.setState({ element: useGame.getState().element ?? element })
    go(back === 'profileEdit' ? 'profile' : back)
  }

  return (
    <motion.div
      className="absolute inset-0 overflow-y-auto px-16 py-10"
      style={{
        backgroundImage: `radial-gradient(circle at 20% 15%, ${color}30 0%, transparent 50%), ${GRID}`,
        backgroundSize: `100% 100%, ${GRID_SIZE}`,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {(existing || hasProfiles) && (
        <button onClick={() => go(back)} className="font-display text-xs tracking-[0.4em] text-white/50 transition hover:text-white">
          ← CANCEL
        </button>
      )}
      <p className="font-display mt-4 text-xs tracking-[0.5em] text-white/40">BRAWLER PROFILE</p>
      <h1 className="font-display text-4xl font-black tracking-wider">{existing ? 'EDIT YOUR BRAWLER' : 'CREATE YOUR BRAWLER'}</h1>

      <div className="mt-8 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-10">
        {/* avatar */}
        <section className="rounded-xl border border-white/10 bg-black/40 p-6 backdrop-blur">
          <div className="flex items-center gap-6">
            <Avatar avatar={avatar} color={color} size={150} />
            <div>
              <p className="font-display text-2xl font-bold">
                {firstName || 'First'} {lastName || 'Last'}
              </p>
              <p className="mt-1 text-white/50">{ELEMENT_BY_ID[element].name} Brawler</p>
            </div>
          </div>

          <div className="mt-6 flex gap-2 border-b border-white/10">
            {(['characters', 'build', 'photo'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="font-display -mb-px border-b-2 px-4 py-2 text-xs tracking-[0.3em] transition"
                style={{ borderColor: tab === t ? color : 'transparent', color: tab === t ? '#fff' : 'rgba(255,255,255,0.45)' }}
              >
                {t === 'characters' ? 'SERIES CHARACTERS' : t === 'build' ? 'BUILD YOUR OWN' : 'PHOTO'}
              </button>
            ))}
          </div>

          {tab === 'characters' && (
            <div className="mt-5 grid grid-cols-4 gap-3">
              {CHARACTERS.map((c) => {
                const on = avatar.kind === 'preset' && avatar.id === c.id
                const el = ELEMENT_BY_ID[c.element]
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      playSfx('tick')
                      setAvatar({ kind: 'preset', id: c.id })
                      setParts(c.parts)
                      // playing as a series character: fill in their name if none was typed yet
                      const [first, last] = c.name.split(' ')
                      if (!firstName && !lastName && last) {
                        setFirstName(first)
                        setLastName(last)
                      }
                    }}
                    className="flex flex-col items-center rounded-lg border-2 p-2 transition hover:bg-white/5"
                    style={{ borderColor: on ? el.color : 'rgba(255,255,255,0.08)' }}
                  >
                    <div className="h-16 w-16 overflow-hidden rounded-full">
                      <AvatarDrawing parts={c.parts} color={el.color} />
                    </div>
                    <span className="mt-1 text-center text-xs leading-tight font-semibold">{c.name}</span>
                    <span className="text-[10px] text-white/40">
                      {el.name} · {c.bakugan}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {tab === 'build' && (
            <div className="mt-5 space-y-4">
              <Swatches label="SKIN" options={SKINS} value={parts.skin} onPick={(v) => setPart('skin', v)} />
              <Choices label="HAIR" options={HAIR_STYLES} value={parts.hair} onPick={(v) => setPart('hair', v)} />
              <Swatches label="HAIR COLOR" options={HAIR_COLORS} value={parts.hairColor} onPick={(v) => setPart('hairColor', v)} />
              <Choices label="EYES" options={EYE_STYLES} value={parts.eyes} onPick={(v) => setPart('eyes', v)} />
              <Swatches label="EYE COLOR" options={EYE_COLORS} value={parts.eyeColor} onPick={(v) => setPart('eyeColor', v)} />
              <Swatches label="OUTFIT" options={OUTFITS} value={parts.outfit} onPick={(v) => setPart('outfit', v)} />
              <Choices label="EXTRA" options={ACCESSORIES} value={parts.accessory} onPick={(v) => setPart('accessory', v)} />
            </div>
          )}

          {tab === 'photo' && (
            <div className="mt-5">
              <p className="text-sm text-white/60">
                Upload any picture. It is cropped to a square and stays on this device only — nothing is sent anywhere.
              </p>
              <input ref={file} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
              <button
                onClick={() => file.current?.click()}
                className="font-display mt-4 rounded-md border-2 px-6 py-3 text-sm tracking-[0.3em] transition hover:bg-white/10"
                style={{ borderColor: color }}
              >
                {avatar.kind === 'photo' ? 'CHANGE PHOTO' : 'UPLOAD PHOTO'}
              </button>
            </div>
          )}
        </section>

        {/* details */}
        <section className="rounded-xl border border-white/10 bg-black/40 p-6 backdrop-blur">
          <div className="grid grid-cols-2 gap-4">
            <Field label="FIRST NAME" value={firstName} onChange={setFirstName} placeholder="Dan" />
            <Field label="LAST NAME" value={lastName} onChange={setLastName} placeholder="Kuso" />
          </div>

          <p className="font-display mt-6 text-xs tracking-[0.4em] text-white/40">ATTRIBUTE</p>
          <div className="mt-2 grid grid-cols-6 gap-2">
            {ELEMENTS.map((e) => (
              <button
                key={e.id}
                onClick={() => {
                  playSfx('tick')
                  setElement(e.id)
                }}
                className="flex flex-col items-center rounded-lg border-2 py-2 transition"
                style={{ borderColor: element === e.id ? e.color : 'rgba(255,255,255,0.08)', background: element === e.id ? `${e.color}22` : 'transparent' }}
              >
                <img src={e.icon} alt="" className="h-10 w-10" />
                <span className="mt-1 text-xs">{e.name}</span>
              </button>
            ))}
          </div>
          {!existing && (
            <p className="mt-2 text-xs text-white/45">
              Your attribute decides your starting Bakugan: its {ELEMENT_BY_ID[element].name} Bakugan plus two allies.
            </p>
          )}

          <p className="font-display mt-6 text-xs tracking-[0.4em] text-white/40">BIO</p>
          <textarea
            value={bio}
            maxLength={BIO_MAX}
            onChange={(e) => setBio(e.target.value)}
            rows={5}
            placeholder="Who are you as a brawler? Favourite Bakugan, battle style, rivals…"
            className="mt-2 w-full resize-none rounded-md border border-white/15 bg-black/40 p-3 text-sm outline-none focus:border-white/50"
          />
          <p className="text-right text-xs text-white/35">
            {bio.length}/{BIO_MAX}
          </p>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
          <motion.button
            onClick={save}
            whileHover={valid ? { scale: 1.04 } : undefined}
            whileTap={valid ? { scale: 0.97 } : undefined}
            className="font-display mt-6 w-full skew-x-[-10deg] border-2 py-4 text-lg font-black tracking-[0.3em] transition"
            style={{ borderColor: valid ? color : 'rgba(255,255,255,0.15)', background: valid ? `${color}33` : 'transparent', opacity: valid ? 1 : 0.5 }}
          >
            {existing ? 'SAVE PROFILE' : 'START BRAWLING'}
          </motion.button>
        </section>
      </div>
    </motion.div>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="block">
      <span className="font-display text-xs tracking-[0.4em] text-white/40">{label}</span>
      <input
        value={value}
        maxLength={24}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-2 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2.5 text-lg outline-none focus:border-white/50"
      />
    </label>
  )
}

function Swatches({ label, options, value, onPick }: { label: string; options: string[]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-display w-24 shrink-0 text-[10px] tracking-[0.3em] text-white/40">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((c) => (
          <button
            key={c}
            onClick={() => onPick(c)}
            aria-label={c}
            className="h-7 w-7 rounded-full border-2 transition hover:scale-110"
            style={{ background: c, borderColor: value === c ? '#fff' : 'transparent' }}
          />
        ))}
      </div>
    </div>
  )
}

function Choices<T extends string>({ label, options, value, onPick }: { label: string; options: T[]; value: T; onPick: (v: T) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-display w-24 shrink-0 text-[10px] tracking-[0.3em] text-white/40">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o}
            onClick={() => onPick(o)}
            className="rounded-md border px-2.5 py-1 text-xs capitalize transition"
            style={{ borderColor: value === o ? '#fff' : 'rgba(255,255,255,0.15)', color: value === o ? '#fff' : 'rgba(255,255,255,0.6)' }}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  )
}
