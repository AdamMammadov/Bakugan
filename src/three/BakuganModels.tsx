import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { formModels, type Bakugan, type Entrant } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { asset } from '../asset'
import { BakuganBall } from './BakuganBall'
import { PROCEDURAL_BALLS } from './balls/procedural'
import { NormalizedModel } from './NormalizedModel'
import { SKIN_BY_ID } from '../season/season'
import { PlaceholderMonster } from './PlaceholderMonster'
import type { PoseRef } from './pose'
import { Sparkles } from './Sparkles'

export const MONSTER_HEIGHT = 3
export const BALL_SIZE = 1

/**
 * The monster form: the form's (or Bakugan's) .glb when provided, otherwise the procedural
 * stand-in. Evolved forms stand a little taller.
 */
export function MonsterModel({
  entrant,
  poseRef,
  frontAt,
  showcase,
}: {
  entrant: Entrant
  poseRef?: PoseRef
  /** In the arena: where the monster's front stands, so long bodies never reach into the opponent. */
  frontAt?: number
  /**
   * Shown on its own (showroom, inventory): slim Bakugan grow a little and wings may spread wider,
   * so every Bakugan fills the stage about as much as the others.
   */
  showcase?: boolean
}) {
  const base = ELEMENT_BY_ID[entrant.bakugan.element]
  // an equipped skin recolours the Bakugan, or swaps in its own model (model skins)
  const skin = entrant.skin ? SKIN_BY_ID[entrant.skin] : undefined
  const skinModel = skin?.models?.[entrant.bakugan.id]
  const element = skin ? { ...base, color: skin.color, glow: skin.glow } : base
  const models = formModels(entrant)
  const size = (1 + entrant.form * 0.12) * (models?.scale ?? 1)
  const placeholder = (
    <group scale={size}>
      <PlaceholderMonster color={element.color} glow={element.glow} poseRef={poseRef} />
    </group>
  )
  // a Legendary skin shows off with sparkles around the Bakugan
  const sparkles = skin?.rarity === 'legendary' && (
    <Sparkles
      count={40}
      scale={[MONSTER_HEIGHT * size, MONSTER_HEIGHT * size * 1.2, MONSTER_HEIGHT * size]}
      position={[0, (MONSTER_HEIGHT * size) / 2, 0]}
      size={6}
      speed={0.4}
      color={skin.glow}
    />
  )
  if (!models?.monster)
    return (
      <>
        {placeholder}
        {sparkles}
      </>
    )
  return (
    <Hover on={!!models.fly && !skinModel}>
      {/* nothing until the real model has loaded, so the stand-in never flashes up first */}
      <Suspense fallback={null}>
        <NormalizedModel
          url={asset(skinModel ?? models.monster)}
          height={MONSTER_HEIGHT * size}
          // wide wings must not reach across the field; a model can allow itself more (models.length)
          maxLength={
            MONSTER_HEIGHT * size * Math.max(showcase ? 2.4 : 0, skinModel ? 2 : (models.length ?? (models.fly ? 1.25 : 2)))
          }
          fill={showcase ? (models.fill ?? 1.3) : 1}
          frontAt={frontAt}
          yaw={models.monsterYaw}
          poseRef={poseRef}
          tint={skinModel ? undefined : skin ? { color: skin.color, glow: skin.glow } : models.tint}
        />
      </Suspense>
      {sparkles}
    </Hover>
  )
}

/** Winged Bakugan hover above the ground, rising and sinking gently. */
function Hover({ on, children }: { on: boolean; children: React.ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = on ? MONSTER_HEIGHT * (0.25 + Math.sin(clock.elapsedTime * 1.6) * 0.05) : 0
  })
  return <group ref={ref}>{children}</group>
}

/** The ball form. The procedural ball can open (`openRef`); a .glb ball is shown as-is. */
export function BallModel({
  bakugan,
  form = 0,
  openRef,
  skin: skinId,
}: {
  bakugan: Bakugan
  /** An evolution can have a ball of its own; otherwise the Bakugan's ball is used. */
  form?: number
  openRef: RefObject<boolean>
  skin?: string
}) {
  const ballUrl = bakugan.evolutions[form]?.models?.ball ?? bakugan.models?.ball
  const skin = skinId ? SKIN_BY_ID[skinId] : undefined
  const element = skin ? { ...ELEMENT_BY_ID[bakugan.element], color: skin.color } : ELEMENT_BY_ID[bakugan.element]
  // a skinned ball uses the plain ball so the skin colour shows
  const Custom = skin ? undefined : PROCEDURAL_BALLS[bakugan.id]
  const placeholder = Custom ? <Custom openRef={openRef} /> : <BakuganBall color={element.color} openRef={openRef} />
  if (!ballUrl) return placeholder
  const figure = bakugan.models?.figure
  const creature = formModels({ bakugan, form })?.monster
  return (
    <Suspense fallback={null}>
      <group position={[0, -BALL_SIZE / 2, 0]}>
        <NormalizedModel
          url={asset(ballUrl)}
          height={BALL_SIZE}
          openRef={openRef}
          tint={skin ? { color: skin.color, glow: skin.glow } : undefined}
        />
        {figure && creature && (
          <OpenFigure
            url={asset(skin?.models?.[bakugan.id] ?? creature)}
            height={BALL_SIZE * figure}
            length={formModels({ bakugan, form })?.length ?? 2}
            openRef={openRef}
            tint={skin ? { color: skin.color, glow: skin.glow } : undefined}
          />
        )}
      </group>
    </Suspense>
  )
}

/** Where the creature stands in an open pod ball: on the base's floor, a little above the ball's bottom. */
const FIGURE_FLOOR = BALL_SIZE * 0.06

/**
 * The creature itself, small, rising out of a ball that opens like a pod (as a Bakugan pops open on a Gate Card):
 * it grows from the ball's floor as the shell opens, and shrinks back into it when the ball closes.
 */
function OpenFigure({
  url,
  height,
  length,
  openRef,
  tint,
}: {
  url: string
  height: number
  /** How wide its wings may spread, in heights. */
  length: number
  openRef: RefObject<boolean>
  tint?: { color: string; glow: string }
}) {
  const group = useRef<THREE.Group>(null)
  const amount = useRef(0)
  useFrame((_, dt) => {
    amount.current = THREE.MathUtils.damp(amount.current, openRef.current ? 1 : 0, 4, dt)
    const g = group.current
    if (!g) return
    // it rises once the shell has started to open
    const k = THREE.MathUtils.smootherstep(amount.current, 0.2, 1)
    g.scale.setScalar(Math.max(k, 0.001))
    g.visible = k > 0.01
  })
  return (
    <group ref={group} position={[0, FIGURE_FLOOR, 0]} visible={false} scale={0.001}>
      <NormalizedModel url={url} height={height} maxLength={height * length} tint={tint} />
    </group>
  )
}

/** Starts downloading a Bakugan's models ahead of time so the brawl doesn't stall on them. */
export function preloadModels(bakugan: Bakugan) {
  const urls = [
    bakugan.models?.ball,
    bakugan.models?.monster,
    ...bakugan.evolutions.flatMap((e) => [e.models?.ball, e.models?.monster]),
  ]
  for (const url of urls) if (url) useGLTF.preload(asset(url))
}
