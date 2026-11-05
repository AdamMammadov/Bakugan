import type { ComponentType, RefObject } from 'react'
import type { Bakugan } from '../../data/bakugan'
import { HydranoidBall } from './HydranoidBall'

/** Hand-built ball forms (with their own opening animation), keyed by Bakugan id. */
export const PROCEDURAL_BALLS: Record<string, ComponentType<{ openRef: RefObject<boolean> }>> = {
  hydranoid: HydranoidBall,
}

/** Whether a Bakugan's ball form has a model of its own (a .glb or a hand-built one), not the plain stand-in. */
export const hasBallModel = (bakugan: Bakugan, form = 0) =>
  !!(bakugan.evolutions[form]?.models?.ball ?? bakugan.models?.ball) || !!PROCEDURAL_BALLS[bakugan.id]
