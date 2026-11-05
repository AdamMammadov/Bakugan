import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, type ReactNode } from 'react'
import { playSfx } from '../audio/sfx'
import { useGame } from '../store/useGame'
import { useSettings, type Quality } from '../store/useSettings'

const QUALITIES: { id: Quality; label: string; sub: string }[] = [
  { id: 'low', label: 'LOW', sub: 'Fastest · no shadows or glow' },
  { id: 'medium', label: 'MEDIUM', sub: 'Shadows and glow, a little softer' },
  { id: 'high', label: 'HIGH', sub: 'Sharpest picture' },
]

/** The ⚙ button that opens the settings, for the corners of the screens. */
export function SettingsButton({ className = '' }: { className?: string }) {
  const setOpen = useSettings((s) => s.setOpen)
  return (
    <button
      onClick={() => {
        playSfx('select')
        setOpen(true)
      }}
      title="Settings"
      className={`font-display flex h-9 items-center gap-2 rounded-full border border-white/15 bg-black/50 px-4 text-xs tracking-[0.3em] text-white/70 backdrop-blur transition hover:border-white/40 hover:text-white ${className}`}
    >
      <span className="text-base leading-none tracking-normal">⚙</span> SETTINGS
    </button>
  )
}

/** Sound and graphics settings, over whatever screen is showing (a battle carries on behind it). */
export function SettingsPanel() {
  const open = useSettings((s) => s.open)
  const setOpen = useSettings((s) => s.setOpen)
  const s = useSettings()
  const muted = useGame((g) => g.muted)
  const music = useGame((g) => g.music)
  const toggleMute = useGame((g) => g.toggleMute)
  const toggleMusic = useGame((g) => g.toggleMusic)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className="max-h-full w-full max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-[#0b1024]/95 p-7 shadow-2xl"
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-black tracking-[0.2em]">SETTINGS</h2>
              <button
                onClick={() => setOpen(false)}
                title="Close (Esc)"
                className="font-display text-xs tracking-[0.3em] text-white/50 hover:text-white"
              >
                CLOSE ✕
              </button>
            </div>

            <Section title="SOUND">
              <Toggle label="All sound" on={!muted} onClick={toggleMute} />
              <Toggle label="Music" on={music} disabled={muted} onClick={toggleMusic} />
              <Slider
                label="Music volume"
                value={s.musicVolume}
                disabled={muted || !music}
                onChange={(v) => s.set({ musicVolume: v })}
              />
              <Slider
                label="Sound effects"
                value={s.sfxVolume}
                disabled={muted}
                onChange={(v) => s.set({ sfxVolume: v })}
                onRelease={() => playSfx('select')}
              />
              <Slider
                label="Voices (announcer, brawlers)"
                value={s.voiceVolume}
                disabled={muted}
                onChange={(v) => s.set({ voiceVolume: v })}
              />
              <Slider label="Crowd" value={s.crowdVolume} disabled={muted} onChange={(v) => s.set({ crowdVolume: v })} />
            </Section>

            <Section title="GRAPHICS">
              <div className="grid grid-cols-3 gap-2">
                {QUALITIES.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => {
                      playSfx('select')
                      s.set({ quality: q.id })
                    }}
                    className={`rounded-lg border px-2 py-3 text-center transition ${
                      s.quality === q.id
                        ? 'border-white/70 bg-white/15 text-white'
                        : 'border-white/15 bg-black/30 text-white/60 hover:border-white/40 hover:text-white'
                    }`}
                  >
                    <span className="font-display block text-sm font-black tracking-[0.2em]">{q.label}</span>
                    <span className="mt-1 block text-[11px] leading-tight text-white/50">{q.sub}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-white/40">If the game runs slowly, choose LOW.</p>
            </Section>

            <div className="mt-7 flex justify-between">
              <button
                onClick={() => s.reset()}
                className="font-display text-xs tracking-[0.25em] text-white/45 transition hover:text-white"
              >
                ↺ DEFAULTS
              </button>
              <button
                onClick={() => setOpen(false)}
                className="font-display skew-x-[-10deg] border-2 border-white/70 bg-white/10 px-8 py-2 text-sm font-black tracking-[0.3em] hover:bg-white/20"
              >
                DONE
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="font-display mb-3 text-xs tracking-[0.35em] text-white/45">{title}</h3>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

function Toggle({ label, on, onClick, disabled }: { label: string; on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-between rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-left transition hover:border-white/30 disabled:opacity-40"
    >
      <span className="text-sm">{label}</span>
      <span
        className={`relative h-6 w-11 rounded-full transition ${on && !disabled ? 'bg-emerald-500' : 'bg-white/20'}`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on && !disabled ? 'left-[22px]' : 'left-0.5'}`}
        />
      </span>
    </button>
  )
}

function Slider({
  label,
  value,
  onChange,
  onRelease,
  disabled,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  onRelease?: () => void
  disabled?: boolean
}) {
  return (
    <label className={`block rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 ${disabled ? 'opacity-40' : ''}`}>
      <span className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-display text-xs text-white/60">{Math.round(value * 100)}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        onPointerUp={onRelease}
        onKeyUp={onRelease}
        className="mt-2 w-full accent-white"
      />
    </label>
  )
}
