import { Suspense, type RefObject } from 'react'
import { formModels, type Bakugan, type Entrant } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { asset } from '../asset'
import { BakuganBall } from './BakuganBall'
import { NormalizedModel } from './NormalizedModel'
import { PlaceholderMonster } from './PlaceholderMonster'
import type { PoseRef } from './pose'

export const MONSTER_HEIGHT = 3
export const BALL_SIZE = 1

/**
 * The monster form: the form's (or Bakugan's) .glb when provided, otherwise the procedural
 * stand-in. Evolved forms stand a little taller.
 */
export function MonsterModel({ entrant, poseRef }: { entrant: Entrant; poseRef?: PoseRef }) {
  const element = ELEMENT_BY_ID[entrant.bakugan.element]
  const models = formModels(entrant)
  const size = 1 + entrant.form * 0.12
  const placeholder = (
    <group scale={size}>
      <PlaceholderMonster color={element.color} glow={element.glow} poseRef={poseRef} />
    </group>
  )
  if (!models?.monster) return placeholder
  return (
    <Suspense fallback={placeholder}>
      <NormalizedModel url={asset(models.monster)} height={MONSTER_HEIGHT * size} yaw={models.monsterYaw} poseRef={poseRef} />
    </Suspense>
  )
}

/** The ball form. The procedural ball can open (`openRef`); a .glb ball is shown as-is. */
export function BallModel({ bakugan, openRef }: { bakugan: Bakugan; openRef: RefObject<boolean> }) {
  const element = ELEMENT_BY_ID[bakugan.element]
  const placeholder = <BakuganBall color={element.color} openRef={openRef} />
  if (!bakugan.models?.ball) return placeholder
  return (
    <Suspense fallback={placeholder}>
      <group position={[0, -BALL_SIZE / 2, 0]}>
        <NormalizedModel url={asset(bakugan.models.ball)} height={BALL_SIZE} />
      </group>
    </Suspense>
  )
}
