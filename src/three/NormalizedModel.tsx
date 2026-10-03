import { useAnimations, useGLTF } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'

/**
 * Loads a .glb of unknown scale/origin and fits it: scaled to `height`, centred on X/Z,
 * standing on y = 0. Plays an idle-looking clip when the file has animations.
 */
export function NormalizedModel({ url, height, yaw = 0 }: { url: string; height: number; yaw?: number }) {
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
