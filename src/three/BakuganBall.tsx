import { useFrame } from '@react-three/fiber'
import { type RefObject, useRef } from 'react'
import * as THREE from 'three'

/**
 * Procedural placeholder for a Bakugan in ball form: two hemispheres
 * that swing open while `openRef.current` is true.
 */
export function BakuganBall({ color, openRef }: { color: string; openRef: RefObject<boolean> }) {
  const top = useRef<THREE.Group>(null)
  const bottom = useRef<THREE.Group>(null)

  useFrame((_, dt) => {
    const target = openRef.current ? 1.9 : 0
    for (const [ref, sign] of [
      [top, -1],
      [bottom, 1],
    ] as const) {
      if (!ref.current) continue
      ref.current.rotation.x = THREE.MathUtils.damp(ref.current.rotation.x, sign * target, 6, dt)
    }
  })

  return (
    <group>
      {/* hinge sits at the back of the ball */}
      <group position={[0, 0, -0.5]}>
        <group ref={top}>
          <Shell color={color} upper />
        </group>
        <group ref={bottom}>
          <Shell color={color} upper={false} />
        </group>
      </group>
    </group>
  )
}

function Shell({ color, upper }: { color: string; upper: boolean }) {
  const thetaStart = upper ? 0 : Math.PI / 2
  return (
    <group position={[0, 0, 0.5]}>
      <mesh castShadow>
        <sphereGeometry args={[0.5, 48, 24, 0, Math.PI * 2, thetaStart, Math.PI / 2]} />
        <meshStandardMaterial color={color} metalness={0.55} roughness={0.25} side={THREE.DoubleSide} />
      </mesh>
      {/* panel grooves */}
      {[0.18, 0.36].map((y) => (
        <mesh key={y} position={[0, upper ? y : -y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[Math.sqrt(0.25 - y * y) + 0.003, 0.012, 8, 64]} />
          <meshStandardMaterial color="#111" metalness={0.8} roughness={0.4} />
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.5, 0.025, 12, 64]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.3} />
      </mesh>
    </group>
  )
}
