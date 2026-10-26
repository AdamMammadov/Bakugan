import { cupAt, dailyEvent, weeklyEvent } from '../events/catalog'
import { cupEntry } from '../events/progress'
import { useProfileEvents } from '../events/store'
import { useActiveProfile } from '../profile/useProfiles'

/** What is on in the events today, in one line ("NEATHIA CUP · ENTRY OPEN"); `ready` when a reward waits. */
export function useEventsLine() {
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
  return { line, ready: !!ready }
}
