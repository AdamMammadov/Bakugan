import { OrbitControls, Sparkles } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { BAKUGAN } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { BakuganBall } from '../three/BakuganBall'
import { MonsterModel } from '../three/BakuganModels'
import { LightPillar } from '../three/LightPillar'
import { StageFit } from '../three/StageFit'

/** When the ball opens, and when the Bakugan bursts out of it (seconds after the scene starts). */
const OPEN_AT = 1.4
const REVEAL_AT = 1.9

/** The part of the screen the Bakugan stands in: upper middle, above the title. */
function Fit({ target, fitKey }: { target: React.RefObject<THREE.Group | null>; fitKey: string }) {
  const size = useThree((s) => s.size)
  const stage = { x: size.width * 0.28, y: size.height * 0.08, w: size.width * 0.44, h: size.height * 0.56 }
  return <StageFit target={target} fitKey={fitKey} stage={stage} fill={0.96} />
}

/**
 * The title scene: a Bakugan ball drops in spinning, opens, and the Bakugan bursts out of it in a column of
 * light, then turns slowly. The model stays hidden (and unmeasured) until then, so the framing fits it at once.
 */
function Show({ id, form, skin, onReady }: { id: string; form: number; skin?: string; onReady: () => void }) {
  const bakugan = BAKUGAN.find((b) => b.id === id) ?? BAKUGAN[0]
  const el = ELEMENT_BY_ID[bakugan.element]
  const ball = useRef<THREE.Group>(null)
  const target = useRef<THREE.Group>(null)
  const turn = useRef<THREE.Group>(null)
  const open = useRef(false)
  const start = useRef<number | null>(null)
  const shownAt = useRef<number | null>(null)
  const [revealed, setRevealed] = useState(false)

  useFrame(({ clock }, dt) => {
    if (start.current === null) {
      start.current = clock.elapsedTime
      onReady()
    }
    const t = clock.elapsedTime - start.current
    const b = ball.current
    const m = target.current
    if (!b || !m) return

    // the ball drops in from above, spinning, and hovers
    const drop = Math.max(0, 1 - t / 0.9)
    b.position.y = 2.2 + drop * drop * 6 + Math.sin(t * 2.2) * 0.06
    b.rotation.y += dt * (open.current ? 1.2 : 5)
    if (t > OPEN_AT) open.current = true

    // out it comes once the ball has opened and the model is in (a slow download keeps the ball waiting, open)
    if (shownAt.current === null && t > REVEAL_AT) {
      let meshes = 0
      m.traverse((o) => void ((o as THREE.Mesh).isMesh && meshes++))
      if (meshes) {
        shownAt.current = t
        setRevealed(true)
      }
    }
    m.visible = shownAt.current !== null
    if (shownAt.current !== null) {
      const k = THREE.MathUtils.clamp((t - shownAt.current) / 0.35, 0, 1)
      b.scale.setScalar(Math.max(0.0001, 1.25 * (1 - k)))
    }
    if (turn.current) turn.current.rotation.y += dt * 0.35
  })

  return (
    <>
      <group ref={ball} scale={1.25}>
        <BakuganBall color={el.color} openRef={open} />
      </group>
      <group ref={target} visible={false}>
        <group ref={turn} rotation={[0, -0.6, 0]}>
          <MonsterModel entrant={{ bakugan, form, skin }} showcase />
        </group>
      </group>
      <Fit target={target} fitKey={`${id}-${form}-${skin ?? ''}`} />
      {revealed && <LightPillar color={el.glow} duration={1.4} />}
      <Sparkles count={70} scale={[9, 6, 4]} position={[0, 2.2, 0]} size={3.5} speed={0.35} color={el.glow} />
      <pointLight position={[0, 3, -3]} intensity={40} color={el.glow} />
      <directionalLight position={[-4, 2, 2]} intensity={0.9} color={el.color} />
    </>
  )
}

/** The camera starts looking at the ball; StageFit takes over once the Bakugan is out. */
function Start() {
  const camera = useThree((s) => s.camera)
  useEffect(() => camera.lookAt(0, 1.2, 0), [camera])
  return null
}

/** The title screen's 3D layer: the hero Bakugan bursting out of its ball. Loaded after the 2D title is up. */
export default function TitleStage(props: { id: string; form: number; skin?: string; onReady: () => void }) {
  return (
    <Canvas camera={{ position: [0, 2.6, 12], fov: 32 }} dpr={[1, 1.75]} gl={{ alpha: true, antialias: true }}>
      <OrbitControls makeDefault target={[0, 1.2, 0]} enableRotate={false} enableZoom={false} enablePan={false} />
      <Start />
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, 5, 4]} intensity={2.4} />
      <Show {...props} />
    </Canvas>
  )
}
