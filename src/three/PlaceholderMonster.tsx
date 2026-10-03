import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'

/** Stand-in creature used until a real monster .glb is provided. */
export function PlaceholderMonster({ color, glow }: { color: string; glow: string }) {
  const leftWing = useRef<THREE.Group>(null)
  const rightWing = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const flap = 0.15 + Math.sin(t * 2.2) * 0.3
    if (leftWing.current) leftWing.current.rotation.z = -flap
    if (rightWing.current) rightWing.current.rotation.z = flap
    if (body.current) body.current.position.y = Math.sin(t * 1.6) * 0.05
  })

  const skin = <meshStandardMaterial color={color} metalness={0.4} roughness={0.35} />
  const dark = <meshStandardMaterial color="#1b1b22" metalness={0.6} roughness={0.4} />

  return (
    <group ref={body}>
      {/* torso */}
      <mesh position={[0, 1.4, 0]} castShadow>
        <capsuleGeometry args={[0.45, 0.9, 8, 24]} />
        {skin}
      </mesh>
      {/* chest plate */}
      <mesh position={[0, 1.5, 0.36]} castShadow>
        <boxGeometry args={[0.5, 0.6, 0.15]} />
        {dark}
      </mesh>
      {/* neck + head */}
      <mesh position={[0, 2.25, 0.25]} rotation={[0.5, 0, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.22, 0.5, 16]} />
        {skin}
      </mesh>
      <group position={[0, 2.55, 0.45]}>
        <mesh castShadow>
          <boxGeometry args={[0.42, 0.34, 0.6]} />
          {skin}
        </mesh>
        <mesh position={[0, -0.08, 0.4]} castShadow>
          <boxGeometry args={[0.3, 0.16, 0.35]} />
          {skin}
        </mesh>
        {[-0.13, 0.13].map((x) => (
          <mesh key={x} position={[x, 0.06, 0.3]}>
            <sphereGeometry args={[0.05, 12, 12]} />
            <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={4} toneMapped={false} />
          </mesh>
        ))}
        {[-0.15, 0.15].map((x) => (
          <mesh key={x} position={[x, 0.25, -0.2]} rotation={[-0.7, 0, x > 0 ? -0.3 : 0.3]} castShadow>
            <coneGeometry args={[0.06, 0.4, 8]} />
            {dark}
          </mesh>
        ))}
      </group>
      {/* wings, pivoting at the shoulders */}
      {(
        [
          [leftWing, -1],
          [rightWing, 1],
        ] as const
      ).map(([ref, side]) => (
        <group key={side} ref={ref} position={[side * 0.3, 1.85, -0.35]}>
          <mesh position={[side * 0.9, 0, 0]} castShadow>
            <boxGeometry args={[1.8, 0.05, 0.9]} />
            <meshStandardMaterial color={color} metalness={0.3} roughness={0.5} transparent opacity={0.9} />
          </mesh>
        </group>
      ))}
      {/* legs */}
      {[-0.28, 0.28].map((x) => (
        <mesh key={x} position={[x, 0.45, 0]} castShadow>
          <capsuleGeometry args={[0.16, 0.6, 6, 12]} />
          {skin}
        </mesh>
      ))}
      {/* arms */}
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, 1.45, 0.15]} rotation={[0.4, 0, x > 0 ? 0.4 : -0.4]} castShadow>
          <capsuleGeometry args={[0.11, 0.6, 6, 12]} />
          {skin}
        </mesh>
      ))}
      {/* tail */}
      <mesh position={[0, 0.7, -0.6]} rotation={[-1.1, 0, 0]} castShadow>
        <coneGeometry args={[0.18, 1.2, 12]} />
        {skin}
      </mesh>
    </group>
  )
}
