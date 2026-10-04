import { ContactShadows, OrbitControls, Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { asset } from '../asset'
import type { BattleEvent, SideIndex } from '../battle/engine'
import type { Entrant } from '../data/bakugan'
import { ELEMENT_BY_ID, type ElementId } from '../data/elements'
import { AbilityEffect } from './AbilityEffect'
import { Impact, Projectile, ShieldDome } from './ArenaFx'
import { MonsterModel } from './BakuganModels'
import { GateCard } from './GateCard'
import { LightPillar } from './LightPillar'
import type { Pose } from './pose'

export const FIGHTER_X = 6.8
/** Bakugan stand larger in the arena than in the viewer. */
const FIGHTER_SCALE = 2.3
/** Seconds from an action starting to its hit landing; the UI applies damage at this moment. */
export const IMPACT_AT = 0.75
export const ACTION_DURATION = 1.7

const CHEST_Y = 1.6 * FIGHTER_SCALE

interface Props {
  fighters: [Entrant, Entrant]
  gate: ElementId | null
  event: { event: BattleEvent; key: number } | null
  shields: [boolean, boolean]
  defeated: SideIndex | null
}

const sideX = (side: SideIndex) => (side === 0 ? -FIGHTER_X : FIGHTER_X)

export function ArenaScene({ fighters, gate, event, shields, defeated }: Props) {
  const gateElement = gate ? ELEMENT_BY_ID[gate] : null
  const blockFlash = useMemo<[number, number]>(
    () => (event?.event.blocked ? (event.event.target === 0 ? [event.key, 0] : [0, event.key]) : [0, 0]),
    [event],
  )

  return (
    <>
      <color attach="background" args={['#05060a']} />
      <fog attach="fog" args={['#05060a', 30, 70]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 9, 6]} intensity={2.2} castShadow shadow-mapSize={[2048, 2048]} />
      {fighters.map((f, i) => (
        <pointLight key={i} position={[sideX(i as SideIndex) * 1.6, 3, -2]} intensity={25} color={ELEMENT_BY_ID[f.bakugan.element].glow} />
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[45, 96]} />
        <meshStandardMaterial color="#0b0c12" metalness={0.3} roughness={0.8} />
      </mesh>
      <Sparkles count={200} scale={[40, 14, 28]} position={[0, 6, 0]} size={2} speed={0.3} color={gateElement?.glow ?? '#9aa3b5'} />

      {/* the field Gate Card both Bakugan stand on */}
      <group rotation={[0, Math.PI / 2, 0]} scale={6.5}>
        <Suspense fallback={null}>
          <GateCard icon={gateElement?.icon ?? asset('wheel/inner.webp')} color={gateElement?.color ?? '#9aa3b5'} />
        </Suspense>
      </group>

      {fighters.map((e, i) => (
        <Fighter key={i} side={i as SideIndex} entrant={e} event={event} shield={shields[i]} blockFlash={blockFlash[i]} defeated={defeated === i} />
      ))}

      {event && <ActionFx key={event.key} event={event.event} fighters={fighters} />}

      <ContactShadows position={[0, 0.001, 0]} opacity={0.6} scale={45} blur={2.5} far={14} />
      <OrbitControls
        makeDefault
        target={[0, 3.6, 0]}
        enablePan={false}
        minDistance={8}
        maxDistance={50}
        maxPolarAngle={Math.PI / 2 - 0.08}
      />
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
  const fallen = useRef(0)
  const facing = side === 0 ? 1 : -1

  useEffect(() => {
    if (!event) return
    const { actor, target, action, damage, blocked } = event.event
    const hostile = action.kind === 'basic' || action.ability.type === 'attack' || action.ability.type === 'drain'
    if (actor === side) anim.current = { kind: hostile ? 'lunge' : 'cast', start: null }
    else if (target === side && damage > 0 && !blocked) anim.current = { kind: 'hit', start: null }
  }, [event, side])

  useFrame(({ clock }, dt) => {
    const g = ref.current
    if (!g) return
    const now = clock.elapsedTime
    born.current ??= now
    const grow = THREE.MathUtils.clamp((now - born.current - 0.4) / 0.7, 0, 1)
    fallen.current = THREE.MathUtils.damp(fallen.current, defeated ? 1 : 0, 3, dt)

    let x = 0
    let shake = 0
    let lift = 0
    const a = anim.current
    if (a) {
      a.start ??= now
      const t = now - a.start
      if (a.kind === 'lunge') x = Math.sin(THREE.MathUtils.clamp(t / 0.5, 0, 1) * Math.PI) * 0.9 * facing
      if (a.kind === 'cast') lift = Math.sin(THREE.MathUtils.clamp(t / 0.8, 0, 1) * Math.PI) * 0.4
      if (a.kind === 'hit') {
        const k = THREE.MathUtils.clamp((t - IMPACT_AT) / 0.45, 0, 1)
        if (k > 0 && k < 1) {
          x = -Math.sin(k * Math.PI) * 0.6 * facing
          shake = Math.sin(t * 80) * 0.08 * (1 - k)
        }
      }
      if (t > ACTION_DURATION) anim.current = null
    }

    const s = Math.max(1 - Math.pow(1 - grow, 3), 0.001) * (1 - fallen.current * 0.999)
    g.scale.setScalar(Math.max(s, 0.001))
    g.position.set(sideX(side) + x + shake, lift - fallen.current * 0.5, 0)
    g.rotation.z = fallen.current * 0.5 * facing
  })

  return (
    <group>
      <group ref={ref} rotation={[0, (Math.PI / 2) * facing, 0]} scale={0.001}>
        <group scale={FIGHTER_SCALE}>
          <MonsterModel entrant={entrant} poseRef={anim} />
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
  const type = action.kind === 'basic' ? 'attack' : action.ability.type
  const preset = action.kind === 'basic' ? 'fireball' : action.ability.effect

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
        {!blocked && <Projectile from={to} to={from} preset="aura" color={me.glow} glow="#ffffff" delay={IMPACT_AT + 0.1} travel={0.6} />}
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
