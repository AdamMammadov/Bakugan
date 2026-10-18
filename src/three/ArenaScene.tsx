import { OrbitControls, Sparkles } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { asset } from '../asset'
import type { BattleEvent, SideIndex } from '../battle/engine'
import { formModels, type Entrant } from '../data/bakugan'
import { ELEMENT_BY_ID, type ElementId } from '../data/elements'
import { AbilityEffect } from './AbilityEffect'
import { LiftDrag } from './LiftDrag'
import { ChaosBeam, Impact, Projectile, ShieldDome } from './ArenaFx'
import { MonsterModel } from './BakuganModels'
import { BlobShadow } from './BlobShadow'
import { Brawler, type BrawlerGesture } from './Brawler'
import { GateCard } from './GateCard'
import type { AvatarParts } from '../profile/avatar'
import { LightPillar } from './LightPillar'
import { env, moveFor, type Pose } from './pose'

/** Bakugan tower over the field: about 21 units, so a brawler (≈4 units) reaches their ankles. */
const FIGHTER_SCALE = 7
/** Brawler size: a little larger than true scale so they read clearly next to the Bakugan. */
const BRAWLER_SCALE = 3.6
const BRAWLER_X = 24
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
/** How far each Bakugan's front stands from the field's middle, per unit of its size, so big heads keep their distance. */
const FRONT_GAP = 10
/** The usual view was made for fronts closer together (3.7 from the middle), so it sits this much further back. */
const SPREAD = 1.25

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

/** Bakugan up to this size (evolution growth times models.scale) fit the usual view; a bigger one makes it pull back. */
const GIANT = 1.4
const sizeOf = (e: Entrant) => (1 + e.form * 0.12) * (formModels(e)?.scale ?? 1)
/**
 * Where a Bakugan stands (x): its front FRONT_GAP × its size from the middle, its body behind that. A giant counts
 * as GIANT, so its long body still fits the view, which pulls back for it.
 */
const xOf = (side: SideIndex, e: Entrant) =>
  (side === 0 ? -1 : 1) * (FRONT_GAP * Math.min(GIANT, Math.max(1, sizeOf(e))) + FRONT_AT * FIGHTER_SCALE)
/**
 * How far the view pulls back for the fighters: SPREAD for the usual sizes; with a giant on the field, as far as fits
 * a Bakugan of size 1.15 in the usual view (a giant hovers high and spreads its wings above the others' heads).
 */
const pullFor = (fighters: Entrant[]) => {
  const biggest = Math.max(...fighters.map(sizeOf))
  return (biggest > GIANT ? biggest / 1.15 : 1) * SPREAD
}

/** A shield bubble round a Bakugan, in its model's frame (model units). */
interface ShieldFit {
  center: THREE.Vector3
  radii: THREE.Vector3
}

/** About `count` of the model's vertices, where they are drawn right now, in `frame`'s space. */
function sampleModel(model: THREE.Object3D, frame: THREE.Object3D, count: number) {
  // updateMatrixWorld (not updateWorldMatrix) also refreshes skinned meshes' bind matrices
  frame.updateWorldMatrix(true, false)
  frame.updateMatrixWorld(true)
  const toFrame = frame.matrixWorld.clone().invert()
  const meshes: THREE.Mesh[] = []
  model.traverseVisible((o) => {
    if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh)
  })
  const total = meshes.reduce((n, m) => n + m.geometry.getAttribute('position').count, 0)
  const step = Math.ceil(total / count)
  const pts: THREE.Vector3[] = []
  const toFrameOf = new THREE.Matrix4()
  for (const m of meshes) {
    toFrameOf.multiplyMatrices(toFrame, m.matrixWorld)
    const n = m.geometry.getAttribute('position').count
    for (let i = 0; i < n; i += step) pts.push(m.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(toFrameOf))
  }
  return pts
}

/** How far out a point lies in a bubble (1 = on its skin). */
const depthIn = (fit: ShieldFit, p: THREE.Vector3) =>
  Math.hypot((p.x - fit.center.x) / fit.radii.x, (p.y - fit.center.y) / fit.radii.y, (p.z - fit.center.z) / fit.radii.z)

/** The smallest bubble round the middle of the points' box, stretched along the box's sides, that holds them all. */
function fitShield(pts: THREE.Vector3[]): ShieldFit {
  const box = new THREE.Box3().setFromPoints(pts)
  const center = box.getCenter(new THREE.Vector3())
  const half = box.getSize(new THREE.Vector3()).multiplyScalar(0.5).addScalar(0.01)
  // each point as a share of the half box; try stretches up and across, and find the length that holds every point
  const q = pts.map((p) => p.clone().sub(center).divide(half))
  const sample = q.filter((_, i) => i % Math.ceil(q.length / 3000) === 0)
  const lengthFor = (sy: number, sz: number, points: THREE.Vector3[]) => {
    let sx = 1
    for (const p of points) {
      const room = 1 - (p.y / sy) ** 2 - (p.z / sz) ** 2
      if (room <= 0) return Infinity
      sx = Math.max(sx, Math.abs(p.x) / Math.sqrt(room))
    }
    return sx
  }
  let best = new THREE.Vector3(Math.SQRT2, 2, 2)
  for (let i = 1; i <= 20; i++)
    for (let j = 1; j <= 20; j++) {
      const [sy, sz] = [1 + i * 0.05, 1 + j * 0.05]
      const sx = lengthFor(sy, sz, sample)
      if (sx * sy * sz < best.x * best.y * best.z) best = new THREE.Vector3(sx, sy, sz)
    }
  // every point inside (a point the sample missed may need a little more height and width), with some room
  while (!Number.isFinite((best.x = lengthFor(best.y, best.z, q)))) best.multiplyScalar(1.05)
  return { center, radii: half.multiply(best).multiplyScalar(1.06) }
}

export function ArenaScene({ fighters, gate, event, shields, defeated, brawlers }: Props) {
  const gateElement = gate ? ELEMENT_BY_ID[gate] : null
  const pull = pullFor(fighters)
  const blockFlash = useMemo<[number, number]>(
    () => (event?.event.blocked ? (event.event.target === 0 ? [event.key, 0] : [0, event.key]) : [0, 0]),
    [event],
  )
  // how far each shield reaches out in front of its Bakugan's spot, once measured (keyed by fighter)
  const [shieldReach, setShieldReach] = useState<Record<string, number>>({})
  const keys = fighters.map((e, i) => `${i}-${e.bakugan.id}-${e.form}`)
  const onShieldReach = useCallback(
    (side: SideIndex, entrant: Entrant, reach: number) =>
      setShieldReach((r) => ({ ...r, [`${side}-${entrant.bakugan.id}-${entrant.form}`]: reach })),
    [],
  )

  return (
    <>
      <color attach="background" args={['#05060a']} />
      <fog attach="fog" args={['#05060a', 70 * pull, 160 * pull]} />
      <ambientLight intensity={0.4} />
      <directionalLight
        // a giant on the field: the light and its shadow area move out with the view
        position={[12 * pull, 40 * pull, 24 * pull]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-45 * pull}
        shadow-camera-right={45 * pull}
        shadow-camera-top={45 * pull}
        shadow-camera-bottom={-45 * pull}
        shadow-camera-far={120 * pull}
        // pushes the shadow test off each surface, so smooth curved armour does not shade itself in fine rings
        shadow-bias={-0.0004}
        shadow-normalBias={0.06}
      />
      {fighters.map((f, i) => (
        <pointLight
          key={i}
          position={[xOf(i as SideIndex, f) * 1.6, 8, -4]}
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
          key={keys[i]}
          side={i as SideIndex}
          entrant={e}
          event={event}
          shield={shields[i]}
          blockFlash={blockFlash[i]}
          defeated={defeated[i]}
          onShieldReach={onShieldReach}
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

      {event && (
        <ActionFx
          key={event.key}
          event={event.event}
          fighters={fighters}
          shieldReach={[shieldReach[keys[0]], shieldReach[keys[1]]]}
        />
      )}

      <OrbitControls
        makeDefault
        target={[0, 8.5, 0]}
        enablePan={false}
        minDistance={8}
        maxDistance={120 * pull}
        maxPolarAngle={Math.PI / 2 - 0.08}
      />
      <LiftDrag max={30} />
      <PullBack k={pull} />
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
  onShieldReach,
}: {
  side: SideIndex
  entrant: Entrant
  event: Props['event']
  shield: boolean
  blockFlash: number
  defeated: boolean
  /** Tells the scene how far the shield reaches out in front of this Bakugan's spot (world units). */
  onShieldReach: (side: SideIndex, entrant: Entrant, reach: number) => void
}) {
  const element = ELEMENT_BY_ID[entrant.bakugan.element]
  const ref = useRef<THREE.Group>(null)
  const born = useRef<number | null>(null)
  const anim = useRef<Pose | null>(null)
  const motion = useRef<THREE.Group>(null)
  const frame = useRef<THREE.Group>(null)
  const model = useRef<THREE.Group>(null)
  const fallen = useRef(0)
  const facing = side === 0 ? 1 : -1
  const x = xOf(side, entrant)
  // the shield is sized to the model once it has loaded, and grows to its idle sway over the first seconds
  const [fit, setFit] = useState<ShieldFit | null>(null)
  const measure = useRef<{ fit: ShieldFit; shell: THREE.Vector3[]; next: number; until: number } | null>(null)

  useEffect(() => {
    if (!event) return
    const { actor, target, action, damage, blocked } = event.event
    if (action.kind === 'switch') return
    const ability = action.kind === 'ability' ? action.card.ability : null
    const hostile = !ability || ability.type === 'attack' || ability.type === 'drain' || ability.type === 'finisher'
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
    g.position.set(x, -fallen.current * 0.5, 0)
    g.rotation.z = fallen.current * 0.5 * facing

    // measured while standing still (a move would stretch it); each fit keeps the outer points of the ones before
    const ms = measure.current
    if (model.current && frame.current && !anim.current && !defeated && (!ms || (now >= ms.next && now < ms.until))) {
      const pts = sampleModel(model.current, frame.current, ms ? 8000 : 20000)
      if (pts.length) {
        const all = ms ? pts.concat(ms.shell) : pts
        const f = fitShield(all)
        const changed =
          !ms || f.center.distanceTo(ms.fit.center) + f.radii.distanceTo(ms.fit.radii) > 0.01 * ms.fit.radii.length()
        // the outermost points are the ones the next fit must still hold
        const outer = all
          .map((p) => ({ p, d: depthIn(f, p) }))
          .filter((o) => o.d > 0.8)
          .sort((a, b) => b.d - a.d)
        measure.current = { fit: f, shell: outer.slice(0, 6000).map((o) => o.p), next: now + 0.5, until: ms?.until ?? now + 8 }
        if (changed) {
          setFit(f)
          onShieldReach(side, entrant, (f.center.z + f.radii.z) * FIGHTER_SCALE)
        }
      }
    }
  })

  return (
    <group>
      <group ref={ref} rotation={[0, (Math.PI / 2) * facing, 0]} scale={0.001}>
        <group scale={FIGHTER_SCALE}>
          {/* rotations pivot around the hips so rearing up looks natural */}
          <group ref={motion} position={[0, 0, -HIP_Z]}>
            <group ref={frame} position={[0, 0, HIP_Z]}>
              <group ref={model}>
                <MonsterModel entrant={entrant} poseRef={anim} frontAt={FRONT_AT} />
              </group>
              {/* the shield wraps the whole model and moves with it */}
              {fit && (
                <group position={fit.center} scale={fit.radii}>
                  <ShieldDome color={element.glow} active={shield} flashKey={blockFlash} flashDelay={IMPACT_AT} />
                </group>
              )}
            </group>
          </group>
          <BlobShadow size={3.2} />
        </group>
      </group>
      <group position={[x, 0, 0]} scale={FIGHTER_SCALE}>
        <EntryPillar color={element.glow} />
      </group>
    </group>
  )
}

/**
 * Moves the view out (or back in) to `k` times its usual distance, easing over a moment: the camera and the point
 * it looks at scale together about the field's middle, so the framing stays the same, only wider. The player's own
 * turning and zooming are kept.
 */
function PullBack({ k }: { k: number }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3; update: () => void } | null
  const now = useRef(1)
  const move = useRef<{ from: number; t: number } | null>(null)
  useEffect(() => {
    move.current = { from: now.current, t: 0 }
  }, [k])
  useFrame((_, dt) => {
    const m = move.current
    if (!m || !controls) return
    m.t = Math.min(1, m.t + dt / 0.8)
    const next = m.from + (k - m.from) * THREE.MathUtils.smoothstep(m.t, 0, 1)
    camera.position.multiplyScalar(next / now.current)
    controls.target.multiplyScalar(next / now.current)
    controls.update()
    now.current = next
    if (m.t >= 1) move.current = null
  })
  return null
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
function ActionFx({
  event,
  fighters,
  shieldReach,
}: {
  event: BattleEvent
  fighters: [Entrant, Entrant]
  /** How far each shield reaches out in front of its Bakugan's spot, once measured. */
  shieldReach: [number | undefined, number | undefined]
}) {
  const { actor, target, action, blocked } = event
  const me = ELEMENT_BY_ID[fighters[actor].bakugan.element]
  const ax = xOf(actor, fighters[actor])
  const tx = xOf(target, fighters[target])
  const reach = shieldReach[target]
  const from = useMemo(() => new THREE.Vector3(ax * 0.75, CHEST_Y, 0), [ax])
  const to = useMemo(() => {
    // a blocked hit stops on the front of the shield
    if (!blocked) return new THREE.Vector3(tx * 0.85, CHEST_Y, 0)
    return new THREE.Vector3(Math.sign(tx) * Math.max(1, Math.abs(tx) - (reach ?? Math.abs(tx) * 0.75)), CHEST_Y, 0)
  }, [tx, blocked, reach])
  if (action.kind === 'switch') return null
  const type = action.kind === 'basic' ? 'attack' : action.card.ability.type
  const preset = action.kind === 'basic' ? 'fireball' : action.card.ability.effect

  if (type === 'finisher') {
    // a giant fires from its mouth, high above the field, with a beam to match its size
    const big = Math.max(1, sizeOf(fighters[actor]))
    const mouth = new THREE.Vector3(ax * 0.6, CHEST_Y * (big > GIANT ? big * 1.5 : 1), 0)
    return <ChaosBeam from={mouth} to={to} size={big} hitAt={IMPACT_AT - 0.1} />
  }
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
          <group position={[tx, 0, 0]} scale={0.8}>
            <AbilityEffect effect="shadowOrb" color={me.color} glow={me.glow} />
          </group>
        )}
      </>
    )
  }
  if (type === 'boost') {
    return (
      <group position={[ax, 0, 0]} scale={0.8}>
        <AbilityEffect effect="aura" color={me.color} glow={me.glow} />
      </group>
    )
  }
  // shield: the dome itself is driven by fighter state; add a short burst
  return <Impact at={new THREE.Vector3(ax, CHEST_Y, 0)} color={me.glow} delay={0.1} />
}
