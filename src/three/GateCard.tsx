import { useTexture } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

const W = 2.2
const H = 3.0

/**
 * A Gate Card that spins down from above and lands flat on the field. `glow` scales how brightly its border and
 * emblem shine (1 = full glow, as in the viewer; the arena turns it down so the Bakugan on it stay clear).
 */
export function GateCard({ icon, color, glow = 1 }: { icon: string; color: string; glow?: number }) {
  const ref = useRef<THREE.Group>(null)
  const t = useRef(0)
  const texture = useTexture(icon)
  texture.colorSpace = THREE.SRGBColorSpace

  useFrame((_, dt) => {
    t.current = Math.min(t.current + dt / 0.9, 1)
    const k = 1 - Math.pow(1 - t.current, 3)
    if (!ref.current) return
    ref.current.position.y = THREE.MathUtils.lerp(6, 0.02, k)
    ref.current.rotation.y = (1 - k) * Math.PI * 4
    ref.current.rotation.x = -Math.PI / 2 + (1 - k) * 0.8
  })

  return (
    <group ref={ref} position={[0, 6, 0]}>
      <mesh receiveShadow>
        <boxGeometry args={[W, H, 0.03]} />
        <meshStandardMaterial color="#0c0d12" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* glowing border */}
      <mesh position={[0, 0, 0.017]}>
        <planeGeometry args={[W - 0.08, H - 0.08]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4 * glow} toneMapped={glow < 1} />
      </mesh>
      <mesh position={[0, 0, 0.018]}>
        <planeGeometry args={[W - 0.24, H - 0.24]} />
        <meshStandardMaterial color="#111219" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.019]}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshBasicMaterial
          map={texture}
          transparent
          color={new THREE.Color().setScalar(glow >= 1 ? 1 : glow * 0.45)}
          opacity={glow >= 1 ? 1 : 0.55 + glow}
          toneMapped={glow < 1}
        />
      </mesh>
    </group>
  )
}
