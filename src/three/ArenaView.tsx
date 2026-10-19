import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'

type Controls = { target: THREE.Vector3; update: () => void } | null

/**
 * Keeps the free camera inside the stadium: the player may turn round the field and zoom (towards the cursor)
 * anywhere, but never into the stands or under the field. Sizes scale with the view (`k`).
 */
export function ViewLimits({ k, reach, height, target }: { k: number; reach: number; height: number; target: number }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as Controls
  useFrame(() => {
    if (!controls) return
    const t = controls.target
    const tr = Math.hypot(t.x, t.z)
    if (tr > target * k) t.multiply(new THREE.Vector3((target * k) / tr, 1, (target * k) / tr))
    t.setY(THREE.MathUtils.clamp(t.y, 0.5, height * k * 0.6))
    const p = camera.position
    const r = Math.hypot(p.x, p.z)
    if (r > reach * k) p.multiply(new THREE.Vector3((reach * k) / r, 1, (reach * k) / r))
    p.setY(THREE.MathUtils.clamp(p.y, 1.5, height * k))
  })
  return null
}

/**
 * Double-click a brawler to fly the camera to them (then turn and zoom round them); double-click anywhere else
 * to go back to the usual view of the two Bakugan.
 */
export function BrawlerFocus({
  spots,
  home,
}: {
  /** Each brawler's chest and the way they face, in world space. */
  spots: { at: THREE.Vector3; facing: THREE.Vector3; size: number }[]
  /** The usual view: camera position and look-at point. */
  home: () => { position: THREE.Vector3; target: THREE.Vector3 }
}) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls) as unknown as Controls
  const el = useThree((s) => s.gl.domElement)
  const fly = useRef<{ from: [THREE.Vector3, THREE.Vector3]; to: [THREE.Vector3, THREE.Vector3]; t: number } | null>(null)
  const spotsRef = useRef(spots)
  const homeRef = useRef(home)
  useEffect(() => {
    spotsRef.current = spots
    homeRef.current = home
  }, [spots, home])

  useEffect(() => {
    if (!controls) return
    const onDouble = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      let best: (typeof spots)[number] | null = null
      let bestD = Infinity
      for (const s of spotsRef.current) {
        const v = s.at.clone().project(camera)
        if (v.z > 1) continue
        const d = Math.hypot(((v.x + 1) / 2) * rect.width - px, ((1 - v.y) / 2) * rect.height - py)
        // close enough to the brawler on screen (bigger when they are drawn bigger)
        const r = Math.max(60, (s.size / s.at.distanceTo(camera.position)) * rect.height * 0.9)
        if (d < r && d < bestD) {
          best = s
          bestD = d
        }
      }
      let to: [THREE.Vector3, THREE.Vector3]
      if (best) {
        const pos = best.at
          .clone()
          .addScaledVector(best.facing, best.size * 2.6)
          .add(new THREE.Vector3(0, best.size * 0.35, 0))
        to = [pos, best.at.clone()]
      } else {
        const h = homeRef.current()
        to = [h.position, h.target]
      }
      fly.current = { from: [camera.position.clone(), controls.target.clone()], to, t: 0 }
    }
    el.addEventListener('dblclick', onDouble)
    return () => el.removeEventListener('dblclick', onDouble)
  }, [controls, camera, el])

  useFrame((_, dt) => {
    const f = fly.current
    if (!f || !controls) return
    f.t = Math.min(1, f.t + dt / 0.9)
    const k = THREE.MathUtils.smootherstep(f.t, 0, 1)
    camera.position.lerpVectors(f.from[0], f.to[0], k)
    controls.target.lerpVectors(f.from[1], f.to[1], k)
    controls.update()
    if (f.t >= 1) fly.current = null
  })
  return null
}
