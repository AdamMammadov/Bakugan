import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { poseWeight, type PoseRef } from './pose'

/**
 * Stand-in creature used until a real monster .glb is provided. It reacts to the
 * fighter's pose: lunges with jaws open and claws forward, raises its arms to cast,
 * and recoils when hit.
 */
export function PlaceholderMonster({ color, glow, poseRef }: { color: string; glow: string; poseRef?: PoseRef }) {
  const leftWing = useRef<THREE.Group>(null)
  const rightWing = useRef<THREE.Group>(null)
  const leftArm = useRef<THREE.Group>(null)
  const rightArm = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const jaw = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const pose = poseRef?.current ?? null
    const attack = poseWeight(pose, 'lunge', t, 0.7)
    const cast = poseWeight(pose, 'cast', t, 1.0)
    const hit = poseWeight(pose, 'hit', t, 0.45, 0.75)

    const flap = 0.15 + Math.sin(t * (2.2 + attack * 6)) * 0.3 + attack * 0.4 + cast * 0.6 - hit * 0.4
    if (leftWing.current) leftWing.current.rotation.z = -flap
    if (rightWing.current) rightWing.current.rotation.z = flap

    const armSwing = -0.3 - attack * 1.6 - cast * 2.4
    for (const [arm, side] of [
      [leftArm, -1],
      [rightArm, 1],
    ] as const) {
      if (!arm.current) continue
      arm.current.rotation.x = armSwing + Math.sin(t * 1.6 + side) * 0.05
      arm.current.rotation.z = side * (0.4 + cast * 0.5)
    }

    if (head.current) {
      head.current.rotation.x = 0.1 + attack * 0.35 - cast * 0.45 - hit * 0.5
      head.current.position.z = 0.45 + attack * 0.35
    }
    if (jaw.current) jaw.current.rotation.x = 0.05 + attack * 0.7 + cast * 0.4 + hit * 0.3
    if (body.current) {
      body.current.position.y = Math.sin(t * 1.6) * 0.05 + cast * 0.15
      body.current.rotation.x = attack * 0.15 - hit * 0.2
    }
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
      {/* neck */}
      <mesh position={[0, 2.25, 0.25]} rotation={[0.5, 0, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.22, 0.5, 16]} />
        {skin}
      </mesh>
      {/* head: skull + hinged jaw */}
      <group ref={head} position={[0, 2.55, 0.45]}>
        <mesh castShadow>
          <boxGeometry args={[0.42, 0.3, 0.6]} />
          {skin}
        </mesh>
        <mesh position={[0, 0.0, 0.4]} castShadow>
          <boxGeometry args={[0.3, 0.12, 0.35]} />
          {skin}
        </mesh>
        <group ref={jaw} position={[0, -0.13, 0.05]}>
          <mesh position={[0, -0.04, 0.3]} castShadow>
            <boxGeometry args={[0.28, 0.08, 0.55]} />
            {dark}
          </mesh>
        </group>
        {/* glowing mouth, visible when the jaw opens */}
        <mesh position={[0, -0.1, 0.38]}>
          <boxGeometry args={[0.2, 0.04, 0.3]} />
          <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={3} toneMapped={false} />
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
      {/* arms, pivoting at the shoulders, with claws */}
      {(
        [
          [leftArm, -1],
          [rightArm, 1],
        ] as const
      ).map(([ref, side]) => (
        <group key={side} ref={ref} position={[side * 0.5, 1.75, 0.15]}>
          <mesh position={[0, -0.35, 0]} castShadow>
            <capsuleGeometry args={[0.11, 0.6, 6, 12]} />
            {skin}
          </mesh>
          {[-0.06, 0, 0.06].map((cx) => (
            <mesh key={cx} position={[cx, -0.78, 0.04]} rotation={[0.3, 0, 0]} castShadow>
              <coneGeometry args={[0.03, 0.16, 6]} />
              {dark}
            </mesh>
          ))}
        </group>
      ))}
      {/* tail */}
      <mesh position={[0, 0.7, -0.6]} rotation={[-1.1, 0, 0]} castShadow>
        <coneGeometry args={[0.18, 1.2, 12]} />
        {skin}
      </mesh>
    </group>
  )
}
