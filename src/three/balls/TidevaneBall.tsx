import { useFrame } from '@react-three/fiber'
import { type RefObject, useRef } from 'react'
import * as THREE from 'three'
import { R } from './shell'

const NAVY = { color: '#0b2152', metalness: 0.4, roughness: 0.3 }
const STEEL = { color: '#7f9fbd', metalness: 0.7, roughness: 0.25 }
const GOLD = { color: '#d9a640', metalness: 0.85, roughness: 0.28 }
const TIDE = { color: '#5fe6ff', emissive: '#22c8ff', emissiveIntensity: 1.6, toneMapped: false }

/**
 * Tidevane in ball form (an original design, like Tidevane): a deep navy top dotted with pale spots and a blue-steel
 * bottom split by glowing tide-lines, with a golden trident on its front whose prongs burn blue. Swings open at the
 * back like the plain ball while `openRef` is true.
 */
export function TidevaneBall({ openRef }: { openRef: RefObject<boolean> }) {
  const top = useRef<THREE.Group>(null)
  const bottom = useRef<THREE.Group>(null)
  const flames = useRef<THREE.Group>(null)

  useFrame(({ clock }, dt) => {
    const target = openRef.current ? 1.9 : 0
    for (const [ref, sign] of [
      [top, -1],
      [bottom, 1],
    ] as const) {
      if (ref.current) ref.current.rotation.x = THREE.MathUtils.damp(ref.current.rotation.x, sign * target, 6, dt)
    }
    // the blue flames on the prongs flicker
    if (flames.current) flames.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 8) * 0.08)
  })

  return (
    <group position={[0, 0, -R]}>
      <group ref={top}>
        <group position={[0, 0, R]}>
          <Half upper />
          {/* the golden trident on the front, leaning out with the shell */}
          <group position={[0, 0.2, 0.44]} rotation={[0.55, 0, 0]}>
            <mesh position={[0, -0.03, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 0.14, 8]} />
              <meshStandardMaterial {...GOLD} />
            </mesh>
            <mesh position={[0, 0.04, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.01, 0.01, 0.12, 8]} />
              <meshStandardMaterial {...GOLD} />
            </mesh>
            {[-0.055, 0, 0.055].map((x) => (
              <mesh key={x} position={[x, x ? 0.075 : 0.085, 0]}>
                <coneGeometry args={[0.013, x ? 0.07 : 0.09, 8]} />
                <meshStandardMaterial {...GOLD} />
              </mesh>
            ))}
            <group ref={flames}>
              {[-0.055, 0, 0.055].map((x) => (
                <mesh key={x} position={[x, x ? 0.12 : 0.14, 0]}>
                  <sphereGeometry args={[0.018, 12, 8]} />
                  <meshStandardMaterial {...TIDE} />
                </mesh>
              ))}
            </group>
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

/** Pale spots scattered over the top (fixed, so every ball looks alike). */
const SPOTS = Array.from({ length: 26 }, (_, i) => {
  const a = i * 2.39996
  const h = 0.12 + ((i * 0.618) % 1) * 0.8
  return { a, h }
})

function Half({ upper }: { upper: boolean }) {
  const s = upper ? 1 : -1
  return (
    <group>
      <mesh castShadow>
        <sphereGeometry args={[R, 48, 24, 0, Math.PI * 2, upper ? 0 : Math.PI / 2, Math.PI / 2]} />
        <meshStandardMaterial {...(upper ? NAVY : STEEL)} side={THREE.DoubleSide} />
      </mesh>
      {upper &&
        SPOTS.map(({ a, h }, i) => {
          const y = h * R
          const r = Math.sqrt(R * R - y * y)
          return (
            <mesh key={i} position={[Math.sin(a) * r, y, Math.cos(a) * r]}>
              <sphereGeometry args={[0.014, 8, 6]} />
              <meshStandardMaterial color="#cdeeff" emissive="#7fd8ff" emissiveIntensity={0.5} />
            </mesh>
          )
        })}
      {/* segment lines: steel grooves on the navy top, glowing tide-lines on the steel bottom */}
      {[0.2, 0.37].map((y) => (
        <mesh key={y} position={[0, s * y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[Math.sqrt(R * R - y * y) + 0.003, upper ? 0.012 : 0.009, 8, 64]} />
          <meshStandardMaterial {...(upper ? STEEL : TIDE)} />
        </mesh>
      ))}
      {/* the rim where the halves meet, with a tide-line along it */}
      <mesh position={[0, s * 0.012, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[R, 0.022, 12, 64]} />
        <meshStandardMaterial {...STEEL} />
      </mesh>
      {!upper && (
        <mesh position={[0, -0.03, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[R - 0.004, 0.008, 8, 64]} />
          <meshStandardMaterial {...TIDE} />
        </mesh>
      )}
    </group>
  )
}
