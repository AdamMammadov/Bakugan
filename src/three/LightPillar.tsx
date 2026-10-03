import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

/** The column of light that hides the ball-to-monster swap. Plays once over `duration` seconds. */
export function LightPillar({ color, duration = 1.6 }: { color: string; duration?: number }) {
  const ref = useRef<THREE.Group>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const ring = useRef<THREE.Mesh>(null)
  const t = useRef(0)

  useFrame((_, dt) => {
    t.current += dt / duration
    const p = Math.min(t.current, 1)
    // grow fast, hold, fade
    const grow = THREE.MathUtils.clamp(p / 0.25, 0.001, 1)
    const fade = p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4
    if (ref.current) ref.current.scale.set(0.2 + grow * 0.8 * fade + 0.2, grow, 0.2 + grow * 0.8 * fade + 0.2)
    if (mat.current) mat.current.opacity = fade * 0.85
    if (ring.current) {
      const s = 1 + p * 6
      ring.current.scale.set(s, s, s)
      ;(ring.current.material as THREE.MeshBasicMaterial).opacity = (1 - p) * 0.9
    }
  })

  return (
    <group>
      <group ref={ref}>
        <mesh position={[0, 6, 0]}>
          <cylinderGeometry args={[1.1, 1.4, 12, 32, 1, true]} />
          <meshBasicMaterial
            ref={mat}
            color={color}
            transparent
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.5, 0.65, 64]} />
        <meshBasicMaterial color={color} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}
