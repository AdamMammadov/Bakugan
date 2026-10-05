import { useAnimations, useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { type RefObject, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { rigPose, type Pose, type PoseRef } from './pose'

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
export function NormalizedModel({
  url,
  height,
  yaw = 0,
  poseRef,
  openRef,
  tint,
}: {
  url: string
  /** Skin colours: the model is tinted towards `color` and glows in `glow`. */
  tint?: { color: string; glow: string }
  height: number
  yaw?: number
  poseRef?: PoseRef
  /** For ball models: while true, pieces move to the open pose stored in their glTF extras. */
  openRef?: RefObject<boolean>
}) {
  const gltf = useGLTF(url)
  // Clone so the same model can appear twice (e.g. a mirror match in the arena).
  const scene = useMemo(() => {
    const copy = clone(gltf.scene)
    copy.traverse((o) => {
      const m = o as THREE.Mesh
      if (m.isMesh) {
        o.castShadow = true
        o.receiveShadow = true
        if (tint) {
          const tintOne = (mat: THREE.Material) => {
            const c = mat.clone() as THREE.MeshStandardMaterial
            c.color?.lerp(new THREE.Color(tint.color), 0.6)
            if (c.emissive) {
              c.emissive = new THREE.Color(tint.glow)
              c.emissiveIntensity = 0.18
            }
            return c
          }
          m.material = Array.isArray(m.material) ? m.material.map(tintOne) : tintOne(m.material)
        }
      }
    })
    // parts that only exist in the open form start collapsed, and must not affect the fit
    copy.traverse((o) => {
      if (o.userData.openOnly) {
        o.scale.setScalar(0.001)
        o.visible = false
      }
    })
    return copy
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf.scene, tint?.color, tint?.glow])

  const openable = useMemo(() => {
    const nodes: { node: THREE.Object3D; pos: THREE.Vector3; rot: THREE.Euler; u: Record<string, unknown> }[] = []
    scene.traverse((o) => {
      const u = o.userData
      if (u.openPos || u.openRot || u.openOnly || u.closedOnly) nodes.push({ node: o, pos: o.position.clone(), rot: o.rotation.clone(), u })
    })
    return nodes
  }, [scene])
  const openAmount = useRef(0)
  useFrame((_, dt) => {
    if (!openable.length || !openRef) return
    openAmount.current = THREE.MathUtils.damp(openAmount.current, openRef.current ? 1 : 0, 5, dt)
    const k = openAmount.current
    for (const { node, pos, rot, u } of openable) {
      const op = u.openPos as number[] | undefined
      const or = u.openRot as number[] | undefined
      if (op) node.position.set(pos.x + op[0] * k, pos.y + op[1] * k, pos.z + op[2] * k)
      if (or) node.rotation.set(rot.x + or[0] * k, rot.y + or[1] * k, rot.z + or[2] * k)
      if (u.openOnly) {
        node.scale.setScalar(Math.max(k, 0.001))
        node.visible = k > 0.02
      }
      if (u.closedOnly) {
        node.scale.setScalar(Math.max(1 - k, 0.001))
        node.visible = k < 0.98
      }
    }
  })

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

  // Part-rigged models (e.g. the Blender-built monsters) expose named pivot nodes;
  // animate them procedurally for idle breathing and per-move combat poses.
  const rig = useMemo(() => {
    const get = (n: string) => scene.getObjectByName(n) ?? null
    const nodes = {
      neck: get('neck'),
      head: get('head'),
      jaw: get('jaw'),
      tail: get('tail'),
      tip: get('tail_tip'),
      fl: get('leg_fl'),
      fr: get('leg_fr'),
      bl: get('leg_bl'),
      br: get('leg_br'),
    }
    return nodes.neck || nodes.tail ? nodes : null
  }, [scene])

  useFrame(({ clock }) => {
    if (!rig) return
    const now = clock.elapsedTime
    const pose = poseRef?.current ?? null
    const t = pose?.start != null ? now - pose.start : 0
    const p = rigPose(pose?.move ?? null, t, now)
    rig.neck?.rotation.set(p.neck, 0, 0)
    rig.head?.rotation.set(p.head, 0, 0)
    rig.jaw?.rotation.set(p.jaw, 0, 0)
    rig.tail?.rotation.set(p.tailLift, p.tailYaw, 0)
    rig.tip?.rotation.set(0, p.tipYaw, 0)
    rig.fl?.rotation.set(p.frontL, 0, 0)
    rig.fr?.rotation.set(p.frontR, 0, 0)
    rig.bl?.rotation.set(p.hindL, 0, 0)
    rig.br?.rotation.set(p.hindR, 0, 0)
  })

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
