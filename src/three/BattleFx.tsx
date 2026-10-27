import { useTexture } from '@react-three/drei'
import { addAfterEffect, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useContext, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { SideIndex } from '../battle/engine'
import { ELEMENTS, ELEMENT_BY_ID, type ElementId, type ElementInfo } from '../data/elements'
import { fx, listenFx, type FxCall } from './fx'
import { Glare, GroundRing, Lightning, LightColumn, Shards, Sprites, Swirl } from './fxKit'
import { FxFade, fxClock, fxScale, GATE_GOLD, GATE_GOLD_GLOW, GLSL_NOISE, glareTexture } from './fxShared'
import { crowd } from './stadium'

/**
 * The battle's big moments on the field, played from the effects bus (fx.ts): "Ability activate!" (the attribute's
 * own show round the Bakugan, a shockwave, a column of light, G-Power rising off the gainer and red sparks off the
 * loser), the Gate Card opening (beams, its symbol rising as a hologram, a ripple across the field, the power
 * flowing to whoever opened it), closing (the light collapsing into the card as it cracks), nullify (glass
 * shattering) and a Bakugan's defeat (a burst of its colour). The Bakugan's own aura is drawn by the Fighter.
 */

export interface FxFighter {
  /** Where it stands (x, world units). */
  x: number
  element: ElementId
  /** Its size against a usual Bakugan (≥ 1), for the effects round it. */
  size: number
}

interface Item {
  id: number
  call: FxCall
  /** Its effects' opacity: drops to 0 when the effect is cut short (its card nullified). */
  fade: { current: number }
  /** Extra details worked out when it starts. */
  extra?: { from?: string; to: string; self: boolean; beams: THREE.Vector3[]; flow: Float32Array; target?: 'ability' | 'gate' }
}

const LIFE: Record<FxCall['kind'], number> = { ability: 1.7, gateOpen: 2.2, gateClose: 2.0, nullify: 1.4, defeat: 1.3 }

let nextId = 1

if (import.meta.env.DEV && typeof window !== 'undefined') {
  // try the effects by hand: __fx({ kind: 'ability', side: 0, element: 'pyrus', name: 'Fire Wall', delta: [100, 0] })
  Object.assign(window, { __fx: fx, __crowd: crowd })
}

export function BattleFx({
  fighters,
  ground,
  k,
  gateOn,
  colors,
}: {
  fighters: [FxFighter, FxFighter]
  /** Height of the card's top (world units). */
  ground: number
  /** The stadium's scale (1 = usual view). */
  k: number
  /** The field's Gate Card is face up. */
  gateOn: boolean
  /** Each side's attribute colour. */
  colors: [string, string]
}) {
  const camera = useThree((s) => s.camera)
  const getState = useThree((s) => s.get)
  // dev builds: the scene's state, and a way to catch a frame just after it is drawn (for screenshots)
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __arena: getState, __afterFrame: addAfterEffect, __fxClock: fxClock })
  }, [getState])
  const [items, setItems] = useState<Item[]>([])
  const lights = useRef<(THREE.PointLight | null)[]>([null, null, null])
  const flashes = useRef<{ light: number; color: THREE.Color; start: number; peak: number; dur: number }[]>([])
  // the gate's tug of war: who opened it first (its owner) and who holds it now
  const gate = useRef<{ owner: SideIndex | null; holder: SideIndex | null; color: string; lastOpen: number }>({
    owner: null,
    holder: null,
    color: GATE_GOLD,
    lastOpen: -1e9,
  })
  const layer = useRef<GateLayerHandle>({ level: 0, color: new THREE.Color(GATE_GOLD), events: [] })
  const halfX = 1.5 * 46 * k
  const halfZ = 1.1 * 46 * k

  const live = useRef({ fighters, colors, halfX, halfZ, ground })
  useEffect(() => {
    live.current = { fighters, colors, halfX, halfZ, ground }
  }, [fighters, colors, halfX, halfZ, ground])
  // effects being cut short (nullified), and when each effect ends (scene clock), by id
  const dying = useRef(new Map<number, { current: number }>())
  const ends = useRef(new Map<number, number>())

  // a new battle (other Bakugan on the field): the gate starts fresh
  const battleKey = `${fighters[0].element}-${fighters[1].element}-${fighters[0].x}-${fighters[1].x}`
  useEffect(() => {
    gate.current = { owner: null, holder: null, color: GATE_GOLD, lastOpen: -1e9 }
    layer.current.level = 0
  }, [battleKey])
  // the card turned face down without a call (a reset): its light goes out
  useEffect(() => {
    if (!gateOn && performance.now() - gate.current.lastOpen > 4000) layer.current.level = 0
  }, [gateOn])

  useEffect(
    () =>
      listenFx((call) => {
        const now = fxClock.now
        const { fighters: f, colors: c, halfX: hx, halfZ: hz } = live.current
        // reduced motion: the field's flashes of light are kept soft
        const soft = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.35 : 1
        const flash = (light: number, color: string, peak: number, dur: number) =>
          flashes.current.push({ light, color: new THREE.Color(color), start: now, peak: peak * soft, dur })
        const item: Item = { id: nextId++, call, fade: { current: 1 } }
        switch (call.kind) {
          case 'ability': {
            flash(call.side, ELEMENT_BY_ID[call.element].glow, 520, 0.9)
            const foe = (1 - call.side) as SideIndex
            if (call.delta[foe] < 0)
              flashes.current.push({ light: foe, color: new THREE.Color('#ff3a2a'), start: now + 0.45, peak: 300, dur: 0.6 })
            break
          }
          case 'gateOpen': {
            const g = gate.current
            g.owner ??= call.by
            const self = g.holder !== null && g.holder !== call.by
            const base = call.element ? ELEMENT_BY_ID[call.element].color : GATE_GOLD
            const to = call.by === g.owner ? base : c[call.by]
            item.extra = {
              from: self ? g.color : undefined,
              to,
              self,
              beams: beamSpots(hx, hz, camera.position),
              flow: flowFrom(hx, hz, f[call.by].x),
            }
            g.holder = call.by
            g.color = to
            g.lastOpen = performance.now()
            layer.current.events.push({
              kind: 'open',
              at: now,
              color: new THREE.Color(to),
              from: self ? new THREE.Color(item.extra.from) : null,
              by: call.by,
            })
            flash(2, to, 900, 1.4)
            break
          }
          case 'gateClose': {
            const g = gate.current
            item.extra = { to: g.color, self: false, beams: beamSpots(hx, hz, camera.position), flow: new Float32Array() }
            g.holder = null
            layer.current.events.push({ kind: 'close', at: now, color: new THREE.Color(g.color), from: null, by: call.by })
            flash(2, g.color, 400, 0.7)
            break
          }
          case 'nullify': {
            const target =
              call.target ??
              (performance.now() - gate.current.lastOpen < 4000 && gate.current.holder !== call.by ? 'gate' : 'ability')
            item.extra = { to: '#bfeaff', self: false, beams: [], flow: new Float32Array(), target }
            if (target === 'gate') {
              gate.current.holder = null
              layer.current.events.push({
                kind: 'close',
                at: now,
                color: new THREE.Color(gate.current.color),
                from: null,
                by: call.by,
              })
              flash(2, '#dff4ff', 600, 0.6)
            } else flash((1 - call.by) as SideIndex, '#dff4ff', 480, 0.6)
            break
          }
          case 'defeat':
            flash(call.side, ELEMENT_BY_ID[f[call.side].element].glow, 600, 1)
            break
        }
        setItems((list) => {
          // a nullified ability's show is cut short
          if (call.kind === 'nullify' && item.extra?.target !== 'gate')
            for (const it of list) if (it.call.kind === 'ability' && it.call.side !== call.by) dying.current.set(it.id, it.fade)
          return [...list, item]
        })
        ends.current.set(item.id, now + LIFE[call.kind])
      }),
    [camera],
  )
  // the effects' clock runs first each frame (slowed down in dev when asked)
  useFrame((_, dt) => void (fxClock.now += Math.min(dt, 0.1) * fxScale()), -1)

  useFrame((_, frameDt) => {
    const now = fxClock.now
    const dt = Math.min(frameDt, 0.1) * fxScale()
    // effects that have played out are let go (on the scene's clock, so they always play in full)
    const done: number[] = []
    for (const [id, end] of ends.current) if (now > end) done.push(id)
    if (done.length) {
      for (const id of done) {
        ends.current.delete(id)
        dying.current.delete(id)
      }
      setItems((list) => list.filter((it) => !done.includes(it.id)))
    }
    // the flashes of light on the field
    const levels = [0, 0, 0]
    const tint: (THREE.Color | null)[] = [null, null, null]
    flashes.current = flashes.current.filter((f) => now - f.start < f.dur)
    for (const f of flashes.current) {
      const t = now - f.start
      if (t < 0) continue
      const v = f.peak * (t < 0.06 ? t / 0.06 : Math.pow(1 - (t - 0.06) / (f.dur - 0.06), 2))
      if (v > levels[f.light]) {
        levels[f.light] = v
        tint[f.light] = f.color
      }
    }
    lights.current.forEach((l, i) => {
      if (!l) return
      l.intensity = levels[i]
      if (tint[i]) l.color.copy(tint[i]!)
    })
    for (const f of dying.current.values()) f.current = Math.max(0, f.current - dt / 0.22)
  })

  const lightAt = (i: number): [number, number, number] => (i < 2 ? [fighters[i].x * 0.85, ground + 24, 20] : [0, ground + 30, 0])

  return (
    <>
      {[0, 1, 2].map((i) => (
        <pointLight
          key={i}
          ref={(l) => void (lights.current[i] = l)}
          position={lightAt(i)}
          intensity={0}
          distance={i < 2 ? 110 * k : 180 * k}
          decay={2}
        />
      ))}
      <GateLayer state={layer} halfX={halfX} halfZ={halfZ} y={ground + 0.06} gateOn={gateOn} />
      {items.map((it) => (
        <FxFade.Provider key={it.id} value={it.fade}>
          <ItemFx item={it} fighters={fighters} ground={ground} k={k} halfX={halfX} halfZ={halfZ} />
        </FxFade.Provider>
      ))}
    </>
  )
}

/** Where the gate's beams rise: round the card's edge, leaving out the stretch right under the view. */
function beamSpots(hx: number, hz: number, cam: THREE.Vector3) {
  const out: THREE.Vector3[] = []
  const per = 2 * (hx + hz)
  const n = 18
  for (let i = 0; i < n; i++) {
    let d = ((i + 0.5) / n) * per
    let p: THREE.Vector3
    if (d < 2 * hx) p = new THREE.Vector3(-hx + d, 0, -hz)
    else if ((d -= 2 * hx) < 2 * hz) p = new THREE.Vector3(hx, 0, -hz + d)
    else if ((d -= 2 * hz) < 2 * hx) p = new THREE.Vector3(hx - d, 0, hz)
    else p = new THREE.Vector3(-hx, 0, hz - (d - 2 * hx))
    if (Math.hypot(p.x - cam.x, p.z - cam.z) < hx * 0.75) continue
    out.push(p)
  }
  // the four corners, a little brighter (also left out when right under the view)
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    const p = new THREE.Vector3(sx * hx, 1, sz * hz)
    if (Math.hypot(p.x - cam.x, p.z - cam.z) >= hx * 0.75) out.push(p)
  }
  return out
}

/** Points on the card the gate's power flows from, relative to the Bakugan at `x` it flows to. */
function flowFrom(hx: number, hz: number, x: number) {
  const n = 160
  const out = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const r = Math.sqrt(Math.random())
    out.set([Math.cos(a) * r * hx * 0.8 - x, 0.5, Math.sin(a) * r * hz * 0.8], i * 3)
  }
  return out
}

function ItemFx({
  item,
  fighters,
  ground,
  k,
  halfX,
  halfZ,
}: {
  item: Item
  fighters: [FxFighter, FxFighter]
  ground: number
  k: number
  halfX: number
  halfZ: number
}) {
  const { call } = item
  const at = (side: SideIndex): [number, number, number] => [fighters[side].x, ground, 0]
  const size = (side: SideIndex) => fighters[side].size * Math.sqrt(k)
  switch (call.kind) {
    case 'ability': {
      const foe = (1 - call.side) as SideIndex
      const el = ELEMENT_BY_ID[call.element]
      return (
        <>
          <group position={at(call.side)} scale={size(call.side)}>
            <AbilityBurst el={el} />
            {call.delta[call.side] > 0 && <PowerRise color={el.glow} delay={0.35} />}
            {call.delta[call.side] < 0 && <HitSparks delay={0.45} />}
          </group>
          {call.delta[foe] !== 0 && (
            <group position={at(foe)} scale={size(foe)}>
              {call.delta[foe] < 0 && <HitSparks delay={0.45} />}
              {call.delta[foe] > 0 && <PowerRise color={ELEMENT_BY_ID[fighters[foe].element].glow} delay={0.35} />}
            </group>
          )}
        </>
      )
    }
    case 'gateOpen': {
      const x = item.extra!
      return (
        <>
          <group position={[0, ground, 0]}>
            <GateOpen color={x.to} beams={x.beams} halfX={halfX} halfZ={halfZ} k={k} element={call.element} />
          </group>
          <group position={at(call.by)}>
            <Sprites count={160} motion={FLOW} dur={1.6} delay={0.45} colors={[x.to, '#ffffff']} size={1.1} bases={x.flow} />
          </group>
          {([0, 1] as const).map((s) =>
            call.delta[s] > 0 ? (
              <group key={s} position={at(s)} scale={size(s)}>
                <PowerRise color={ELEMENT_BY_ID[fighters[s].element].glow} delay={0.9} />
              </group>
            ) : call.delta[s] < 0 ? (
              <group key={s} position={at(s)} scale={size(s)}>
                <HitSparks delay={0.9} />
              </group>
            ) : null,
          )}
        </>
      )
    }
    case 'gateClose': {
      const x = item.extra!
      return (
        <group position={[0, ground, 0]}>
          <GateClose color={x.to} beams={x.beams} halfX={halfX} />
        </group>
      )
    }
    case 'nullify': {
      const target = (1 - call.by) as SideIndex
      if (item.extra?.target === 'gate')
        return (
          <group position={[0, ground, 0]}>
            <Shatter scale={3.2 * k} y={3} />
          </group>
        )
      return (
        <group position={at(target)} scale={size(target)}>
          <Shatter scale={1} y={11} />
        </group>
      )
    }
    case 'defeat': {
      const el = ELEMENT_BY_ID[fighters[call.side].element]
      return (
        <group position={at(call.side)} scale={size(call.side)}>
          <DefeatBurst el={el} />
        </group>
      )
    }
  }
}

/* ---------- ability ---------- */

/** "Ability activate!" round the Bakugan (group units: world units at a usual Bakugan's size). */
function AbilityBurst({ el }: { el: ElementInfo }) {
  const Show = ELEMENT_SHOW[el.id]
  return (
    <>
      <GroundRing radius={36} width={0.04} dur={0.95} colors={[el.glow, el.color]} alpha={0.75} />
      <GroundRing radius={26} width={0.025} dur={0.75} delay={0.08} colors={['#ffffff', el.glow]} alpha={0.45} />
      <LightColumn radius={3.6} height={78} dur={1.0} grow={0.14} colors={[el.color, el.glow]} alpha={0.32} />
      <group position={[0, 12, 0]}>
        <Glare texture={glareTexture('burst')} size={30} dur={0.42} color={el.glow} grow={[0.35, 1.1]} peak={0.1} alpha={0.4} />
      </group>
      <Show el={el} />
    </>
  )
}

const FLAME_TONGUES = /* glsl */ `
  float ph = fract(s.x + t * (0.9 + s.y * 0.8));
  float ang = s.z * 6.2831 + t * 3.2 + ph * 2.5;
  float rad = 5.0 + 4.0 * s.w + ph * 3.0;
  p = vec3(cos(ang) * rad, ph * 27.0 * (0.6 + 0.4 * r.x), sin(ang) * rad);
  a = sin(ph * 3.14159) * smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.65, 1.0, life)) * 0.5;
  sz = (5.0 + 4.0 * r.y) * (1.0 - ph * 0.55);
  mixc = ph;
  hot = (1.0 - ph) * 0.25;
`

const EMBERS = /* glsl */ `
  vec3 dir = normalize(vec3(r.x - 0.5, 0.0, r.y - 0.5) + 1e-4);
  p = dir * (4.0 + t * (5.0 + 9.0 * s.z)) + vec3(0.0, 2.0 + t * (9.0 + 14.0 * s.w), 0.0);
  p.x += sin(t * 6.0 + s.x * 20.0) * 1.3;
  p.z += cos(t * 5.0 + s.y * 20.0) * 1.3;
  a = smoothstep(0.0, 0.05, t) * (1.0 - smoothstep(0.45 + 0.4 * r.z, 1.0, life)) * (0.65 + 0.35 * sin(t * 30.0 + s.x * 50.0));
  sz = 0.55 + 0.8 * r.w;
  mixc = r.z;
`

const WATER_HELIX = /* glsl */ `
  float strand = step(0.5, s.x);
  float ph = fract(s.y + t * 0.75);
  float ang = ph * 11.0 + strand * 3.14159 + t * 4.0;
  float rad = 8.5 - ph * 2.2;
  p = vec3(cos(ang) * rad, ph * 28.0, sin(ang) * rad) + (r.xyz - 0.5) * 1.3;
  a = sin(ph * 3.14159) * smoothstep(0.0, 0.15, t) * (1.0 - smoothstep(0.65, 1.0, life));
  sz = 0.8 + r.w * 0.9;
  mixc = r.x;
`

const SPRAY = /* glsl */ `
  float tt = max(0.0, t - 0.12 - s.w * 0.25);
  vec3 dir = normalize(vec3(r.x - 0.5, 0.0, r.y - 0.5) + 1e-4);
  vec3 v = dir * (7.0 + 11.0 * s.x) + vec3(0.0, 10.0 + 14.0 * s.y, 0.0);
  p = vec3(0.0, 4.0 + 12.0 * s.z, 0.0) + dir * 6.0 + v * tt + vec3(0.0, -17.0 * tt * tt, 0.0);
  a = step(0.001, tt) * (1.0 - smoothstep(0.6, 1.0, life)) * step(0.0, p.y);
  sz = 0.6 + 0.8 * r.z;
  mixc = r.w;
`

const DUST = /* glsl */ `
  float ang = s.x * 6.2831;
  float k = 1.0 - pow(1.0 - life, 2.5);
  float rad = 6.0 + k * (15.0 + 10.0 * s.y);
  p = vec3(cos(ang) * rad, 1.0 + k * (2.0 + 5.0 * s.z), sin(ang) * rad);
  a = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.4, 1.0, life)) * 0.42;
  sz = (5.0 + 5.0 * s.w) * (0.6 + k);
  mixc = r.x;
`

const CHIPS = /* glsl */ `
  float tt = max(0.0, t - 0.05 * s.w);
  vec3 dir = normalize(vec3(r.x - 0.5, 0.0, r.y - 0.5) + 1e-4);
  vec3 v = dir * (6.0 + 12.0 * s.x) + vec3(0.0, 12.0 + 16.0 * s.y, 0.0);
  p = dir * (5.0 + 4.0 * s.z) + v * tt + vec3(0.0, -22.0 * tt * tt, 0.0);
  p.y = max(p.y, 0.3);
  a = (1.0 - smoothstep(0.65, 1.0, life));
  sz = 0.5 + 0.9 * r.z;
  rot = t * (r.w - 0.5) * 14.0;
  mixc = r.w;
`

const SPARKLES = /* glsl */ `
  vec3 dir = normalize(vec3(r.x - 0.5, r.y - 0.3, r.z - 0.5) + 1e-4);
  float k = 1.0 - pow(1.0 - life, 2.0);
  p = vec3(0.0, 12.0, 0.0) + dir * (6.0 + 19.0 * s.x * k) + vec3(0.0, 4.0 * k * s.y, 0.0);
  float tw = 0.5 + 0.5 * sin(t * (14.0 + 10.0 * s.z) + s.w * 30.0);
  a = smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.55 + 0.3 * r.w, 1.0, life)) * tw;
  sz = 1.3 + 2.0 * s.y;
  rot = t * (s.z - 0.5) * 3.0;
  mixc = s.w;
`

const HALO_RISE = /* glsl */ `
  float ang = s.x * 6.2831 + t * 0.8;
  float k = 1.0 - pow(1.0 - life, 1.6);
  float rad = 10.0 + 1.5 * sin(ang * 3.0 + t * 4.0);
  p = vec3(cos(ang) * rad, 1.0 + k * 28.0 + (s.y - 0.5) * 1.5, sin(ang) * rad);
  a = smoothstep(0.0, 0.1, life) * (1.0 - smoothstep(0.6, 1.0, life)) * 0.6;
  sz = 0.9 + 0.7 * s.z;
  mixc = s.w;
`

const DARK_INFLOW = /* glsl */ `
  float ph = fract(s.x + t * 0.7);
  float ang = s.y * 6.2831 + ph * 5.0 + t * 2.0;
  float rad = mix(21.0, 3.0, ph);
  p = vec3(cos(ang) * rad, 1.0 + ph * 16.0 * s.z, sin(ang) * rad);
  a = sin(ph * 3.14159) * smoothstep(0.0, 0.15, t) * (1.0 - smoothstep(0.62, 1.0, life)) * 0.5;
  sz = 3.0 + 3.0 * r.x;
  mixc = r.y;
`

const DARK_SPARKS = /* glsl */ `
  vec3 dir = normalize(vec3(r.x - 0.5, r.y - 0.2, r.z - 0.5) + 1e-4);
  float tt = fract(s.x + t * 1.6);
  p = vec3(0.0, 4.0 + 16.0 * s.y, 0.0) + dir * tt * 9.0;
  a = (1.0 - tt) * smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.65, 1.0, life)) * step(0.4, fract(t * 9.0 + s.z));
  sz = 0.6 + 0.6 * s.w;
  mixc = s.z;
`

const LEAVES = /* glsl */ `
  float ph = fract(s.x + t * 0.55);
  float ang = s.y * 6.2831 + t * (3.0 + 2.0 * s.z);
  float rad = 5.0 + ph * 13.0 + 2.0 * r.x;
  p = vec3(cos(ang) * rad, ph * 31.0, sin(ang) * rad);
  a = smoothstep(0.0, 0.1, ph) * (1.0 - smoothstep(0.75, 1.0, ph)) * smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.7, 1.0, life));
  sz = 1.3 + 1.1 * r.y;
  rot = t * (4.0 + 6.0 * r.z) * (r.w < 0.5 ? -1.0 : 1.0);
  mixc = r.x;
`

const WIND = /* glsl */ `
  float ph = fract(s.x + t * 1.4);
  float ang = s.y * 6.2831 + t * (7.0 + 3.0 * s.z);
  float rad = 6.0 + 9.0 * ph + 3.0 * r.x;
  p = vec3(cos(ang) * rad, 2.0 + ph * 26.0 + r.y * 4.0, sin(ang) * rad);
  a = sin(ph * 3.14159) * smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.6, 1.0, life)) * 0.7;
  sz = 0.5 + 0.5 * r.z;
  mixc = ph;
`

const ELEMENT_SHOW: Record<ElementId, (p: { el: ElementInfo }) => React.ReactNode> = {
  pyrus: () => (
    <>
      <Swirl
        bottom={9}
        top={6}
        height={30}
        dur={1.3}
        colors={['#ff3510', '#ffd060']}
        style="flame"
        bands={3}
        twist={1.4}
        speed={1.6}
        alpha={0.7}
      />
      <Swirl
        bottom={6}
        top={3.5}
        height={24}
        dur={1.2}
        colors={['#ff7a1a', '#fff0a0']}
        bands={2}
        twist={-1.1}
        speed={-2.2}
        alpha={0.45}
      />
      <Sprites count={110} motion={FLAME_TONGUES} dur={1.3} colors={['#ff2a00', '#ff9a1f', '#fff3c0']} size={0.8} />
      <Sprites count={200} motion={EMBERS} dur={1.45} colors={['#ff5a10', '#ffcc40']} shape="ember" />
    </>
  ),
  aquos: () => (
    <>
      <Swirl
        bottom={8}
        top={7}
        height={28}
        dur={1.3}
        colors={['#1e5bff', '#bfe6ff']}
        style="water"
        bands={2}
        twist={2.2}
        speed={1.2}
        flare={0.3}
        alpha={0.6}
      />
      <Swirl
        bottom={5.5}
        top={4}
        height={22}
        dur={1.2}
        colors={['#3f8cff', '#ffffff']}
        bands={3}
        twist={-1.5}
        speed={-1.8}
        alpha={0.35}
      />
      <Sprites count={240} motion={WATER_HELIX} dur={1.3} colors={['#4f9bff', '#e8f6ff']} shape="drop" size={0.9} />
      <Sprites count={150} motion={SPRAY} dur={1.4} colors={['#5fa8ff', '#e8f6ff']} shape="drop" />
      <GroundRing radius={30} width={0.08} dur={1.2} delay={0.15} colors={['#a8d8ff', '#2f6bff']} rough={0.5} alpha={0.45} />
    </>
  ),
  subterra: () => (
    <>
      <Shards kind="rock" count={22} dur={1.35} color="#6b4a2b" glow="#e8a25a" size={1.3} speed={9} spread={9} up={1.4} />
      <GroundRing radius={32} width={0.1} dur={1.3} colors={['#c9a27a', '#7a5a3a']} rough={1} alpha={0.6} blending="normal" />
      <Sprites count={60} motion={DUST} dur={1.4} colors={['#7d6045', '#c8a57c']} shape="smoke" blending="normal" />
      <Sprites count={80} motion={CHIPS} dur={1.3} colors={['#4a3220', '#a77a4c']} shape="chip" blending="normal" />
      <Swirl
        bottom={9}
        top={8}
        height={18}
        dur={1.1}
        colors={['#c8782e', '#ffd08a']}
        bands={4}
        twist={0.6}
        speed={1}
        alpha={0.35}
      />
    </>
  ),
  haos: () => (
    <>
      <group position={[0, 12, 0]}>
        <Glare
          texture={glareTexture('rays')}
          size={52}
          dur={1.3}
          color="#fff27a"
          spin={0.35}
          grow={[0.25, 1.1]}
          peak={0.15}
          alpha={0.42}
        />
        <Glare
          texture={glareTexture('rays')}
          size={36}
          dur={1.1}
          delay={0.1}
          color="#ffffff"
          spin={-0.5}
          grow={[0.3, 1]}
          peak={0.2}
          alpha={0.22}
        />
      </group>
      <Swirl
        bottom={10}
        top={12}
        height={40}
        dur={1.2}
        colors={['#f5d90a', '#ffffff']}
        bands={9}
        twist={0}
        speed={0.35}
        alpha={0.28}
      />
      <Sprites count={150} motion={SPARKLES} dur={1.45} colors={['#fff27a', '#ffffff']} shape="star" size={0.8} />
      <Sprites count={80} motion={HALO_RISE} dur={1.3} colors={['#fff27a', '#ffffff']} />
    </>
  ),
  darkus: () => (
    <>
      <VortexDisc radius={22} dur={1.4} />
      <Swirl
        bottom={10}
        top={4.5}
        height={26}
        dur={1.35}
        colors={['#0c0016', '#5a1aa0']}
        bands={3}
        twist={2.4}
        speed={2.2}
        alpha={0.6}
        blending="normal"
      />
      <Swirl
        bottom={7}
        top={3}
        height={22}
        dur={1.3}
        colors={['#9b3dff', '#e0b0ff']}
        bands={2}
        twist={2.4}
        speed={2.6}
        alpha={0.4}
      />
      <Sprites count={110} motion={DARK_INFLOW} dur={1.35} colors={['#05000a', '#3a0a66']} shape="smoke" blending="normal" />
      <Sprites count={60} motion={DARK_SPARKS} dur={1.3} colors={['#9b3dff', '#ffffff']} shape="ember" />
      <Lightning count={4} path={darkBolt} dur={1.2} delay={0.08} color="#a35cff" width={0.38} />
    </>
  ),
  ventus: () => (
    <>
      <Swirl
        bottom={4}
        top={15}
        height={34}
        dur={1.35}
        colors={['#19c79a', '#d0fff0']}
        bands={4}
        twist={3}
        speed={2.4}
        flare={0.2}
        alpha={0.55}
      />
      <Swirl
        bottom={3}
        top={9}
        height={28}
        dur={1.25}
        colors={['#6fffd0', '#ffffff']}
        bands={3}
        twist={2.4}
        speed={3.2}
        alpha={0.3}
      />
      <Sprites count={220} motion={WIND} dur={1.35} colors={['#19c79a', '#e6fff6']} size={0.9} />
      <Sprites count={80} motion={LEAVES} dur={1.4} colors={['#1a9a5a', '#9cff7a']} shape="leaf" blending="normal" />
    </>
  ),
}

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
/** A purple bolt: from the air above the Bakugan down to the ground round it, or an arc across its body. */
function darkBolt(i: number): [THREE.Vector3, THREE.Vector3] {
  const a = Math.random() * Math.PI * 2
  if (i % 2) {
    _a.set(Math.cos(a) * (3 + Math.random() * 5), 22 + Math.random() * 10, Math.sin(a) * (3 + Math.random() * 5))
    _b.set(Math.cos(a + 0.6) * (8 + Math.random() * 8), 0.4, Math.sin(a + 0.6) * (8 + Math.random() * 8))
  } else {
    _a.set(Math.cos(a) * 9, 4 + Math.random() * 14, Math.sin(a) * 9)
    _b.set(Math.cos(a + 2.4) * 9, 4 + Math.random() * 14, Math.sin(a + 2.4) * 9)
  }
  return [_a.clone(), _b.clone()]
}

/** A dark whirlpool opening on the ground under a Darkus Bakugan. */
function VortexDisc({ radius, dur }: { radius: number; dur: number }) {
  const mesh = useRef<THREE.Mesh>(null)
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          uniform float uT;
          uniform float uDur;
          uniform float uFade;
          ${GLSL_NOISE}
          void main() {
            vec2 q = vUv * 2.0 - 1.0;
            float d = length(q);
            float life = clamp(uT / uDur, 0.0, 1.0);
            float open = smoothstep(0.0, 0.3, life);
            float ang = atan(q.y, q.x + 1e-5);
            float arms = fract(ang / 6.2831 * 4.0 + log(d + 0.02) * 1.1 + uT * 0.9);
            float arm = smoothstep(0.0, 0.2, arms) * smoothstep(0.7, 0.3, arms);
            float n = fxNoise(q * 6.0 + uT);
            float disc = smoothstep(open, open * 0.6, d);
            float a = disc * (0.55 + 0.4 * arm) * (1.0 - smoothstep(0.7, 1.0, life)) * uFade;
            vec3 col = mix(vec3(0.02, 0.0, 0.05), vec3(0.75, 0.3, 1.6), arm * smoothstep(0.15, 0.8, d) * (0.5 + n));
            if (!(a >= 0.003)) discard;
            gl_FragColor = vec4(col, a);
          }`,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -40,
        uniforms: { uT: { value: 0 }, uDur: { value: dur }, uFade: { value: 1 } },
      }),
    [dur],
  )
  useEffect(() => () => material.dispose(), [material])
  const t = useRef(0)
  const fade = useContextFade()
  useFrame((_, dt) => {
    t.current += Math.min(dt, 0.1) * fxScale()
    const m = mesh.current
    if (!m) return
    const u = (m.material as THREE.ShaderMaterial).uniforms
    u.uT.value = t.current
    u.uFade.value = fade?.current ?? 1
    m.visible = t.current <= dur
  })
  return (
    <mesh ref={mesh} material={material} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} scale={radius}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}

/** The fade the kit's effects use (an effect cut short), for this file's own shaders. */
const useContextFade = () => useContext(FxFade)

const RISE = /* glsl */ `
  float ph = fract(s.x + t * 1.3);
  float ang = s.y * 6.2831;
  float rad = 5.5 + 4.5 * s.z;
  p = vec3(cos(ang) * rad, ph * 31.0, sin(ang) * rad);
  a = sin(ph * 3.14159) * smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.6, 1.0, life));
  sz = 0.7 + 0.6 * r.x;
  mixc = ph;
`

/** G-Power going up: motes and a ring of light climbing the Bakugan. */
function PowerRise({ color, delay }: { color: string; delay: number }) {
  return (
    <>
      <Sprites count={130} motion={RISE} dur={1.05} delay={delay} colors={[color, '#fff6c0']} />
      <Sprites count={110} motion={HALO_RISE} dur={0.95} delay={delay} colors={['#fff6c0', color]} />
      <GroundRing radius={18} width={0.06} dur={0.7} delay={delay} colors={['#fff6c0', color]} alpha={0.8} />
    </>
  )
}

const RED_SPARKS = /* glsl */ `
  vec3 dir = normalize(vec3(r.x - 0.5, r.y - 0.3, r.z - 0.5) + 1e-4);
  p = vec3(0.0, 11.0, 0.0) + dir * (3.0 + t * (20.0 + 18.0 * s.x)) + vec3(0.0, -10.0 * t * t, 0.0);
  a = 1.0 - smoothstep(0.2 + 0.45 * s.y, 1.0, life);
  sz = 0.6 + 0.8 * s.z;
  mixc = s.w;
`

/** G-Power lost: a red flash and sparks off the Bakugan. */
function HitSparks({ delay }: { delay: number }) {
  return (
    <>
      <Sprites count={120} motion={RED_SPARKS} dur={0.8} delay={delay} colors={['#ff2a1a', '#ffb080']} shape="ember" />
      <group position={[0, 11, 0]}>
        <Glare
          texture={glareTexture('burst')}
          size={34}
          dur={0.4}
          delay={delay}
          color="#ff3a22"
          grow={[0.5, 1.1]}
          peak={0.12}
          alpha={0.85}
        />
      </group>
    </>
  )
}

const DEFEAT_BURST = /* glsl */ `
  vec3 dir = normalize(vec3(r.x - 0.5, r.y - 0.25, r.z - 0.5) + 1e-4);
  float k = 1.0 - pow(1.0 - life, 3.0);
  p = vec3(0.0, 9.0, 0.0) + dir * (2.0 + k * (22.0 + 14.0 * s.x)) + vec3(0.0, -4.0 * life * life, 0.0);
  a = 1.0 - smoothstep(0.35 + 0.4 * s.y, 1.0, life);
  sz = (1.0 + 1.6 * s.z) * (1.0 - 0.5 * life);
  mixc = s.w;
  hot = 1.0 - smoothstep(0.0, 0.3, life);
`

/** A Bakugan is defeated: a short burst of its colour. */
function DefeatBurst({ el }: { el: ElementInfo }) {
  return (
    <>
      <group position={[0, 10, 0]}>
        <Glare texture={glareTexture('burst')} size={56} dur={0.6} color={el.glow} grow={[0.3, 1.2]} peak={0.1} />
      </group>
      <Sprites count={220} motion={DEFEAT_BURST} dur={1.1} colors={[el.color, el.glow, '#ffffff']} shape="ember" />
      <GroundRing radius={34} width={0.05} dur={0.9} colors={[el.glow, el.color]} />
    </>
  )
}

/** Glass breaking: a flash, a pane's worth of glinting splinters flying apart. */
function Shatter({ scale, y }: { scale: number; y: number }) {
  return (
    <group position={[0, y, 0]} scale={scale}>
      <Glare texture={glareTexture('burst')} size={40} dur={0.45} color="#dff4ff" grow={[0.5, 1.2]} peak={0.08} />
      <Glare
        texture={glareTexture('rays')}
        size={34}
        dur={0.5}
        color="#bfeaff"
        grow={[0.6, 1.1]}
        peak={0.1}
        spin={0.8}
        alpha={0.7}
      />
      <Shards kind="glass" count={54} dur={1.2} color="#bfeaff" glow="#ffffff" size={1.6} speed={14} spread={5} up={0.5} />
      <Sprites count={80} motion={GLASS_DUST} dur={0.9} colors={['#bfeaff', '#ffffff']} shape="star" />
    </group>
  )
}

const GLASS_DUST = /* glsl */ `
  vec3 dir = normalize(vec3(r.x - 0.5, r.y - 0.5, r.z - 0.5) + 1e-4);
  float k = 1.0 - pow(1.0 - life, 2.0);
  p = dir * (2.0 + k * 16.0 * s.x) + vec3(0.0, -3.0 * life * life, 0.0);
  a = (1.0 - smoothstep(0.3, 1.0, life)) * (0.5 + 0.5 * sin(t * 25.0 + s.y * 40.0));
  sz = 0.7 + 0.9 * s.z;
  rot = s.w * 3.0;
`

const FLOW = /* glsl */ `
  float k = clamp((t - s.x * 0.6) / (0.55 + 0.3 * s.z), 0.0, 1.0);
  float e = k * k * (3.0 - 2.0 * k);
  p = mix(base, vec3((r.x - 0.5) * 6.0, 11.0 + (r.y - 0.5) * 8.0, (r.z - 0.5) * 6.0), e);
  p.y += sin(e * 3.14159) * (5.0 + 9.0 * s.y);
  a = step(0.0001, k) * (1.0 - smoothstep(0.85, 1.0, k)) * (0.65 + 0.35 * sin(t * 22.0 + s.w * 40.0));
  sz = 0.8 + 0.9 * s.w;
  mixc = e;
`

/* ---------- the Gate Card ---------- */

const GATE_MOTES = /* glsl */ `
  float ang = s.x * 6.2831;
  float rr = sqrt(s.y);
  vec3 from = vec3(cos(ang) * rr * 60.0, 0.5, sin(ang) * rr * 44.0);
  float k = clamp(t / (0.35 + 0.15 * s.z), 0.0, 1.0);
  p = mix(from, vec3(0.0, 1.0, 0.0), k * k);
  a = (1.0 - k) * smoothstep(0.0, 0.1, t) * 0.9;
  sz = 0.9 + 0.8 * s.w;
  mixc = k;
`

/** "Gate Card, open!": beams round the card, the symbol rising, the ripple and the gathering motes (group at the card's top). */
function GateOpen({
  color,
  beams,
  halfX,
  halfZ,
  k,
  element,
}: {
  color: string
  beams: THREE.Vector3[]
  halfX: number
  halfZ: number
  k: number
  element: ElementId | null
}) {
  const glow = element ? ELEMENT_BY_ID[element].glow : GATE_GOLD_GLOW
  return (
    <>
      <group scale={[halfX / 60, 1, halfZ / 44]}>
        <Sprites count={180} motion={GATE_MOTES} dur={0.5} colors={[color, '#ffffff']} size={1.2} />
      </group>
      {beams.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <LightColumn
            radius={p.y > 0 ? 3.2 * k : 1.8 * k}
            height={(p.y > 0 ? 95 : 70) * k}
            dur={1.5}
            delay={0.32 + (i % 5) * 0.03}
            grow={0.22}
            colors={[color, '#fff6e0']}
            alpha={p.y > 0 ? 0.6 : 0.4}
          />
        </group>
      ))}
      <GroundRing radius={150 * k} from={0.02} width={0.025} dur={1.5} delay={0.35} colors={[glow, color]} alpha={0.9} />
      <GroundRing radius={110 * k} from={0.02} width={0.02} dur={1.3} delay={0.5} colors={['#ffffff', color]} alpha={0.5} />
      <LightColumn radius={7 * k} height={22 * k} dur={1.6} delay={0.4} grow={0.4} colors={[color, glow]} alpha={0.22} />
      <Suspense fallback={null}>
        <Hologram element={element} color={color} glow={glow} k={k} />
      </Suspense>
    </>
  )
}

/** The gate closing: its light pulled back down into the card, a ring collapsing to the middle. */
function GateClose({ color, beams, halfX }: { color: string; beams: THREE.Vector3[]; halfX: number }) {
  const k = halfX / 69
  return (
    <>
      {beams.map((p, i) => (
        <group key={i} position={[p.x, 0, p.z]}>
          <LightColumn
            radius={(p.y > 0 ? 2.6 : 1.4) * k}
            height={60 * k}
            dur={0.6}
            grow={0.5}
            collapse
            colors={[color, '#ffffff']}
            alpha={0.6}
          />
        </group>
      ))}
      <GroundRing radius={95 * k} from={0.04} width={0.03} dur={0.75} inward colors={[color, '#ffffff']} alpha={0.9} />
      <Sprites
        count={90}
        motion={CRACK_DUST}
        dur={1.3}
        delay={0.55}
        colors={['#2a2c38', '#6d7184']}
        shape="chip"
        blending="normal"
        size={k}
      />
    </>
  )
}

const CRACK_DUST = /* glsl */ `
  float ang = s.x * 6.2831;
  vec3 from = vec3(cos(ang) * s.y * 40.0, 0.3, sin(ang) * s.y * 30.0);
  float tt = t;
  p = from + vec3(cos(ang) * tt * 6.0 * s.z, tt * (8.0 + 8.0 * s.w) - 14.0 * tt * tt, sin(ang) * tt * 6.0 * s.z);
  p.y = max(p.y, 0.3);
  a = 1.0 - smoothstep(0.5, 1.0, life);
  sz = 0.5 + 0.7 * r.x;
  rot = t * (r.y - 0.5) * 10.0;
  mixc = r.z;
`

const ICONS = ELEMENTS.map((e) => e.icon)

let neutralEmblem: THREE.Texture | null = null
/** The symbol of a command or character gate: a gold hexagon with a star. */
function neutralTexture() {
  if (neutralEmblem) return neutralEmblem
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const g = c.getContext('2d')!
  g.translate(128, 128)
  const hex = (r: number) => {
    g.beginPath()
    for (let i = 0; i < 6; i++)
      g.lineTo(Math.cos(-Math.PI / 2 + (i * Math.PI) / 3) * r, Math.sin(-Math.PI / 2 + (i * Math.PI) / 3) * r)
    g.closePath()
  }
  g.lineWidth = 14
  g.strokeStyle = '#ffffff'
  hex(104)
  g.stroke()
  g.lineWidth = 5
  hex(82)
  g.stroke()
  g.fillStyle = '#ffffff'
  g.beginPath()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 26 : 62
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  g.closePath()
  g.fill()
  neutralEmblem = new THREE.CanvasTexture(c)
  return neutralEmblem
}

/** The gate's symbol rising from the card as a flickering hologram. */
function Hologram({ element, color, glow, k }: { element: ElementId | null; color: string; glow: string; k: number }) {
  const icons = useTexture(ICONS)
  const texture = element ? icons[ELEMENTS.findIndex((e) => e.id === element)] : neutralTexture()
  const mesh = useRef<THREE.Mesh>(null)
  const camera = useThree((s) => s.camera)
  const fade = useContextFade()
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          varying vec2 vUv;
          uniform sampler2D uMap;
          uniform float uT;
          uniform float uA;
          uniform vec3 uColor;
          uniform vec3 uGlow;
          uniform float uTint;
          void main() {
            vec4 tex = texture2D(uMap, vUv);
            float lum = dot(tex.rgb, vec3(0.3, 0.5, 0.2));
            float scan = 0.7 + 0.3 * sin(vUv.y * 140.0 - uT * 18.0);
            float band = smoothstep(0.0, 0.04, abs(fract(vUv.y * 0.8 - uT * 0.9) - 0.5));
            float flicker = 0.85 + 0.15 * sin(uT * 61.0) * sin(uT * 23.0);
            vec3 col = mix(tex.rgb * 1.4, mix(uColor, uGlow, lum) * (0.6 + lum), uTint);
            float a = tex.a * uA * scan * flicker * (0.75 + 0.25 * band);
            if (!(a >= 0.003)) discard;
            gl_FragColor = vec4(col * 1.6, a);
          }`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        uniforms: {
          uMap: { value: texture },
          uT: { value: 0 },
          uA: { value: 0 },
          uColor: { value: new THREE.Color(color) },
          uGlow: { value: new THREE.Color(glow) },
          uTint: { value: element ? 0.45 : 1 },
        },
      }),
    [texture, color, glow, element],
  )
  useEffect(() => () => material.dispose(), [material])
  const t = useRef(-0.45)
  useFrame((_, dt) => {
    t.current += Math.min(dt, 0.1) * fxScale()
    const m = mesh.current
    if (!m) return
    const tt = t.current
    m.visible = tt > 0 && tt < 1.75
    if (!m.visible) return
    const rise = 1 - Math.pow(1 - THREE.MathUtils.clamp(tt / 0.8, 0, 1), 3)
    m.position.y = (3 + rise * 17) * k
    m.scale.setScalar((7 + rise * 9) * k)
    // turns to the view round its upright axis, with a slow spin of its own
    m.rotation.set(0, Math.atan2(camera.position.x - m.position.x, camera.position.z) + Math.sin(tt * 2) * 0.25, 0)
    const a = Math.min(1, tt / 0.15) * (1 - THREE.MathUtils.smoothstep(tt, 1.2, 1.75))
    const u = (m.material as THREE.ShaderMaterial).uniforms
    u.uA.value = a * (fade?.current ?? 1)
    u.uT.value = tt
  })
  return (
    <mesh ref={mesh} material={material} visible={false}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  )
}

/* ---------- the card's own light, kept while the gate is open ---------- */

interface GateLayerHandle {
  /** How brightly the open card's edge glows (0 = closed). */
  level: number
  color: THREE.Color
  events: { kind: 'open' | 'close'; at: number; color: THREE.Color; from: THREE.Color | null; by: SideIndex }[]
}

let crackTexture: THREE.Texture | null = null
/** Cracks across the card: a few impact points with jagged branches (white on black). */
function cracks() {
  if (crackTexture) return crackTexture
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 750
  const g = c.getContext('2d')!
  g.fillStyle = '#000'
  g.fillRect(0, 0, c.width, c.height)
  g.strokeStyle = '#fff'
  g.lineCap = 'round'
  g.lineJoin = 'round'
  let seed = 11
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const branch = (x: number, y: number, a: number, len: number, w: number, depth: number) => {
    g.lineWidth = w
    g.beginPath()
    g.moveTo(x, y)
    let px = x
    let py = y
    const steps = 6 + Math.floor(rand() * 5)
    for (let i = 0; i < steps; i++) {
      a += (rand() - 0.5) * 0.9
      px += Math.cos(a) * (len / steps)
      py += Math.sin(a) * (len / steps)
      g.lineTo(px, py)
      if (depth > 0 && rand() < 0.28) {
        g.stroke()
        branch(px, py, a + (rand() < 0.5 ? -1 : 1) * (0.5 + rand() * 0.6), len * 0.45, w * 0.6, depth - 1)
        g.lineWidth = w
        g.beginPath()
        g.moveTo(px, py)
      }
    }
    g.stroke()
  }
  for (const [x, y] of [
    [512, 375],
    [300, 260],
    [740, 500],
  ]) {
    const n = 6 + Math.floor(rand() * 3)
    for (let i = 0; i < n; i++) branch(x, y, (i / n) * Math.PI * 2 + rand() * 0.5, 180 + rand() * 260, 5, 2)
  }
  crackTexture = new THREE.CanvasTexture(c)
  return crackTexture
}

const LAYER_FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform float uT;
uniform float uLevel;
uniform vec3 uColor;
uniform vec3 uFrom;
uniform float uWipe;
uniform float uWipeDir;
uniform float uWipeGlow;
uniform float uScan;
uniform float uScanGlow;
uniform float uCrack;
uniform sampler2D uCracks;
void main() {
  vec2 q = vUv * 2.0 - 1.0;
  float edge = 1.0 - max(abs(q.x), abs(q.y));
  float rim = exp(-edge * 60.0) + 0.45 * exp(-edge * 12.0);
  float frame = exp(-abs(edge - 0.045) * 260.0) * 0.7;
  // the light pours in from the opener's end: the old colour gives way behind the front
  float along = q.x * uWipeDir;
  float taken = smoothstep(uWipe + 0.06, uWipe - 0.06, -along);
  vec3 col = mix(uFrom, uColor, taken);
  float fw = (-along - uWipe) / 0.035;
  float front = exp(-fw * fw) * uWipeGlow;
  float pulse = 0.85 + 0.15 * sin(uT * 2.4);
  float sd = (length(q * vec2(1.0, 0.73)) - uScan) / 0.05;
  float scan = exp(-sd * sd) * uScanGlow;
  float crack = texture2D(uCracks, vUv).r * uCrack;
  float a = (rim + frame) * uLevel * pulse + scan * 0.8 + front + crack;
  if (!(a >= 0.003)) discard;
  gl_FragColor = vec4(mix(col, vec3(1.0), clamp(crack * 0.6 + front * 0.4, 0.0, 1.0)) * 1.3, clamp(a, 0.0, 1.0));
}
`

const DIM_FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform float uDim;
uniform sampler2D uCracks;
void main() {
  float crack = texture2D(uCracks, vUv).r;
  float a = uDim * (0.32 + 0.6 * crack);
  if (!(a >= 0.003)) discard;
  gl_FragColor = vec4(vec3(0.0, 0.0, 0.01), a);
}
`

/**
 * The open card's own light: an edge glow in the colour of whoever holds it, a scan racing out as it opens, a wipe
 * of colour from the new holder's end when it changes hands, and glowing cracks that cool to dark as it closes.
 */
function GateLayer({
  state,
  halfX,
  halfZ,
  y,
  gateOn,
}: {
  state: React.RefObject<GateLayerHandle>
  halfX: number
  halfZ: number
  y: number
  gateOn: boolean
}) {
  const glow = useRef<THREE.Mesh>(null)
  const dim = useRef<THREE.Mesh>(null)
  const flat = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
  const materials = useMemo(() => {
    const crackMap = cracks()
    return {
      glow: new THREE.ShaderMaterial({
        vertexShader: flat,
        fragmentShader: LAYER_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -6,
        polygonOffsetUnits: -60,
        uniforms: {
          uT: { value: 0 },
          uLevel: { value: 0 },
          uColor: { value: new THREE.Color(GATE_GOLD) },
          uFrom: { value: new THREE.Color(GATE_GOLD) },
          uWipe: { value: 2 },
          uWipeDir: { value: 1 },
          uWipeGlow: { value: 0 },
          uScan: { value: 0 },
          uScanGlow: { value: 0 },
          uCrack: { value: 0 },
          uCracks: { value: crackMap },
        },
      }),
      dim: new THREE.ShaderMaterial({
        vertexShader: flat,
        fragmentShader: DIM_FRAGMENT,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -5,
        polygonOffsetUnits: -50,
        uniforms: { uDim: { value: 0 }, uCracks: { value: crackMap } },
      }),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(
    () => () => {
      materials.glow.dispose()
      materials.dim.dispose()
    },
    [materials],
  )
  const gateOnRef = useRef(gateOn)
  useEffect(() => {
    gateOnRef.current = gateOn
  }, [gateOn])

  useFrame(() => {
    const now = fxClock.now
    const st = state.current
    if (!glow.current || !dim.current) return
    const u = (glow.current.material as THREE.ShaderMaterial).uniforms
    u.uT.value = now
    st.events = st.events.filter((e) => now - e.at < 3)
    const ev = st.events[st.events.length - 1]
    let level = st.level
    let scanGlow = 0
    let wipeGlow = 0
    let crack = 0
    let dimLevel = 0
    if (ev) {
      const t = now - ev.at
      if (ev.kind === 'open') {
        // the card charges, then a scan races out from its middle and the edge burns bright before settling
        const target = 0.38
        st.level = target
        level = t < 0.32 ? (t / 0.32) * 0.8 : target + (1.6 - target) * Math.exp(-(t - 0.32) * 3)
        u.uScan.value = THREE.MathUtils.clamp((t - 0.3) / 0.6, 0, 1.1) * 1.1
        scanGlow = t > 0.3 ? Math.max(0, 1 - (t - 0.3) / 0.7) : 0
        if (ev.from) {
          // changing hands: the new colour pours across from the opener's end
          u.uFrom.value.copy(ev.from)
          u.uWipeDir.value = ev.by === 0 ? 1 : -1
          const w = THREE.MathUtils.clamp((t - 0.1) / 0.9, 0, 1)
          u.uWipe.value = THREE.MathUtils.lerp(-1.1, 1.1, w * w * (3 - 2 * w))
          wipeGlow = w > 0 && w < 1 ? 1.2 : 0
        } else {
          u.uFrom.value.copy(ev.color)
          u.uWipe.value = 2
        }
        u.uColor.value.copy(ev.color)
        st.color.copy(ev.color)
      } else {
        // closing: a last flare, the light drains away, cracks glow and cool, the card dims, then it all fades
        st.level = 0
        level = t < 0.15 ? 1.2 : Math.max(0, 1.2 * (1 - (t - 0.15) / 0.45))
        u.uColor.value.copy(ev.color)
        u.uFrom.value.copy(ev.color)
        u.uWipe.value = 2
        const ct = t - 0.5
        crack = ct < 0 ? 0 : ct < 0.12 ? (ct / 0.12) * 0.95 : 0.95 * Math.exp(-(ct - 0.12) * 4)
        dimLevel = ct < 0 ? 0 : Math.min(1, ct / 0.25) * (1 - THREE.MathUtils.smoothstep(t, 1.6, 2.6))
      }
    }
    if (!gateOnRef.current && (!ev || now - ev.at > 2.5)) st.level = level = Math.min(level, 0)
    u.uLevel.value = level
    u.uScanGlow.value = scanGlow
    u.uWipeGlow.value = wipeGlow
    u.uCrack.value = crack
    ;(dim.current.material as THREE.ShaderMaterial).uniforms.uDim.value = dimLevel
    glow.current.visible = level > 0.001 || scanGlow > 0 || wipeGlow > 0 || crack > 0.001
    dim.current.visible = dimLevel > 0.001
  })

  return (
    <group position={[0, y, 0]}>
      <mesh ref={dim} material={materials.dim} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <planeGeometry args={[halfX * 2 * 0.985, halfZ * 2 * 0.98]} />
      </mesh>
      <mesh ref={glow} material={materials.glow} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} visible={false}>
        <planeGeometry args={[halfX * 2 * 0.985, halfZ * 2 * 0.98]} />
      </mesh>
    </group>
  )
}
