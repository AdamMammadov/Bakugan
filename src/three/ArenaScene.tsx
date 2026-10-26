import { OrbitControls, Sparkles } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { BattleEvent, SideIndex } from '../battle/engine'
import { formModels, type Entrant } from '../data/bakugan'
import { ELEMENT_BY_ID, type ElementId } from '../data/elements'
import { AbilityEffect } from './AbilityEffect'
import { LiftDrag } from './LiftDrag'
import { ChaosBeam, Impact, Projectile, ShieldDome } from './ArenaFx'
import { BrawlerFocus, ViewLimits } from './ArenaView'
import { MonsterModel } from './BakuganModels'
import { BlobShadow } from './BlobShadow'
import { Brawler, type BrawlerGesture } from './Brawler'
import { FIELD_CARD_TOP, FieldGateCard } from './FieldGateCard'
import type { AvatarParts } from '../profile/avatar'
import { LightPillar } from './LightPillar'
import { env, moveFor, type Move, type Pose } from './pose'
import {
  depthIn,
  fitShield,
  hoverLift,
  outerShell,
  poseList,
  rigOf,
  sampleInPoses,
  sampleInto,
  samplerFor,
  type ModelSampler,
  type Rig,
  type ShieldFit,
} from './shieldFit'
import { crowd } from './stadium'
import { FIELD_RADIUS, Stadium } from './Stadium'
import { THROW_LAND, ThrownBall } from './ThrowIn'

/** Bakugan tower over the field: about 21 units, so a brawler (≈4 units) reaches their ankles. */
const FIGHTER_SCALE = 7
/** Brawler size: well above true scale, so they read from behind the field (about half a Bakugan's height). */
const BRAWLER_SCALE = 7.4
/**
 * Where the brawlers stand: just behind the far edge of the Gate Card, each on their own side, close enough to the
 * middle that the usual view sees them in the gap between the two Bakugan.
 */
const BRAWLER_X = 17
const BRAWLER_Z = 57
/** The field Gate Card (2.2 × 3 card units) at this size covers the ground both Bakugan stand on. */
const CARD_SCALE = 46
/** Height of the card's top (world units, usual view): the Bakugan stand on it, never in it. */
const GROUND = FIELD_CARD_TOP * CARD_SCALE
/**
 * Smallest look a Bakugan may have in the usual view (model units): the geometric mean of the height and width it
 * shows the camera. Slim or small ones grow to it (at most MAX_BOOST times), so every Bakugan reads from afar.
 */
const MIN_PRESENCE = 2.6
/** Shortest a Bakugan may stand (model units; a normal one is 3). */
const MIN_HEIGHT = 2.76
const MAX_BOOST = 1.6
/**
 * How far a Bakugan that is wider than it is long (arms or wings spread, seen edge-on from the side) turns its front
 * towards the usual view while it waits (radians). It squares up to the opponent whenever it acts or is hit.
 */
const STANCE_TURN = 0.5
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
  /** Each side's throws so far: a side's count goes up when its brawler throws a Bakugan onto the field. */
  throws?: [number, number]
  /** A tag battle: each brawler's teammate, standing next to them (null: none). */
  partners?: [BrawlerInfo | null, BrawlerInfo | null]
}

export interface BrawlerInfo {
  parts: AvatarParts
  photo?: string
  model?: string
  gesture: { kind: BrawlerGesture; key: number }
  /** Their colour (a teammate's own; a brawler on the field takes their Bakugan's). */
  color?: string
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

/** Where a brawler stands (world space) for a stadium of size `k`, and where they look: towards the field's middle. */
const brawlerSpot = (side: SideIndex, k: number) => {
  const at = new THREE.Vector3((side === 0 ? -BRAWLER_X : BRAWLER_X) * k, 0, -BRAWLER_Z * k)
  return { at, facing: at.clone().negate().setY(0).normalize() }
}

/** A tag battle's teammate: a little behind their mate, towards the middle (in the gap between the Bakugan). */
const partnerSpot = (side: SideIndex, k: number) => {
  const at = new THREE.Vector3((side === 0 ? -1 : 1) * (BRAWLER_X - 8.5) * k, 0, -(BRAWLER_Z + 7) * k)
  return { at, facing: at.clone().negate().setY(0).normalize() }
}

export function ArenaScene({ fighters, gate, event, shields, defeated, brawlers, throws = [0, 0], partners }: Props) {
  const gateElement = gate ? ELEMENT_BY_ID[gate] : null
  const pull = pullFor(fighters)
  // the stadium, the card and the brawlers grow with the view when a giant is on the field
  const k = pull / SPREAD
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

  const [el0, el1] = [fighters[0].bakugan.element, fighters[1].bakugan.element]
  const [name0, name1] = [fighters[0].bakugan.name, fighters[1].bakugan.name]
  const colors = useMemo<[string, string]>(() => [ELEMENT_BY_ID[el0].color, ELEMENT_BY_ID[el1].color], [el0, el1])
  const names = useMemo<[string, string]>(() => [name0, name1], [name0, name1])
  const [model0, model1] = [brawlers[0].model, brawlers[1].model]
  const [mate0, mate1] = [partners?.[0]?.model, partners?.[1]?.model]
  // brawlers on the field are not in the crowd too
  const onField = useMemo(() => [model0 ?? '', model1 ?? '', mate0 ?? '', mate1 ?? ''], [model0, model1, mate0, mate1])
  const spots = useMemo(() => [brawlerSpot(0, k), brawlerSpot(1, k)], [k])
  const focusSpots = useMemo(
    () =>
      spots.map((s) => ({
        at: s.at.clone().setY(BRAWLER_SCALE * k * 1.05),
        facing: s.facing,
        size: BRAWLER_SCALE * k * 1.8,
      })),
    [spots, k],
  )
  const home = useCallback(
    () => ({
      position: new THREE.Vector3(0, 11, 46).multiplyScalar(pull),
      target: new THREE.Vector3(0, 8.5, 0).multiplyScalar(pull),
    }),
    [pull],
  )

  // each brawler throws in turn: a side's Bakugan comes in when its count goes up (nothing to throw on the first render)
  const [throw0, throw1] = throws
  const [firstThrow] = useState<[number, number]>([throw0, throw1])
  // a battle that starts before its first throw keeps the field empty until the balls land
  const [waitThrow] = useState(throw0 === 0 && throw1 === 0)
  const throwing = [throw0 !== firstThrow[0], throw1 !== firstThrow[1]]
  // clock time each side's latest throw started
  const throwAt = useRef<[number | null, number | null]>([null, null])
  const seenThrow = useRef<[number, number]>([...firstThrow])
  useFrame(({ clock }) => {
    const now: [number, number] = [throw0, throw1]
    for (const i of [0, 1] as const) {
      if (seenThrow.current[i] === now[i]) continue
      seenThrow.current[i] = now[i]
      throwAt.current[i] = clock.elapsedTime
    }
  })

  // the crowd follows the battle on its own too: a cheer for a hit, a gasp at a block, a roar for a knockout
  useEffect(() => {
    if (!event || event.event.action.kind === 'switch') return
    const { actor, damage, blocked, ko } = event.event
    const timer = setTimeout(() => {
      if (blocked) crowd('gasp', (1 - actor) as SideIndex)
      else if (ko) crowd('roar', actor)
      else if (damage > 0) crowd('cheer', actor)
    }, IMPACT_AT * 1000)
    return () => clearTimeout(timer)
  }, [event])
  const [down0, down1] = defeated
  const wasDown = useRef<[boolean, boolean]>([down0, down1])
  useEffect(() => {
    const was = wasDown.current
    if (down0 && !was[0]) crowd('roar', 1)
    if (down1 && !was[1]) crowd('roar', 0)
    wasDown.current = [down0, down1]
  }, [down0, down1])
  // the fans cheer each Bakugan as its ball lands
  const thrownCount = throw0 + throw1
  const [firstCount] = useState(thrownCount)
  useEffect(() => {
    if (thrownCount === firstCount) return
    const timer = setTimeout(() => crowd('cheer'), THROW_LAND * 1000)
    return () => clearTimeout(timer)
  }, [thrownCount, firstCount])
  // the fans greet the Bakugan as they come onto the field (thrown ones get the cheer when they land)
  useEffect(() => {
    if (waitThrow) return
    const timer = setTimeout(() => crowd('cheer'), 1200)
    return () => clearTimeout(timer)
  }, [waitThrow])

  return (
    <>
      <color attach="background" args={['#05060a']} />
      <fog attach="fog" args={['#05060a', 150 * k, 430 * k]} />
      <ambientLight intensity={0.45} />
      <hemisphereLight args={['#8fa6d8', '#0b0c12', 0.35]} />
      <directionalLight
        // a giant on the field: the light and its shadow area move out with the view
        position={[12 * pull, 40 * pull, 24 * pull]}
        intensity={2.2}
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
          position={[xOf(i as SideIndex, f) * 1.6, 14, -4]}
          intensity={45}
          color={ELEMENT_BY_ID[f.bakugan.element].glow}
        />
      ))}

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[(FIELD_RADIUS + 2) * k, 96]} />
        <meshStandardMaterial color="#0b0c12" metalness={0.3} roughness={0.85} />
      </mesh>
      <Sparkles
        count={300}
        scale={[70, 28, 44]}
        position={[0, 11, 0]}
        size={1.6}
        speed={0.3}
        color={gateElement?.glow ?? '#9aa3b5'}
      />

      <Stadium scale={k} colors={colors} names={names} exclude={onField} />

      {/* the field Gate Card both Bakugan stand on: face down until its owner opens it */}
      <group scale={CARD_SCALE * k}>
        <Suspense fallback={null}>
          <FieldGateCard element={gateElement} glow={0.32} />
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
          over={defeated[0] || defeated[1]}
          onShieldReach={onShieldReach}
          throwAt={throwAt}
          waitThrow={waitThrow}
          ground={GROUND * k}
          // next to a giant the view pulls back: the others grow a little so they still read
          presence={Math.sqrt(k)}
        />
      ))}

      {brawlers.map((b, i) => (
        <group
          key={i}
          position={spots[i].at}
          rotation={[0, Math.atan2(spots[i].facing.x, spots[i].facing.z), 0]}
          scale={BRAWLER_SCALE * k}
        >
          <Suspense fallback={null}>
            <Brawler
              parts={b.parts}
              photo={b.photo}
              model={b.model}
              gesture={b.gesture}
              color={ELEMENT_BY_ID[fighters[i].bakugan.element].color}
              throwKey={throws[i]}
            />
          </Suspense>
          <BlobShadow size={0.9} />
        </group>
      ))}

      {partners?.map((b, i) => {
        if (!b) return null
        const spot = partnerSpot(i as SideIndex, k)
        return (
          <group
            key={`mate-${i}`}
            position={spot.at}
            rotation={[0, Math.atan2(spot.facing.x, spot.facing.z), 0]}
            scale={BRAWLER_SCALE * k}
          >
            <Suspense fallback={null}>
              <Brawler
                parts={b.parts}
                photo={b.photo}
                model={b.model}
                gesture={b.gesture}
                color={b.color ?? ELEMENT_BY_ID[fighters[i].bakugan.element].color}
              />
            </Suspense>
            <BlobShadow size={0.9} />
          </group>
        )
      })}

      {fighters.map((e, i) =>
        throwing[i] ? (
          <ThrownBall
            key={`${throws[i]}-${i}`}
            from={spots[i].at.clone().add(new THREE.Vector3(0, BRAWLER_SCALE * k * 2, 0))}
            // the ball lands on the card's top and bounces there
            to={new THREE.Vector3(xOf(i as SideIndex, e) - (i === 0 ? -1 : 1) * 6, GROUND * k + 1.2, 0)}
            entrant={e}
            color={ELEMENT_BY_ID[e.bakugan.element].glow}
          />
        ) : null,
      )}

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
        // the wheel zooms towards the cursor, so the player can close in on a brawler or the stands
        zoomToCursor
        minDistance={8}
        maxDistance={86 * k}
        maxPolarAngle={Math.PI / 2 - 0.08}
      />
      <ViewLimits k={k} reach={FIELD_RADIUS - 8} height={70} target={FIELD_RADIUS - 25} />
      <BrawlerFocus spots={focusSpots} home={home} />
      <LiftDrag max={30} />
      <PullBack k={pull} />
      <EffectComposer>
        <Bloom luminanceThreshold={1} luminanceSmoothing={0.15} intensity={0.65} mipmapBlur />
        <Vignette offset={0.25} darkness={0.7} />
      </EffectComposer>
    </>
  )
}

/** The model's height off its spot right now: a winged Bakugan hovers (see Hover in BakuganModels). */
const hoverOf = (model: THREE.Object3D) => model.children[0]?.position.y ?? 0

/** Whole-body motion of a move, in the model's own frame (forward = +Z). */
interface Motion {
  fwd: number
  lift: number
  pitch: number
  yaw: number
  shake: number
}

/**
 * The body motion `t` s into `move`. `bend` scales how far it rears up or leans: a long body rears up less, so its
 * tail does not swing down through the card (it is lifted off the card for the rest).
 */
function motionAt(move: Move, t: number, m: Motion, bend = 1) {
  m.fwd = m.lift = m.pitch = m.yaw = m.shake = 0
  switch (move) {
    case 'bite':
      m.fwd = 1.1 * env(t, 0.1, 0.85)
      m.pitch = 0.08 * env(t, 0.2, 0.8)
      break
    case 'breath':
      m.fwd = -0.35 * env(t, 0, 1.5)
      m.pitch = -0.1 * env(t, 0, 1.5)
      break
    case 'clawSwipe':
      m.pitch = -0.38 * env(t, 0, 0.7)
      m.fwd = 0.7 * env(t, 0.35, 0.95)
      m.yaw = 0.25 * env(t, 0.3, 0.95)
      break
    case 'tailWhip':
      // full spin so the tail sweeps through the opponent
      m.yaw = THREE.MathUtils.smoothstep(t, 0.05, 1.05) * Math.PI * 2
      m.fwd = 0.4 * env(t, 0.05, 1.05)
      break
    case 'stomp':
      m.pitch = -0.55 * env(t, 0, 0.75)
      m.lift = 0.25 * env(t, 0, 0.75)
      if (t > 0.72 && t < 1.1) m.shake = Math.sin(t * 90) * 0.06 * (1.1 - t) * 3
      break
    case 'roar':
      m.pitch = -0.25 * env(t, 0, 1.5)
      m.shake = Math.sin(t * 60) * 0.02 * env(t, 0.2, 1.4)
      break
    case 'guard':
      m.fwd = -0.45 * env(t, 0, 1.4)
      m.lift = -0.15 * env(t, 0, 1.4)
      break
    case 'hit': {
      const h = env(t, IMPACT_AT - 0.03, IMPACT_AT + 0.55)
      m.fwd = -0.9 * h
      m.pitch = -0.18 * h
      m.yaw = 0.15 * h
      if (h > 0) m.shake = Math.sin(t * 80) * 0.08 * h
      break
    }
  }
  m.pitch *= bend
  return m
}

const _motion: Motion = { fwd: 0, lift: 0, pitch: 0, yaw: 0, shake: 0 }
const _euler = new THREE.Euler()
const _hip = new THREE.Matrix4()
const _mm = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _up = new THREE.Vector3(0, 1, 0)
const _p = new THREE.Vector3()
const _s = new THREE.Vector3()

/** Where a motion puts the model's frame: the motion group (turning round the hips) with the frame group in it. */
function motionMatrix(m: Motion, out: THREE.Matrix4) {
  out.makeRotationFromEuler(_euler.set(m.pitch, m.yaw, 0))
  out.setPosition(m.shake, m.lift, -HIP_Z + m.fwd)
  return out.multiply(_hip.makeTranslation(0, 0, HIP_Z))
}

/**
 * How low the model reaches (model units, from its spot) in each pose it can strike, so it can be lifted just
 * enough to stay on the card: `idle` for the idle sway, `moves` per move every 0.1 s.
 */
interface GroundTable {
  idle: number
  moves: Partial<Record<Move, number[]>>
}

/** Lowest point of a model in `pose` (from its table), counting the next table step too so it never dips early. */
function lowestIn(tab: GroundTable, pose: Pose | null, now: number) {
  if (!pose || pose.start === null) return tab.idle
  const steps = tab.moves[pose.move]
  if (!steps) return tab.idle
  const i = Math.max(0, Math.floor((now - pose.start) * 10))
  return Math.min(steps[i] ?? tab.idle, steps[i + 1] ?? tab.idle)
}

/** How a Bakugan stands, from its size and shape once loaded (model units). */
interface Stance {
  /** Turn of the front towards the usual view (radians, before the side's sign). */
  turn: number
  /** Growth about its front, so slim or small Bakugan still read. */
  boost: number
  /** Middle of its body along its length: it turns round here. */
  pivot: number
  /** Half its width, for the roll when it falls. */
  halfWidth: number
  /** How far it rears up and leans in its moves (1 = fully; long bodies less). */
  bend: number
}

/**
 * One Bakugan on the field: rises out of its thrown ball, lunges, flinches and falls when defeated. It stands on the
 * card (lifted when a pose would dip into it), and slim or small ones stand a little bigger and turned partly to the
 * view so they read from afar.
 */
function Fighter({
  side,
  entrant,
  event,
  shield,
  blockFlash,
  defeated,
  onShieldReach,
  throwAt,
  waitThrow,
  ground,
  presence,
  over,
}: {
  side: SideIndex
  entrant: Entrant
  event: Props['event']
  shield: boolean
  blockFlash: number
  defeated: boolean
  /** Tells the scene how far the shield reaches out in front of this Bakugan's spot (world units). */
  onShieldReach: (side: SideIndex, entrant: Entrant, reach: number) => void
  /** Clock time each side's latest throw started, or null before its first. */
  throwAt: React.RefObject<[number | null, number | null]>
  /** The battle starts with an empty field: stay hidden until the first throw lands. */
  waitThrow: boolean
  /** Height of the card's top (world units). */
  ground: number
  /** The view's pull-back factor for presence (1 = usual view): next to a giant the others stand bigger. */
  presence: number
  /** The battle is decided (one side is down): the winner goes back into its ball a moment later. */
  over: boolean
}) {
  const element = ELEMENT_BY_ID[entrant.bakugan.element]
  const ref = useRef<THREE.Group>(null)
  // when it rose out (null while it waits to be thrown in)
  const born = useRef<number | null>(null)
  const anim = useRef<Pose | null>(null)
  const stanceGroup = useRef<THREE.Group>(null)
  const motion = useRef<THREE.Group>(null)
  const frame = useRef<THREE.Group>(null)
  const model = useRef<THREE.Group>(null)
  const shadow = useRef<THREE.Mesh>(null)
  const fallen = useRef(0)
  // once defeated it stays down until the next throw (the battle clears `defeated` before that)
  const down = useRef(false)
  // its size on the field last frame, for shrinking back into the ball from where it is
  const shown = useRef(0)
  const recallFrom = useRef(0)
  // back in its ball after winning a battle, until the next throw (and when the battle was decided)
  const parked = useRef(false)
  const overAt = useRef<number | null>(null)
  const facing = side === 0 ? 1 : -1
  const x = xOf(side, entrant)
  // a throw: the Bakugan goes back into its ball at once, and comes out of the thrown one when it lands
  const recalled = useRef(-99)
  const seenThrow = useRef<number | null>(null)
  // the light pillar it rises in: played on entry, and again when a thrown ball lands (key -1: none yet)
  const [pillar, setPillar] = useState({ key: -1, delay: 0 })
  // how it stands (known once the model is in), how far it is turned now, and how high it is lifted off the card
  const stance = useRef<Stance>({ turn: 0, boost: 1, pivot: 0, halfWidth: 1, bend: 1 })
  const turned = useRef(0)
  const raised = useRef(0)
  // squares up to the opponent for this long (s) when it acts or is targeted
  const squareFor = useRef(0)
  // the shield is sized once the model has loaded, round every pose it strikes (idle sway and every move)
  const [fit, setFit] = useState<ShieldFit | null>(null)
  const sweep = useRef<{
    sampler: ModelSampler
    rig: Rig | null
    poses: ReturnType<typeof poseList>
    next: number
    pts: number[]
    fit: ShieldFit | null
    check: number
    ground: GroundTable
  } | null>(null)

  useEffect(() => {
    if (!event) return
    const { actor, target, action, damage, blocked } = event.event
    if (action.kind === 'switch') return
    const ability = action.kind === 'ability' ? action.card.ability : null
    const hostile = !ability || ability.type === 'attack' || ability.type === 'drain' || ability.type === 'finisher'
    if (actor === side || target === side) squareFor.current = ACTION_DURATION + 0.3
    if (actor === side) {
      const move = moveFor(ability)
      anim.current = { kind: hostile ? 'lunge' : 'cast', move, start: null }
    } else if (target === side && damage > 0 && !blocked) anim.current = { kind: 'hit', move: 'hit', start: null }
  }, [event, side])

  // the shield grows with the Bakugan, about its front
  const reachOf = (f: ShieldFit) => {
    const { boost } = stance.current
    return (boost * (f.center.z + f.radii.z) + (1 - boost) * FRONT_AT) * FIGHTER_SCALE
  }
  const measuredFor = useRef(presence)

  /** Measures the model as it stands: how much it turns to the view, grows, and where its middle is. */
  const measure = (sampler: ModelSampler, fr: THREE.Object3D) => {
    const pts: number[] = []
    sampleInto(sampler, fr, pts)
    const box = new THREE.Box3()
    for (let i = 0; i < pts.length; i += 3) box.expandByPoint(_p.set(pts[i], pts[i + 1], pts[i + 2]))
    const size = box.getSize(new THREE.Vector3())
    const turn = STANCE_TURN * THREE.MathUtils.smoothstep(size.x / Math.max(size.z, 1e-3), 1, 2.2)
    // what the usual view sees of it: its height, and its length and width as turned
    const seen = size.z * Math.cos(turn) + size.x * Math.sin(turn)
    const boost = THREE.MathUtils.clamp(
      Math.max((MIN_PRESENCE * presence) / Math.sqrt(size.y * seen), (MIN_HEIGHT * presence) / size.y),
      1,
      MAX_BOOST,
    )
    stance.current = {
      turn,
      boost,
      pivot: (box.min.z + box.max.z) / 2,
      halfWidth: Math.max(-box.min.x, box.max.x),
      // rearing up turns round the hips (at -HIP_Z): keep the drop of the far end behind them small
      bend: Math.min(1, 1.6 / Math.max(1e-3, -HIP_Z - box.min.z)),
    }
    return pts
  }

  /**
   * Sizes the shield and learns how low the model reaches: once the model is in, it is put through every pose it
   * can strike (a few each frame); the bubble is fitted round all of them, and each pose's lowest point is kept.
   * While the shield is up, the live pose is checked too and the bubble grows if anything ever pokes out.
   */
  const fitShieldStep = (now: number) => {
    const mdl = model.current
    const fr = frame.current
    if (!mdl || !fr) return
    const sw = sweep.current
    if (!sw) {
      let loaded = false
      mdl.traverseVisible((o) => {
        loaded ||= (o as THREE.Mesh).isMesh
      })
      if (!loaded) return
      const sampler = samplerFor(mdl)
      const rest = measure(sampler, fr)
      measuredFor.current = presence
      let low = Infinity
      for (let i = 1; i < rest.length; i += 3) low = Math.min(low, rest[i])
      sweep.current = {
        sampler,
        rig: rigOf(mdl),
        poses: poseList(ACTION_DURATION),
        next: 0,
        pts: [],
        fit: null,
        check: 0,
        ground: { idle: low, moves: {} },
      }
      return
    }
    // a giant came onto the field (or left): stand bigger (or back to size)
    if (measuredFor.current !== presence) {
      measuredFor.current = presence
      measure(sw.sampler, fr)
      if (sw.fit) onShieldReach(side, entrant, reachOf(sw.fit))
    }
    const publish = (f: ShieldFit) => {
      sw.fit = f
      setFit(f)
      onShieldReach(side, entrant, reachOf(f))
    }
    if (sw.next < sw.poses.length) {
      // a few milliseconds of poses per frame
      const start = performance.now()
      const lift = hoverLift(hoverOf(mdl))
      const tab = sw.ground
      if (sw.next === 0) tab.idle = Infinity
      while (sw.next < sw.poses.length && performance.now() - start < 6) {
        const pose = sw.poses[sw.next++]
        const from = sw.pts.length
        sampleInPoses(sw.sampler, mdl, fr, sw.rig, [pose], sw.pts, lift)
        // the pose's lowest point once the body motion of its move is added
        const [move, t] = pose
        const e = move ? motionMatrix(motionAt(move, t, _motion, stance.current.bend), _mm).elements : null
        let low = Infinity
        for (let i = from; i < sw.pts.length; i += 3) {
          const y = e ? e[1] * sw.pts[i] + e[5] * sw.pts[i + 1] + e[9] * sw.pts[i + 2] + e[13] : sw.pts[i + 1]
          if (y < low) low = y
        }
        if (!move) tab.idle = Math.min(tab.idle, low)
        else {
          const steps = (tab.moves[move] ??= [])
          const i = Math.round(t * 10)
          steps[i] = Math.min(steps[i] ?? Infinity, low)
        }
      }
      const f = fitShield(sw.pts)
      sw.pts = outerShell(sw.pts, f)
      // a first bubble right away, the full one when every pose is in
      if (!sw.fit || sw.next >= sw.poses.length) publish(f)
      else sw.fit = f
      return
    }
    if (!shield || now < sw.check || !sw.fit) return
    sw.check = now + 0.25
    const live: number[] = []
    sampleInto(sw.sampler, fr, live)
    let out = false
    for (let i = 0; i < live.length && !out; i += 3) out = depthIn(sw.fit, live[i], live[i + 1], live[i + 2]) > 0.98
    if (out) {
      sw.pts.push(...live)
      const f = fitShield(sw.pts)
      sw.pts = outerShell(sw.pts, f)
      publish(f)
    }
  }

  useFrame(({ clock }, dt) => {
    const g = ref.current
    if (!g) return
    const now = clock.elapsedTime
    const ta = throwAt.current[side]
    // on the field from the start, unless the battle throws its Bakugan in (then only a throw brings it out)
    if (born.current === null && !waitThrow && (ta === null || now - ta >= THROW_LAND)) {
      born.current = now
      setPillar({ key: 0, delay: 0 })
    }
    if (ta !== seenThrow.current) {
      seenThrow.current = ta
      if (ta !== null && now - ta < THROW_LAND) {
        // out again when the ball lands
        recalled.current = now
        recallFrom.current = shown.current
        born.current = ta + THROW_LAND - 0.25
        setPillar((p) => ({ key: p.key + 1, delay: ta + THROW_LAND - 0.1 - now }))
        down.current = defeated
        parked.current = false
        fallen.current = defeated ? 1 : 0
        anim.current = null
      }
    }
    fitShieldStep(now)
    g.visible = born.current !== null
    if (born.current === null) return

    // a battle won: the winner returns to its ball (in a flash of light), leaving the field empty for the next one
    if (!over) overAt.current = null
    else if (waitThrow && !down.current && !parked.current) {
      overAt.current ??= now
      if (now - overAt.current > 2.6) {
        parked.current = true
        recalled.current = now
        recallFrom.current = shown.current
        setPillar((p) => ({ key: p.key + 1, delay: 0 }))
      }
    }
    const grow = parked.current ? 0 : THREE.MathUtils.clamp((now - born.current - 0.4) / 0.7, 0, 1)
    // shrinking back into the ball when recalled
    const shrink = recallFrom.current * (1 - THREE.MathUtils.smoothstep(now - recalled.current, 0, 0.3))
    down.current ||= defeated
    fallen.current = THREE.MathUtils.damp(fallen.current, down.current ? 1 : 0, 3, dt)

    // whole-body motion of the current move, in the model's own frame (forward = +Z)
    const a = anim.current
    if (a) {
      a.start ??= now
      if (now - a.start > ACTION_DURATION) anim.current = null
    }
    const mo =
      anim.current?.start != null ? motionAt(anim.current.move, now - anim.current.start, _motion, stance.current.bend) : null
    const m = motion.current
    if (m) {
      m.position.set(mo?.shake ?? 0, mo?.lift ?? 0, -HIP_Z + (mo?.fwd ?? 0))
      m.rotation.set(mo?.pitch ?? 0, mo?.yaw ?? 0, 0)
    }

    // the stance: turned towards the view while waiting, grown about its front, lifted off the card when a pose dips
    const st = stance.current
    squareFor.current = Math.max(0, squareFor.current - dt)
    turned.current = THREE.MathUtils.damp(turned.current, squareFor.current > 0 ? 0 : st.turn, 6, dt)
    const low = sweep.current ? lowestIn(sweep.current.ground, anim.current, now) : 0
    // a little to spare in a move, for its quickest dips between the table's steps
    const need = Math.max(0, -(low - (anim.current ? 0.04 : 0)) * st.boost)
    // rises at once, settles back gently
    raised.current = Math.max(need, THREE.MathUtils.damp(raised.current, need, 8, dt))
    const sg = stanceGroup.current
    if (sg) {
      const b = st.boost
      const pivot = b * st.pivot + (1 - b) * FRONT_AT
      _q.setFromAxisAngle(_up, -facing * turned.current)
      _p.set(0, 0, (1 - b) * FRONT_AT - pivot).applyQuaternion(_q)
      _p.y += raised.current
      _p.z += pivot
      sg.matrix.compose(_p, _q, _s.setScalar(b))
      sg.matrixWorldNeedsUpdate = true
    }
    shadow.current?.scale.setScalar(3.2 * st.boost)

    const s = Math.max(Math.max(1 - Math.pow(1 - grow, 3), shrink), 0.001) * (1 - fallen.current * 0.999)
    g.scale.setScalar(Math.max(s, 0.001))
    shown.current = s
    // falling over: it rolls onto its side, its lower edge staying on the card
    const roll = fallen.current * 0.5
    g.rotation.z = roll * facing
    g.position.set(x, ground + Math.sin(roll) * st.halfWidth * st.boost * FIGHTER_SCALE * s, 0)
  })

  return (
    <group>
      <group ref={ref} rotation={[0, (Math.PI / 2) * facing, 0]} scale={0.001} visible={false}>
        <group scale={FIGHTER_SCALE}>
          <group ref={stanceGroup} matrixAutoUpdate={false}>
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
          </group>
          <BlobShadow ref={shadow} size={3.2} />
        </group>
      </group>
      {pillar.key >= 0 && (
        <group position={[x, ground, 0]} scale={FIGHTER_SCALE}>
          <EntryPillar key={pillar.key} color={element.glow} delay={pillar.delay} />
        </group>
      )}
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

/** Light pillar that plays once when the fighters appear (after `delay` s: when a thrown ball lands). */
function EntryPillar({ color, delay = 0 }: { color: string; delay?: number }) {
  const ref = useRef<THREE.Group>(null)
  const t = useRef(0)
  useFrame((_, dt) => {
    t.current += dt
    if (ref.current) ref.current.visible = t.current < delay + 1.8
  })
  return (
    <group ref={ref}>
      <LightPillar color={color} duration={1.6} delay={delay} />
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
