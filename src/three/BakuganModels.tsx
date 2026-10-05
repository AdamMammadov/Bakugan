import { Sparkles, useGLTF } from '@react-three/drei'
import { Suspense, type ComponentType, type RefObject } from 'react'
import { formModels, type Bakugan, type Entrant } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { asset } from '../asset'
import { BakuganBall } from './BakuganBall'
import { HydranoidBall } from './balls/HydranoidBall'
import { NormalizedModel } from './NormalizedModel'
import { SKIN_BY_ID } from '../season/season'
import { PlaceholderMonster } from './PlaceholderMonster'
import type { PoseRef } from './pose'

export const MONSTER_HEIGHT = 3
export const BALL_SIZE = 1

/** Hand-built ball forms (with their own opening animation), keyed by Bakugan id. */
const PROCEDURAL_BALLS: Record<string, ComponentType<{ openRef: RefObject<boolean> }>> = {
  hydranoid: HydranoidBall,
}

/**
 * The monster form: the form's (or Bakugan's) .glb when provided, otherwise the procedural
 * stand-in. Evolved forms stand a little taller.
 */
export function MonsterModel({ entrant, poseRef }: { entrant: Entrant; poseRef?: PoseRef }) {
  const base = ELEMENT_BY_ID[entrant.bakugan.element]
  // an equipped skin recolours the Bakugan
  const skin = entrant.skin ? SKIN_BY_ID[entrant.skin] : undefined
  const element = skin ? { ...base, color: skin.color, glow: skin.glow } : base
  const models = formModels(entrant)
  const size = 1 + entrant.form * 0.12
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
    <>
      <Suspense fallback={placeholder}>
        <NormalizedModel
          url={asset(models.monster)}
          height={MONSTER_HEIGHT * size}
          maxLength={MONSTER_HEIGHT * size * 1.7}
          yaw={models.monsterYaw}
          poseRef={poseRef}
          tint={skin ? { color: skin.color, glow: skin.glow } : undefined}
        />
      </Suspense>
      {sparkles}
    </>
  )
}

/** The ball form. The procedural ball can open (`openRef`); a .glb ball is shown as-is. */
export function BallModel({ bakugan, openRef, skin: skinId }: { bakugan: Bakugan; openRef: RefObject<boolean>; skin?: string }) {
  const skin = skinId ? SKIN_BY_ID[skinId] : undefined
  const element = skin ? { ...ELEMENT_BY_ID[bakugan.element], color: skin.color } : ELEMENT_BY_ID[bakugan.element]
  // a skinned ball uses the plain ball so the skin colour shows
  const Custom = skin ? undefined : PROCEDURAL_BALLS[bakugan.id]
  const placeholder = Custom ? <Custom openRef={openRef} /> : <BakuganBall color={element.color} openRef={openRef} />
  if (!bakugan.models?.ball) return placeholder
  return (
    <Suspense fallback={placeholder}>
      <group position={[0, -BALL_SIZE / 2, 0]}>
        <NormalizedModel
          url={asset(bakugan.models.ball)}
          height={BALL_SIZE}
          openRef={openRef}
          tint={skin ? { color: skin.color, glow: skin.glow } : undefined}
        />
      </group>
    </Suspense>
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
