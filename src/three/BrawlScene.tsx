import { ContactShadows, Gltf, OrbitControls, Sparkles } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { type RefObject, Suspense, useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Ability, Bakugan } from '../data/bakugan'
import type { ElementInfo } from '../data/elements'
import { AbilityEffect } from './AbilityEffect'
import { BakuganBall } from './BakuganBall'
import { GateCard } from './GateCard'
import { LightPillar } from './LightPillar'
import { PlaceholderMonster } from './PlaceholderMonster'

export type Phase = 'ball' | 'gate' | 'brawling' | 'monster'

const BALL_REST = new THREE.Vector3(0, 0.5, 2.6)
const CARD_CENTER = new THREE.Vector3(0, 0.5, 0)

const CAMERA = {
  ball: { pos: new THREE.Vector3(0, 1.4, 5), target: new THREE.Vector3(0, 0.5, 2.6) },
  gate: { pos: new THREE.Vector3(0, 4.5, 8), target: new THREE.Vector3(0, 0.3, 1) },
  monster: { pos: new THREE.Vector3(0, 3, 8.5), target: new THREE.Vector3(0, 1.6, 0) },
}

interface Props {
  bakugan: Bakugan
  element: ElementInfo
  phase: Phase
  activeAbility: { ability: Ability; key: number } | null
}

export function BrawlScene({ bakugan, element, phase, activeAbility }: Props) {
  // Clock time at which the brawl sequence started; drives the ball → monster timeline.
  const brawlStart = useRef<number | null>(null)
  useFrame(({ clock }) => {
    if (phase !== 'brawling') brawlStart.current = null
    else brawlStart.current ??= clock.elapsedTime
  })

  return (
    <>
      <color attach="background" args={['#05060a']} />
      <fog attach="fog" args={['#05060a', 12, 30]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 8, 5]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} />
      <pointLight position={[-4, 3, -3]} intensity={30} color={element.glow} />
      <pointLight position={[0, 2, 6]} intensity={8} color="#ffffff" />

      <Field color={element.color} />
      <Sparkles count={80} scale={[16, 6, 16]} position={[0, 3, 0]} size={2} speed={0.3} color={element.glow} />

      <Suspense fallback={null}>
        {phase !== 'ball' && <GateCard icon={element.icon} color={element.color} />}
      </Suspense>

      <BallActor bakugan={bakugan} color={element.color} phase={phase} brawlStart={brawlStart} />
      {phase === 'brawling' && <LightPillar color={element.glow} />}
      {(phase === 'monster' || phase === 'brawling') && (
        <MonsterActor bakugan={bakugan} element={element} phase={phase} brawlStart={brawlStart} />
      )}

      {activeAbility && (
        <AbilityEffect
          key={activeAbility.key}
          effect={activeAbility.ability.effect}
          color={element.color}
          glow={element.glow}
        />
      )}

      <ContactShadows position={[0, 0.001, 0]} opacity={0.6} scale={20} blur={2.5} far={6} />
      <CameraRig phase={phase} />

      <EffectComposer multisampling={0}>
        <Bloom luminanceThreshold={0.9} intensity={1.2} mipmapBlur />
        <Vignette offset={0.25} darkness={0.75} />
      </EffectComposer>
    </>
  )
}

function Field({ color }: { color: string }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[14, 64]} />
        <meshStandardMaterial color="#0b0c12" metalness={0.3} roughness={0.8} />
      </mesh>
      {[3.5, 7, 10.5].map((r) => (
        <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.003, 0]}>
          <ringGeometry args={[r, r + 0.03, 96]} />
          <meshBasicMaterial color={color} transparent opacity={0.35} />
        </mesh>
      ))}
    </group>
  )
}

/** Brawl timeline in seconds. */
const T = { roll: 0.6, open: 0.9, swap: 1.4, grown: 2.1 }

function elapsed(brawlStart: RefObject<number | null>, now: number) {
  return brawlStart.current === null ? 0 : now - brawlStart.current
}

function BallActor({ bakugan, color, phase, brawlStart }: { bakugan: Bakugan; color: string; phase: Phase; brawlStart: RefObject<number | null> }) {
  const ref = useRef<THREE.Group>(null)
  const open = useRef(false)

  useFrame(({ clock }, dt) => {
    const g = ref.current
    if (!g) return
    const t = elapsed(brawlStart, clock.elapsedTime)
    if (phase === 'brawling') {
      const k = Math.min(t / T.roll, 1)
      g.position.lerpVectors(BALL_REST, CARD_CENTER, k)
      g.position.y += Math.sin(k * Math.PI) * 1.2
      g.rotation.x = -k * Math.PI * 4
      if (k >= 1) g.rotation.x = 0
      open.current = t > T.open
      g.visible = t < T.swap
    } else {
      g.position.copy(BALL_REST)
      g.position.y += Math.sin(clock.elapsedTime * 2) * 0.04
      g.rotation.y += dt * 0.3
      g.rotation.x = 0
      open.current = false
      g.visible = phase !== 'monster'
    }
  })

  return (
    <group ref={ref}>
      {bakugan.models?.ball ? (
        <Suspense fallback={null}>
          <Gltf src={bakugan.models.ball} castShadow />
        </Suspense>
      ) : (
        <BakuganBall color={color} openRef={open} />
      )}
    </group>
  )
}

function MonsterActor({ bakugan, element, phase, brawlStart }: { bakugan: Bakugan; element: ElementInfo; phase: Phase; brawlStart: RefObject<number | null> }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = elapsed(brawlStart, clock.elapsedTime)
    const k = phase === 'monster' ? 1 : THREE.MathUtils.clamp((t - T.swap) / (T.grown - T.swap), 0, 1)
    const eased = 1 - Math.pow(1 - k, 3)
    // Never scale to exactly 0: a singular matrix yields NaN normals, which bloom smears over the whole frame.
    ref.current.scale.setScalar(Math.max(eased, 0.001))
    ref.current.visible = k > 0
  })
  return (
    <group ref={ref} scale={0.001} visible={false}>
      {bakugan.models?.monster ? (
        <Suspense fallback={null}>
          <Gltf src={bakugan.models.monster} castShadow />
        </Suspense>
      ) : (
        <PlaceholderMonster color={element.color} glow={element.glow} />
      )}
    </group>
  )
}

/** Flies the camera to a preset when the phase changes, then hands control back to the user. */
function CameraRig({ phase }: { phase: Phase }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const { camera } = useThree()
  const flying = useRef(0)
  const preset = phase === 'brawling' || phase === 'monster' ? CAMERA.monster : phase === 'gate' ? CAMERA.gate : CAMERA.ball

  useEffect(() => {
    flying.current = 1.4
  }, [preset])

  useFrame((_, dt) => {
    const c = controls.current
    if (!c || flying.current <= 0) return
    flying.current -= dt
    camera.position.lerp(preset.pos, 1 - Math.exp(-4 * dt))
    c.target.lerp(preset.target, 1 - Math.exp(-4 * dt))
    c.update()
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      minDistance={1.2}
      maxDistance={14}
      maxPolarAngle={Math.PI / 2 - 0.05}
      onStart={() => (flying.current = 0)}
    />
  )
}
