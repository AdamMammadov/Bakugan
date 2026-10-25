import { playSfx } from '../audio/sfx'
import { cupAt, dailyEvent, weeklyEvent } from '../events/catalog'
import { openEvents } from '../events/nav'
import { cupEntry } from '../events/progress'
import { useProfileEvents } from '../events/store'
import { useActiveProfile } from '../profile/useProfiles'
import { Trophy } from './EventArt'

/** The hub's way into the events: what is on today, at a glance. */
export function EventsChip() {
  const profile = useActiveProfile()
  const events = useProfileEvents(profile?.id)
  const entry = cupEntry(events)
  const cup = cupAt()
  // a finished rule event waiting to be claimed comes first
  const ready = [dailyEvent(), weeklyEvent()].find((ev) => {
    const prog = events.rules[ev.id]
    return prog && !prog.claimed && prog.wins >= ev.goal
  })
  const line = ready
    ? `${ready.name.toUpperCase()} · REWARD READY`
    : entry.running
      ? `${(events.cup?.name ?? cup.name).toUpperCase()} · IN PROGRESS`
      : entry.enteredToday
        ? dailyEvent().name.toUpperCase()
        : `${cup.name.toUpperCase()} · ENTRY OPEN`
  return (
    <button
      onClick={() => {
        playSfx('select')
        openEvents()
      }}
      className="flex items-center gap-3 rounded-xl border-2 border-violet-400/60 bg-black/50 px-4 py-2.5 text-left backdrop-blur transition hover:bg-violet-400/10"
    >
      <Trophy size={40} />
      <span>
        <span className="font-display block text-[10px] tracking-[0.4em] text-violet-300">{line}</span>
        <span className="font-display mt-0.5 block text-xl font-black">EVENTS</span>
      </span>
    </button>
  )
}
