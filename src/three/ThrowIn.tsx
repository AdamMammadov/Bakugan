import { useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Entrant } from '../data/bakugan'
import { BallModel } from './BakuganModels'

/** Seconds from the throw gesture starting to the ball leaving the hand, and its flight to the field. */
export const THROW_RELEASE = 0.45
export const THROW_FLIGHT = 0.85
/** When the ball lands, counted from the start of the throw; the Bakugan pops out of it right after. */
export const THROW_LAND = THROW_RELEASE + THROW_FLIGHT

const TAIL = 7

/**
 * A brawler's throw at the start of a round: the Bakugan's ball leaves the hand, flies in an arc with a glowing
 * tail, bounces once on the field and opens, and is gone when the Bakugan rises out of the light.
 */
export function ThrownBall({
  from,
  to,
  entrant,
  color,
  size = 2.4,
}: {
  from: THREE.Vector3
  to: THREE.Vector3
  entrant: Entrant
  color: string
  /** Ball size (world units). */
  size?: number
}) {
  const ball = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Group>(null)
  const tail = useRef<THREE.Group>(null)
  const open = useRef(false)
  const start = useRef<number | null>(null)
  const apex = useMemo(() => Math.max(from.y, to.y) + 14 + from.distanceTo(to) * 0.12, [from, to])

  /** Where the ball is `t` seconds into its flight (0 → 1 over THROW_FLIGHT), with a small bounce after landing. */
  const pathAt = useMemo(
    () => (t: number, out: THREE.Vector3) => {
      const k = THREE.MathUtils.clamp(t / THROW_FLIGHT, 0, 1)
      out.lerpVectors(from, to, k)
      // a parabola through the start, the apex and the landing spot
      const base = THREE.MathUtils.lerp(from.y, to.y, k)
      out.y = base + 4 * (apex - Math.max(from.y, to.y)) * k * (1 - k)
      const after = t - THROW_FLIGHT
      if (after > 0) out.y = to.y + Math.max(0, Math.sin(Math.min(1, after / 0.3) * Math.PI)) * size * 0.8
      return out
    },
    [from, to, apex, size],
  )

  useFrame(({ clock }) => {
    start.current ??= clock.elapsedTime
    const t = clock.elapsedTime - start.current - THROW_RELEASE
    const g = ball.current
    if (!g) return
    // in the hand until it is let go, gone once the Bakugan is out
    g.visible = t >= 0 && t < THROW_FLIGHT + 0.65
    if (!g.visible) {
      if (tail.current) tail.current.visible = false
      return
    }
    pathAt(t, g.position)
    open.current = t > THROW_FLIGHT + 0.3
    if (spin.current && t < THROW_FLIGHT + 0.3) spin.current.rotation.set(t * 14, t * 9, 0)
    if (tail.current) {
      tail.current.visible = t < THROW_FLIGHT
      tail.current.children.forEach((c, i) => {
        pathAt(Math.max(0, t - (i + 1) * 0.035), c.position)
        c.scale.setScalar(size * 0.45 * (1 - i / TAIL))
      })
    }
  })

  return (
    <>
      <group ref={ball} visible={false}>
        <group ref={spin} scale={size}>
          <Suspense fallback={null}>
            <BallModel bakugan={entrant.bakugan} form={entrant.form} openRef={open} skin={entrant.skin} />
          </Suspense>
        </group>
        <mesh scale={size * 0.85}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshBasicMaterial color={color} transparent opacity={0.35} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
      <group ref={tail} visible={false}>
        {Array.from({ length: TAIL }, (_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[1, 10, 8]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.5 * (1 - i / TAIL)}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
    </>
  )
}
