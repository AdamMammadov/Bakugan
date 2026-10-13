import { useFrame, useThree } from '@react-three/fiber'
import { useRef, type RefObject } from 'react'
import * as THREE from 'three'
import type { OrbitControls } from 'three-stdlib'

/** A part of the canvas, in CSS pixels from its top-left corner, that a model should fill. */
export type Stage = { x: number; y: number; w: number; h: number }
/** How far the model reaches out from the up axis (turning round it), and how low and high, in world units. */
export type Sweep = { radius: number; low: number; high: number }

/** Height slices of the model's profile, and points round each slice's widest circle. */
const SLICES = 48
const AROUND = 32
/** How long a refit takes, in seconds. */
const EASE = 0.5
/** Frames a new model is shown before it is measured, so its own per-frame placing (a flyer's hover) has run. */
const SETTLE = 3

/**
 * Frames the model under `target` so it fills the `stage` part of the canvas (up to `fill` of its width and
 * height) seen from any side the camera turns to: the view is shifted so its middle is the stage's middle, the
 * look-at point set to the model's middle height and the camera moved in or out. The model is measured as the
 * shape it sweeps turning round the up axis, so autorotation never takes it past the stage's edges. Refits,
 * easing over, once a new model (`fitKey`) has loaded and whenever the stage or the window changes; in between
 * the player turns, zooms and lifts the view as usual (the scene's default OrbitControls). `onMeasure` hears how
 * big each new model is; a floor disc it returns (its height and radius) is framed along with the model.
 */
export function StageFit({
  target,
  stage,
  fitKey,
  fill = 0.95,
  onMeasure,
}: {
  target: RefObject<THREE.Object3D | null>
  stage: Stage | null
  fitKey: string
  fill?: number
  onMeasure?: (sweep: Sweep) => { y: number; radius: number } | void
}) {
  const controls = useThree((s) => s.controls) as OrbitControls | null
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const size = useThree((s) => s.size)
  const profile = useRef<{ key: string; points: THREE.Vector3[] } | null>(null)
  const settled = useRef({ key: '', frames: 0 })
  const done = useRef('')
  const move = useRef<{ from: View; to: View; start: number } | null>(null)

  useFrame(({ clock }) => {
    if (!controls || !stage || !target.current) return
    if (profile.current?.key !== fitKey) {
      const found = sweep(target.current)
      // not loaded yet (or only just): keep the view as it is until it has settled
      const s = settled.current
      if (s.key !== fitKey || !found) {
        settled.current = { key: fitKey, frames: found ? 1 : 0 }
        return
      }
      if (++s.frames < SETTLE) return
      const floor = onMeasure?.(found.sweep)
      if (floor)
        for (let a = 0; a < AROUND; a++) {
          const t = (a / AROUND) * Math.PI * 2
          found.points.push(new THREE.Vector3(floor.radius * Math.cos(t), floor.y, floor.radius * Math.sin(t)))
        }
      profile.current = { key: fitKey, points: found.points }
    }
    const want = `${fitKey}|${stage.x}|${stage.y}|${stage.w}|${stage.h}|${size.width}|${size.height}|${fill}`
    if (want !== done.current) {
      done.current = want
      const from = current(camera, controls, size)
      const dir = camera.position.clone().sub(controls.target).normalize()
      const to = frame(profile.current.points, dir, camera.fov, size, stage, fill)
      move.current = { from, to, start: clock.elapsedTime }
      controls.minDistance = 0
      controls.maxDistance = Infinity
    }
    const m = move.current
    if (!m) return
    const k = THREE.MathUtils.smoothstep(clock.elapsedTime - m.start, 0, EASE)
    const lerp = (a: number, b: number) => a + (b - a) * k
    // keep the way the camera faces (autorotation, the player's turning), set how far and how high
    const dir = camera.position.clone().sub(controls.target).normalize()
    controls.target.set(0, lerp(m.from.y, m.to.y), 0)
    camera.position.copy(controls.target).addScaledVector(dir, lerp(m.from.d, m.to.d))
    offset(camera, size, lerp(m.from.cx, m.to.cx), lerp(m.from.cy, m.to.cy))
    if (k >= 1) {
      move.current = null
      controls.minDistance = m.to.d * 0.35
      controls.maxDistance = m.to.d * 2.5
    }
  })
  return null
}

/** Where the camera looks (height), how far it is, and where on the canvas the view's middle falls. */
type View = { y: number; d: number; cx: number; cy: number }

function current(camera: THREE.PerspectiveCamera, controls: OrbitControls, size: { width: number; height: number }): View {
  const v = camera.view
  return {
    y: controls.target.y,
    d: camera.position.distanceTo(controls.target),
    cx: v?.enabled ? size.width / 2 - v.offsetX : size.width / 2,
    cy: v?.enabled ? size.height / 2 - v.offsetY : size.height / 2,
  }
}

/** Puts the middle of the view at (cx, cy) on the canvas. */
function offset(camera: THREE.PerspectiveCamera, size: { width: number; height: number }, cx: number, cy: number) {
  const { width: w, height: h } = size
  camera.setViewOffset(w, h, w / 2 - cx, h / 2 - cy, w, h)
}

/**
 * The shape the model sweeps turning round the up axis: for each height slice, points round the circle of
 * its farthest vertex. Null while the model has no meshes (still loading).
 */
function sweep(root: THREE.Object3D): { points: THREE.Vector3[]; sweep: Sweep } | null {
  root.updateWorldMatrix(true, true)
  const ys: number[] = []
  const rs: number[] = []
  const v = new THREE.Vector3()
  root.traverseVisible((o) => {
    const m = o as THREE.Mesh
    const pos = m.isMesh ? m.geometry.attributes.position : undefined
    if (!pos) return
    for (let i = 0; i < pos.count; i++) {
      // where the vertex is drawn: a skinned mesh's raw positions can be in another frame (quantized files
      // keep the scale in the skin), so it is measured after skinning
      m.getVertexPosition(i, v).applyMatrix4(m.matrixWorld)
      ys.push(v.y)
      rs.push(Math.hypot(v.x, v.z))
    }
  })
  if (!ys.length) return null
  let lo = Infinity
  let hi = -Infinity
  for (const y of ys) {
    lo = Math.min(lo, y)
    hi = Math.max(hi, y)
  }
  // room for the hover's bob and the wings' beat, caught at some point of their swing
  const pad = (hi - lo) * 0.04 + 1e-4
  lo -= pad
  hi += pad
  const step = (hi - lo) / SLICES
  const widest = new Float32Array(SLICES).fill(-1)
  for (let i = 0; i < ys.length; i++) {
    const k = Math.min(SLICES - 1, Math.floor((ys[i] - lo) / step))
    widest[k] = Math.max(widest[k], rs[i] * 1.03)
  }
  const points: THREE.Vector3[] = []
  let radius = 0
  for (let k = 0; k < SLICES; k++) {
    radius = Math.max(radius, widest[k])
    if (widest[k] < 0) continue
    for (const y of [lo + k * step, lo + (k + 1) * step])
      for (let a = 0; a < AROUND; a++) {
        const t = (a / AROUND) * Math.PI * 2
        points.push(new THREE.Vector3(widest[k] * Math.cos(t), y, widest[k] * Math.sin(t)))
      }
  }
  return { points, sweep: { radius, low: lo, high: hi } }
}

/**
 * The view that fits the points into the stage: the closest camera distance along `dir` (from the look-at point
 * towards the camera) at which every point falls inside it, with the look-at height moved until the model sits in
 * the stage's middle.
 */
function frame(
  points: THREE.Vector3[],
  dir: THREE.Vector3,
  fov: number,
  size: { width: number; height: number },
  stage: Stage,
  fill: number,
): View {
  const tanV = Math.tan(THREE.MathUtils.degToRad(fov / 2))
  const tanH = tanV * (size.width / size.height)
  // the stage's half size as a share of the canvas's (the view's middle is the stage's middle)
  const sx = (fill * stage.w) / size.width
  const sy = (fill * stage.h) / size.height
  const back = dir.clone().negate()
  const right = new THREE.Vector3().crossVectors(back, THREE.Object3D.DEFAULT_UP)
  if (right.lengthSq() < 1e-9) right.set(1, 0, 0)
  right.normalize()
  const up = new THREE.Vector3().crossVectors(right, back)
  const q = new THREE.Vector3()
  /** How high the points reach on screen (lowest, highest), or null when one is off the stage. */
  const reach = (d: number, y: number, strict: boolean): [number, number] | null => {
    const cam = new THREE.Vector3(0, y, 0).addScaledVector(dir, d)
    let low = Infinity
    let high = -Infinity
    for (const p of points) {
      q.subVectors(p, cam)
      const z = q.dot(back)
      if (z < 0.01) return null
      const sxp = q.dot(right) / (z * tanH)
      const syp = q.dot(up) / (z * tanV)
      if (strict && (Math.abs(sxp) > sx || Math.abs(syp) > sy)) return null
      low = Math.min(low, syp)
      high = Math.max(high, syp)
    }
    return [low, high]
  }
  let lo = Infinity
  let hi = -Infinity
  for (const p of points) {
    lo = Math.min(lo, p.y)
    hi = Math.max(hi, p.y)
  }
  let y = (lo + hi) / 2
  let d = 1
  for (let round = 0; round < 3; round++) {
    let near = 0.05
    let far = 1000
    for (let i = 0; i < 40; i++) {
      const mid = (near + far) / 2
      if (reach(mid, y, true)) far = mid
      else near = mid
    }
    d = far
    const r = reach(d, y, false)
    if (!r) break
    // move the look-at point towards the middle of what is seen
    y += ((r[0] + r[1]) / 2) * d * tanV
  }
  return { y, d, cx: stage.x + stage.w / 2, cy: stage.y + stage.h / 2 }
}
