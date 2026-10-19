import * as THREE from 'three'
import { MONSTER_HEIGHT } from './BakuganModels'
import { rigPose, type Move, type RigPose } from './pose'

/** A shield bubble round a Bakugan, in its model's frame (model units). */
export interface ShieldFit {
  center: THREE.Vector3
  radii: THREE.Vector3
}

/** For each visible mesh of a model, the vertices worth tracking (see samplerFor). */
export interface ModelSampler {
  meshes: { mesh: THREE.Mesh; idx: Int32Array }[]
}

/** Evenly spread directions on a sphere. */
function directions(n: number) {
  const out: THREE.Vector3[] = []
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n
    const r = Math.sqrt(1 - y * y)
    const a = i * Math.PI * (3 - Math.sqrt(5))
    out.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r))
  }
  return out
}
const DIRS = directions(96)

/**
 * Picks the vertices that can reach furthest out: in every mesh the outermost one in each of 96 directions
 * (wing tips, horns, a lance's point), plus about `spread` vertices spread over the whole model.
 */
export function samplerFor(model: THREE.Object3D, spread = 2500): ModelSampler {
  const meshes: THREE.Mesh[] = []
  model.traverseVisible((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh)
  })
  const total = meshes.reduce((n, m) => n + m.geometry.getAttribute('position').count, 0)
  const step = Math.max(1, Math.ceil(total / spread))
  return {
    meshes: meshes.map((mesh) => {
      const pos = mesh.geometry.getAttribute('position')
      const pick = new Set<number>()
      for (let i = 0; i < pos.count; i += step) pick.add(i)
      const best = new Float64Array(DIRS.length).fill(-Infinity)
      const arg = new Int32Array(DIRS.length)
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i)
        const y = pos.getY(i)
        const z = pos.getZ(i)
        for (let d = 0; d < DIRS.length; d++) {
          const v = DIRS[d]
          const dot = x * v.x + y * v.y + z * v.z
          if (dot > best[d]) {
            best[d] = dot
            arg[d] = i
          }
        }
      }
      for (const i of arg) pick.add(i)
      return { mesh, idx: Int32Array.from(pick) }
    }),
  }
}

const _v = new THREE.Vector3()
const _m = new THREE.Matrix4()

/** Adds the tracked vertices, where they are drawn right now, in `frame`'s space, to `out` (x, y, z, …). */
export function sampleInto(s: ModelSampler, frame: THREE.Object3D, out: number[], lift: number[] = [0]) {
  // updateMatrixWorld (not updateWorldMatrix) also refreshes skinned meshes' bind matrices
  frame.updateMatrixWorld(true)
  const toFrame = frame.matrixWorld.clone().invert()
  for (const { mesh, idx } of s.meshes) {
    _m.multiplyMatrices(toFrame, mesh.matrixWorld)
    for (let k = 0; k < idx.length; k++) {
      mesh.getVertexPosition(idx[k], _v).applyMatrix4(_m)
      // a hovering Bakugan bobs up and down: count it at every height it reaches
      for (const dy of lift) out.push(_v.x, _v.y + dy, _v.z)
    }
  }
}

/** How far out a point lies in a bubble (1 = on its skin). */
export const depthIn = (fit: ShieldFit, x: number, y: number, z: number) =>
  Math.hypot((x - fit.center.x) / fit.radii.x, (y - fit.center.y) / fit.radii.y, (z - fit.center.z) / fit.radii.z)

/**
 * The smallest bubble round the middle of the points' box, stretched along the box's sides, that holds them all
 * (points as x, y, z, …), made `room` times bigger and a little more for the bubble's flat facets.
 */
export function fitShield(pts: ArrayLike<number>, room = 1.05): ShieldFit {
  const n = pts.length / 3
  const min = new THREE.Vector3(Infinity, Infinity, Infinity)
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity)
  for (let i = 0; i < n; i++) {
    _v.set(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2])
    min.min(_v)
    max.max(_v)
  }
  const center = min.clone().add(max).multiplyScalar(0.5)
  const half = max.clone().sub(min).multiplyScalar(0.5).addScalar(0.01)
  // each point as a share of the half box; try stretches up and across, and find the length that holds every point
  const q = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    q[i * 3] = (pts[i * 3] - center.x) / half.x
    q[i * 3 + 1] = (pts[i * 3 + 1] - center.y) / half.y
    q[i * 3 + 2] = (pts[i * 3 + 2] - center.z) / half.z
  }
  const every = Math.ceil(n / 3000)
  const lengthFor = (sy: number, sz: number, stride: number) => {
    let sx = 1
    for (let i = 0; i < n; i += stride) {
      const room = 1 - (q[i * 3 + 1] / sy) ** 2 - (q[i * 3 + 2] / sz) ** 2
      if (room <= 0) return Infinity
      sx = Math.max(sx, Math.abs(q[i * 3]) / Math.sqrt(room))
    }
    return sx
  }
  let best = new THREE.Vector3(Math.SQRT2, 2, 2)
  for (let i = 1; i <= 20; i++)
    for (let j = 1; j <= 20; j++) {
      const [sy, sz] = [1 + i * 0.05, 1 + j * 0.05]
      const sx = lengthFor(sy, sz, every)
      if (sx * sy * sz < best.x * best.y * best.z) best = new THREE.Vector3(sx, sy, sz)
    }
  // every point inside (a point the sample missed may need a little more height and width)
  while (!Number.isFinite((best.x = lengthFor(best.y, best.z, 1)))) best.multiplyScalar(1.05)
  const radii = half.multiply(best).multiplyScalar(room)
  // the drawn bubble is a mesh of flat facets, which dip up to ~1.5% inside the true curve
  radii.addScalar(0.015 * Math.max(radii.x, radii.y, radii.z))
  return { center, radii }
}

/** Keeps the points (x, y, z, …) that lie far out in `fit`: the only ones a bigger fit can still need. */
export function outerShell(pts: number[], fit: ShieldFit, keep = 30000) {
  const n = pts.length / 3
  const depth = new Float32Array(n)
  for (let i = 0; i < n; i++) depth[i] = depthIn(fit, pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2])
  let cut = 0.5
  if (n > keep) cut = Math.max(cut, Float32Array.from(depth).sort()[n - keep])
  const out: number[] = []
  for (let i = 0; i < n; i++) if (depth[i] >= cut) out.push(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2])
  return out
}

/** The joints NormalizedModel turns on a part-rigged model. */
const JOINTS = ['neck', 'head', 'jaw', 'tail', 'tail_tip', 'leg_fl', 'leg_fr', 'leg_bl', 'leg_br', 'wing_l', 'wing_r'] as const
type Joint = (typeof JOINTS)[number]
export type Rig = Partial<Record<Joint, THREE.Object3D>>

/** The model's rig joints, or null when it has none (it then never moves its parts). */
export function rigOf(model: THREE.Object3D): Rig | null {
  const rig: Rig = {}
  for (const j of JOINTS) {
    const o = model.getObjectByName(j)
    if (o) rig[j] = o
  }
  return rig.neck || rig.tail || rig.head || rig.wing_l ? rig : null
}

/** Puts the rig into a pose exactly as NormalizedModel does each frame (keep the two in step). */
function applyPose(rig: Rig, p: RigPose) {
  const k = (o: THREE.Object3D | undefined) => (o?.userData.swing as number | undefined) ?? 1
  rig.neck?.rotation.set(p.neck * k(rig.neck), 0, 0)
  rig.head?.rotation.set(p.head * k(rig.head), 0, 0)
  rig.jaw?.rotation.set(p.jaw * k(rig.jaw), 0, 0)
  rig.tail?.rotation.set(p.tailLift * k(rig.tail), p.tailYaw * k(rig.tail), 0)
  rig.tail_tip?.rotation.set(0, p.tipYaw * k(rig.tail_tip), 0)
  rig.leg_fl?.rotation.set(p.frontL * k(rig.leg_fl), 0, 0)
  rig.leg_fr?.rotation.set(p.frontR * k(rig.leg_fr), 0, 0)
  rig.leg_bl?.rotation.set(p.hindL * k(rig.leg_bl), 0, 0)
  rig.leg_br?.rotation.set(p.hindR * k(rig.leg_br), 0, 0)
  rig.wing_l?.rotation.set(0, 0, p.wing * k(rig.wing_l))
  rig.wing_r?.rotation.set(0, 0, -p.wing * k(rig.wing_r))
}

const MOVES: Move[] = ['bite', 'breath', 'clawSwipe', 'tailWhip', 'stomp', 'roar', 'guard', 'hit']
/** Idle clock times that put the idle sway at its ends: wings up, wings down, tail out to one side, then the other. */
const SWAY_ENDS = [0.49, 1.47, 1.75, 5.24]

/** Every pose the shield must hold: the idle sway, and each move from start to finish, as [move, t, now]. */
export function poseList(length = 1.7): [Move | null, number, number][] {
  const out: [Move | null, number, number][] = []
  for (let i = 0; i < 24; i++) out.push([null, 0, i * 0.3])
  for (const move of MOVES)
    for (let t = 0; t <= length + 1e-6; t += 0.1)
      for (let k = 0; k < 2; k++) out.push([move, t, SWAY_ENDS[(Math.round(t * 10) * 2 + k) % SWAY_ENDS.length]])
  return out
}

/**
 * Samples the model in each of `poses` (rig set by hand, put back afterwards) and adds the points to `out`.
 * `lift`: heights a hovering model bobs to, relative to where it is now.
 */
export function sampleInPoses(
  s: ModelSampler,
  model: THREE.Object3D,
  frame: THREE.Object3D,
  rig: Rig | null,
  poses: [Move | null, number, number][],
  out: number[],
  lift: number[],
) {
  if (!rig) {
    sampleInto(s, frame, out, lift)
    return
  }
  const saved = JOINTS.map((j) => rig[j]?.rotation.clone())
  for (const [move, t, now] of poses) {
    applyPose(rig, rigPose(move, t, now))
    sampleInto(s, frame, out, lift)
  }
  JOINTS.forEach((j, i) => saved[i] && rig[j]?.rotation.copy(saved[i]))
  model.updateMatrixWorld(true)
}

/** Heights a winged Bakugan's hover moves it to (see Hover in BakuganModels), relative to `now` (its height now). */
export const hoverLift = (now: number) => (now > 0.01 ? [MONSTER_HEIGHT * 0.2 - now, MONSTER_HEIGHT * 0.3 - now] : [0])
