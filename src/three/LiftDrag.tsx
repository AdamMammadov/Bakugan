import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls } from 'three-stdlib'

/**
 * Right-drag moves the view up or down, so Bakugan hovering high up can be brought into frame;
 * left-drag still turns the model and the wheel zooms. The model follows the mouse as if grabbed.
 * Works with the scene's default OrbitControls (`makeDefault`). The look-at height stays between
 * `min` and `max`; when `resetKey` changes (e.g. another Bakugan picked) the view goes back to `base`.
 */
export function LiftDrag({
  min = 0,
  max = 6,
  base,
  resetKey,
}: {
  min?: number
  max?: number
  base?: number
  resetKey?: unknown
}) {
  const controls = useThree((s) => s.controls) as OrbitControls | null
  const camera = useThree((s) => s.camera)
  const el = useThree((s) => s.gl.domElement)
  // how far the view has been moved, so it can be put back
  const lifted = useRef(0)
  const range = useRef({ min, max })
  useEffect(() => {
    range.current = { min, max }
  }, [min, max])

  useEffect(() => {
    if (!controls || base === undefined || lifted.current === 0) return
    camera.position.y -= lifted.current
    controls.target.y = base
    lifted.current = 0
    controls.update()
  }, [resetKey, base, controls, camera])

  useEffect(() => {
    if (!controls) return
    let lastY: number | null = null
    const down = (e: PointerEvent) => {
      if (e.button !== 2) return
      lastY = e.clientY
      el.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (lastY === null) return
      // world units per pixel at the look-at point, so the model moves with the mouse
      const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 45
      const perPx =
        (2 * camera.position.distanceTo(controls.target) * Math.tan(THREE.MathUtils.degToRad(fov / 2))) / el.clientHeight
      lifted.current = lift(controls, camera, (e.clientY - lastY) * perPx, range.current, lifted.current)
      lastY = e.clientY
    }
    const up = (e: PointerEvent) => {
      if (e.button === 2) lastY = null
    }
    const noMenu = (e: Event) => e.preventDefault()
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('contextmenu', noMenu)
    return () => {
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('contextmenu', noMenu)
    }
  }, [controls, camera, el])

  return null
}

/** Moves the camera and its look-at point up by `dy` within the range; returns the new total lift. */
function lift(controls: OrbitControls, camera: THREE.Camera, dy: number, range: { min: number; max: number }, total: number) {
  const y = Math.min(range.max, Math.max(range.min, controls.target.y + dy))
  const moved = y - controls.target.y
  camera.position.y += moved
  controls.target.y = y
  controls.update()
  return total + moved
}
