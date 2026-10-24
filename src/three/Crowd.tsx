import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { asset } from '../asset'
import { CHARACTERS } from '../profile/avatar'

/** One spectator's place in the stands. */
export interface Seat {
  x: number
  y: number
  z: number
  /** Height (world units). */
  size: number
  /** 0–1, varies how each fan looks and moves. */
  seed: number
  /** Whose fan (0 = the player's side). Fans of both sides sit all round the stands. */
  side: number
  /** Angle round the stadium, for the wave. */
  angle: number
}

/**
 * How the stands move right now, per side ([player's fans, opponent's fans]); 0 = still, 1 = all out.
 * The chant's beat comes in as pulses: `clapHit` when hands meet, `pump` when fists go up on a shout.
 */
export interface CrowdLevels {
  hype: [number, number]
  arms: [number, number]
  jump: [number, number]
  boo: [number, number]
  clap: [number, number]
  clapHit: [number, number]
  pump: [number, number]
  gasp: number
  wave: number
  waveAt: number
}

/**
 * The fans are impostors: the game's own brawler models, drawn once at load time into an atlas (front and
 * three-quarter views; brawlers with movable arms also cheering, clapping and waving), then shown as camera-facing
 * cards, one instanced draw for the whole stadium. Each fan gets its own outfit and hair colours (a hue turn that
 * leaves skin alone), size, mirror image and way of moving.
 */
const COLS = 8
const ROWS = 4
const CELL_PX = 256
/** A cell is 1 × 2 atlas units; a standing figure fills this much of its height (room above for raised arms). */
const FIGURE = 1.5
const FEET = 0.04
/** Three-quarter views are turned this much. */
const QUARTER = 0.5
/** Extra poses, in this order, for brawlers whose arms move. */
const POSES = ['cheer', 'clap', 'wave'] as const
/** How tall each brawler stands next to the others. */
const HEIGHT: Record<string, number> = { marucho: 0.82, runo: 0.95, julie: 0.95, alice: 0.96, klaus: 1.04 }

const BRAWLERS = CHARACTERS.filter((c) => c.model)
const URLS = BRAWLERS.map((c) => asset(c.model!))

/** Arm angles for each pose (the arms are bent at the elbow, forearms forward), left mirroring right. */
const ARMS: Record<'idle' | (typeof POSES)[number], [[number, number, number], [number, number, number]]> = {
  idle: [
    [0, 0, -1.18],
    [0, 0, -1.18],
  ],
  // fists up by the head
  cheer: [
    [-1.25, 0, 0.75],
    [-1.25, 0, 0.75],
  ],
  // hands together in front
  clap: [
    [0, 1.0, -1.3],
    [0, 1.0, -1.3],
  ],
  wave: [
    [-1.25, 0, 0.75],
    [0, 0, -1.18],
  ],
}

function setPose(body: THREE.Object3D, pose: keyof typeof ARMS) {
  const r = body.getObjectByName('armR')
  const l = body.getObjectByName('armL')
  if (!r || !l) return
  const [[rx, ry, rz], [lx, ly, lz]] = ARMS[pose]
  r.rotation.set(rx, ry, rz)
  l.rotation.set(lx, -ly, -lz)
}

/** A copy of a brawler model ready for the atlas: eyes drawn over the face as on the field (new materials go to `made`). */
function figure(scene: THREE.Object3D, made: THREE.Material[]) {
  const c = scene.clone(true)
  c.traverse((o) => {
    const m = o as THREE.Mesh
    if (!m.isMesh) return
    const eyeball = o.name.startsWith('eyeball')
    const front = o.name.startsWith('front')
    if (o.name.startsWith('face') || eyeball || front) {
      const mat = (m.material as THREE.Material).clone()
      mat.polygonOffset = true
      mat.polygonOffsetFactor = eyeball ? -20 : front ? -80 : -40
      mat.polygonOffsetUnits = eyeball ? -200 : front ? -800 : -400
      m.material = mat
      made.push(mat)
    }
  })
  return c
}

interface Atlas {
  texture: THREE.Texture
  /** Per brawler: its first idle cell, and its first pose cell (-1: none). */
  cells: [number, number][]
  dispose: () => void
}

/** Draws every brawler into the atlas (one render into a mipmapped, multisampled target). */
function buildAtlas(gl: THREE.WebGLRenderer, scenes: THREE.Object3D[]): Atlas {
  const scene = new THREE.Scene()
  scene.add(new THREE.AmbientLight('#ffffff', 0.75))
  scene.add(new THREE.HemisphereLight('#c9d4ff', '#3a3040', 0.55))
  const key = new THREE.DirectionalLight('#ffffff', 1.8)
  key.position.set(2, 4, 6)
  scene.add(key)
  const extra: THREE.Material[] = []
  const cells: [number, number][] = []
  let next = BRAWLERS.length * 2
  const place = (src: THREE.Object3D, index: number, yaw: number, pose: 'idle' | (typeof POSES)[number]) => {
    const body = figure(src, extra)
    // measured standing still, so every pose of a brawler has the same size and feet
    setPose(body, 'idle')
    body.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(body)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    setPose(body, pose)
    const holder = new THREE.Group()
    const s = FIGURE / size.y
    holder.position.set((index % COLS) + 0.5, Math.floor(index / COLS) * 2 + FEET, 0)
    holder.rotation.y = yaw
    holder.scale.setScalar(s)
    body.position.set(-center.x, -box.min.y, -center.z)
    holder.add(body)
    scene.add(holder)
  }
  scenes.forEach((src, i) => {
    place(src, i * 2, 0, 'idle')
    place(src, i * 2 + 1, QUARTER, 'idle')
    let poses = -1
    if (src.getObjectByName('armR') && src.getObjectByName('armL') && next + POSES.length * 2 <= COLS * ROWS) {
      poses = next
      POSES.forEach((p, k) => {
        place(src, next + k * 2, 0, p)
        place(src, next + k * 2 + 1, QUARTER, p)
      })
      next += POSES.length * 2
    }
    cells.push([i * 2, poses])
  })
  const camera = new THREE.OrthographicCamera(0, COLS, ROWS * 2, 0, 0.1, 100)
  camera.position.set(0, 0, 50)
  const target = new THREE.WebGLRenderTarget(COLS * CELL_PX, ROWS * CELL_PX * 2, {
    samples: 4,
    colorSpace: THREE.SRGBColorSpace,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
  })
  target.texture.anisotropy = 4
  const before = gl.getRenderTarget()
  const clear = gl.getClearColor(new THREE.Color())
  const alpha = gl.getClearAlpha()
  const shadows = gl.shadowMap.autoUpdate
  gl.shadowMap.autoUpdate = false
  gl.setClearColor('#000000', 0)
  gl.setRenderTarget(target)
  gl.clear()
  gl.render(scene, camera)
  gl.setRenderTarget(before)
  gl.setClearColor(clear, alpha)
  gl.shadowMap.autoUpdate = shadows
  return {
    texture: target.texture,
    cells,
    dispose: () => {
      target.dispose()
      for (const m of extra) m.dispose()
    },
  }
}

const VERTEX_HEAD = /* glsl */ `
attribute vec4 aPos;  // feet x, y, z, figure height
attribute vec4 aInfo; // seed, side, angle round the stadium, 1 when the arms move
attribute vec4 aLook; // hue turn, saturation, brightness, mirror (1 / -1)
attribute vec2 aCell; // first idle cell, first pose cell
uniform float uTime;
uniform vec2 uHype;
uniform vec2 uArms;
uniform vec2 uJump;
uniform vec2 uBoo;
uniform vec2 uClap;
uniform vec2 uClapHit;
uniform vec2 uPump;
uniform float uGasp;
uniform float uWave;
uniform float uWaveAt;
varying vec4 vLook;
`

const VERTEX_MOVE = /* glsl */ `
{
  float seed = aInfo.x;
  float side = aInfo.y;
  float poseable = aInfo.w;
  float ph = seed * 6.2831;
  // how much this fan joins in: a few hardly move
  float keen = 0.25 + 0.75 * fract(seed * 7.31);
  float hype = mix(uHype.x, uHype.y, side) * keen;
  // each fan's arms go all the way up once the cheer is loud enough for them (no half-raised arms)
  float th = 0.75 * (1.0 - keen);
  float arms = smoothstep(th, th + 0.12, mix(uArms.x, uArms.y, side));
  float jump = mix(uJump.x, uJump.y, side) * keen;
  float boo = mix(uBoo.x, uBoo.y, side) * keen;
  float clap = mix(uClap.x, uClap.y, side) * keen;
  float hit = mix(uClapHit.x, uClapHit.y, side);
  float pump = mix(uPump.x, uPump.y, side);
  float gasp = uGasp * keen;
  // the wave's crest passing this fan
  float d = abs(mod(aInfo.z - uWaveAt + 3.14159, 6.28318) - 3.14159);
  float wave = uWave * exp(-d * d * 30.0);
  float t = uTime * (0.8 + 0.4 * fract(seed * 3.7)) + ph;
  float wav = sin(t * 6.0);
  float up = clamp(arms + wave, 0.0, 1.0);

  // pose: 0 standing, 1 arms up, 2 hands together, 3 one arm waving
  float pose = 0.0;
  if (hype > 0.45 && sin(t * 1.7) > 0.2) pose = 3.0;
  if (clap > 0.4) pose = hit > 0.35 ? 2.0 : 0.0;
  if (clap > 0.4 && pump > 0.5) pose = 1.0;
  if (up > 0.5) pose = 1.0;
  if (boo > 0.5 || gasp > 0.5) pose = 0.0;
  if (poseable < 0.5) pose = 0.0;
  // fans who cannot lift their arms show it with their whole body instead
  float lift = (1.0 - poseable) * (up * 0.5 + clap * hit * 0.25);

  // where the fan stands and how big, with the stadium's own scale
  vec3 feet = (modelMatrix * vec4(aPos.xyz, 1.0)).xyz;
  float h = aPos.w * length(modelMatrix[0].xyz);
  float cell = h / ${FIGURE.toFixed(2)};
  // a card that turns round its upright axis to face the camera
  vec3 toCam = cameraPosition - feet;
  toCam.y = 0.0;
  vec3 f = normalize(toCam + vec3(1e-4, 0.0, 0.0));
  vec3 right = vec3(f.z, 0.0, -f.x);
  // which view: the fan faces the field (give or take a glance); seen from aside, the three-quarter view
  float look = atan(-feet.x, -feet.z) + (fract(seed * 13.7) - 0.5) * 0.7;
  vec3 facing = vec3(sin(look), 0.0, cos(look));
  float across = dot(facing, right);
  float view = abs(across) > 0.3 ? 1.0 : 0.0;
  float mirror = view > 0.5 ? sign(across) : aLook.w;

  // jumps, sways and leans
  float hop = jump * abs(sin(t * 4.5)) * 0.12 + wave * 0.1 + hype * 0.015 * max(0.0, wav) + lift * abs(sin(t * 5.0)) * 0.12
    + boo * 0.01 * abs(sin(uTime * 7.0 + ph));
  float tilt = 0.05 * hype * sin(t * 2.0) + 0.05 * boo * sin(uTime * 14.0 + ph) - 0.06 * gasp * aLook.w;
  float stretch = 1.0 + 0.04 * up * (1.0 - poseable) - 0.03 * gasp;
  vec2 q = vec2(position.x, (position.y - ${FEET.toFixed(2)}) * stretch);
  q = vec2(q.x * cos(tilt) - q.y * sin(tilt), q.x * sin(tilt) + q.y * cos(tilt));
  vec3 world = feet + right * q.x * cell + vec3(0.0, (q.y + hop * ${FIGURE.toFixed(2)}) * cell, 0.0);
  mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;

  // the atlas cell for this pose and view
  float index = pose < 0.5 ? aCell.x + view : aCell.y + (pose - 1.0) * 2.0 + view;
  vec2 corner = vec2(mod(index, ${COLS.toFixed(1)}), floor(index / ${COLS.toFixed(1)}));
  vec2 inCell = vec2(mirror < 0.0 ? 1.0 - uv.x : uv.x, uv.y);
  vMapUv = (corner + inCell) / vec2(${COLS.toFixed(1)}, ${ROWS.toFixed(1)});
  vLook = aLook;
}
`

const FRAGMENT_HEAD = /* glsl */ `
varying vec4 vLook;
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
`

const FRAGMENT_TINT = /* glsl */ `
#include <map_fragment>
{
  // each fan's own colours: clothes and hair turn round the colour wheel, skin stays skin
  vec3 hsv = rgb2hsv(pow(max(diffuseColor.rgb, 0.0), vec3(1.0 / 2.2)));
  float skin = (1.0 - smoothstep(0.1, 0.13, hsv.x)) * smoothstep(0.0, 0.025, hsv.x)
    * (1.0 - smoothstep(0.55, 0.7, hsv.y)) * smoothstep(0.3, 0.45, hsv.z);
  float turn = vLook.x * (1.0 - skin) * smoothstep(0.12, 0.3, hsv.y);
  hsv.x = fract(hsv.x + turn);
  // some fans wear colour where the brawler wears white or grey
  float dye = step(2.0, vLook.y);
  float pale = (1.0 - smoothstep(0.08, 0.2, hsv.y)) * smoothstep(0.35, 0.6, hsv.z) * (1.0 - skin) * dye;
  hsv.x = mix(hsv.x, vLook.x, pale);
  hsv.y = mix(clamp(hsv.y * mix(vLook.y - 2.0 * dye, 1.0, skin), 0.0, 1.0), 0.5, pale);
  diffuseColor.rgb = pow(hsv2rgb(hsv), vec3(2.2)) * vLook.z;
}
`

/** The fans' material: the atlas on camera-facing cards, moved and coloured per fan in its shaders. */
function crowdMaterial(map: THREE.Texture) {
  const uniforms = {
    uTime: { value: 0 },
    uHype: { value: new THREE.Vector2() },
    uArms: { value: new THREE.Vector2() },
    uJump: { value: new THREE.Vector2() },
    uBoo: { value: new THREE.Vector2() },
    uClap: { value: new THREE.Vector2() },
    uClapHit: { value: new THREE.Vector2() },
    uPump: { value: new THREE.Vector2() },
    uGasp: { value: 0 },
    uWave: { value: 0 },
    uWaveAt: { value: 0 },
  }
  const m = new THREE.MeshBasicMaterial({ map, alphaTest: 0.45, side: THREE.DoubleSide })
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${VERTEX_HEAD}`)
      .replace('#include <project_vertex>', `vec4 mvPosition;\n${VERTEX_MOVE}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAGMENT_HEAD}`)
      .replace('#include <map_fragment>', FRAGMENT_TINT)
  }
  m.userData.uniforms = uniforms
  return m
}

/** The fans in the stands: one instanced draw of camera-facing cards, posed in the vertex shader. */
export function Crowd({ seats, levels }: { seats: Seat[]; levels: React.RefObject<CrowdLevels> }) {
  const gl = useThree((s) => s.gl)
  const gltfs = useGLTF(URLS)
  // the atlas is drawn on the first frame the models are in (and let go with the stands)
  const [atlas, setAtlas] = useState<Atlas | null>(null)
  const made = useRef<Atlas | null>(null)
  useFrame(() => {
    if (made.current) return
    made.current = buildAtlas(
      gl,
      gltfs.map((g) => g.scene),
    )
    setAtlas(made.current)
  })
  useEffect(
    () => () => {
      made.current?.dispose()
      made.current = null
    },
    [],
  )

  const material = useMemo(() => (atlas ? crowdMaterial(atlas.texture) : null), [atlas])
  useEffect(() => () => material?.dispose(), [material])

  const geometry = useMemo(() => {
    if (!atlas) return null
    const plane = new THREE.PlaneGeometry(1, 2)
    plane.translate(0, 1, 0)
    const g = new THREE.InstancedBufferGeometry()
    g.index = plane.index
    g.setAttribute('position', plane.getAttribute('position'))
    g.setAttribute('uv', plane.getAttribute('uv'))
    g.setAttribute('normal', plane.getAttribute('normal'))
    const n = seats.length
    const pos = new Float32Array(n * 4)
    const info = new Float32Array(n * 4)
    const look = new Float32Array(n * 4)
    const cell = new Float32Array(n * 2)
    seats.forEach((s, i) => {
      const r = (k: number) => (Math.sin((s.seed + k) * 9187.13) * 43758.5453) % 1
      const pick = Math.floor(Math.abs(r(1)) * BRAWLERS.length)
      const [idle, poses] = atlas.cells[pick]
      const id = BRAWLERS[pick].id
      pos.set([s.x, s.y, s.z, s.size * (HEIGHT[id] ?? 1)], i * 4)
      info.set([s.seed, s.side, s.angle, poses >= 0 ? 1 : 0], i * 4)
      // a third keep their own colours; the rest wear something else
      const keep = Math.abs(r(2)) < 0.33
      const hue = keep ? 0 : Math.abs(r(3))
      // saturation (plus 2 when white clothes are dyed too), brightness, mirror image
      const sat = 0.8 + Math.abs(r(4)) * 0.4 + (!keep && Math.abs(r(7)) < 0.6 ? 2 : 0)
      look.set([hue, sat, 0.6 + Math.abs(r(5)) * 0.3, r(6) < 0 ? -1 : 1], i * 4)
      cell.set([idle, poses], i * 2)
    })
    g.setAttribute('aPos', new THREE.InstancedBufferAttribute(pos, 4))
    g.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 4))
    g.setAttribute('aLook', new THREE.InstancedBufferAttribute(look, 4))
    g.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 2))
    g.instanceCount = n
    plane.dispose()
    return g
  }, [seats, atlas])
  useEffect(() => () => geometry?.dispose(), [geometry])

  const mesh = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const l = levels.current
    const m = mesh.current
    if (!l || !m) return
    const u = (m.material as THREE.Material).userData.uniforms
    u.uTime.value = clock.elapsedTime
    u.uHype.value.set(...l.hype)
    u.uArms.value.set(...l.arms)
    u.uJump.value.set(...l.jump)
    u.uBoo.value.set(...l.boo)
    u.uClap.value.set(...l.clap)
    u.uClapHit.value.set(...l.clapHit)
    u.uPump.value.set(...l.pump)
    u.uGasp.value = l.gasp
    u.uWave.value = l.wave
    u.uWaveAt.value = l.waveAt
  })

  if (!geometry || !material) return null
  return <mesh ref={mesh} geometry={geometry} material={material} frustumCulled={false} />
}
