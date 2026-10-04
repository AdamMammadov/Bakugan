import { ContactShadows, OrbitControls, Sparkles } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { type RefObject, Suspense, useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { Ability, Bakugan } from '../data/bakugan'
import type { ElementInfo } from '../data/elements'
import { AbilityEffect } from './AbilityEffect'
import { BallModel, MonsterModel } from './BakuganModels'
import { GateCard } from './GateCard'
import { LightPillar } from './LightPillar'
import { moveFor, type Pose } from './pose'

export type Phase = 'ball' | 'gate' | 'brawling' | 'monster'

const BALL_REST = new THREE.Vector3(0, 0.5, 3.4)
/** Gate Card size in the viewer (the card model is 2.2 × 3). */
const GATE_SCALE = 3.2
const CARD_CENTER = new THREE.Vector3(0, 0.5, 0)

/** How much bigger the monster form is than in the old 30–40 cm scale: ~9 m next to a 1 m ball. */
export const MONSTER_SCALE = 4

const CAMERA = {
  ball: { pos: new THREE.Vector3(0, 1.4, 5.8), target: new THREE.Vector3(0, 0.5, 3.4) },
  gate: { pos: new THREE.Vector3(0, 10, 15), target: new THREE.Vector3(0, 0.3, 0.8) },
  monster: { pos: new THREE.Vector3(15, 9, 28), target: new THREE.Vector3(0, 5.6, 0) },
}

interface Props {
  bakugan: Bakugan
  element: ElementInfo
  phase: Phase
  /** Index of the evolution being shown. */
  form: number
  /** Show the ball in its opened pose while inspecting it. */
  ballOpen: boolean
  activeAbility: { ability: Ability; key: number } | null
}

export function BrawlScene({ bakugan, element, phase, form, ballOpen, activeAbility }: Props) {
  // Clock time at which the brawl sequence started; drives the ball → monster timeline.
  const brawlStart = useRef<number | null>(null)
  useFrame(({ clock }) => {
    if (phase !== 'brawling') brawlStart.current = null
    else brawlStart.current ??= clock.elapsedTime
  })

  return (
    <>
      <color attach="background" args={['#05060a']} />
      <fog attach="fog" args={['#05060a', 40, 90]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 8, 5]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} />
      <pointLight position={[-4, 3, -3]} intensity={30} color={element.glow} />
      <pointLight position={[0, 2, 6]} intensity={8} color="#ffffff" />

      <Field color={element.color} />
      <Sparkles count={160} scale={[30, 14, 30]} position={[0, 6, 0]} size={3} speed={0.3} color={element.glow} />

      <Suspense fallback={null}>
        {phase !== 'ball' && (
          // the field card is big enough for a ~9 m Bakugan to stand on
          <group scale={GATE_SCALE}>
            <GateCard icon={element.icon} color={element.color} />
          </group>
        )}
      </Suspense>

      <BallActor bakugan={bakugan} ballOpen={ballOpen} phase={phase} brawlStart={brawlStart} />
      {phase === 'brawling' && (
        <group scale={[2.2, 1.2, 2.2]}>
          <LightPillar color={element.glow} delay={T.pillar} />
        </group>
      )}
      {(phase === 'monster' || phase === 'brawling') && (
        <MonsterActor bakugan={bakugan} form={form} phase={phase} brawlStart={brawlStart} activeAbility={activeAbility} />
      )}

      {activeAbility && (
        <group scale={MONSTER_SCALE}>
          <AbilityEffect
            key={activeAbility.key}
            effect={activeAbility.ability.effect}
            color={element.color}
            glow={element.glow}
          />
        </group>
      )}

      <ContactShadows position={[0, 0.001, 0]} opacity={0.6} scale={40} blur={2.5} far={12} />
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
        <circleGeometry args={[55, 96]} />
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
const T = { roll: 0.6, open: 0.7, swap: 2.1, grown: 2.8, pillar: 1.5 }

function elapsed(brawlStart: RefObject<number | null>, now: number) {
  return brawlStart.current === null ? 0 : now - brawlStart.current
}

function BallActor({ bakugan, phase, brawlStart, ballOpen }: { bakugan: Bakugan; phase: Phase; ballOpen: boolean; brawlStart: RefObject<number | null> }) {
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
      // face the camera so the opening is visible
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, Math.round(g.rotation.y / (Math.PI * 2)) * Math.PI * 2, 6, dt)
      open.current = t > T.open
      g.visible = t < T.swap
    } else {
      g.position.copy(BALL_REST)
      g.position.y += Math.sin(clock.elapsedTime * 2) * 0.04
      if (!ballOpen) g.rotation.y += dt * 0.3
      // when opened for inspection, turn to face the camera
      else g.rotation.y = THREE.MathUtils.damp(g.rotation.y, Math.round(g.rotation.y / (Math.PI * 2)) * Math.PI * 2 - 0.6, 4, dt)
      g.rotation.x = 0
      open.current = phase === 'ball' && ballOpen
      g.visible = phase !== 'monster'
    }
  })

  return (
    <group ref={ref}>
      <BallModel bakugan={bakugan} openRef={open} />
    </group>
  )
}

function MonsterActor({
  bakugan,
  form,
  phase,
  brawlStart,
  activeAbility,
}: {
  bakugan: Bakugan
  form: number
  phase: Phase
  brawlStart: RefObject<number | null>
  activeAbility: Props['activeAbility']
}) {
  const ref = useRef<THREE.Group>(null)
  // activating an ability card plays that card's combat move
  const pose = useRef<Pose | null>(null)
  useEffect(() => {
    if (activeAbility) pose.current = { kind: 'cast', move: moveFor(activeAbility.ability), start: null }
  }, [activeAbility])
  useFrame(({ clock }) => {
    if (pose.current) {
      pose.current.start ??= clock.elapsedTime
      if (clock.elapsedTime - pose.current.start > 1.7) pose.current = null
    }
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
      <group scale={MONSTER_SCALE}>
        <MonsterModel entrant={{ bakugan, form }} poseRef={pose} />
      </group>
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
      maxDistance={65}
      maxPolarAngle={Math.PI / 2 - 0.05}
      onStart={() => (flying.current = 0)}
    />
  )
}
