import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { Pose, PoseRef } from './pose'

/** Clip-name patterns tried for each pose, in order. */
const POSE_CLIPS: Record<Pose['kind'], RegExp> = {
  lunge: /attack|bite|strike|punch|claw/i,
  cast: /roar|cast|skill|special|power/i,
  hit: /hit|damage|hurt|flinch/i,
}

/**
 * Loads a .glb of unknown scale/origin and fits it: scaled to `height`, centred on X/Z,
 * standing on y = 0. Plays an idle-looking clip when the file has animations, and a
 * matching one-shot clip (attack / roar / hit) whenever the fighter's pose changes.
 */
export function NormalizedModel({ url, height, yaw = 0, poseRef }: { url: string; height: number; yaw?: number; poseRef?: PoseRef }) {
  const gltf = useGLTF(url)
  // Clone so the same model can appear twice (e.g. a mirror match in the arena).
  const scene = useMemo(() => {
    const copy = clone(gltf.scene)
    copy.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true
        o.receiveShadow = true
      }
    })
    return copy
  }, [gltf.scene])

  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const scale = size.y > 0 ? height / size.y : 1
    return { scale, offset: [-center.x * scale, -box.min.y * scale, -center.z * scale] as const }
  }, [scene, height])

  const root = useRef<THREE.Group>(null)
  const { actions, names } = useAnimations(gltf.animations, root)
  useEffect(() => {
    const clip = names.find((n) => /idle|stand|breath/i.test(n)) ?? names[0]
    const action = clip ? actions[clip] : null
    action?.reset().fadeIn(0.3).play()
    return () => void action?.fadeOut(0.2)
  }, [actions, names])

  const lastPose = useRef<Pose | null>(null)
  useFrame(() => {
    const pose = poseRef?.current ?? null
    if (pose === lastPose.current) return
    lastPose.current = pose
    if (!pose) return
    const clip = names.find((n) => POSE_CLIPS[pose.kind].test(n))
    const action = clip ? actions[clip] : null
    if (!action) return
    action.reset().setLoop(THREE.LoopOnce, 1).fadeIn(0.15).play()
    action.clampWhenFinished = false
  })

  return (
    <group rotation-y={yaw}>
      <group position={fit.offset} scale={fit.scale}>
        <group ref={root}>
          <primitive object={scene} />
        </group>
      </group>
    </group>
  )
}
