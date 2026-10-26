import { ContactShadows } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { BAKUGAN, formModels } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { BakuganBall } from '../three/BakuganBall'
import { MonsterModel } from '../three/BakuganModels'

const CLOSED = { current: false }

/** Turns its contents slowly round, so the lights stay where they are. */
function Turntable({ speed, children }: { speed: number; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * speed
  })
  return (
    <group ref={ref} rotation={[0, -0.5, 0]}>
      {children}
    </group>
  )
}

/** A dark disc with a glowing rim and a ring that pulses outwards. */
function Platform({ color }: { color: string }) {
  const pulse = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const m = pulse.current
    if (!m) return
    const t = (clock.elapsedTime * 0.45) % 1
    m.scale.setScalar(1 + t * 0.7)
    ;(m.material as THREE.MeshBasicMaterial).opacity = 0.55 * (1 - t)
  })
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.15, 64]} />
        <meshStandardMaterial color="#0d0e15" emissive={color} emissiveIntensity={0.14} roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[2.05, 2.17, 96]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh ref={pulse} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[2.1, 2.15, 96]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** Points the camera at the middle of the Bakugan. */
function Aim({ y }: { y: number }) {
  const camera = useThree((s) => s.camera)
  useEffect(() => camera.lookAt(0, y, 0), [camera, y])
  return null
}

/** The player's lead Bakugan on a glowing stand, turning slowly: the main menu's centrepiece. */
export default function MenuStage({ id, form, skin }: { id: string; form: number; skin?: string }) {
  const bakugan = BAKUGAN.find((b) => b.id === id) ?? BAKUGAN[0]
  const entrant = { bakugan, form, skin }
  const el = ELEMENT_BY_ID[bakugan.element]
  // bigger evolved forms are shrunk back, so every lead fills the stage about the same
  const size = (1 + form * 0.12) * (formModels(entrant)?.scale ?? 1)
  return (
    <Canvas camera={{ position: [0, 2.6, 12.5], fov: 30 }} dpr={[1, 1.75]} gl={{ alpha: true, antialias: true }}>
      <Aim y={1.7} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 5, 4]} intensity={2.4} />
      <directionalLight position={[-4, 2, 2]} intensity={0.8} color={el.color} />
      <pointLight position={[0, 3, -3]} intensity={30} color={el.glow} />
      <Suspense
        fallback={
          <group position={[0, 0.8, 0]} scale={1.3}>
            <BakuganBall color={el.color} openRef={CLOSED} />
          </group>
        }
      >
        <group scale={1 / Math.max(1, size)}>
          <Turntable speed={0.32}>
            <MonsterModel entrant={entrant} showcase />
          </Turntable>
        </group>
      </Suspense>
      <Platform color={el.color} />
      <ContactShadows position={[0, 0.02, 0]} opacity={0.6} scale={7} blur={2.2} far={3} resolution={256} />
    </Canvas>
  )
}
