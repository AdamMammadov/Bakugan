import type { SideIndex } from '../battle/engine'
import type { ElementId } from '../data/elements'

/**
 * Big battle moments for the arena's effects, like the stadium bus (stadium.ts): the battle screen calls fx() when
 * they happen, the 3D scene and the effect overlays listen and play them.
 */
export type FxCall =
  /** An ability card is activated: `delta` is the G change for side 0 and side 1. */
  | { kind: 'ability'; side: SideIndex; element: ElementId; name: string; delta: [number, number] }
  /** The Gate Card opens in `by`'s favour (its owner, or a brawler opening it for themselves after closing it). */
  | { kind: 'gateOpen'; by: SideIndex; element: ElementId | null; name: string; delta: [number, number] }
  /** `by` closes the open Gate Card: its effect is undone. */
  | { kind: 'gateClose'; by: SideIndex; element: ElementId | null; name: string }
  /**
   * `by` nullifies the opponent's last ability card, or their open Gate Card (`target`; when left out, the effects
   * guess from the moves just before).
   */
  | { kind: 'nullify'; by: SideIndex; name: string; target?: 'ability' | 'gate' }
  /** A Bakugan's G-Power drops to 0, or it loses the clash. */
  | { kind: 'defeat'; side: SideIndex }

const listeners = new Set<(call: FxCall) => void>()

/** Lets the arena's effects hear the battle's moments; returns the way to stop listening. */
export function listenFx(fn: (call: FxCall) => void) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** A battle moment happens. */
export function fx(call: FxCall) {
  for (const fn of listeners) fn(call)
}
