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
  /**
   * A neighbour this fan chats with now and then: [shared timing 0–1, which way the neighbour sits (1: further
   * round the stadium, -1: back), 1 when paired].
   */
  chat?: [number, number, number]
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
  /** The other side's fans holding their heads. */
  dismay: [number, number]
  /** How tense the battle is (close clashes build it up): fans stand, lean in, clap along. */
  tension: number
  /** Cameras going off round the stands (big moments). */
  flash: number
  /** Phones held up with their lights on. */
  lights: number
}

/**
 * The fans are impostors: the game's own brawler models, drawn once at load time into an atlas (front and
 * three-quarter views; brawlers with movable arms also cheering, clapping and waving), then shown as camera-facing
 * cards, one instanced draw for the whole stadium. Each fan gets its own outfit and hair colours (a hue turn that
 * leaves skin alone), size, mirror image and way of moving.
 */
const COLS = 8
const ROWS = 5
const CELL_PX = 256
/** A cell is 1 × 2 atlas units; a standing figure fills this much of its height (room above for raised arms). */
const FIGURE = 1.5
const FEET = 0.04
/** Three-quarter views are turned this much. */
const QUARTER = 0.5
/** Extra poses, in this order, for brawlers whose arms move. */
const POSES = ['cheer', 'clap', 'wave', 'head'] as const
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
  // hands to the head (dismay, shock): elbows out, forearms up against the sides of the head
  head: [
    [-1.57, 0, 1.05],
    [-1.57, 0, 1.05],
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
  if (import.meta.env.DEV)
    // dev builds: the atlas as an image, to check the poses
    Object.assign(window, {
      __crowdAtlas: () => {
        const w = target.width
        const h = target.height
        const px = new Uint8Array(w * h * 4)
        gl.readRenderTargetPixels(target, 0, 0, w, h, px)
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const img = c.getContext('2d')!.createImageData(w, h)
        for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4)
        c.getContext('2d')!.putImageData(img, 0, 0)
        return c.toDataURL('image/png')
      },
    })
  return {
    texture: target.texture,
    cells,
    dispose: () => {
      target.dispose()
      for (const m of extra) m.dispose()
    },
  }
}

/** What every fan knows about the stands now (the same in the fans', the props' and the lights' shaders). */
const FAN_UNIFORMS = /* glsl */ `
uniform float uTime;
uniform vec2 uHype;
uniform vec2 uArms;
uniform vec2 uJump;
uniform vec2 uBoo;
uniform vec2 uClap;
uniform vec2 uClapHit;
uniform vec2 uPump;
uniform vec2 uDismay;
uniform float uGasp;
uniform float uWave;
uniform float uWaveAt;
uniform float uTension;
uniform float uFlash;
uniform float uLights;
`

/**
 * One fan's behaviour, from their seed and the stands' levels: each has their own rhythm, keenness and way of
 * cheering. Sizes are in figure heights; `pose` is 0 standing, 1 arms up, 2 hands together, 3 one arm up, 4 hands
 * on the head.
 */
const FAN_STATE = /* glsl */ `
float fanRand(float seed, float k) { return fract(sin((seed + k) * 91.345) * 47453.5453); }
vec2 fanTurn(vec2 q, float a) { return vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a)); }

struct Fan { float pose; float hop; float tilt; float sink; float stretch; float look; float raise; float excite; };

Fan fanState(vec4 info, vec3 chat) {
  Fan f;
  float seed = info.x;
  float side = info.y;
  float ph = seed * 6.2831;
  // how much this fan joins in: a few hardly move
  float keen = 0.25 + 0.75 * fract(seed * 7.31);
  float hype = mix(uHype.x, uHype.y, side) * keen;
  // each fan's arms go all the way up once the cheer is loud enough for them (no half-raised arms)
  float th = 0.75 * (1.0 - keen);
  float arms = smoothstep(th, th + 0.12, mix(uArms.x, uArms.y, side));
  float jump = mix(uJump.x, uJump.y, side) * keen;
  float boo = mix(uBoo.x, uBoo.y, side) * keen;
  float dth = 0.6 * (1.0 - keen);
  float dismay = smoothstep(dth, dth + 0.15, mix(uDismay.x, uDismay.y, side));
  float clap = mix(uClap.x, uClap.y, side) * keen;
  float hit = mix(uClapHit.x, uClapHit.y, side);
  float pump = mix(uPump.x, uPump.y, side);
  float gasp = uGasp * keen;
  // the wave's crest passing this fan
  float d = abs(mod(info.z - uWaveAt + 3.14159, 6.28318) - 3.14159);
  float wave = uWave * exp(-d * d * 30.0);
  float t = uTime * (0.8 + 0.4 * fanRand(seed, 1.0)) + ph;
  float tense = uTension * keen;
  float excite = clamp(hype * 1.2 + arms + jump + boo * 0.7 + dismay * 0.6 + gasp + clap * 0.8 + tense * 0.9, 0.0, 1.0);
  f.excite = excite;

  // about half sit while it is calm; each stands up at their own point as it heats up (and for the wave)
  float sitter = step(fanRand(seed, 2.0), 0.5);
  float standAt = 0.1 + 0.45 * fanRand(seed, 3.0);
  float standing = clamp(smoothstep(standAt, standAt + 0.2, excite) + wave * 1.5, 0.0, 1.0);
  f.sink = sitter * (1.0 - standing) * 0.26;

  // calm: a sway of their own, a glance round now and then, a chat with the neighbour, the odd stretch
  f.tilt = (0.012 + 0.03 * fanRand(seed, 4.0)) * sin(uTime * (0.5 + 0.9 * fanRand(seed, 5.0)) + ph);
  float g = sin(uTime * (0.08 + 0.1 * fanRand(seed, 6.0)) + ph * 3.0);
  f.look = step(0.75, abs(g)) * sign(g) * 0.9;
  float chatting = chat.z * step(0.45, sin(uTime * (0.1 + 0.05 * chat.x) + chat.x * 6.2831)) * (1.0 - excite);
  f.look = mix(f.look, chat.y * 1.1, chatting);
  f.tilt += chatting * chat.y * 0.035;
  f.hop = chatting * 0.008 * max(0.0, sin(uTime * 7.0 + ph));
  float st = fract(uTime / (24.0 + 30.0 * fanRand(seed, 7.0)) + fanRand(seed, 8.0));
  float stretching = (1.0 - smoothstep(0.05, 0.3, excite)) * step(st, 0.04) * step(0.45, fanRand(seed, 9.0)) * (1.0 - chatting);
  f.stretch = 1.0 + 0.035 * stretching;
  float pose = stretching > 0.5 ? 1.0 : 0.0;

  // cheering, each their own way: arms up, clapping, fist pumps, jumping, waving
  float kind = fanRand(seed, 10.0);
  float up = clamp(arms + wave, 0.0, 1.0);
  if (up > 0.5) {
    if (wave > 0.5 || kind < 0.25) pose = 1.0;
    else if (kind < 0.45) pose = sin(t * 14.0) > 0.0 ? 2.0 : 0.0;
    else if (kind < 0.65) {
      float beat = sin(t * 7.0);
      pose = beat > -0.1 ? 3.0 : 0.0;
      f.hop += 0.035 * max(0.0, beat);
    } else if (kind < 0.82) {
      pose = 1.0;
      f.hop += 0.09 * abs(sin(t * 4.5));
    } else {
      pose = 3.0;
      f.tilt += 0.07 * sin(t * 5.0);
    }
  } else if (hype > 0.45 && sin(t * 1.7) > 0.2) pose = 3.0;
  // a close clash: some clap along
  if (tense > 0.5 && up < 0.5 && kind > 0.3 && kind < 0.55) pose = sin(uTime * 9.0 + ph) > 0.2 ? 2.0 : 0.0;
  // the chant: hands together on the claps, fists up on the shout
  if (clap > 0.4) pose = hit > 0.35 ? 2.0 : (pump > 0.5 ? 1.0 : 0.0);
  // the side that just lost out: heads in hands, or a fist shaken in a boo
  if (dismay > 0.5) {
    pose = kind < 0.6 ? 4.0 : 0.0;
    f.tilt += 0.05 * sin(uTime * 3.0 + ph);
    f.sink += 0.02;
  }
  if (boo > 0.5) {
    pose = kind < 0.5 ? 3.0 : 0.0;
    f.tilt += 0.05 * sin(uTime * 14.0 + ph);
  }
  if (gasp > 0.5) pose = kind < 0.4 ? 4.0 : 0.0;
  f.pose = pose;
  f.hop += jump * abs(sin(t * 4.5)) * 0.12 + wave * 0.1 + boo * 0.01 * abs(sin(uTime * 7.0 + ph));
  f.tilt -= 0.06 * gasp * (fanRand(seed, 11.0) - 0.5);
  f.stretch *= 1.0 + 0.04 * up * (1.0 - info.w) - 0.03 * gasp;
  // fans who cannot lift their arms show it with their whole body
  f.hop += (1.0 - info.w) * (up * 0.5 + clap * hit * 0.25) * abs(sin(t * 5.0)) * 0.12;
  f.raise = clamp(up + hype * 0.8 + clap * 0.6 + tense * 0.4, 0.0, 1.0);
  return f;
}

// where a fan stands, how tall (world units) and the card's sideways direction (towards the view's right)
void fanFrame(vec4 pos, out vec3 feet, out float h, out vec3 toward, out vec3 right) {
  feet = (modelMatrix * vec4(pos.xyz, 1.0)).xyz;
  h = pos.w * length(modelMatrix[0].xyz);
  vec3 toCam = cameraPosition - feet;
  toCam.y = 0.0;
  toward = normalize(toCam + vec3(1e-4, 0.0, 0.0));
  right = vec3(toward.z, 0.0, -toward.x);
}
`

const VERTEX_HEAD = /* glsl */ `
attribute vec4 aPos;  // feet x, y, z, figure height
attribute vec4 aInfo; // seed, side, angle round the stadium, 1 when the arms move
attribute vec4 aLook; // hue turn, saturation, brightness, mirror (1 / -1)
attribute vec2 aCell; // first idle cell, first pose cell
attribute vec3 aChat; // the neighbour they chat with
attribute vec2 aProp; // what they hold up (0 sign, 1 flag, 2 scarf, 3 sign at the chest), 1 when they hold one
${FAN_UNIFORMS}
varying vec4 vLook;
${FAN_STATE}
`

const VERTEX_MOVE = /* glsl */ `
{
  Fan fan = fanState(aInfo, aChat);
  float seed = aInfo.x;
  float pose = aInfo.w < 0.5 ? 0.0 : fan.pose;
  // a sign or scarf goes up with both arms, a flag with one
  if (aProp.y > 0.5 && aInfo.w > 0.5 && fan.raise > 0.5 && aProp.x < 2.5) pose = abs(aProp.x - 1.0) < 0.5 ? 3.0 : 1.0;
  vec3 feet;
  float h;
  vec3 toward;
  vec3 right;
  fanFrame(aPos, feet, h, toward, right);
  float cell = h / ${FIGURE.toFixed(2)};
  // which view: the fan faces the field (give or take a glance or a word with the neighbour); seen from aside, the
  // three-quarter view
  float look = atan(-feet.x, -feet.z) + (fract(seed * 13.7) - 0.5) * 0.5 + fan.look;
  vec3 facing = vec3(sin(look), 0.0, cos(look));
  float across = dot(facing, right);
  float view = abs(across) > 0.3 ? 1.0 : 0.0;
  float mirror = view > 0.5 ? sign(across) : aLook.w;

  vec2 q = vec2(position.x, (position.y - ${FEET.toFixed(2)}) * fan.stretch);
  q = fanTurn(q, fan.tilt);
  vec3 world = feet + right * q.x * cell + vec3(0.0, q.y * cell + (fan.hop - fan.sink) * h, 0.0);
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

type Uniforms = Record<string, { value: number | THREE.Vector2 | THREE.Color }>

/** The uniforms every crowd shader shares (one set, updated once a frame). */
function crowdUniforms(): Uniforms {
  return {
    uTime: { value: 0 },
    uHype: { value: new THREE.Vector2() },
    uArms: { value: new THREE.Vector2() },
    uJump: { value: new THREE.Vector2() },
    uBoo: { value: new THREE.Vector2() },
    uClap: { value: new THREE.Vector2() },
    uClapHit: { value: new THREE.Vector2() },
    uPump: { value: new THREE.Vector2() },
    uDismay: { value: new THREE.Vector2() },
    uGasp: { value: 0 },
    uWave: { value: 0 },
    uWaveAt: { value: 0 },
    uTension: { value: 0 },
    uFlash: { value: 0 },
    uLights: { value: 0 },
    uSide0: { value: new THREE.Color() },
    uSide1: { value: new THREE.Color() },
  }
}

/** The fans' material: the atlas on camera-facing cards, moved and coloured per fan in its shaders. */
function crowdMaterial(map: THREE.Texture, uniforms: Uniforms) {
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

const PROP_VERTEX = /* glsl */ `
{
  Fan fan = fanState(aInfo, aChat);
  vec3 feet;
  float h;
  vec3 toward;
  vec3 right;
  fanFrame(aPos, feet, h, toward, right);
  float kind = aProp.x;
  float seed = aProp.y;
  float r = fan.raise;
  vec2 pos = position.xy;
  // each prop's size, the point it turns round (in its own units) and where that is held (figure heights)
  vec2 size;
  vec2 pivot;
  vec2 hold;
  float sway;
  if (kind < 0.5) {
    // a sign: held at the chest while it is calm, up over the head in a cheer
    size = vec2(0.56, 0.36);
    pivot = vec2(0.0, -0.5);
    hold = vec2(0.0, mix(0.42, 0.98, r));
    sway = 0.07 * sin(uTime * 4.0 + seed * 20.0) * r;
  } else if (kind < 1.5) {
    // a flag on a pole, brought out and waved in a cheer (harder the louder it gets); the cloth ripples
    size = vec2(0.62, 0.8) * smoothstep(0.25, 0.45, r);
    pivot = vec2(-0.5, -0.5);
    hold = vec2(0.16, mix(0.42, 0.72, r));
    sway = (0.12 + 0.4 * r) * sin(uTime * (1.6 + 2.4 * r) + seed * 20.0) - 0.1;
    float cloth = step(0.0, pos.y) * (pos.x + 0.5);
    pos.y += cloth * 0.07 * sin(pos.x * 9.0 - uTime * 9.0 + seed * 10.0);
  } else if (kind < 2.5) {
    // a scarf stretched out overhead, only in a cheer
    size = vec2(1.05, 0.15) * smoothstep(0.3, 0.5, r);
    pivot = vec2(0.0);
    hold = vec2(0.0, 1.1);
    pos.y += 0.3 * sin(pos.x * 7.0 - uTime * 8.0 + seed * 10.0) * r;
    sway = 0.05 * sin(uTime * 6.0 + seed * 20.0);
  } else {
    // a small sign at the chest, bobbing in a cheer
    size = vec2(0.5, 0.3);
    pivot = vec2(0.0);
    hold = vec2(0.0, 0.5 + 0.1 * r + 0.03 * sin(uTime * 6.0 + seed * 20.0) * r);
    sway = 0.0;
  }
  vec2 q = fanTurn((pos - pivot) * size, sway + fan.tilt) + hold;
  q.y *= fan.stretch;
  vec3 world = feet + right * q.x * h + vec3(0.0, (q.y + fan.hop - fan.sink) * h, 0.0) + toward * 0.12 * h;
  mvPosition = viewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  vPropUv = uv;
  vPropKind = kind;
  vPropSeed = seed;
  vPropColor = aInfo.y < 0.5 ? uSide0 : uSide1;
}
`

const PROP_FRAGMENT = /* glsl */ `
{
  vec2 p = vPropUv;
  vec3 col = vPropColor;
  if (vPropKind < 0.5 || vPropKind > 2.5) {
    // a board in the side's colour with a white edge, and white lettering or a big emblem
    float inner = step(0.07, p.x) * step(p.x, 0.93) * step(0.1, p.y) * step(p.y, 0.9);
    float mark;
    if (fract(vPropSeed * 3.1) < 0.35) {
      vec2 c = (p - 0.5) * vec2(1.6, 1.0);
      mark = step(length(c), 0.3) * (1.0 - step(length(c), 0.19)) + step(abs(p.y - 0.5), 0.04) * step(abs(p.x - 0.5), 0.17);
    } else {
      float row1 = step(abs(p.y - 0.63), 0.1) * step(0.16, p.x) * step(p.x, 0.84);
      float row2 = step(abs(p.y - 0.34), 0.08) * step(0.26, p.x) * step(p.x, 0.74);
      mark = (row1 + row2) * step(0.32, fract(p.x * (vPropSeed > 0.5 ? 6.0 : 8.0)));
    }
    col = mix(vec3(1.0), col, inner);
    col = mix(col, vec3(1.0), clamp(mark, 0.0, 1.0) * inner);
  } else if (vPropKind < 1.5) {
    float pole = step(p.x, 0.045);
    float cloth = step(0.52, p.y) * step(0.045, p.x);
    if (pole + cloth < 0.5) discard;
    float stripe = step(abs(p.y - 0.76 + (p.x - 0.5) * 0.3), 0.05);
    col = pole > 0.5 ? vec3(0.3) : mix(col, vec3(1.0), stripe);
  } else {
    // a scarf: the side's colour with white bands and fringed ends
    col = mix(col, vec3(1.0), step(0.5, fract(p.x * 5.0)) * step(abs(p.y - 0.5), 0.2));
    float ends = step(p.x, 0.05) + step(0.95, p.x);
    if (ends > 0.5 && fract(p.y * 6.0) < 0.5) discard;
  }
  diffuseColor.rgb = col * (0.55 + 0.25 * fract(vPropSeed * 7.7));
}
`

/** The props' material: camera-facing signs, flags and scarves held by the fans who have them. */
function propMaterial(uniforms: Uniforms) {
  const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec4 aPos;
        attribute vec4 aInfo;
        attribute vec3 aChat;
        attribute vec2 aProp;
        ${FAN_UNIFORMS}
        uniform vec3 uSide0;
        uniform vec3 uSide1;
        varying vec2 vPropUv;
        varying float vPropKind;
        varying float vPropSeed;
        varying vec3 vPropColor;
        ${FAN_STATE}`,
      )
      .replace('#include <project_vertex>', `vec4 mvPosition;\n${PROP_VERTEX}`)
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vPropUv;
        varying float vPropKind;
        varying float vPropSeed;
        varying vec3 vPropColor;`,
      )
      .replace('#include <map_fragment>', PROP_FRAGMENT)
  }
  return m
}

/** Phones held up with their lights on, and cameras going off: soft points of light at the fans' hands. */
function lightsMaterial(uniforms: Uniforms) {
  return new THREE.ShaderMaterial({
    uniforms: { ...uniforms, uPx: { value: 500 } },
    vertexShader: /* glsl */ `
      attribute vec4 aPos;
      attribute vec4 aInfo;
      attribute vec3 aChat;
      attribute vec2 aLight; // when this fan's phone comes up (0–1), own timing
      ${FAN_UNIFORMS}
      uniform float uPx;
      varying float vBright;
      varying float vFlash;
      ${FAN_STATE}
      void main() {
        Fan fan = fanState(aInfo, aChat);
        vec3 feet;
        float h;
        vec3 toward;
        vec3 right;
        fanFrame(aPos, feet, h, toward, right);
        float seed = aLight.y;
        float phone = smoothstep(aLight.x, aLight.x + 0.12, uLights) * (0.8 + 0.2 * sin(uTime * 2.0 + seed * 30.0));
        // a camera going off: a sharp pop now and then while the moment lasts
        float pop = uFlash * step(0.975, fract(uTime * (0.5 + seed) + seed * 7.0));
        vec3 world = feet + right * (seed - 0.5) * 0.4 * h + vec3(0.0, (1.02 + 0.03 * sin(uTime * 1.5 + seed * 9.0) + fan.hop - fan.sink) * h, 0.0)
          + toward * 0.2 * h;
        vec4 mv = viewMatrix * vec4(world, 1.0);
        gl_Position = projectionMatrix * mv;
        float size = pop > 0.0 ? 0.55 : 0.09;
        vBright = max(phone, pop);
        vFlash = pop > 0.0 ? 1.0 : 0.0;
        gl_PointSize = vBright > 0.01 ? clamp(size * h * uPx / max(1.0, -mv.z), 1.5, 64.0) : 0.0;
      }`,
    fragmentShader: /* glsl */ `
      varying float vBright;
      varying float vFlash;
      void main() {
        float d = length(gl_PointCoord * 2.0 - 1.0);
        float a = exp(-d * d * 5.0) * vBright;
        if (!(a >= 0.01)) discard;
        gl_FragColor = vec4(mix(vec3(0.85, 0.92, 1.0) * 1.6, vec3(4.0), vFlash), a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  })
}

/** The per-fan attributes the shaders read, for the seats in `pick` (all of them when left out). */
function fanAttributes(g: THREE.BufferGeometry, seats: Seat[], heights: number[], instanced: boolean) {
  const n = seats.length
  const pos = new Float32Array(n * 4)
  const info = new Float32Array(n * 4)
  const chat = new Float32Array(n * 3)
  seats.forEach((s, i) => {
    pos.set([s.x, s.y, s.z, heights[i]], i * 4)
    info.set([s.seed, s.side, s.angle, 0], i * 4)
    chat.set(s.chat ?? [0, 0, 0], i * 3)
  })
  const A = instanced ? THREE.InstancedBufferAttribute : THREE.BufferAttribute
  g.setAttribute('aPos', new A(pos, 4))
  g.setAttribute('aInfo', new A(info, 4))
  g.setAttribute('aChat', new A(chat, 3))
  return info
}

/** A fan's own random numbers (the same every time). */
const seatRand = (s: Seat, k: number) => Math.abs((Math.sin((s.seed + k) * 9187.13) * 43758.5453) % 1)

/**
 * The fans in the stands: one instanced draw of camera-facing cards, posed in the vertex shader; the signs, flags
 * and scarves some of them hold (one more draw); the phones and cameras (a third). `colors` are the two sides'.
 */
export function Crowd({
  seats,
  levels,
  colors,
}: {
  seats: Seat[]
  levels: React.RefObject<CrowdLevels>
  colors: [string, string]
}) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
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

  const uniforms = useMemo(() => crowdUniforms(), [])
  const material = useMemo(() => (atlas ? crowdMaterial(atlas.texture, uniforms) : null), [atlas, uniforms])
  useEffect(() => () => material?.dispose(), [material])
  const props = useMemo(() => propMaterial(uniforms), [uniforms])
  const lights = useMemo(() => lightsMaterial(uniforms), [uniforms])
  useEffect(
    () => () => {
      props.dispose()
      lights.dispose()
    },
    [props, lights],
  )

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
    const look = new Float32Array(n * 4)
    const cell = new Float32Array(n * 2)
    const prop = new Float32Array(n * 2)
    const heights: number[] = []
    // about half the fans are brawlers whose arms move (they cheer, clap, wave and hold their heads)
    const moving = atlas.cells.flatMap((c, i) => (c[1] >= 0 ? [i] : []))
    const poseable: boolean[] = []
    seats.forEach((s, i) => {
      const pick =
        moving.length && seatRand(s, 8) < 0.5
          ? moving[Math.floor(seatRand(s, 9) * moving.length)]
          : Math.floor(seatRand(s, 1) * BRAWLERS.length)
      const [idle, poses] = atlas.cells[pick]
      heights.push(s.size * (HEIGHT[BRAWLERS[pick].id] ?? 1))
      poseable.push(poses >= 0)
      // a third keep their own colours; the rest wear something else
      const keep = seatRand(s, 2) < 0.33
      const hue = keep ? 0 : seatRand(s, 3)
      // saturation (plus 2 when white clothes are dyed too), brightness, mirror image
      const sat = 0.8 + seatRand(s, 4) * 0.4 + (!keep && seatRand(s, 7) < 0.6 ? 2 : 0)
      look.set([hue, sat, 0.6 + seatRand(s, 5) * 0.3, Math.sin((s.seed + 6) * 9187.13) < 0 ? -1 : 1], i * 4)
      cell.set([idle, poses], i * 2)
      // some fans brought something to hold up
      if (seatRand(s, 11) < 0.14) {
        const k = seatRand(s, 12)
        prop.set([poses >= 0 ? (k < 0.45 ? 0 : k < 0.75 ? 1 : 2) : k < 0.6 ? 3 : 1, 1], i * 2)
      }
    })
    const info = fanAttributes(g, seats, heights, true)
    poseable.forEach((p, i) => (info[i * 4 + 3] = p ? 1 : 0))
    g.setAttribute('aLook', new THREE.InstancedBufferAttribute(look, 4))
    g.setAttribute('aCell', new THREE.InstancedBufferAttribute(cell, 2))
    g.setAttribute('aProp', new THREE.InstancedBufferAttribute(prop, 2))
    g.instanceCount = n
    plane.dispose()

    // the props: one card each for the fans who hold one
    const holders = seats.flatMap((_, i) => (prop[i * 2 + 1] ? [i] : []))
    const card = new THREE.PlaneGeometry(1, 1, 8, 4)
    const pg = new THREE.InstancedBufferGeometry()
    pg.index = card.index
    pg.setAttribute('position', card.getAttribute('position'))
    pg.setAttribute('uv', card.getAttribute('uv'))
    pg.setAttribute('normal', card.getAttribute('normal'))
    const pinfo = fanAttributes(
      pg,
      holders.map((i) => seats[i]),
      holders.map((i) => heights[i]),
      true,
    )
    holders.forEach((i, k) => (pinfo[k * 4 + 3] = poseable[i] ? 1 : 0))
    pg.setAttribute(
      'aProp',
      new THREE.InstancedBufferAttribute(Float32Array.from(holders.flatMap((i) => [prop[i * 2], seatRand(seats[i], 13)])), 2),
    )
    pg.instanceCount = holders.length
    card.dispose()

    // phones and cameras: a point for a third of the fans
    const owners = seats.flatMap((s, i) => (seatRand(s, 14) < 0.35 ? [i] : []))
    const lg = new THREE.BufferGeometry()
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(owners.length * 3), 3))
    fanAttributes(
      lg,
      owners.map((i) => seats[i]),
      owners.map((i) => heights[i]),
      false,
    )
    lg.setAttribute(
      'aLight',
      new THREE.BufferAttribute(
        Float32Array.from(owners.flatMap((i) => [seatRand(seats[i], 15) * 0.85, seatRand(seats[i], 16)])),
        2,
      ),
    )
    return { fans: g, props: pg, lights: lg }
  }, [seats, atlas])
  useEffect(
    () => () => {
      geometry?.fans.dispose()
      geometry?.props.dispose()
      geometry?.lights.dispose()
    },
    [geometry],
  )

  const [side0, side1] = colors
  const _size = useMemo(() => new THREE.Vector2(), [])
  useFrame(({ clock }) => {
    const l = levels.current
    if (!l) return
    const u = (mesh.current?.material as THREE.MeshBasicMaterial | undefined)?.userData.uniforms as Uniforms | undefined
    if (!u) return
    u.uTime.value = clock.elapsedTime
    ;(u.uHype.value as THREE.Vector2).set(...l.hype)
    ;(u.uArms.value as THREE.Vector2).set(...l.arms)
    ;(u.uJump.value as THREE.Vector2).set(...l.jump)
    ;(u.uBoo.value as THREE.Vector2).set(...l.boo)
    ;(u.uClap.value as THREE.Vector2).set(...l.clap)
    ;(u.uClapHit.value as THREE.Vector2).set(...l.clapHit)
    ;(u.uPump.value as THREE.Vector2).set(...l.pump)
    ;(u.uDismay.value as THREE.Vector2).set(...l.dismay)
    u.uGasp.value = l.gasp
    u.uWave.value = l.wave
    u.uWaveAt.value = l.waveAt
    u.uTension.value = l.tension
    u.uFlash.value = l.flash
    u.uLights.value = l.lights
    ;(u.uSide0.value as THREE.Color).set(side0)
    ;(u.uSide1.value as THREE.Color).set(side1)
    const pts = lightPoints.current
    if (pts) {
      const fov = (camera as THREE.PerspectiveCamera).fov ?? 50
      ;(pts.material as THREE.ShaderMaterial).uniforms.uPx.value =
        gl.getDrawingBufferSize(_size).y / (2 * Math.tan(THREE.MathUtils.degToRad(fov) / 2))
      pts.visible = l.lights > 0.01 || l.flash > 0.01
    }
  })
  const mesh = useRef<THREE.Mesh>(null)
  const lightPoints = useRef<THREE.Points>(null)

  if (!geometry || !material) return null
  return (
    <>
      <mesh ref={mesh} geometry={geometry.fans} material={material} frustumCulled={false} />
      <mesh geometry={geometry.props} material={props} frustumCulled={false} />
      <points ref={lightPoints} geometry={geometry.lights} material={lights} frustumCulled={false} visible={false} />
    </>
  )
}
