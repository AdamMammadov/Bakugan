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
      positions[i * 3 + 1] = (grounded ? 0.2 + seeds[i * 3 + 2] * 0.6 * (1 - lag / 0.35) : from.y + dir.y * kk + Math.sin(kk * Math.PI) * 0.6) + Math.sin(ang) * spread
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
        <meshBasicMaterial color={color} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ball} visible={false}>
        <sphereGeometry args={[0.6, 24, 16]} />
        <meshBasicMaterial color="#ffffff" transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <pointLight ref={light} color={color} intensity={0} distance={8} />
    </group>
  )
}

/** Translucent barrier shown while a fighter's shield is up. Flashes when it blocks. */
export function ShieldDome({ color, active, flashKey }: { color: string; active: boolean; flashKey: number }) {
  const ref = useRef<THREE.Group>(null)
  const scale = useRef(0)
  const lastFlash = useRef(flashKey)
  const flash = useRef(0)

  useFrame(({ clock }, dt) => {
    if (lastFlash.current !== flashKey) {
      lastFlash.current = flashKey
      flash.current = 1
    }
    flash.current = Math.max(0, flash.current - dt * 2)
    scale.current = THREE.MathUtils.damp(scale.current, active || flash.current > 0 ? 1 : 0.001, 8, dt)
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
    <group ref={ref} position={[0, 1.6, 0]} visible={false}>
      <mesh>
        <sphereGeometry args={[2.1, 32, 24]} />
        <meshBasicMaterial color={color} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[2.15, 2]} />
        <meshBasicMaterial color={color} wireframe transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}
