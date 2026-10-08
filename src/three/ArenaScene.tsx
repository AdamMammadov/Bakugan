import { OrbitControls, Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { asset } from '../asset'
import type { BattleEvent, SideIndex } from '../battle/engine'
import type { Entrant } from '../data/bakugan'
import { ELEMENT_BY_ID, type ElementId } from '../data/elements'
import { AbilityEffect } from './AbilityEffect'
import { LiftDrag } from './LiftDrag'
import { Impact, Projectile, ShieldDome } from './ArenaFx'
import { MonsterModel } from './BakuganModels'
import { BlobShadow } from './BlobShadow'
import { Brawler, type BrawlerGesture } from './Brawler'
import { GateCard } from './GateCard'
import type { AvatarParts } from '../profile/avatar'
import { LightPillar } from './LightPillar'
import { env, moveFor, type Pose } from './pose'

export const FIGHTER_X = 17
/** Bakugan tower over the field: about 21 units, so a brawler (≈4 units) reaches their ankles. */
const FIGHTER_SCALE = 7
/** Brawler size: a little larger than true scale so they read clearly next to the Bakugan. */
const BRAWLER_SCALE = 3.6
const BRAWLER_X = FIGHTER_X + 5
const BRAWLER_Z = 12
/** Hip position along the model's length (model units), used as the pivot for rearing up. */
const HIP_Z = -1.1
/** Seconds from an action starting to its hit landing; the UI applies damage at this moment. */
export const IMPACT_AT = 0.75
export const ACTION_DURATION = 1.7

const CHEST_Y = 1.6 * FIGHTER_SCALE
/**
 * Where each monster's front stands, ahead of its spot (model units): the two fronts stay a few
 * units apart however long the bodies are, and long tails reach back instead of into the opponent.
 */
const FRONT_AT = 1.9

interface Props {
  fighters: [Entrant, Entrant]
  gate: ElementId | null
  event: { event: BattleEvent; key: number } | null
  shields: [boolean, boolean]
  defeated: [boolean, boolean]
  brawlers: [BrawlerInfo, BrawlerInfo]
}

export interface BrawlerInfo {
  parts: AvatarParts
  photo?: string
  model?: string
  gesture: { kind: BrawlerGesture; key: number }
}

const sideX = (side: SideIndex) => (side === 0 ? -FIGHTER_X : FIGHTER_X)

export function ArenaScene({ fighters, gate, event, shields, defeated, brawlers }: Props) {
  const gateElement = gate ? ELEMENT_BY_ID[gate] : null
  const blockFlash = useMemo<[number, number]>(
    () => (event?.event.blocked ? (event.event.target === 0 ? [event.key, 0] : [0, event.key]) : [0, 0]),
    [event],
  )

  return (
    <>
      <color attach="background" args={['#05060a']} />
      <fog attach="fog" args={['#05060a', 70, 160]} />
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[12, 40, 24]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-camera-far={120}
      />
      {fighters.map((f, i) => (
        <pointLight
          key={i}
          position={[sideX(i as SideIndex) * 1.6, 8, -4]}
          intensity={90}
          color={ELEMENT_BY_ID[f.bakugan.element].glow}
        />
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[110, 96]} />
        <meshStandardMaterial color="#0b0c12" metalness={0.3} roughness={0.8} />
      </mesh>
      <Sparkles
        count={300}
        scale={[70, 28, 44]}
        position={[0, 11, 0]}
        size={2}
        speed={0.3}
        color={gateElement?.glow ?? '#9aa3b5'}
      />

      {/* the field Gate Card both Bakugan stand on */}
      <group rotation={[0, Math.PI / 2, 0]} scale={27}>
        <Suspense fallback={null}>
          <GateCard icon={gateElement?.icon ?? asset('wheel/inner.webp')} color={gateElement?.color ?? '#9aa3b5'} />
        </Suspense>
      </group>

      {fighters.map((e, i) => (
        <Fighter
          key={`${i}-${e.bakugan.id}-${e.form}`}
          side={i as SideIndex}
          entrant={e}
          event={event}
          shield={shields[i]}
          blockFlash={blockFlash[i]}
          defeated={defeated[i]}
        />
      ))}

      {brawlers.map((b, i) => (
        <group
          key={i}
          position={[i === 0 ? -BRAWLER_X : BRAWLER_X, 0, BRAWLER_Z]}
          rotation={[0, i === 0 ? Math.PI / 2 - 0.5 : -Math.PI / 2 + 0.5, 0]}
          scale={BRAWLER_SCALE}
        >
          <Suspense fallback={null}>
            <Brawler
              parts={b.parts}
              photo={b.photo}
              model={b.model}
              gesture={b.gesture}
              color={ELEMENT_BY_ID[fighters[i].bakugan.element].color}
            />
          </Suspense>
          <BlobShadow size={0.9} />
        </group>
      ))}

      {event && <ActionFx key={event.key} event={event.event} fighters={fighters} />}

      <OrbitControls
        makeDefault
        target={[0, 8.5, 0]}
        enablePan={false}
        minDistance={8}
        maxDistance={120}
        maxPolarAngle={Math.PI / 2 - 0.08}
      />
      <LiftDrag max={30} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.9} intensity={1.2} mipmapBlur />
        <Vignette offset={0.25} darkness={0.75} />
      </EffectComposer>
    </>
  )
}

/** One Bakugan on the field: rises in on entry, lunges, flinches and falls when defeated. */
function Fighter({
  side,
  entrant,
  event,
  shield,
  blockFlash,
  defeated,
}: {
  side: SideIndex
  entrant: Entrant
  event: Props['event']
  shield: boolean
  blockFlash: number
  defeated: boolean
}) {
  const element = ELEMENT_BY_ID[entrant.bakugan.element]
  const ref = useRef<THREE.Group>(null)
  const born = useRef<number | null>(null)
  const anim = useRef<Pose | null>(null)
  const motion = useRef<THREE.Group>(null)
  const fallen = useRef(0)
  const facing = side === 0 ? 1 : -1

  useEffect(() => {
    if (!event) return
    const { actor, target, action, damage, blocked } = event.event
    if (action.kind === 'switch') return
    const ability = action.kind === 'ability' ? action.card.ability : null
    const hostile = !ability || ability.type === 'attack' || ability.type === 'drain'
    if (actor === side) {
      const move = moveFor(ability)
      anim.current = { kind: hostile ? 'lunge' : 'cast', move, start: null }
    } else if (target === side && damage > 0 && !blocked) anim.current = { kind: 'hit', move: 'hit', start: null }
  }, [event, side])

  useFrame(({ clock }, dt) => {
    const g = ref.current
    if (!g) return
    const now = clock.elapsedTime
    born.current ??= now
    const grow = THREE.MathUtils.clamp((now - born.current - 0.4) / 0.7, 0, 1)
    fallen.current = THREE.MathUtils.damp(fallen.current, defeated ? 1 : 0, 3, dt)

    // whole-body motion of the current move, in the model's own frame (forward = +Z)
    let fwd = 0
    let lift = 0
    let pitch = 0
    let yaw = 0
    let shake = 0
    const a = anim.current
    if (a) {
      a.start ??= now
      const t = now - a.start
      switch (a.move) {
        case 'bite':
          fwd = 1.1 * env(t, 0.1, 0.85)
          pitch = 0.08 * env(t, 0.2, 0.8)
          break
        case 'breath':
          fwd = -0.35 * env(t, 0, 1.5)
          pitch = -0.1 * env(t, 0, 1.5)
          break
        case 'clawSwipe':
          pitch = -0.38 * env(t, 0, 0.7)
          fwd = 0.7 * env(t, 0.35, 0.95)
          yaw = 0.25 * env(t, 0.3, 0.95)
          break
        case 'tailWhip': {
          // full spin so the tail sweeps through the opponent
          const k = THREE.MathUtils.smoothstep(t, 0.05, 1.05)
          yaw = k * Math.PI * 2
          fwd = 0.4 * env(t, 0.05, 1.05)
          break
        }
        case 'stomp':
          pitch = -0.55 * env(t, 0, 0.75)
          lift = 0.25 * env(t, 0, 0.75)
          if (t > 0.72 && t < 1.1) shake = Math.sin(t * 90) * 0.06 * (1.1 - t) * 3
          break
        case 'roar':
          pitch = -0.25 * env(t, 0, 1.5)
          shake = Math.sin(t * 60) * 0.02 * env(t, 0.2, 1.4)
          break
        case 'guard':
          fwd = -0.45 * env(t, 0, 1.4)
          lift = -0.15 * env(t, 0, 1.4)
          break
        case 'hit': {
          const h = env(t, IMPACT_AT - 0.03, IMPACT_AT + 0.55)
          fwd = -0.9 * h
          pitch = -0.18 * h
          yaw = 0.15 * h
          if (h > 0) shake = Math.sin(t * 80) * 0.08 * h
          break
        }
      }
      if (t > ACTION_DURATION) anim.current = null
    }
    const m = motion.current
    if (m) {
      m.position.set(shake, lift, -HIP_Z + fwd)
      m.rotation.set(pitch, yaw, 0)
    }

    const s = Math.max(1 - Math.pow(1 - grow, 3), 0.001) * (1 - fallen.current * 0.999)
    g.scale.setScalar(Math.max(s, 0.001))
    g.position.set(sideX(side), -fallen.current * 0.5, 0)
    g.rotation.z = fallen.current * 0.5 * facing
  })

  return (
    <group>
      <group ref={ref} rotation={[0, (Math.PI / 2) * facing, 0]} scale={0.001}>
        <group scale={FIGHTER_SCALE}>
          {/* rotations pivot around the hips so rearing up looks natural */}
          <group ref={motion} position={[0, 0, -HIP_Z]}>
            <group position={[0, 0, HIP_Z]}>
              <MonsterModel entrant={entrant} poseRef={anim} frontAt={FRONT_AT} />
            </group>
          </group>
          <BlobShadow size={3.2} />
        </group>
      </group>
      <group position={[sideX(side), 0, 0]} scale={FIGHTER_SCALE}>
        <ShieldDome color={element.glow} active={shield} flashKey={blockFlash} />
        <EntryPillar color={element.glow} />
      </group>
    </group>
  )
}

/** Light pillar that plays once when the fighters appear. */
function EntryPillar({ color }: { color: string }) {
  const ref = useRef<THREE.Group>(null)
  const t = useRef(0)
  useFrame((_, dt) => {
    t.current += dt
    if (ref.current) ref.current.visible = t.current < 1.8
  })
  return (
    <group ref={ref}>
      <LightPillar color={color} duration={1.6} />
    </group>
  )
}

/** Visuals for one battle action. */
function ActionFx({ event, fighters }: { event: BattleEvent; fighters: [Entrant, Entrant] }) {
  const { actor, target, action, blocked } = event
  const me = ELEMENT_BY_ID[fighters[actor].bakugan.element]
  const from = useMemo(() => new THREE.Vector3(sideX(actor) * 0.75, CHEST_Y, 0), [actor])
  const to = useMemo(() => new THREE.Vector3(sideX(target) * (blocked ? 0.25 : 0.85), CHEST_Y, 0), [target, blocked])
  if (action.kind === 'switch') return null
  const type = action.kind === 'basic' ? 'attack' : action.card.ability.type
  const preset = action.kind === 'basic' ? 'fireball' : action.card.ability.effect

  if (type === 'attack') {
    return (
      <>
        <Projectile from={from} to={to} preset={preset} color={me.color} glow={me.glow} />
        <Impact at={to} color={me.glow} delay={IMPACT_AT} />
      </>
    )
  }
  if (type === 'drain') {
    // strike the opponent, then the stolen power flows back to the user
    return (
      <>
        <Projectile from={from} to={to} preset={preset} color={me.color} glow={me.glow} />
        <Impact at={to} color={me.glow} delay={IMPACT_AT} />
        {!blocked && (
          <Projectile from={to} to={from} preset="aura" color={me.glow} glow="#ffffff" delay={IMPACT_AT + 0.1} travel={0.6} />
        )}
      </>
    )
  }
  if (type === 'weaken') {
    return (
      <>
        <Projectile from={from} to={to} preset={preset} color={me.color} glow={me.glow} />
        {!blocked && (
          <group position={[sideX(target), 0, 0]} scale={0.8}>
            <AbilityEffect effect="shadowOrb" color={me.color} glow={me.glow} />
          </group>
        )}
      </>
    )
  }
  if (type === 'boost') {
    return (
      <group position={[sideX(actor), 0, 0]} scale={0.8}>
        <AbilityEffect effect="aura" color={me.color} glow={me.glow} />
      </group>
    )
  }
  // shield: the dome itself is driven by fighter state; add a short burst
  return <Impact at={new THREE.Vector3(sideX(actor), CHEST_Y, 0)} color={me.glow} delay={0.1} />
}
