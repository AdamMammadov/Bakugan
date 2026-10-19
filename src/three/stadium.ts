import type { SideIndex } from '../battle/engine'

/**
 * The arena's stands and announcer, driven by the battle: the battle screen calls crowd() and announce() at
 * the moments that matter, the stadium in the 3D scene listens and plays them (the fans' reaction and noise,
 * the announcer's banner and voice).
 */
export type CrowdMood = 'cheer' | 'roar' | 'boo' | 'gasp' | 'chant' | 'calm'

export type StadiumCall = { kind: 'crowd'; mood: CrowdMood; side?: SideIndex } | { kind: 'announce'; text: string }

const listeners = new Set<(call: StadiumCall) => void>()

/** Lets the stadium hear the battle's calls; returns the way to stop listening. */
export function listenStadium(fn: (call: StadiumCall) => void) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** The stands react; `side` is whose fans lead it (0 = the player's side). */
export function crowd(mood: CrowdMood, side?: SideIndex) {
  for (const fn of listeners) fn({ kind: 'crowd', mood, side })
}

/** The announcer calls out a line. */
export function announce(text: string) {
  for (const fn of listeners) fn({ kind: 'announce', text })
}
