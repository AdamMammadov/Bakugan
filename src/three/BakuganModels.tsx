import { Suspense, type RefObject } from 'react'
import type { Bakugan } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { asset } from '../asset'
import { BakuganBall } from './BakuganBall'
import { NormalizedModel } from './NormalizedModel'
import { PlaceholderMonster } from './PlaceholderMonster'

export const MONSTER_HEIGHT = 3
export const BALL_SIZE = 1

/** The monster form: the Bakugan's .glb when provided, otherwise the procedural stand-in. */
export function MonsterModel({ bakugan }: { bakugan: Bakugan }) {
  const element = ELEMENT_BY_ID[bakugan.element]
  const placeholder = <PlaceholderMonster color={element.color} glow={element.glow} />
  if (!bakugan.models?.monster) return placeholder
  return (
    <Suspense fallback={placeholder}>
      <NormalizedModel url={asset(bakugan.models.monster)} height={MONSTER_HEIGHT} yaw={bakugan.models.monsterYaw} />
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
