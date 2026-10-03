import * as THREE from 'three'

/** One-off body animation a fighter is playing. `start` is filled in on the first frame. */
export interface Pose {
  kind: 'lunge' | 'cast' | 'hit'
  start: number | null
}

export type PoseRef = { current: Pose | null }

/** 0 → 1 → 0 envelope of a pose over `length` seconds (after `delay`), or 0 when idle. */
export function poseWeight(pose: Pose | null, kind: Pose['kind'], now: number, length = 0.9, delay = 0) {
  if (!pose || pose.kind !== kind || pose.start === null) return 0
  const k = THREE.MathUtils.clamp((now - pose.start - delay) / length, 0, 1)
  return Math.sin(k * Math.PI)
}
