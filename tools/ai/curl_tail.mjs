// curl_tail.mjs in.glb out.glb '<json>': curls a long tail over the back (or under it), for part-cut models whose
// tail is its own pivot node ('tail', with 'tail_tip' under it, as tools/preview/convert.ts writes them).
// The tail runs straight for its first `start` share (0..1) of its length, then bends up through `angle` degrees;
// the tail tip's pivot node moves and turns with the bend, so it still swings at its joint.
// json: { start, angle, power, down, subdivide } (defaults 0.25, 200, 1, false, 0). `power` above 1 tightens the
// bend towards the tip (a spiral); `down` curls it under instead of over (a chameleon's tail); `subdivide` splits
// the tail's triangles into four that many times first, so a tail with few rings along it still bends smoothly.
// Needs @gltf-transform/core and /extensions (npm i them in a folder and run this from there).
// Used for: Delta Dragonoid {"start":0.1,"angle":400,"power":2.2,"subdivide":2};
// Trox, Titanium Trox {"start":0.3,"angle":170,"power":1.4};
// Preyas {"start":0.1,"angle":330,"power":2,"down":true,"subdivide":3}
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'

const [src, dst, raw] = process.argv.slice(2)
const cfg = { start: 0.25, angle: 200, ...JSON.parse(raw ?? '{}') }
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(src)
const nodes = doc.getRoot().listNodes()
const tail = nodes.find((n) => n.getName() === 'tail')
if (!tail) throw new Error('no tail node')

// 4x4 column-major helpers
const mul = (a, b) => {
  const o = new Array(16).fill(0)
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]
  return o
}
const apply = (m, v, w = 1) => [0, 1, 2].map((r) => m[r] * v[0] + m[4 + r] * v[1] + m[8 + r] * v[2] + m[12 + r] * w)
const invert = (m) => {
  // rigid + uniform scale is enough here, but do the general inverse
  const inv = new Array(16)
  const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10
  const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30
  const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32
  const det = 1 / (b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06)
  inv[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; inv[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det
  inv[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; inv[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det
  inv[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; inv[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det
  inv[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; inv[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det
  inv[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; inv[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det
  inv[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; inv[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det
  inv[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; inv[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det
  inv[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; inv[15] = (a20 * b03 - a22 * b01 + a23 * b00) * det
  return inv
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const sub = (a, b) => a.map((v, i) => v - b[i])
const add = (...vs) => [0, 1, 2].map((i) => vs.reduce((s, v) => s + v[i], 0))
const scale = (a, k) => a.map((v) => v * k)
const norm = (a) => scale(a, 1 / Math.hypot(...a))

// every node under the tail (itself included) and the primitives drawn by them, each accessor once
const under = []
const walk = (n) => {
  under.push(n)
  n.listChildren().forEach(walk)
}
walk(tail)
const P = apply(tail.getWorldMatrix(), [0, 0, 0])
const prims = []
const seen = new Set()
for (const n of under) {
  const mesh = n.getMesh()
  if (!mesh) continue
  for (const p of mesh.listPrimitives()) {
    const pos = p.getAttribute('POSITION')
    if (seen.has(pos)) continue
    seen.add(pos)
    prims.push({ node: n, prim: p, pos, nrm: p.getAttribute('NORMAL') })
  }
}
/**
 * Splits every triangle of a primitive into four, `passes` times, so a tail drawn with few rings along its length
 * can bend smoothly. New corners sit halfway along each edge (shared by both triangles on it), every attribute
 * halfway between its ends.
 */
const subdivide = (prim, passes) => {
  if (prim.getMode() !== 4) return
  const accs = prim.listSemantics().map((s) => prim.getAttribute(s))
  const data = accs.map((a) => Array.from({ length: a.getCount() }, (_, i) => a.getElement(i, [])))
  const ind = prim.getIndices()
  let idx = ind ? Array.from(ind.getArray()) : [...Array(accs[0].getCount()).keys()]
  for (let pass = 0; pass < passes; pass++) {
    const cache = new Map()
    const mid = (a, b) => {
      const key = a < b ? `${a},${b}` : `${b},${a}`
      if (!cache.has(key)) {
        cache.set(key, data[0].length)
        for (const d of data) d.push(d[a].map((v, j) => (v + d[b][j]) / 2))
      }
      return cache.get(key)
    }
    const next = []
    for (let t = 0; t < idx.length; t += 3) {
      const [a, b, c] = idx.slice(t, t + 3)
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a)
      next.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca)
    }
    idx = next
  }
  accs.forEach((a, k) => {
    const Typed = a.getArray().constructor
    a.setArray(new Typed(data[k].length * a.getElementSize()))
    const isNormal = prim.listSemantics()[k] === 'NORMAL'
    data[k].forEach((v, i) => a.setElement(i, isNormal ? norm(v) : v))
  })
  if (ind) ind.setArray(new Uint32Array(idx))
  else prim.setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)).setBuffer(accs[0].getBuffer()))
}
if (cfg.subdivide) for (const { prim } of prims) subdivide(prim, cfg.subdivide)

// where the tail points (along the ground) and how long it is
let cx = 0, cz = 0, count = 0
for (const { node, pos } of prims) {
  const m = node.getWorldMatrix()
  for (let i = 0; i < pos.getCount(); i++) {
    const v = apply(m, pos.getElement(i, []))
    cx += v[0]; cz += v[2]; count++
  }
}
const D = norm([cx / count - P[0], 0, cz / count - P[2]])
const U = [0, cfg.down ? -1 : 1, 0]
const S = norm([D[1] * U[2] - D[2] * U[1], D[2] * U[0] - D[0] * U[2], D[0] * U[1] - D[1] * U[0]])
let L = 0
for (const { node, pos } of prims) {
  const m = node.getWorldMatrix()
  for (let i = 0; i < pos.getCount(); i++) L = Math.max(L, dot(sub(apply(m, pos.getElement(i, [])), P), D))
}
const t0 = cfg.start * L
const theta = (cfg.angle * Math.PI) / 180
const power = cfg.power ?? 1
/** How far the bend has turned at distance t along the tail: none before t0, then up to `angle` at the tip,
 * tightening towards the tip when `power` > 1 (a spiral rather than an even arc). */
const phiAt = (t) => (t <= t0 ? 0 : theta * Math.min(1, (t - t0) / (L - t0)) ** power)
// the bent centre line, by small steps from the root (in the D-U plane)
const STEPS = 2000
const line = [[0, 0]]
for (let i = 1; i <= STEPS; i++) {
  const t = (i / STEPS) * L * 1.05
  const phi = phiAt(t - (L * 1.05) / STEPS / 2)
  const [a, b] = line[i - 1]
  const dt = (L * 1.05) / STEPS
  line.push([a + Math.cos(phi) * dt, b + Math.sin(phi) * dt])
}
const centre = (t) => {
  const k = Math.max(0, Math.min(STEPS, (t / (L * 1.05)) * STEPS))
  const i = Math.floor(k), f = k - i
  const p = line[i], q = line[Math.min(STEPS, i + 1)]
  return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f]
}
/** The bent place of a point (world), and how far the bend has turned there. */
const bend = (v) => {
  const d = sub(v, P)
  const t = dot(d, D)
  if (t <= t0) return { v, phi: 0 }
  const h = dot(d, U)
  const w = sub(d, add(scale(D, t), scale(U, h)))
  const phi = phiAt(t)
  const [a, b] = centre(t)
  // the point's height above the line turns with the line
  return { v: add(P, scale(D, a - h * Math.sin(phi)), scale(U, b + h * Math.cos(phi)), w), phi }
}
const turn = (n, phi) => {
  const a = dot(n, D), b = dot(n, U), c = dot(n, S)
  return add(scale(D, a * Math.cos(phi) - b * Math.sin(phi)), scale(U, a * Math.sin(phi) + b * Math.cos(phi)), scale(S, c))
}

// bend every vertex in world space first, before any pivot moves
const bent = prims.map(({ node, pos, nrm }) => {
  const m = node.getWorldMatrix()
  const out = []
  for (let i = 0; i < pos.getCount(); i++) {
    const b = bend(apply(m, pos.getElement(i, [])))
    const n = nrm ? turn(norm(apply(m, nrm.getElement(i, []), 0)), b.phi) : null
    out.push({ v: b.v, n })
  }
  return out
})

// the pivots under the tail ride along the bend (and turn with it)
for (const n of under.slice(1)) {
  if (n.getMesh() && n.listChildren().length === 0 && n.getTranslation().every((x) => x === 0)) continue
  const world = n.getWorldMatrix()
  const Q = apply(world, [0, 0, 0])
  const { v: Q2, phi } = bend(Q)
  // world rotation of the turn about S through the origin, as a matrix
  const c = Math.cos(phi), s = Math.sin(phi)
  const rot = (x) => turn(x, phi)
  const ex = rot([world[0], world[1], world[2]]), ey = rot([world[4], world[5], world[6]]), ez = rot([world[8], world[9], world[10]])
  void c; void s
  const newWorld = [...ex, 0, ...ey, 0, ...ez, 0, ...Q2, 1]
  const parent = n.getParentNode()
  const local = mul(invert(parent.getWorldMatrix()), newWorld)
  n.setMatrix(local)
}

// write the bent vertices back in each node's new frame
prims.forEach(({ node, pos, nrm }, k) => {
  const inv = invert(node.getWorldMatrix())
  bent[k].forEach(({ v, n }, i) => {
    pos.setElement(i, apply(inv, v))
    if (nrm && n) nrm.setElement(i, norm(apply(inv, n, 0)))
  })
})
await io.write(dst, doc)
console.log(`curled ${prims.length} primitives, tail length ${L.toFixed(2)}, straight for ${t0.toFixed(2)}`)
