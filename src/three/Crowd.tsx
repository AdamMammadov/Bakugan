import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** One spectator's place in the stands. */
export interface Seat {
  x: number
  y: number
  z: number
  /** Height (world units). */
  size: number
  /** 0–1, varies how each fan moves. */
  seed: number
  /** Whose fan (0 = the player's side). */
  side: number
  /** How much of the shirt is in their side's colour (0–1). */
  team: number
  /** Angle round the stadium, for the wave. */
  angle: number
  shirt: THREE.Color
  skin: THREE.Color
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
  colors: [THREE.Color, THREE.Color]
}

/**
 * A low-poly person 1.52 tall facing +Z: legs, body, head, and two arms that hang from the shoulders. Indexed, so
 * each corner is shaded once (about 110 vertices a fan).
 */
function personGeometry() {
  const part = (g: THREE.BufferGeometry, at: [number, number, number], arm: number, head: number) => {
    g.deleteAttribute('uv')
    g.translate(...at)
    const n = g.getAttribute('position').count
    g.setAttribute('aArm', new THREE.Float32BufferAttribute(new Float32Array(n).fill(arm), 1))
    g.setAttribute('aHead', new THREE.Float32BufferAttribute(new Float32Array(n).fill(head), 1))
    return g
  }
  // the head: a round twenty-sided ball, its corners shared
  const head = new THREE.IcosahedronGeometry(0.2, 0)
  head.deleteAttribute('uv')
  const pos = head.getAttribute('position')
  const normal = head.getAttribute('normal')
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i).normalize()
    normal.setXYZ(i, v.x, v.y, v.z)
  }
  const ball = mergeVertices(head)
  return mergeGeometries([
    part(new THREE.BoxGeometry(0.4, 0.55, 0.24), [0, 0.275, 0], 0, 0),
    part(new THREE.BoxGeometry(0.56, 0.6, 0.3), [0, 0.85, 0], 0, 0),
    part(ball, [0, 1.34, 0], 0, 1),
    part(new THREE.BoxGeometry(0.14, 0.56, 0.14), [-0.35, 0.8, 0], -1, 0),
    part(new THREE.BoxGeometry(0.14, 0.56, 0.14), [0.35, 0.8, 0], 1, 0),
  ])!
}

const VERTEX_HEAD = /* glsl */ `
attribute vec4 aInfo; // seed, side, team share, angle round the stadium
attribute vec3 aSkin;
attribute float aArm; // -1 left arm, 1 right arm
attribute float aHead;
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
uniform vec3 uSide0;
uniform vec3 uSide1;
`

const VERTEX_MOVE = /* glsl */ `
vec3 transformed = vec3(position);
{
  float seed = aInfo.x;
  float side = aInfo.y;
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
  float d = abs(mod(aInfo.w - uWaveAt + 3.14159, 6.28318) - 3.14159);
  float wave = uWave * exp(-d * d * 30.0);
  float t = uTime * (0.8 + 0.4 * fract(seed * 3.7)) + ph;
  float wav = sin(t * 6.0 + aArm * 1.3);
  // arm angles: out to the side (0 hangs down, 2.6 overhead) and forward
  float up = clamp(arms + wave, 0.0, 1.0);
  float sideA = mix(0.12 + hype * 0.3 * (0.5 + 0.5 * wav), 2.55 + 0.3 * wav, up);
  float fwdA = 0.25 * hype * (0.5 + 0.5 * wav) * (1.0 - up);
  sideA = mix(sideA, 0.15, boo);
  fwdA = mix(fwdA, 1.0 + 0.35 * sin(uTime * 7.0 + ph), boo);
  sideA = mix(sideA, mix(0.45 - 0.5 * hit, 0.25, pump), clap);
  fwdA = mix(fwdA, mix(1.3, 2.75, pump), clap);
  sideA = mix(sideA, 0.15, gasp);
  fwdA = mix(fwdA, 2.3, gasp);
  if (aArm != 0.0) {
    vec3 s = vec3(0.35 * aArm, 1.08, 0.0);
    vec3 q = transformed - s;
    float a = sideA * aArm;
    q.xy = vec2(q.x * cos(a) - q.y * sin(a), q.x * sin(a) + q.y * cos(a));
    q.yz = vec2(q.y * cos(fwdA) + q.z * sin(fwdA), -q.y * sin(fwdA) + q.z * cos(fwdA));
    transformed = s + q;
  }
  // sway, lean back in a gasp, jump
  transformed.x += transformed.y * 0.07 * hype * sin(t * 2.0);
  transformed.z -= transformed.y * 0.15 * gasp;
  transformed.y += jump * abs(sin(t * 4.5)) * 0.5 + wave * 0.35 + hype * 0.06 * max(0.0, wav) + boo * 0.05 * abs(sin(uTime * 7.0 + ph));
}
`

const COLOR = /* glsl */ `
#include <color_vertex>
vColor.rgb = mix(mix(vColor.rgb, mix(uSide0, uSide1, aInfo.y), aInfo.z), aSkin, aHead);
`

/** The fans in the stands: one instanced mesh, posed in the vertex shader (no work per fan on the CPU). */
export function Crowd({ seats, levels }: { seats: Seat[]; levels: React.RefObject<CrowdLevels> }) {
  const mesh = useRef<THREE.InstancedMesh>(null)
  const { geometry, material } = useMemo(() => {
    const geometry = personGeometry()
    const n = seats.length
    const info = new Float32Array(n * 4)
    const skin = new Float32Array(n * 3)
    seats.forEach((s, i) => {
      info.set([s.seed, s.side, s.team, s.angle], i * 4)
      skin.set([s.skin.r, s.skin.g, s.skin.b], i * 3)
    })
    geometry.setAttribute('aInfo', new THREE.InstancedBufferAttribute(info, 4))
    geometry.setAttribute('aSkin', new THREE.InstancedBufferAttribute(skin, 3))
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
      uSide0: { value: new THREE.Color() },
      uSide1: { value: new THREE.Color() },
    }
    const material = new THREE.MeshLambertMaterial({ color: '#ffffff' })
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms)
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${VERTEX_HEAD}`)
        .replace('#include <begin_vertex>', VERTEX_MOVE)
        .replace('#include <color_vertex>', COLOR)
      // fans glow a little in their own colours, so the stands read even where the lights don't reach
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.22;',
      )
    }
    material.userData.uniforms = uniforms
    return { geometry, material }
  }, [seats])

  useEffect(() => {
    const m = mesh.current
    if (!m) return
    const o = new THREE.Object3D()
    seats.forEach((s, i) => {
      o.position.set(s.x, s.y, s.z)
      // face the middle of the field
      o.rotation.set(0, Math.atan2(-s.x, -s.z), 0)
      o.scale.setScalar(s.size / 1.52)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, s.shirt)
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [seats])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame(({ clock }) => {
    const m = mesh.current
    const l = levels.current
    if (!m || !l) return
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
    u.uSide0.value.copy(l.colors[0])
    u.uSide1.value.copy(l.colors[1])
  })

  return <instancedMesh ref={mesh} args={[geometry, material, seats.length]} frustumCulled={false} />
}
