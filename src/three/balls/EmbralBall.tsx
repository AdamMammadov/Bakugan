import { useFrame } from '@react-three/fiber'
import { type RefObject, useRef } from 'react'
import * as THREE from 'three'
import { R } from './shell'

const RED = { color: '#8a1410', metalness: 0.45, roughness: 0.3 }
const OBSIDIAN = { color: '#151118', metalness: 0.6, roughness: 0.22 }
const LAVA = { color: '#ff8a1c', emissive: '#ff6a00', emissiveIntensity: 1.6, toneMapped: false }

/**
 * Embral in ball form (an original design, like Embral): a deep red top and an obsidian bottom split by glowing
 * lava seams, with a burning ember on its front. Swings open at the back like the plain ball while `openRef` is true.
 */
export function EmbralBall({ openRef }: { openRef: RefObject<boolean> }) {
  const top = useRef<THREE.Group>(null)
  const bottom = useRef<THREE.Group>(null)
  const ember = useRef<THREE.Group>(null)

  useFrame(({ clock }, dt) => {
    const target = openRef.current ? 1.9 : 0
    for (const [ref, sign] of [
      [top, -1],
      [bottom, 1],
    ] as const) {
      if (ref.current) ref.current.rotation.x = THREE.MathUtils.damp(ref.current.rotation.x, sign * target, 6, dt)
    }
    // the ember flickers
    if (ember.current) ember.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 9) * 0.06)
  })

  return (
    <group position={[0, 0, -R]}>
      <group ref={top}>
        <group position={[0, 0, R]}>
          <Half upper />
          {/* the ember on the front, leaning out from the shell */}
          <group position={[0, 0.2, 0.44]} rotation={[0.55, 0, 0]}>
            <group ref={ember}>
              <mesh position={[0, 0.05, 0]}>
                <coneGeometry args={[0.06, 0.16, 12]} />
                <meshStandardMaterial {...LAVA} />
              </mesh>
              <mesh position={[0, -0.03, 0]} scale={[1, 0.8, 1]}>
                <sphereGeometry args={[0.065, 16, 12]} />
                <meshStandardMaterial color="#ffd36b" emissive="#ffb020" emissiveIntensity={2} toneMapped={false} />
              </mesh>
            </group>
            {/* the obsidian setting round it */}
            <mesh position={[0, -0.01, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.1, 0.022, 10, 32]} />
              <meshStandardMaterial {...OBSIDIAN} />
            </mesh>
          </group>
        </group>
      </group>
      <group ref={bottom}>
        <group position={[0, 0, R]}>
          <Half upper={false} />
        </group>
      </group>
    </group>
  )
}

function Half({ upper }: { upper: boolean }) {
  const s = upper ? 1 : -1
  return (
    <group>
      <mesh castShadow>
        <sphereGeometry args={[R, 48, 24, 0, Math.PI * 2, upper ? 0 : Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial {...(upper ? RED : OBSIDIAN)} side={THREE.DoubleSide} />
      </mesh>
      {/* segment lines: black grooves on the red top, glowing seams on the obsidian bottom */}
      {[0.2, 0.37].map((y) => (
        <mesh key={y} position={[0, s * y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[Math.sqrt(R * R - y * y) + 0.003, upper ? 0.012 : 0.009, 8, 64]} />
          <meshStandardMaterial {...(upper ? OBSIDIAN : LAVA)} />
        </mesh>
      ))}
      {/* the rim where the halves meet, with a lava line along it */}
      <mesh position={[0, s * 0.012, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[R, 0.022, 12, 64]} />
        <meshStandardMaterial {...OBSIDIAN} />
      </mesh>
      {!upper && (
        <mesh position={[0, -0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[R - 0.004, 0.008, 8, 64]} />
          <meshStandardMaterial {...LAVA} />
        </mesh>
      )}
    </group>
  )
}
