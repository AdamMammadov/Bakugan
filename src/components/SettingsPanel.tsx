import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState, type ReactNode } from 'react'
import { playSfx } from '../audio/sfx'
import { useGame } from '../store/useGame'
import { useSettings, type Commentary, type CrowdSize, type Quality } from '../store/useSettings'

const QUALITIES: { id: Quality; label: string; sub: string }[] = [
  { id: 'low', label: 'LOW', sub: 'Lightest: softer, no shadows, glow or lights' },
  { id: 'medium', label: 'MEDIUM', sub: 'Everything, at your screen’s size' },
  { id: 'high', label: 'HIGH', sub: 'Sharper and smoother; needs a good graphics card' },
]
const CROWDS: { id: CrowdSize; label: string; sub: string }[] = [
  { id: 'few', label: 'FEW', sub: 'Half the fans' },
  { id: 'normal', label: 'NORMAL', sub: 'Three in four' },
  { id: 'packed', label: 'PACKED', sub: 'Every seat filled' },
]
const COMMENTARY: { id: Commentary; label: string; sub: string }[] = [
  { id: 'full', label: 'FULL', sub: 'Every line; turns wait for it' },
  { id: 'short', label: 'SHORT', sub: 'The key words; never holds you up' },
  { id: 'off', label: 'TEXT ONLY', sub: 'On screen, not spoken' },
]
const TABS = ['SOUND', 'GRAPHICS', 'BATTLE', 'DISPLAY'] as const
type Tab = (typeof TABS)[number]

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

/** Sound, graphics, battle and display settings, over whatever screen is showing (a battle carries on behind it). */
export function SettingsPanel() {
  const open = useSettings((s) => s.open)
  const setOpen = useSettings((s) => s.setOpen)
  const s = useSettings()
  const muted = useGame((g) => g.muted)
  const music = useGame((g) => g.music)
  const toggleMute = useGame((g) => g.toggleMute)
  const toggleMusic = useGame((g) => g.toggleMusic)
  const [tab, setTab] = useState<Tab>('SOUND')

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
            className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0b1024]/95 shadow-2xl"
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-7 pt-6 pb-4">
              <h2 className="font-display text-2xl font-black tracking-[0.2em]">SETTINGS</h2>
              <button
                onClick={() => setOpen(false)}
                title="Close (Esc)"
                className="font-display text-xs tracking-[0.3em] text-white/50 hover:text-white"
              >
                CLOSE ✕
              </button>
            </div>

            <div className="flex min-h-0 flex-1">
              {/* the sections */}
              <nav className="flex w-44 shrink-0 flex-col gap-1 border-r border-white/10 p-3">
                {TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`font-display rounded-lg px-4 py-3 text-left text-xs tracking-[0.3em] transition ${
                      tab === t ? 'bg-white/15 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </nav>

              <div className="min-h-[24rem] flex-1 overflow-y-auto p-6">
                {tab === 'SOUND' && (
                  <Section>
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
                    <Toggle
                      label="Silent when the game is in the background"
                      on={s.muteInBackground}
                      onClick={() => s.set({ muteInBackground: !s.muteInBackground })}
                    />
                  </Section>
                )}

                {tab === 'GRAPHICS' && (
                  <Section>
                    <Choice
                      label="Quality"
                      hint="If the game runs slowly or the 3D goes black, choose a lower quality. It also steps down by itself when the 3D fails."
                      options={QUALITIES}
                      value={s.quality}
                      onPick={(quality) => s.set({ quality })}
                    />
                    <Choice
                      label="Fans in the arena"
                      hint="Fewer fans draw faster."
                      options={CROWDS}
                      value={s.crowdSize}
                      onPick={(crowdSize) => s.set({ crowdSize })}
                    />
                    <Toggle label="Show frames per second" on={s.showFps} onClick={() => s.set({ showFps: !s.showFps })} />
                  </Section>
                )}

                {tab === 'BATTLE' && (
                  <Section>
                    <Choice
                      label="Announcer"
                      options={COMMENTARY}
                      value={s.commentary}
                      onPick={(commentary) => s.set({ commentary })}
                    />
                    <Toggle
                      label="Brawlers shout their moves"
                      sub={'"Ability activate!", "Gate Card, open!"'}
                      on={s.brawlerCalls}
                      onClick={() => s.set({ brawlerCalls: !s.brawlerCalls })}
                    />
                  </Section>
                )}

                {tab === 'DISPLAY' && (
                  <Section>
                    <Toggle
                      label="Reduce motion"
                      sub="Pages and panels slide and pop less"
                      on={s.reduceMotion}
                      onClick={() => s.set({ reduceMotion: !s.reduceMotion })}
                    />
                    <Toggle
                      label="Full screen"
                      sub="F11 does the same"
                      on={typeof document !== 'undefined' && !!document.fullscreenElement}
                      onClick={() =>
                        document.fullscreenElement
                          ? void document.exitFullscreen()
                          : void document.documentElement.requestFullscreen?.().catch(() => {})
                      }
                    />
                  </Section>
                )}
              </div>
            </div>

            <div className="flex justify-between border-t border-white/10 px-7 py-4">
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

function Section({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>
}

function Choice<T extends string>({
  label,
  hint,
  options,
  value,
  onPick,
}: {
  label: string
  hint?: string
  options: { id: T; label: string; sub: string }[]
  value: T
  onPick: (id: T) => void
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 px-4 py-3">
      <p className="mb-2 text-sm">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => {
              playSfx('select')
              onPick(o.id)
            }}
            className={`rounded-lg border px-2 py-2.5 text-center transition ${
              value === o.id
                ? 'border-white/70 bg-white/15 text-white'
                : 'border-white/15 bg-black/30 text-white/60 hover:border-white/40 hover:text-white'
            }`}
          >
            <span className="font-display block text-xs font-black tracking-[0.2em]">{o.label}</span>
            <span className="mt-1 block text-[11px] leading-tight text-white/50">{o.sub}</span>
          </button>
        ))}
      </div>
      {hint && <p className="mt-2 text-xs text-white/40">{hint}</p>}
    </div>
  )
}

function Toggle({
  label,
  sub,
  on,
  onClick,
  disabled,
}: {
  label: string
  sub?: string
  on: boolean
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-black/30 px-4 py-2.5 text-left transition hover:border-white/30 disabled:opacity-40"
    >
      <span>
        <span className="block text-sm">{label}</span>
        {sub && <span className="block text-xs text-white/45">{sub}</span>}
      </span>
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${on && !disabled ? 'bg-emerald-500' : 'bg-white/20'}`}
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
