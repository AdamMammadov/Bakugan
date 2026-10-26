import { useFrame, useThree } from '@react-three/fiber'
import { useContext, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { FxFade, fxScale, GLSL_NOISE, randoms } from './fxShared'

/**
 * The building blocks of the arena's big effects (BattleFx, BodyAura): GPU particles whose motion is a few lines of
 * GLSL, glowing swirl shells, ground rings, light columns, lightning and flying shards. Each plays once over `dur`
 * seconds after `delay`; positions are in the parent group's units. Everything is drawn without depth writes and
 * (mostly) additive, so the effects glow through bloom without hiding the Bakugan.
 */

/** Calls `onFrame` with the seconds since the effect began (negative before its delay) and the fade it is under. */
function useClock(delay: number, onFrame: (t: number, fade: number) => void) {
  const t = useRef(-delay)
  const fade = useContext(FxFade)
  useFrame((_, dt) => {
    // a hidden tab comes back with a huge step: the effect simply ends
    t.current += Math.min(dt, 0.1) * fxScale()
    onFrame(t.current, fade?.current ?? 1)
  })
}

const linear = (c: THREE.ColorRepresentation) => new THREE.Color(c)
const uniformsOf = (o: THREE.Object3D) => ((o as THREE.Mesh).material as THREE.ShaderMaterial).uniforms

export type SpriteShape = 'glow' | 'ember' | 'star' | 'leaf' | 'drop' | 'smoke' | 'chip'
const SHAPE: Record<SpriteShape, number> = { glow: 0, ember: 1, star: 2, leaf: 3, drop: 4, smoke: 5, chip: 6 }

const SPRITE_FRAGMENT = /* glsl */ `
varying vec4 vCol;
varying float vRot;
uniform float uShape;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  q.y = -q.y;
  float c = cos(vRot);
  float s = sin(vRot);
  q = vec2(c * q.x - s * q.y, s * q.x + c * q.y);
  float d = length(q);
  float a;
  vec3 col = vCol.rgb;
  if (uShape < 0.5) a = exp(-d * d * 4.5) * step(d, 1.0);
  else if (uShape < 1.5) {
    // a hot spark: white core, coloured falloff
    a = pow(max(0.0, 1.0 - d), 2.2);
    col = mix(col, vec3(1.0, 0.95, 0.85) * max(col.r, max(col.g, col.b)) * 1.4, exp(-d * d * 22.0));
  } else if (uShape < 2.5) {
    // a four-point twinkle
    float rays = max(exp(-abs(q.x) * 16.0) * (1.0 - abs(q.y)), exp(-abs(q.y) * 16.0) * (1.0 - abs(q.x)));
    a = clamp(rays + exp(-d * d * 14.0), 0.0, 1.0);
  } else if (uShape < 3.5) {
    // a leaf: a pointed oval with a lighter vein
    float w = 0.4 * (1.0 - q.y * q.y);
    a = smoothstep(0.03, -0.03, abs(q.x) - w) * step(abs(q.y), 0.98);
    col *= 0.75 + 0.45 * smoothstep(0.09, 0.0, abs(q.x)) + 0.2 * q.x;
  } else if (uShape < 4.5) {
    // a droplet: clear middle, bright rim, a glint
    vec2 g = q - vec2(-0.32, 0.36);
    a = smoothstep(1.0, 0.82, d) * (0.3 + 0.7 * smoothstep(0.45, 0.95, d)) + exp(-dot(g, g) * 26.0);
  } else if (uShape < 5.5) {
    a = smoothstep(1.0, 0.0, d);
    a *= a;
  } else {
    // a chip of rock: hard edged, lit from above
    float poly = max(abs(q.x) * 0.9 + q.y * 0.35, abs(q.y) * 1.05 - q.x * 0.2);
    a = smoothstep(0.82, 0.74, poly);
    col *= 0.65 + 0.55 * clamp(q.y + 0.3, 0.0, 1.0);
  }
  a *= vCol.a;
  if (!(a >= 0.004)) discard;
  gl_FragColor = vec4(col, a);
}
`

const spriteVertex = (motion: string) => /* glsl */ `
attribute vec4 aSeed;
attribute vec4 aSeed2;
attribute vec3 aBase;
uniform float uT;
uniform float uDur;
uniform float uPx;
uniform float uSize;
uniform float uFade;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
varying vec4 vCol;
varying float vRot;
${GLSL_NOISE}
void main() {
  vec4 s = aSeed;
  vec4 r = aSeed2;
  float t = uT;
  float life = clamp(uT / uDur, 0.0, 1.0);
  vec3 base = aBase;
  vec3 p = vec3(0.0);
  float a = 1.0;
  float sz = 1.0;
  float rot = 0.0;
  float mixc = s.x;
  float hot = 0.0;
  ${motion}
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float world = length(modelMatrix[0].xyz);
  gl_PointSize = clamp(sz * uSize * world * uPx / max(0.1, -mv.z), 0.0, 512.0);
  vec3 col = mix(uA, uB, clamp(mixc, 0.0, 1.0));
  col = mix(col, uC, clamp(hot, 0.0, 1.0));
  vCol = vec4(col, clamp(a, 0.0, 1.0) * uFade);
  vRot = rot;
}
`

/** A sprite material for a motion (three shares one program per source). */
function spriteMaterial(
  motion: string,
  shape: SpriteShape,
  blending: 'add' | 'normal',
  colors: [THREE.ColorRepresentation, THREE.ColorRepresentation, THREE.ColorRepresentation],
  dur: number,
  size: number,
) {
  return new THREE.ShaderMaterial({
    vertexShader: spriteVertex(motion),
    fragmentShader: SPRITE_FRAGMENT,
    transparent: true,
    depthWrite: false,
    blending: blending === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending,
    toneMapped: false,
    uniforms: {
      uT: { value: 0 },
      uDur: { value: dur },
      uPx: { value: 500 },
      uSize: { value: size },
      uFade: { value: 1 },
      uShape: { value: SHAPE[shape] },
      uA: { value: linear(colors[0]) },
      uB: { value: linear(colors[1]) },
      uC: { value: linear(colors[2]) },
    },
  })
}

/** Each particle's random numbers and (when `bases` are given) its starting point, picked from them at random. */
function spriteGeometry(count: number, bases?: Float32Array | null) {
  const g = new THREE.BufferGeometry()
  const base = new Float32Array(count * 3)
  if (bases?.length) {
    const n = bases.length / 3
    const pick = randoms(count)
    for (let i = 0; i < count; i++) {
      const k = Math.floor(pick[i] * n) * 3
      base.set([bases[k], bases[k + 1], bases[k + 2]], i * 3)
    }
  }
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3))
  g.setAttribute('aSeed', new THREE.BufferAttribute(randoms(count * 4), 4))
  g.setAttribute('aSeed2', new THREE.BufferAttribute(randoms(count * 4), 4))
  g.setAttribute('aBase', new THREE.BufferAttribute(base, 3))
  return g
}

const _size = new THREE.Vector2()

/** Pixels per world unit at distance 1 for the current camera (for sprites sized in world units). */
function pixelsPerUnit(gl: THREE.WebGLRenderer, camera: THREE.Camera) {
  const h = gl.getDrawingBufferSize(_size).y
  const fov = (camera as THREE.PerspectiveCamera).fov ?? 50
  return h / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2))
}

/**
 * GPU particles. `motion` is GLSL run per particle: it reads `s` and `r` (eight random numbers), `t` (seconds),
 * `life` (0–1 over `dur`) and `base` (the particle's point in `bases`, if given), and sets `p` (position), `a`
 * (opacity), `sz` (size, world units), `rot`, `mixc` (0 = first colour, 1 = second) and `hot` (towards the third).
 */
export function Sprites({
  count,
  motion,
  dur,
  delay = 0,
  colors,
  shape = 'glow',
  blending = 'add',
  size = 1,
  bases,
}: {
  count: number
  motion: string
  dur: number
  delay?: number
  colors: [THREE.ColorRepresentation, THREE.ColorRepresentation, THREE.ColorRepresentation?]
  shape?: SpriteShape
  blending?: 'add' | 'normal'
  size?: number
  /** Points for the particles to start from (x, y, z…); each takes one at random. */
  bases?: Float32Array | null
}) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const points = useRef<THREE.Points>(null)
  const geometry = useMemo(() => spriteGeometry(count, bases), [count, bases])
  const [c0, c1, c2 = '#ffffff'] = colors
  const material = useMemo(
    () => spriteMaterial(motion, shape, blending, [c0, c1, c2], dur, size),
    [motion, shape, blending, c0, c1, c2, dur, size],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  useClock(delay, (t, fade) => {
    const p = points.current
    if (!p) return
    p.visible = t >= 0 && t <= dur
    const u = uniformsOf(p)
    u.uT.value = t
    u.uFade.value = fade
    u.uPx.value = pixelsPerUnit(gl, camera)
  })
  return <points ref={points} geometry={geometry} material={material} frustumCulled={false} visible={false} />
}

const SHELL_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
uniform float uFlare;
void main() {
  vUv = uv;
  vec3 pos = position;
  // the shell flares out at the top
  pos.xz *= 1.0 + uFlare * uv.y * uv.y;
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const SHELL_FRAGMENT = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
uniform float uT;
uniform float uDur;
uniform float uTwist;
uniform float uSpeed;
uniform float uBands;
uniform float uRise;
uniform float uFade;
uniform float uAlpha;
uniform float uStyle;
uniform vec3 uA;
uniform vec3 uB;
${GLSL_NOISE}
void main() {
  float life = clamp(uT / uDur, 0.0, 1.0);
  float x = vUv.x;
  float y = vUv.y;
  float sw = fract(x * uBands + y * uTwist - uT * uSpeed);
  // a streak with a sharp leading edge and a long tail
  float band = smoothstep(0.0, 0.08, sw) * pow(clamp(1.0 - sw, 0.0, 1.0), 1.6);
  float n = fxNoise(vec2(x * 14.0 * uBands / 3.0 + y * 2.0, y * 7.0 - uT * uSpeed * 3.0));
  float body;
  if (uStyle < 0.5) body = band * (0.45 + 0.75 * n);
  else if (uStyle < 1.5) {
    // flames: ragged tongues licking upward
    float tongue = fxNoise(vec2(x * 22.0, y * 4.0 - uT * 5.0));
    body = band * smoothstep(0.25, 0.75, tongue + 0.35 * (1.0 - y)) * 1.3;
  } else {
    // water: smooth glossy sheets with bright crests
    body = smoothstep(0.15, 0.6, band) + 0.6 * pow(band, 6.0);
  }
  float reach = smoothstep(0.0, uRise, uT);
  float top = smoothstep(reach * 1.1 + 0.02, reach * 1.1 - 0.25, y);
  float ends = smoothstep(0.0, 0.1, y) * smoothstep(1.0, 0.75, y);
  float fade = 1.0 - smoothstep(0.6, 1.0, life);
  float rim = 0.4 + 0.6 * pow(clamp(1.0 - abs(dot(normalize(vN), vV)), 0.0, 1.0), 1.2);
  float a = body * top * ends * fade * rim * uAlpha * uFade;
  if (!(a >= 0.003)) discard;
  gl_FragColor = vec4(mix(uA, uB, clamp(body * n, 0.0, 1.0)), a);
}
`

/**
 * A spinning shell of light streaks round an upright axis (a cylinder, or a cone when `top` ≠ `bottom`): a fire swirl,
 * a water spiral, a tornado. It grows from the ground up over `rise` seconds and fades at the end.
 */
export function Swirl({
  bottom,
  top,
  height,
  y = 0,
  dur,
  delay = 0,
  colors,
  bands = 3,
  twist = 1.2,
  speed = 1.4,
  rise = 0.35,
  alpha = 1,
  style = 'streak',
  flare = 0,
  blending = 'add',
}: {
  bottom: number
  top: number
  height: number
  y?: number
  dur: number
  delay?: number
  colors: [THREE.ColorRepresentation, THREE.ColorRepresentation]
  bands?: number
  twist?: number
  speed?: number
  rise?: number
  alpha?: number
  style?: 'streak' | 'flame' | 'water'
  flare?: number
  blending?: 'add' | 'normal'
}) {
  const mesh = useRef<THREE.Mesh>(null)
  const geometry = useMemo(() => {
    const g = new THREE.CylinderGeometry(top, bottom, height, 48, 12, true)
    g.translate(0, height / 2, 0)
    return g
  }, [top, bottom, height])
  const [c0, c1] = colors
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SHELL_VERTEX,
        fragmentShader: SHELL_FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: blending === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending,
        toneMapped: false,
        uniforms: {
          uT: { value: 0 },
          uDur: { value: dur },
          uTwist: { value: twist },
          uSpeed: { value: speed },
          uBands: { value: bands },
          uRise: { value: rise },
          uFade: { value: 1 },
          uAlpha: { value: alpha },
          uStyle: { value: style === 'streak' ? 0 : style === 'flame' ? 1 : 2 },
          uFlare: { value: flare },
          uA: { value: linear(c0) },
          uB: { value: linear(c1) },
        },
      }),
    [blending, dur, twist, speed, bands, rise, alpha, style, flare, c0, c1],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  useClock(delay, (t, fade) => {
    const m = mesh.current
    if (!m) return
    m.visible = t >= 0 && t <= dur
    const u = uniformsOf(m)
    u.uT.value = t
    u.uFade.value = fade
  })
  return <mesh ref={mesh} geometry={geometry} material={material} position={[0, y, 0]} visible={false} />
}

const FLAT_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const RING_FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform float uT;
uniform float uDur;
uniform float uFrom;
uniform float uWidth;
uniform float uFade;
uniform float uAlpha;
uniform float uRough;
uniform float uInward;
uniform vec3 uA;
uniform vec3 uB;
${GLSL_NOISE}
void main() {
  vec2 q = vUv * 2.0 - 1.0;
  float d = length(q);
  float life = clamp(uT / uDur, 0.0, 1.0);
  float k = 1.0 - pow(1.0 - life, 2.6);
  float r = uInward > 0.5 ? mix(0.97, uFrom, k) : mix(uFrom, 1.0, k) * 0.97;
  float ang = atan(q.y, q.x + 1e-5);
  float wob = (fxNoise(vec2(ang * 6.0, uT * 2.0)) - 0.5) * uRough;
  float w = uWidth * (0.6 + 0.8 * (1.0 - life));
  float x = (d - r + wob * 0.12) / w;
  if (uInward > 0.5) x = -x;
  // a sharp front edge, a soft trail behind it
  float ring = x > 0.0 ? exp(-x * x * 6.0) : exp(-x * x * 0.9);
  float dust = uRough > 0.0 ? 0.6 + 0.8 * fxNoise(q * 9.0 + uT) : 1.0;
  float a = ring * dust * (1.0 - smoothstep(0.55, 1.0, life)) * smoothstep(0.0, 0.04, uT) * uAlpha * uFade * step(d, 1.0);
  if (!(a >= 0.003)) discard;
  gl_FragColor = vec4(mix(uB, uA, clamp(x * 0.5 + 0.7, 0.0, 1.0)), a);
}
`

/** A ring on the ground racing out from the middle (a shockwave, a ripple, a dust ring), or in towards it. */
export function GroundRing({
  radius,
  from = 0.05,
  width = 0.06,
  y = 0.15,
  dur,
  delay = 0,
  colors,
  alpha = 1,
  rough = 0,
  inward = false,
  blending = 'add',
}: {
  radius: number
  from?: number
  width?: number
  y?: number
  dur: number
  delay?: number
  colors: [THREE.ColorRepresentation, THREE.ColorRepresentation]
  alpha?: number
  rough?: number
  inward?: boolean
  blending?: 'add' | 'normal'
}) {
  const mesh = useRef<THREE.Mesh>(null)
  const [c0, c1] = colors
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: FLAT_VERTEX,
        fragmentShader: RING_FRAGMENT,
        transparent: true,
        depthWrite: false,
        blending: blending === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -40,
        uniforms: {
          uT: { value: 0 },
          uDur: { value: dur },
          uFrom: { value: from },
          uWidth: { value: width },
          uFade: { value: 1 },
          uAlpha: { value: alpha },
          uRough: { value: rough },
          uInward: { value: inward ? 1 : 0 },
          uA: { value: linear(c0) },
          uB: { value: linear(c1) },
        },
      }),
    [blending, dur, from, width, alpha, rough, inward, c0, c1],
  )
  useEffect(() => () => material.dispose(), [material])
  useClock(delay, (t, fade) => {
    const m = mesh.current
    if (!m) return
    m.visible = t >= 0 && t <= dur
    const u = uniformsOf(m)
    u.uT.value = t
    u.uFade.value = fade
  })
  return (
    <mesh ref={mesh} material={material} rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} scale={radius} visible={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}

const COLUMN_FRAGMENT = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
uniform float uT;
uniform float uDur;
uniform float uFade;
uniform float uAlpha;
uniform float uGrow;
uniform float uCollapse;
uniform vec3 uA;
uniform vec3 uB;
${GLSL_NOISE}
void main() {
  float life = clamp(uT / uDur, 0.0, 1.0);
  float y = vUv.y;
  float facing = clamp(abs(dot(normalize(vN), vV)), 0.0, 1.0);
  // bright core where the column faces us, a glowing edge
  float core = pow(facing, 2.5);
  float edge = pow(1.0 - facing, 3.0) * 0.6;
  float streak = 0.65 + 0.5 * fxNoise(vec2(vUv.x * 18.0, y * 3.0 - uT * 4.0));
  float reach = uCollapse > 0.5 ? 1.0 - smoothstep(0.0, uGrow, uT) : smoothstep(0.0, uGrow, uT);
  float shown = smoothstep(reach + 0.02, reach - 0.15, y);
  float a = (core + edge) * streak * shown * smoothstep(1.0, 0.55, y) * (1.0 - smoothstep(0.55, 1.0, life)) * uAlpha * uFade;
  if (!(a >= 0.003)) discard;
  gl_FragColor = vec4(mix(uA, uB, core), a);
}
`

/** A column of light rising from the ground (or, `collapse`, sinking back into it). */
export function LightColumn({
  radius,
  height,
  dur,
  delay = 0,
  colors,
  alpha = 1,
  grow = 0.25,
  collapse = false,
}: {
  radius: number
  height: number
  dur: number
  delay?: number
  colors: [THREE.ColorRepresentation, THREE.ColorRepresentation]
  alpha?: number
  grow?: number
  collapse?: boolean
}) {
  const mesh = useRef<THREE.Mesh>(null)
  const geometry = useMemo(() => {
    const g = new THREE.CylinderGeometry(radius * 0.8, radius, height, 32, 1, true)
    g.translate(0, height / 2, 0)
    return g
  }, [radius, height])
  const [c0, c1] = colors
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SHELL_VERTEX,
        fragmentShader: COLUMN_FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        uniforms: {
          uT: { value: 0 },
          uDur: { value: dur },
          uFade: { value: 1 },
          uAlpha: { value: alpha },
          uGrow: { value: grow },
          uCollapse: { value: collapse ? 1 : 0 },
          uFlare: { value: 0 },
          uA: { value: linear(c0) },
          uB: { value: linear(c1) },
        },
      }),
    [dur, alpha, grow, collapse, c0, c1],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  useClock(delay, (t, fade) => {
    const m = mesh.current
    if (!m) return
    m.visible = t >= 0 && t <= dur
    const u = uniformsOf(m)
    u.uT.value = t
    u.uFade.value = fade
    // it narrows to a thread as it fades
    const life = THREE.MathUtils.clamp(t / dur, 0, 1)
    const w = collapse ? 1 - life * 0.7 : 1 - THREE.MathUtils.smoothstep(life, 0.45, 1) * 0.75
    m.scale.set(w, 1, w)
  })
  return <mesh ref={mesh} geometry={geometry} material={material} visible={false} />
}

const BOLT_SEGMENTS = 14

/** The ribbons for `count` bolts: two vertices per point, `aAcross` 0 on one edge and 1 on the other. */
function boltGeometry(count: number) {
  const g = new THREE.BufferGeometry()
  const verts = count * (BOLT_SEGMENTS + 1) * 2
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3))
  const across = new Float32Array(verts)
  const idx: number[] = []
  for (let b = 0; b < count; b++)
    for (let i = 0; i <= BOLT_SEGMENTS; i++) {
      const v = (b * (BOLT_SEGMENTS + 1) + i) * 2
      across[v + 1] = 1
      if (i < BOLT_SEGMENTS) idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2)
    }
  g.setAttribute('aAcross', new THREE.BufferAttribute(across, 1))
  g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(verts), 1))
  g.setIndex(idx)
  return g
}

/** A jagged path between two points, and whether it is lit this flicker. */
function jag(from: THREE.Vector3, to: THREE.Vector3) {
  const len = from.distanceTo(to)
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= BOLT_SEGMENTS; i++) {
    const k = i / BOLT_SEGMENTS
    const p = from.clone().lerp(to, k)
    const amp = Math.sin(k * Math.PI) * len * 0.12
    if (i > 0 && i < BOLT_SEGMENTS)
      p.add(new THREE.Vector3((Math.random() - 0.5) * amp * 2, (Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp * 2))
    pts.push(p)
  }
  return { pts, lit: Math.random() < 0.75 }
}

const _a = new THREE.Vector3()
const _b = new THREE.Vector3()
const _cam = new THREE.Vector3()

/**
 * Forked lightning: `count` bolts flickering round a point, each redrawn every few frames. `path` picks each
 * bolt's ends (in the group's units); the bolt is a camera-facing ribbon that jags between them.
 */
export function Lightning({
  count,
  path,
  dur,
  delay = 0,
  color,
  width = 0.5,
  every = 0.07,
}: {
  count: number
  path: (i: number) => [THREE.Vector3, THREE.Vector3]
  dur: number
  delay?: number
  color: THREE.ColorRepresentation
  width?: number
  every?: number
}) {
  const mesh = useRef<THREE.Mesh>(null)
  const camera = useThree((s) => s.camera)
  const bolts = useRef({ next: 0, list: [] as { pts: THREE.Vector3[]; lit: boolean }[] })
  const geometry = useMemo(() => boltGeometry(count), [count])
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: /* glsl */ `
          attribute float aAcross;
          attribute float aAlpha;
          varying float vAcross;
          varying float vAlpha;
          void main() {
            vAcross = aAcross;
            vAlpha = aAlpha;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          varying float vAcross;
          varying float vAlpha;
          uniform vec3 uColor;
          uniform float uFade;
          void main() {
            float x = abs(vAcross - 0.5) * 2.0;
            float core = exp(-x * x * 18.0);
            float glow = exp(-x * x * 2.5) * 0.55;
            float a = (core + glow) * vAlpha * uFade;
            if (!(a >= 0.003)) discard;
            gl_FragColor = vec4(mix(uColor, vec3(1.0), core * 0.85) * 1.6, a);
          }`,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        uniforms: { uColor: { value: linear(color) }, uFade: { value: 1 } },
      }),
    [color],
  )
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  useClock(delay, (t, fade) => {
    const m = mesh.current
    if (!m) return
    m.visible = t >= 0 && t <= dur
    if (!m.visible) return
    uniformsOf(m).uFade.value = fade * (1 - THREE.MathUtils.smoothstep(t / dur, 0.7, 1))
    const st = bolts.current
    // new bolts every few frames, each lit only some of the time (the flicker)
    if (t >= st.next) {
      st.next = t + every
      st.list = Array.from({ length: count }, (_, i) => jag(...path(i)))
    }
    // ribbons across the view direction
    m.updateWorldMatrix(true, false)
    m.worldToLocal(_cam.copy(camera.position))
    const pos = m.geometry.getAttribute('position') as THREE.BufferAttribute
    const alpha = m.geometry.getAttribute('aAlpha') as THREE.BufferAttribute
    st.list.forEach(({ pts, lit }, b) => {
      pts.forEach((p, i) => {
        const prev = pts[Math.max(0, i - 1)]
        const next = pts[Math.min(BOLT_SEGMENTS, i + 1)]
        _a.subVectors(next, prev).normalize()
        _b.subVectors(_cam, p).normalize()
        const side = _a
          .cross(_b)
          .normalize()
          .multiplyScalar(width * (1 - (i / BOLT_SEGMENTS) * 0.5))
        const v = (b * (BOLT_SEGMENTS + 1) + i) * 2
        pos.setXYZ(v, p.x - side.x, p.y - side.y, p.z - side.z)
        pos.setXYZ(v + 1, p.x + side.x, p.y + side.y, p.z + side.z)
        alpha.setX(v, lit ? 1 : 0)
        alpha.setX(v + 1, lit ? 1 : 0)
      })
    })
    pos.needsUpdate = true
    alpha.needsUpdate = true
  })
  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} visible={false} />
}

interface Piece {
  start: THREE.Vector3
  vel: THREE.Vector3
  axis: THREE.Vector3
  spin: number
  scale: number
  stretch: THREE.Vector3
}

/** Where each shard starts and how it flies. */
function flingPieces(count: number, size: number, speed: number, spread: number, up: number): Piece[] {
  return Array.from({ length: count }, () => {
    const ang = Math.random() * Math.PI * 2
    const out = (0.5 + Math.random()) * speed
    const r = spread * (0.4 + Math.random() * 0.6)
    return {
      start: new THREE.Vector3(Math.cos(ang) * r, (Math.random() - 0.3) * spread * 0.6, Math.sin(ang) * r),
      vel: new THREE.Vector3(Math.cos(ang) * out, (0.6 + Math.random() * 1.1) * speed * up, Math.sin(ang) * out),
      axis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
      spin: (Math.random() * 8 + 4) * (Math.random() < 0.5 ? -1 : 1),
      scale: size * (0.45 + Math.random() * 0.8),
      stretch: new THREE.Vector3(1, 0.7 + Math.random() * 0.9, 1),
    }
  })
}

function shardGeometry(kind: 'rock' | 'glass') {
  if (kind === 'rock') return new THREE.DodecahedronGeometry(1, 0)
  const g = new THREE.BufferGeometry()
  // a thin splinter of glass
  g.setAttribute('position', new THREE.Float32BufferAttribute([0, 1.2, 0, -0.5, -0.6, 0.04, 0.6, -0.4, -0.04], 3))
  g.computeVertexNormals()
  return g
}

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()
const _n = new THREE.Vector3()
const _c = new THREE.Color()

/**
 * Pieces flung out from a point that tumble and fall (rock shards, broken glass). `glass` pieces are thin, pale
 * and glint as they turn; rock is solid and lit.
 */
export function Shards({
  count,
  dur,
  delay = 0,
  color,
  glow,
  kind,
  size = 1,
  speed = 1,
  floor = 0,
  spread = 1,
  up = 1,
}: {
  count: number
  dur: number
  delay?: number
  color: THREE.ColorRepresentation
  glow: THREE.ColorRepresentation
  kind: 'rock' | 'glass'
  size?: number
  speed?: number
  /** Height of the ground (group units) they land on. */
  floor?: number
  /** How far from the middle they start (rock bursting out of the ground round it, glass from a pane). */
  spread?: number
  up?: number
}) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const camera = useThree((s) => s.camera)
  const geometry = useMemo(() => shardGeometry(kind), [kind])
  const material = useMemo(
    () =>
      kind === 'rock'
        ? new THREE.MeshStandardMaterial({
            color,
            emissive: glow,
            emissiveIntensity: 0.35,
            roughness: 0.9,
            flatShading: true,
            transparent: true,
          })
        : new THREE.MeshBasicMaterial({
            color: '#ffffff',
            transparent: true,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
          }),
    [kind, color, glow],
  )
  const pieces = useMemo(() => flingPieces(count, size, speed, spread, up), [count, size, speed, spread, up])
  useEffect(() => () => geometry.dispose(), [geometry])
  useEffect(() => () => material.dispose(), [material])
  const tint = useMemo(() => [linear(color), linear(glow)] as const, [color, glow])
  useClock(delay, (t, fade) => {
    const m = mesh.current
    if (!m) return
    m.visible = t >= 0 && t <= dur
    if (!m.visible) return
    const life = t / dur
    const out = 1 - THREE.MathUtils.smoothstep(life, 0.65, 1)
    const gravity = kind === 'rock' ? 9.5 * speed : 3.2 * speed
    m.updateWorldMatrix(true, false)
    m.worldToLocal(_cam.copy(camera.position))
    pieces.forEach((pc, i) => {
      _p.copy(pc.start).addScaledVector(pc.vel, t)
      _p.y -= 0.5 * gravity * t * t
      // rock lands and stays on the ground
      const landed = kind === 'rock' && _p.y <= floor + pc.scale * 0.4
      if (landed) _p.y = floor + pc.scale * 0.4
      _q.setFromAxisAngle(pc.axis, pc.spin * t * (landed ? 0.2 : 1))
      _s.copy(pc.stretch).multiplyScalar(pc.scale)
      m.setMatrixAt(i, _m.compose(_p, _q, _s))
      if (kind === 'glass') {
        // a glint when a face turns towards the view
        _n.set(0, 0, 1).applyQuaternion(_q)
        const glint = Math.pow(Math.abs(_n.dot(_b.subVectors(_cam, _p).normalize())), 6)
        m.setColorAt(
          i,
          _c
            .copy(tint[1])
            .lerp(tint[0], 0.4)
            .multiplyScalar((0.35 + 2.2 * glint) * out * fade),
        )
      }
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    if (kind === 'rock') (m.material as THREE.MeshStandardMaterial).opacity = out * fade
  })
  return (
    <instancedMesh
      ref={mesh}
      args={[geometry, material, count]}
      frustumCulled={false}
      visible={false}
      castShadow={kind === 'rock'}
    />
  )
}

const _wq = new THREE.Quaternion()

/** A glow card that always faces the view (a burst of light, a sunburst of rays). */
export function Glare({
  texture,
  size,
  dur,
  delay = 0,
  color,
  spin = 0,
  grow = [0.3, 1],
  peak = 0.15,
  alpha = 1,
}: {
  texture: THREE.Texture
  size: number
  dur: number
  delay?: number
  color: THREE.ColorRepresentation
  spin?: number
  grow?: [number, number]
  peak?: number
  alpha?: number
}) {
  const mesh = useRef<THREE.Mesh>(null)
  const camera = useThree((s) => s.camera)
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        map: texture,
        color: linear(color),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    [texture, color],
  )
  useEffect(() => () => material.dispose(), [material])
  const [g0, g1] = grow
  useClock(delay, (t, fade) => {
    const m = mesh.current
    if (!m) return
    m.visible = t >= 0 && t <= dur
    if (!m.visible) return
    const life = t / dur
    m.quaternion.copy(camera.quaternion)
    if (m.parent) m.quaternion.premultiply(m.parent.getWorldQuaternion(_wq).invert())
    m.rotateZ(spin * t)
    m.scale.setScalar(size * THREE.MathUtils.lerp(g0, g1, 1 - Math.pow(1 - life, 3)))
    const env = life < peak ? life / peak : 1 - THREE.MathUtils.smoothstep(life, peak, 1)
    ;(m.material as THREE.MeshBasicMaterial).opacity = env * alpha * fade
  })
  return (
    <mesh ref={mesh} material={material} visible={false} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  )
}
