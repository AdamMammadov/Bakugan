import { useGame } from '../store/useGame'

const pill =
  'font-display flex h-9 items-center rounded-full border border-white/15 bg-black/50 px-4 text-xs tracking-[0.3em] text-white/60 backdrop-blur transition hover:text-white'

/** Music and sound switches in the corner. */
export function MuteButton() {
  const muted = useGame((s) => s.muted)
  const music = useGame((s) => s.music)
  const toggleMute = useGame((s) => s.toggleMute)
  const toggleMusic = useGame((s) => s.toggleMusic)
  return (
    <div className="flex gap-2">
      <button onClick={toggleMusic} title="Background music" className={pill} style={{ opacity: music && !muted ? 1 : 0.5 }}>
        ♪ {music ? 'ON' : 'OFF'}
      </button>
      <button onClick={toggleMute} className={pill}>
        SOUND {muted ? 'OFF' : 'ON'}
      </button>
    </div>
  )
}
