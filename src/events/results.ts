import type { ArenaEvent } from '../store/useGame'

/** How an event match ended, as the battle screen reports it. */
export interface EventResult {
  event: ArenaEvent
  won: boolean
  /** The player's lives left, and the battles fought. */
  livesLeft: number
  battles: number
}

const listeners = new Set<(result: EventResult) => void>()

/** The events code hears every finished event match here. */
export function onEventResult(fn: (result: EventResult) => void) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** Called by the battle screen when an event match ends. */
export function reportEventResult(result: EventResult) {
  for (const fn of listeners) fn(result)
}
