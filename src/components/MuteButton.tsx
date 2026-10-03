import { useGame } from '../store/useGame'

export function MuteButton() {
  const muted = useGame((s) => s.muted)
  const toggleMute = useGame((s) => s.toggleMute)
  return (
    <button
      onClick={toggleMute}
      className="font-display fixed right-5 bottom-5 z-50 rounded-full border border-white/15 bg-black/50 px-4 py-2 text-xs tracking-[0.3em] text-white/60 backdrop-blur transition hover:text-white"
    >
      SOUND {muted ? 'OFF' : 'ON'}
    </button>
  )
}
