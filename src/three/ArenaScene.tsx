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
import { BrawlerFocus, ViewLimits } from './ArenaView'
import { MonsterModel } from './BakuganModels'
import { BlobShadow } from './BlobShadow'
import { Brawler, type BrawlerGesture } from './Brawler'
import { GateCard } from './GateCard'
import type { AvatarParts } from '../profile/avatar'
import { LightPillar } from './LightPillar'
import { env, moveFor, type Pose } from './pose'
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
  /** Changes when a new round starts: both brawlers throw their Bakugan onto the field again. */
  throwKey?: number
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

/** Where a brawler stands (world space) for a stadium of size `k`, and where they look: towards the field's middle. */
const brawlerSpot = (side: SideIndex, k: number) => {
  const at = new THREE.Vector3((side === 0 ? -BRAWLER_X : BRAWLER_X) * k, 0, -BRAWLER_Z * k)
  return { at, facing: at.clone().negate().setY(0).normalize() }
}

export function ArenaScene({ fighters, gate, event, shields, defeated, brawlers, throwKey }: Props) {
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
  const onField = useMemo(() => [model0 ?? '', model1 ?? ''], [model0, model1])
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

  // a new round: both brawlers throw their Bakugan in again (nothing to throw on the first render)
  const [firstThrow] = useState(throwKey)
  const throwing = throwKey !== firstThrow
  const throwAt = useRef<number | null>(null)
  const seenThrow = useRef(firstThrow)
  useFrame(({ clock }) => {
    if (seenThrow.current === throwKey) return
    seenThrow.current = throwKey
    throwAt.current = clock.elapsedTime
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
  useEffect(() => {
    if (throwKey === firstThrow) return
    const timer = setTimeout(() => crowd('cheer'), THROW_LAND * 1000)
    return () => clearTimeout(timer)
  }, [throwKey, firstThrow])
  // the fans greet the Bakugan as they come onto the field
  useEffect(() => {
    const timer = setTimeout(() => crowd('cheer'), 1200)
    return () => clearTimeout(timer)
  }, [])

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

      {/* the field Gate Card both Bakugan stand on */}
      <group rotation={[0, Math.PI / 2, 0]} scale={CARD_SCALE * k}>
        <Suspense fallback={null}>
          <GateCard icon={gateElement?.icon ?? asset('wheel/inner.webp')} color={gateElement?.color ?? '#9aa3b5'} glow={0.32} />
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
          throwAt={throwAt}
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
              throwKey={throwKey}
            />
          </Suspense>
          <BlobShadow size={0.9} />
        </group>
      ))}

      {throwing &&
        fighters.map((e, i) => (
          <ThrownBall
            key={`${throwKey}-${i}`}
            from={spots[i].at.clone().add(new THREE.Vector3(0, BRAWLER_SCALE * k * 2, 0))}
            to={new THREE.Vector3(xOf(i as SideIndex, e) - (i === 0 ? -1 : 1) * 6, 1.2, 0)}
            entrant={e}
            color={ELEMENT_BY_ID[e.bakugan.element].glow}
          />
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

/** One Bakugan on the field: rises in on entry, lunges, flinches and falls when defeated. */
function Fighter({
  side,
  entrant,
  event,
  shield,
  blockFlash,
  defeated,
  onShieldReach,
  throwAt,
}: {
  side: SideIndex
  entrant: Entrant
  event: Props['event']
  shield: boolean
  blockFlash: number
  defeated: boolean
  /** Tells the scene how far the shield reaches out in front of this Bakugan's spot (world units). */
  onShieldReach: (side: SideIndex, entrant: Entrant, reach: number) => void
  /** Clock time the latest throw started (a new round), or null before any. */
  throwAt: React.RefObject<number | null>
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
  // a throw: the Bakugan goes back into its ball at once, and comes out of the thrown one when it lands
  const recalled = useRef(-99)
  const seenThrow = useRef<number | null>(null)
  // the light pillar it rises in: played on entry, and again when a thrown ball lands
  const [pillar, setPillar] = useState({ key: 0, delay: 0 })
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
  } | null>(null)

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

  /**
   * Sizes the shield: once the model is in, it is put through every pose it can strike (a few each frame) and the
   * bubble is fitted round all of them; while the shield is up, the live pose is checked too and the bubble grows
   * if anything ever pokes out.
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
      if (loaded)
        sweep.current = {
          sampler: samplerFor(mdl),
          rig: rigOf(mdl),
          poses: poseList(ACTION_DURATION),
          next: 0,
          pts: [],
          fit: null,
          check: 0,
        }
      return
    }
    const publish = (f: ShieldFit) => {
      sw.fit = f
      setFit(f)
      onShieldReach(side, entrant, (f.center.z + f.radii.z) * FIGHTER_SCALE)
    }
    if (sw.next < sw.poses.length) {
      // a few milliseconds of poses per frame
      const start = performance.now()
      const lift = hoverLift(hoverOf(mdl))
      while (sw.next < sw.poses.length && performance.now() - start < 6) {
        sampleInPoses(sw.sampler, mdl, fr, sw.rig, sw.poses.slice(sw.next, sw.next + 6), sw.pts, lift)
        sw.next += 6
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
    born.current ??= now
    const ta = throwAt.current
    if (ta !== seenThrow.current) {
      seenThrow.current = ta
      if (ta !== null && now - ta < THROW_LAND) {
        // out again when the ball lands
        recalled.current = born.current + 1.1 <= now ? now : -99
        born.current = ta + THROW_LAND - 0.25
        setPillar((p) => ({ key: p.key + 1, delay: ta + THROW_LAND - 0.1 - now }))
        fallen.current = defeated ? 1 : 0
        anim.current = null
      }
    }
    const grow = THREE.MathUtils.clamp((now - born.current - 0.4) / 0.7, 0, 1)
    // shrinking back into the ball when recalled
    const shrink = 1 - THREE.MathUtils.smoothstep(now - recalled.current, 0, 0.3)
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

    const s = Math.max(Math.max(1 - Math.pow(1 - grow, 3), shrink), 0.001) * (1 - fallen.current * 0.999)
    g.scale.setScalar(Math.max(s, 0.001))
    g.position.set(x, -fallen.current * 0.5, 0)
    g.rotation.z = fallen.current * 0.5 * facing

    fitShieldStep(now)
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
        <EntryPillar key={pillar.key} color={element.glow} delay={pillar.delay} />
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
