import { ContactShadows, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useRef, useState } from 'react'
import * as THREE from 'three'
import { BAKUGAN } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { MonsterModel } from '../three/BakuganModels'
import { StageFit, type Sweep } from '../three/StageFit'
import { leadKey, saveLeadPicture } from './menuLead'

/** Tallest the saved picture is kept, in pixels. */
const PICTURE_H = 420

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

/** A dark disc with a glowing rim and a ring that pulses outwards a little. */
function Platform({ color, radius }: { color: string; radius: number }) {
  const pulse = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const m = pulse.current
    if (!m) return
    const t = (clock.elapsedTime * 0.45) % 1
    m.scale.setScalar(1 + t * 0.1)
    ;(m.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - t)
  })
  return (
    <group scale={radius}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1, 64]} />
        <meshStandardMaterial color="#0d0e15" emissive={color} emissiveIntensity={0.14} roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <ringGeometry args={[0.95, 1.01, 96]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh ref={pulse} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[0.98, 1.01, 96]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

/**
 * Says when the model is in and framed, then keeps a small picture of the stage for the next visit (drawn
 * straight after a render, so the canvas needs no preserved buffer).
 */
function Ready({
  target,
  fitKey,
  onReady,
}: {
  target: React.RefObject<THREE.Group | null>
  fitKey: string
  onReady: () => void
}) {
  const { gl, scene, camera } = useThree()
  const since = useRef<number | null>(null)
  const state = useRef<'wait' | 'shown' | 'saved'>('wait')
  useFrame(({ clock }) => {
    if (state.current === 'saved' || !target.current) return
    if (since.current === null) {
      let meshes = 0
      target.current.traverse((o) => void ((o as THREE.Mesh).isMesh && meshes++))
      if (meshes) since.current = clock.elapsedTime
      return
    }
    const t = clock.elapsedTime - since.current
    // StageFit eases the view in over half a second
    if (state.current === 'wait' && t > 0.7) {
      state.current = 'shown'
      onReady()
    }
    if (state.current === 'shown' && t > 1.4) {
      state.current = 'saved'
      gl.render(scene, camera)
      const src = gl.domElement
      const k = Math.min(1, PICTURE_H / src.height)
      const out = document.createElement('canvas')
      out.width = Math.round(src.width * k)
      out.height = Math.round(src.height * k)
      out.getContext('2d')?.drawImage(src, 0, 0, out.width, out.height)
      saveLeadPicture(fitKey, out.toDataURL('image/webp', 0.82))
    }
  })
  return null
}

/** Fits the model into the whole canvas (the menu's middle column), the stand included. */
function Fit({
  target,
  fitKey,
  onMeasure,
}: {
  target: React.RefObject<THREE.Group | null>
  fitKey: string
  onMeasure: (s: Sweep) => number
}) {
  const size = useThree((s) => s.size)
  return (
    <StageFit
      target={target}
      fitKey={fitKey}
      stage={{ x: 0, y: 0, w: size.width, h: size.height }}
      fill={0.94}
      onMeasure={(sweep) => ({ y: 0, radius: onMeasure(sweep) * 1.12 })}
    />
  )
}

/** The player's lead Bakugan on a glowing stand, turning slowly: the main menu's centrepiece. */
export default function MenuStage({ id, form, skin, onReady }: { id: string; form: number; skin?: string; onReady: () => void }) {
  const bakugan = BAKUGAN.find((b) => b.id === id) ?? BAKUGAN[0]
  const entrant = { bakugan, form, skin }
  const el = ELEMENT_BY_ID[bakugan.element]
  const key = leadKey(id, form, skin)
  const target = useRef<THREE.Group>(null)
  // the stand grows with the Bakugan (wide wings, long tails)
  const [radius, setRadius] = useState(2)
  const measure = (sweep: Sweep) => {
    const r = THREE.MathUtils.clamp(sweep.radius * 0.85, 1.1, 6)
    setRadius(r)
    return r
  }
  return (
    <Canvas camera={{ position: [0, 3, 12.5], fov: 30 }} dpr={[1, 1.75]} gl={{ alpha: true, antialias: true }}>
      <OrbitControls makeDefault enableRotate={false} enableZoom={false} enablePan={false} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 5, 4]} intensity={2.4} />
      <directionalLight position={[-4, 2, 2]} intensity={0.8} color={el.color} />
      <pointLight position={[0, 3, -3]} intensity={30} color={el.glow} />
      <group ref={target}>
        <Turntable speed={0.32}>
          <MonsterModel entrant={entrant} showcase />
        </Turntable>
      </group>
      <Fit target={target} fitKey={key} onMeasure={measure} />
      <Ready target={target} fitKey={key} onReady={onReady} />
      <Platform color={el.color} radius={radius} />
      <ContactShadows position={[0, 0.02, 0]} opacity={0.6} scale={radius * 3} blur={2.2} far={3} resolution={256} />
    </Canvas>
  )
}
