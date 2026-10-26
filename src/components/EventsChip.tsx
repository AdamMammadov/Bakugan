import { playSfx } from '../audio/sfx'
import { openEvents } from '../events/nav'
import { Trophy } from './EventArt'
import { useEventsLine } from './eventsLine'

/** The hub's way into the events: what is on today, at a glance. */
export function EventsChip() {
  const { line } = useEventsLine()
  return (
    <button
      onClick={() => {
        playSfx('select')
        openEvents()
      }}
      className="flex items-center gap-3 rounded-xl border-2 border-violet-400/60 bg-black/50 px-4 py-2.5 text-left backdrop-blur transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-400/10"
    >
      <Trophy size={40} />
      <span>
        <span className="font-display block text-[10px] tracking-[0.4em] text-violet-300">{line}</span>
        <span className="font-display mt-0.5 block text-xl font-black">EVENTS</span>
      </span>
    </button>
  )
}
