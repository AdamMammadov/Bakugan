import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { listenStadium, type CrowdMood } from './stadium'

/** The light towers stand on this circle (the stadium's own units), this high. */
const TOWER_R = 158
const TOWER_H = 85
const TOWERS = 8
/** Fireworks fountains round the edge of the field. */
const FIELD_R = 96
const FOUNTAINS = 6
const SPARKS = 900
/** Big moments: how strongly each crowd reaction lights the arena up and fires the fountains. */
const MOMENT: Partial<Record<CrowdMood, number>> = { roar: 1, chant: 0.8, cheer: 0.55, gasp: 0.35 }

const BEAM_VERTEX = /* glsl */ `
varying float vH;
varying vec3 vN;
varying vec3 vV;
void main() {
  vH = uv.y;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`
const BEAM_FRAGMENT = /* glsl */ `
varying float vH;
varying vec3 vN;
varying vec3 vV;
uniform vec3 uColor;
uniform float uStrength;
void main() {
  // bright at the lamp, fading towards the field; soft at the beam's edges
  float along = pow(vH, 1.6);
  float edge = pow(abs(dot(normalize(vN), vV)), 1.5);
  float a = along * edge * uStrength;
  if (a < 0.003) discard;
  gl_FragColor = vec4(uColor * uColor * a * 1.4, a);
}
`

/**
 * Show lights: beams from the light towers sweeping the field and the stands in the two brawlers' colours, brighter as
 * the crowd gets going, and fountains of sparks round the field that fire on the big moments (the crowd roaring,
 * chanting or cheering), on the side whose fans lead it. Lives in the stadium's own units.
 */
export function ArenaLights({ colors }: { colors: [string, string] }) {
  const beams = useRef<THREE.Group>(null)
  const heat = useRef(0)
  const mats = useMemo(
    () =>
      Array.from(
        { length: TOWERS },
        (_, i) =>
          new THREE.ShaderMaterial({
            vertexShader: BEAM_VERTEX,
            fragmentShader: BEAM_FRAGMENT,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending,
            uniforms: { uColor: { value: new THREE.Color(colors[i % 2]) }, uStrength: { value: 0.2 } },
          }),
      ),
    // the colours are set every frame below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  // a cone from the lamp (its tip, uv.y = 1) to the floor (uv.y = 0), one unit long, pointing down -y
  const cone = useMemo(() => {
    const g = new THREE.CylinderGeometry(0.06, 1, 1, 32, 1, true)
    g.translate(0, -0.5, 0)
    return g
  }, [])
  useEffect(
    () => () => {
      cone.dispose()
      mats.forEach((m) => m.dispose())
    },
    [cone, mats],
  )

  // ---- the sparks: one point cloud for every fountain
  const spark = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const pos = new Float32Array(SPARKS * 3)
    const col = new Float32Array(SPARKS * 3)
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const vel = new Float32Array(SPARKS * 3)
    const life = new Float32Array(SPARKS)
    const m = new THREE.PointsMaterial({
      size: 1.4,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    })
    return { g, pos, col, vel, life, m, next: 0 }
  }, [])
  useEffect(
    () => () => {
      spark.g.dispose()
      spark.m.dispose()
    },
    [spark],
  )

  // the crowd's big moments fire the fountains and light the beams up
  const queue = useRef<{ side: number | null; amount: number }[]>([])
  useEffect(
    () =>
      listenStadium((call) => {
        if (call.kind !== 'crowd') return
        const amount = MOMENT[call.mood]
        if (amount) queue.current.push({ side: call.side ?? null, amount })
      }),
    [],
  )

  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), down: new THREE.Vector3(0, -1, 0), d: new THREE.Vector3() }), [])
  const fire = (side: number | null, amount: number) => {
    const n = Math.round(260 * amount)
    const c0 = new THREE.Color('#ffb347')
    const c1 = new THREE.Color(side === null ? '#ffffff' : colors[side])
    for (let k = 0; k < n; k++) {
      // the fountains on the side whose fans lead the moment (all of them for both sides)
      const f = Math.floor(Math.random() * FOUNTAINS)
      const half = side === null ? true : (f < FOUNTAINS / 2 ? 0 : 1) === side
      const fi = half ? f : (f + FOUNTAINS / 2) % FOUNTAINS
      const angle = ((fi + 0.5) / FOUNTAINS) * Math.PI - Math.PI / 2 + (fi >= FOUNTAINS / 2 ? Math.PI : 0)
      const i = spark.next
      spark.next = (spark.next + 1) % SPARKS
      spark.pos[i * 3] = Math.sin(angle) * FIELD_R
      spark.pos[i * 3 + 1] = 1
      spark.pos[i * 3 + 2] = Math.cos(angle) * FIELD_R
      const sp = 0.6 + Math.random() * 0.4
      spark.vel[i * 3] = (Math.random() - 0.5) * 9
      spark.vel[i * 3 + 1] = (34 + Math.random() * 26) * sp
      spark.vel[i * 3 + 2] = (Math.random() - 0.5) * 9
      spark.life[i] = 1.1 + Math.random() * 0.8
      const c = Math.random() < 0.6 ? c0 : c1
      spark.col[i * 3] = c.r
      spark.col[i * 3 + 1] = c.g
      spark.col[i * 3 + 2] = c.b
    }
    heat.current = Math.min(1.4, heat.current + amount)
  }

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    for (const m of queue.current.splice(0)) fire(m.side, m.amount)
    heat.current = Math.max(0, heat.current - dt * 0.35)

    // ---- the beams: each sweeps its own slow figure over the field and the near stands
    const g = beams.current
    if (g)
      g.children.forEach((beam, i) => {
        const angle = ((i + 0.5) / TOWERS) * Math.PI * 2 - Math.PI
        const from = new THREE.Vector3(Math.sin(angle) * TOWER_R, TOWER_H, Math.cos(angle) * TOWER_R)
        const r = 20 + 50 * (0.5 + 0.5 * Math.sin(t * 0.21 + i * 1.7))
        const a = t * (i % 2 ? 0.17 : -0.13) + i * 0.8
        const to = new THREE.Vector3(Math.sin(a) * r, 0, Math.cos(a) * r)
        const d = tmp.d.subVectors(to, from)
        const len = d.length()
        beam.position.copy(from)
        tmp.q.setFromUnitVectors(tmp.down, d.normalize())
        beam.quaternion.copy(tmp.q)
        beam.scale.set(5.5 + 3 * heat.current, len, 5.5 + 3 * heat.current)
        const mat = mats[i]
        mat.uniforms.uColor.value.set(colors[i % 2])
        mat.uniforms.uStrength.value = 0.06 + 0.16 * heat.current + 0.015 * Math.sin(t * 2 + i)
      })

    // ---- the sparks fly up, slow, fall and fade
    let live = false
    for (let i = 0; i < SPARKS; i++) {
      if (spark.life[i] <= 0) continue
      live = true
      spark.life[i] -= dt
      spark.vel[i * 3 + 1] -= 46 * dt
      spark.pos[i * 3] += spark.vel[i * 3] * dt
      spark.pos[i * 3 + 1] += spark.vel[i * 3 + 1] * dt
      spark.pos[i * 3 + 2] += spark.vel[i * 3 + 2] * dt
      if (spark.life[i] <= 0 || spark.pos[i * 3 + 1] < 0) {
        spark.life[i] = 0
        spark.pos[i * 3 + 1] = -999
      }
      const k = Math.min(1, Math.max(0, spark.life[i]))
      spark.col[i * 3] *= 0.985 + 0.015 * k
      spark.col[i * 3 + 1] *= 0.975 + 0.025 * k
      spark.col[i * 3 + 2] *= 0.97 + 0.03 * k
    }
    if (live) {
      spark.g.attributes.position.needsUpdate = true
      spark.g.attributes.color.needsUpdate = true
    }
  })

  return (
    <group>
      <group ref={beams}>
        {mats.map((m, i) => (
          <mesh key={i} geometry={cone} material={m} renderOrder={3} frustumCulled={false} />
        ))}
      </group>
      <points geometry={spark.g} material={spark.m} frustumCulled={false} />
    </group>
  )
}
