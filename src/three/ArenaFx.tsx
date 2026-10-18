import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { EffectPreset } from '../data/bakugan'

const TRAIL = 140

/**
 * A charged shot travelling from `from` to `to`, starting after `delay` seconds and
 * taking `travel` seconds. The look depends on the ability's effect preset.
 */
export function Projectile({
  from,
  to,
  preset,
  color,
  glow,
  delay = 0.25,
  travel = 0.5,
}: {
  from: THREE.Vector3
  to: THREE.Vector3
  preset: EffectPreset
  color: string
  glow: string
  delay?: number
  travel?: number
}) {
  const core = useRef<THREE.Mesh>(null)
  const trail = useRef<THREE.Points>(null)
  const beam = useRef<THREE.Mesh>(null)
  const t = useRef(0)
  const isBeam = preset === 'lightBeam'
  const grounded = preset === 'quake'
  const dark = preset === 'shadowOrb'
  const size = preset === 'fireball' || preset === 'waterSphere' || dark ? 0.45 : grounded ? 0.6 : 0.32

  const { positions, seeds } = useMemo(() => {
    const seeds = new Float32Array(TRAIL * 3)
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random()
    return { positions: new Float32Array(TRAIL * 3), seeds }
  }, [])

  const dir = useMemo(() => to.clone().sub(from), [from, to])
  const beamMid = useMemo(() => from.clone().add(to).multiplyScalar(0.5), [from, to])

  useFrame((_, dt) => {
    t.current += dt
    const k = THREE.MathUtils.clamp((t.current - delay) / travel, 0, 1)
    const live = t.current >= delay && t.current < delay + travel + 0.15

    if (beam.current) {
      beam.current.visible = live
      const mat = beam.current.material as THREE.MeshBasicMaterial
      mat.opacity = live ? 0.9 * (1 - Math.max(0, k - 0.6) / 0.4) : 0
      beam.current.scale.set(1 + Math.sin(t.current * 60) * 0.15, k, 1 + Math.sin(t.current * 60) * 0.15)
    }

    const head = from.clone().addScaledVector(dir, k)
    if (grounded) head.y = 0.35
    else head.y += Math.sin(k * Math.PI) * 0.6
    if (core.current) {
      core.current.visible = live && !isBeam && k < 1
      core.current.position.copy(head)
      core.current.rotation.z += dt * 12
    }

    for (let i = 0; i < TRAIL; i++) {
      const lag = seeds[i * 3] * 0.35
      const kk = Math.max(0, k - lag)
      const spread = (grounded ? 0.8 : 0.35) * (lag / 0.35 + 0.2)
      const ang = seeds[i * 3 + 1] * Math.PI * 2 + t.current * (preset === 'tornado' ? 18 : 4)
      positions[i * 3] = from.x + dir.x * kk + Math.cos(ang) * spread * 0.3
      positions[i * 3 + 1] =
        (grounded ? 0.2 + seeds[i * 3 + 2] * 0.6 * (1 - lag / 0.35) : from.y + dir.y * kk + Math.sin(kk * Math.PI) * 0.6) +
        Math.sin(ang) * spread
      positions[i * 3 + 2] = from.z + dir.z * kk + Math.sin(ang) * spread
    }
    if (trail.current) {
      trail.current.visible = live && !isBeam
      trail.current.geometry.attributes.position.needsUpdate = true
    }
  })

  return (
    <group>
      {isBeam && (
        <mesh
          ref={beam}
          position={beamMid}
          quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())}
          visible={false}
        >
          <cylinderGeometry args={[0.18, 0.18, dir.length(), 16, 1, true]} />
          <meshBasicMaterial color={glow} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      <mesh ref={core} visible={false}>
        <icosahedronGeometry args={[size, 1]} />
        <meshBasicMaterial color={dark ? '#1a0630' : glow} toneMapped={false} />
      </mesh>
      <points ref={trail} visible={false} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={grounded ? 0.28 : 0.2}
          color={dark ? '#5b2a99' : color}
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={dark ? THREE.NormalBlending : THREE.AdditiveBlending}
          toneMapped={false}
        />
      </points>
    </group>
  )
}

/** Shockwave + flash where a hit lands. */
export function Impact({ at, color, delay = 0.75 }: { at: THREE.Vector3; color: string; delay?: number }) {
  const ring = useRef<THREE.Mesh>(null)
  const ball = useRef<THREE.Mesh>(null)
  const light = useRef<THREE.PointLight>(null)
  const t = useRef(0)

  useFrame((_, dt) => {
    t.current += dt
    const k = (t.current - delay) / 0.5
    const live = k >= 0 && k <= 1
    const s = 0.2 + Math.max(k, 0) * 2.2
    for (const m of [ring.current, ball.current]) {
      if (!m) continue
      m.visible = live
      m.scale.setScalar(s)
      ;(m.material as THREE.MeshBasicMaterial).opacity = live ? 1 - k : 0
    }
    if (light.current) light.current.intensity = live ? (1 - k) * 60 : 0
  })

  return (
    <group position={at}>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.8, 1, 48]} />
        <meshBasicMaterial
          color={color}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={ball} visible={false}>
        <sphereGeometry args={[0.6, 24, 16]} />
        <meshBasicMaterial color="#ffffff" transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <pointLight ref={light} color={color} intensity={0} distance={8} />
    </group>
  )
}

/**
 * Translucent barrier shown while a fighter's shield is up: a bubble of radius 1, which the parent stretches round
 * the Bakugan. A new `flashKey` (a blocked hit) makes it flash `flashDelay` seconds later, when the hit lands.
 */
export function ShieldDome({
  color,
  active,
  flashKey,
  flashDelay = 0,
}: {
  color: string
  active: boolean
  /** Key of the last hit this shield blocked; 0 = none. */
  flashKey: number
  flashDelay?: number
}) {
  const ref = useRef<THREE.Group>(null)
  const scale = useRef(0)
  const lastFlash = useRef(flashKey)
  const flashAt = useRef<number | null>(null)
  const flash = useRef(0)

  useFrame(({ clock }, dt) => {
    const now = clock.elapsedTime
    // only a new block flashes: the key going back to 0 (the next action) must not bring a broken shield back
    if (lastFlash.current !== flashKey) {
      lastFlash.current = flashKey
      if (flashKey) flashAt.current = now + flashDelay
    }
    if (flashAt.current !== null && now >= flashAt.current) {
      flashAt.current = null
      flash.current = 1
    }
    flash.current = Math.max(0, flash.current - dt * 2)
    const on = active || flash.current > 0 || flashAt.current !== null
    scale.current = THREE.MathUtils.damp(scale.current, on ? 1 : 0.001, 8, dt)
    const g = ref.current
    if (!g) return
    g.visible = scale.current > 0.01
    g.scale.setScalar(Math.max(scale.current, 0.001) * (1 + flash.current * 0.15))
    g.rotation.y = clock.elapsedTime * 0.4
    const [shell, wire] = g.children as THREE.Mesh[]
    ;(shell.material as THREE.MeshBasicMaterial).opacity = 0.12 + flash.current * 0.5
    ;(wire.material as THREE.MeshBasicMaterial).opacity = 0.35 + flash.current * 0.6
  })

  return (
    <group ref={ref} visible={false}>
      <mesh>
        <sphereGeometry args={[1, 32, 24]} />
        <meshBasicMaterial color={color} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[1.02, 2]} />
        <meshBasicMaterial
          color={color}
          wireframe
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

/**
 * Chaos Magnalia: a dark orb gathers at the user's mouth, a thick Darkus beam (black core, violet glow) crosses
 * the field, and a pillar of darkness swallows the opponent where it lands. Hits at about `hitAt` seconds.
 */
export function ChaosBeam({
  from,
  to,
  size = 1,
  hitAt = 0.6,
}: {
  from: THREE.Vector3
  to: THREE.Vector3
  /** The user's size (a giant's beam and orb are thicker). */
  size?: number
  hitAt?: number
}) {
  const orb = useRef<THREE.Group>(null)
  const beam = useRef<THREE.Group>(null)
  const blast = useRef<THREE.Group>(null)
  const pillar = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const t = useRef(0)
  const { mid, length, turn } = useMemo(() => {
    const d = to.clone().sub(from)
    return {
      mid: from.clone().add(to).multiplyScalar(0.5),
      length: d.length(),
      turn: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()),
    }
  }, [from, to])
  const fade = (m: THREE.Object3D | null, o: number) =>
    m?.traverse((c) => {
      const mat = (c as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined
      if (mat) mat.opacity = o * (c.userData.o ?? 1)
    })

  useFrame(({ clock }, dt) => {
    t.current += dt
    const s = t.current
    const charge = THREE.MathUtils.smoothstep(s, 0, hitAt * 0.7)
    const reach = THREE.MathUtils.smoothstep(s, hitAt * 0.55, hitAt)
    const out = 1 - THREE.MathUtils.smoothstep(s, hitAt + 1.1, hitAt + 1.6)
    const wobble = 1 + Math.sin(clock.elapsedTime * 50) * 0.08
    if (orb.current) {
      orb.current.visible = s < hitAt + 1.6
      orb.current.scale.setScalar(Math.max(0.001, (0.4 + charge * 2.2) * size * wobble * out))
    }
    if (beam.current) {
      beam.current.visible = reach > 0 && out > 0
      // grows from the user to the opponent, then thins away
      beam.current.position.copy(from).addScaledVector(to.clone().sub(from), reach / 2)
      beam.current.scale.set(size * wobble * out, Math.max(0.001, reach), size * wobble * out)
    }
    // the pillar of darkness lingers over the fallen opponent
    const hit = THREE.MathUtils.clamp((s - hitAt) / 2.2, 0, 1)
    if (blast.current) {
      blast.current.visible = s >= hitAt && hit < 1
      blast.current.scale.setScalar(0.5 + Math.min(1, hit * 2) * 9)
      fade(blast.current, 1 - hit)
    }
    if (pillar.current) {
      pillar.current.visible = s >= hitAt && hit < 1
      pillar.current.scale.set(0.5 + Math.min(1, hit * 3) * 1.1, Math.min(1, hit * 6), 0.5 + Math.min(1, hit * 3) * 1.1)
      fade(pillar.current, 1 - hit)
    }
    if (light.current) light.current.intensity = s >= hitAt ? (1 - hit) * 400 : charge * 60
  })

  const glow = { transparent: true, depthWrite: false, toneMapped: false } as const
  return (
    <>
      <group ref={orb} position={from}>
        <mesh>
          <sphereGeometry args={[1, 24, 16]} />
          <meshBasicMaterial color="#12001c" {...glow} opacity={0.95} />
        </mesh>
        <mesh scale={1.35}>
          <sphereGeometry args={[1, 24, 16]} />
          <meshBasicMaterial color="#a23cff" {...glow} opacity={0.6} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
      <group ref={beam} quaternion={turn} position={mid} visible={false}>
        {/* a unit-long beam along y, scaled to the distance travelled */}
        <group scale={[1, length, 1]}>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[1.5, 1.5, 1, 24, 1, true]} />
            <meshBasicMaterial color="#12001c" {...glow} opacity={0.9} side={THREE.DoubleSide} />
          </mesh>
          <mesh>
            <cylinderGeometry args={[2.4, 2.4, 1, 24, 1, true]} />
            <meshBasicMaterial
              color="#9b35ff"
              {...glow}
              opacity={0.55}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.45, 0.45, 1, 12, 1, true]} />
            <meshBasicMaterial color="#e6c8ff" {...glow} opacity={0.9} blending={THREE.AdditiveBlending} />
          </mesh>
        </group>
      </group>
      <group ref={blast} position={to} visible={false}>
        <mesh userData={{ o: 0.9 }}>
          <sphereGeometry args={[1, 32, 20]} />
          <meshBasicMaterial color="#12001c" {...glow} />
        </mesh>
        <mesh scale={1.25} userData={{ o: 0.7 }}>
          <sphereGeometry args={[1, 32, 20]} />
          <meshBasicMaterial color="#a23cff" {...glow} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} scale={1.8} userData={{ o: 0.9 }}>
          <ringGeometry args={[0.8, 1, 64]} />
          <meshBasicMaterial color="#c77dff" {...glow} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* the pillar of darkness that swallows the opponent */}
      <group ref={pillar} position={[to.x, 0, to.z]} visible={false}>
        <mesh position={[0, 20, 0]} userData={{ o: 0.75 }}>
          <cylinderGeometry args={[6, 8, 40, 32, 1, true]} />
          <meshBasicMaterial color="#12001c" {...glow} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 20, 0]} userData={{ o: 0.5 }}>
          <cylinderGeometry args={[7.5, 9.5, 40, 32, 1, true]} />
          <meshBasicMaterial color="#8a2be2" {...glow} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
      </group>
      <pointLight position={to} color="#a23cff" intensity={0} distance={60} ref={light} />
    </>
  )
}
