import { useGLTF, useTexture } from '@react-three/drei'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { asset } from '../asset'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { AvatarParts } from '../profile/avatar'

export type BrawlerGesture = 'card' | 'point' | 'flinch' | 'cheer' | 'slump' | null

export interface BrawlerCall {
  /** Changes on every new call so the bubble replays. */
  key: number
  title: string
  sub?: string
}

interface Props {
  parts: AvatarParts
  /** Uploaded face photo, shown on the head instead of drawn hair and eyes. */
  photo?: string
  color: string
  gesture: { kind: BrawlerGesture; key: number }
  /** Game model of a series character; replaces the drawn body when given. */
  model?: string
}

/** Arm angles and body lean the current gesture asks for (procedural body convention). */
interface PoseState {
  r: number
  l: number
}

const PANTS = '#23262f'

/** A brawler standing on the field: holds up the ability card, points, cheers. */
export function Brawler({ parts, photo, color, gesture, model }: Props) {
  const pose = useRef<PoseState>({ r: -0.08, l: 0.08 })
  const root = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const card = useRef<THREE.Mesh>(null)
  const anim = useRef<{ kind: BrawlerGesture; start: number | null }>({ kind: null, start: null })
  const hold = useRef<BrawlerGesture>(null)

  useEffect(() => {
    if (!gesture.kind) return
    anim.current = { kind: gesture.kind, start: null }
    // win and loss poses are held until the next battle
    hold.current = gesture.kind === 'cheer' || gesture.kind === 'slump' ? gesture.kind : null
  }, [gesture])

  useFrame(({ clock }) => {
    const now = clock.elapsedTime
    const a = anim.current
    if (a.kind && a.start === null) a.start = now
    const t = a.start === null ? 0 : now - a.start
    const kind = t < 1.9 ? a.kind : hold.current
    const k = kind === hold.current ? 1 : Math.min(1, t / 0.18) * Math.min(1, (1.9 - t) / 0.3)

    let r = -0.08
    let l = 0.08
    let lean = 0
    let nod = 0
    if (kind === 'card') r = -2.9 * k
    if (kind === 'point') r = -1.55 * k
    if (kind === 'flinch') lean = -0.25 * k
    if (kind === 'cheer') {
      r = -2.8
      l = -2.8
    }
    if (kind === 'slump') {
      nod = 0.45
      lean = 0.15
    }
    pose.current.r = THREE.MathUtils.lerp(pose.current.r, r, 0.25)
    pose.current.l = THREE.MathUtils.lerp(pose.current.l, l, 0.25)
    const breathe = Math.sin(now * 2.2) * 0.012
    if (armR.current) armR.current.rotation.x = THREE.MathUtils.lerp(armR.current.rotation.x, r, 0.25)
    if (armL.current) armL.current.rotation.x = THREE.MathUtils.lerp(armL.current.rotation.x, l, 0.25)
    if (root.current) {
      root.current.rotation.x = THREE.MathUtils.lerp(root.current.rotation.x, lean, 0.2)
      root.current.scale.y = 1 + breathe
    }
    if (head.current) head.current.rotation.x = THREE.MathUtils.lerp(head.current.rotation.x, nod, 0.15)
    if (card.current) {
      card.current.visible = kind === 'card'
      card.current.rotation.y = now * 3
    }
  })

  if (model) {
    return (
      <group ref={root}>
        <ModelBody url={model} pose={pose} color={color} cardRef={card} />
      </group>
    )
  }

  return (
    <group ref={root}>
      {/* legs and shoes */}
      {[-0.11, 0.11].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.44, 0]} castShadow>
            <cylinderGeometry args={[0.085, 0.075, 0.86, 10]} />
            <meshStandardMaterial color={PANTS} roughness={0.8} />
          </mesh>
          <mesh position={[x, 0.04, 0.05]} castShadow>
            <boxGeometry args={[0.15, 0.08, 0.28]} />
            <meshStandardMaterial color="#e9e9ee" roughness={0.6} />
          </mesh>
        </group>
      ))}
      {/* torso */}
      <mesh position={[0, 1.12, 0]} scale={[1.15, 1, 0.75]} castShadow>
        <capsuleGeometry args={[0.2, 0.36, 6, 14]} />
        <meshStandardMaterial color={parts.outfit} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.13, 0.155]}>
        <boxGeometry args={[0.07, 0.42, 0.02]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.6} />
      </mesh>
      {/* arms pivot at the shoulders */}
      {(
        [
          [-0.29, armL],
          [0.29, armR],
        ] as const
      ).map(([x, ref]) => (
        <group key={x} ref={ref} position={[x, 1.4, 0]}>
          <mesh position={[0, -0.28, 0]} castShadow>
            <capsuleGeometry args={[0.06, 0.42, 4, 10]} />
            <meshStandardMaterial color={parts.outfit} roughness={0.55} />
          </mesh>
          <mesh position={[0, -0.58, 0]}>
            <sphereGeometry args={[0.065, 12, 10]} />
            <meshStandardMaterial color={parts.skin} roughness={0.7} />
          </mesh>
          {x > 0 && (
            <mesh ref={card} position={[0, -0.78, 0]} visible={false}>
              <boxGeometry args={[0.24, 0.34, 0.01]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.2} toneMapped={false} />
            </mesh>
          )}
        </group>
      ))}
      {/* head */}
      <group ref={head} position={[0, 1.62, 0]}>
        <mesh position={[0, -0.1, 0]}>
          <cylinderGeometry args={[0.06, 0.07, 0.12, 10]} />
          <meshStandardMaterial color={parts.skin} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.08, 0]} castShadow>
          <sphereGeometry args={[0.16, 20, 16]} />
          <meshStandardMaterial color={parts.skin} roughness={0.7} />
        </mesh>
        {photo ? <PhotoFace url={photo} /> : <Face parts={parts} />}
        {!photo && <Hair parts={parts} />}
      </group>

    </group>
  )
}

/** A series character's game model; its arms hang from the shoulders and follow the gesture. */
function ModelBody({
  url,
  pose,
  color,
  cardRef,
}: {
  url: string
  pose: React.RefObject<PoseState>
  color: string
  cardRef: React.RefObject<THREE.Mesh | null>
}) {
  const { scene } = useGLTF(asset(url))
  const body = useMemo(() => {
    const c = cloneSkinned(scene)
    c.traverse((o) => {
      o.castShadow = true
      // eyes and mouths of the Wii models sit just behind the face skin; draw them in front
      const m = o as THREE.Mesh
      if (m.isMesh && o.name.startsWith('face')) {
        const mat = (m.material as THREE.Material).clone()
        mat.polygonOffset = true
        mat.polygonOffsetFactor = -40
        mat.polygonOffsetUnits = -400
        m.material = mat
      }
    })
    return c
  }, [scene])
  const armR = useMemo(() => body.getObjectByName('armR') ?? null, [body])
  const armL = useMemo(() => body.getObjectByName('armL') ?? null, [body])

  useFrame(() => {
    const { r, l } = pose.current
    // arms point sideways in the model: -1.25 hangs them down, positive lifts them overhead
    if (armR) armR.rotation.z = -1.25 + (-r / 2.9) * 2.45
    if (armL) armL.rotation.z = 1.25 - (-l / 2.9) * 2.45
  })

  // the ability card sits in the right hand
  useEffect(() => {
    // models without separate arms hold the card up above their head instead
    const holder = armR ?? body
    const card = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.34, 0.01),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 2.2, toneMapped: false }),
    )
    if (armR) card.position.set(0.34, 0, 0)
    else card.position.set(0.12, 2.05, 0.15)
    card.visible = false
    holder.add(card)
    cardRef.current = card
    return () => {
      holder.remove(card)
    }
  }, [armR, body, color, cardRef])

  return <primitive object={body} />
}

function Face({ parts }: { parts: AvatarParts }) {
  return (
    <group position={[0, 0.09, 0.14]}>
      {[-0.055, 0.055].map((x) => (
        <mesh key={x} position={[x, 0, 0]}>
          <sphereGeometry args={[0.024, 10, 8]} />
          <meshStandardMaterial color={parts.eyeColor} roughness={0.3} />
        </mesh>
      ))}
      {parts.accessory === 'mask' && (
        <mesh position={[0, 0.005, 0.01]}>
          <boxGeometry args={[0.27, 0.07, 0.04]} />
          <meshStandardMaterial color="#eef0f6" metalness={0.4} roughness={0.3} />
        </mesh>
      )}
      {parts.accessory === 'glasses' && (
        <mesh position={[0, 0, 0.015]}>
          <boxGeometry args={[0.24, 0.05, 0.015]} />
          <meshStandardMaterial color="#1a1a22" transparent opacity={0.8} />
        </mesh>
      )}
      {(parts.accessory === 'goggles' || parts.accessory === 'headband') && (
        <mesh position={[0, 0.09, -0.04]} rotation={[0.2, 0, 0]}>
          <torusGeometry args={[0.15, 0.022, 6, 24]} />
          <meshStandardMaterial color={parts.accessory === 'goggles' ? '#f2c230' : parts.outfit} />
        </mesh>
      )}
    </group>
  )
}

function PhotoFace({ url }: { url: string }) {
  const texture = useTexture(url)
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace
  }, [texture])
  return (
    <mesh position={[0, 0.08, 0.162]}>
      <circleGeometry args={[0.15, 32]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  )
}

function Hair({ parts }: { parts: AvatarParts }) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: parts.hairColor, roughness: 0.6 }), [parts.hairColor])
  const style = parts.hair
  if (style === 'bald') return null
  const spikes: [number, number, number, number, number][] =
    style === 'spiky'
      ? [
          [0, 0.3, -0.02, -0.2, 0],
          [-0.1, 0.27, 0, -0.1, 0.5],
          [0.1, 0.27, 0, -0.1, -0.5],
          [-0.15, 0.2, -0.05, 0.3, 0.9],
          [0.15, 0.2, -0.05, 0.3, -0.9],
          [0, 0.22, -0.13, 0.9, 0],
        ]
      : style === 'swept'
        ? [
            [0.06, 0.27, 0.02, -0.6, -1.1],
            [0.12, 0.22, -0.04, -0.2, -1.3],
            [0.02, 0.25, -0.1, 0.5, -1.0],
          ]
        : []
  return (
    <group position={[0, 0.08, 0]}>
      {/* cap of hair over the skull */}
      <mesh material={mat} position={[0, 0.03, -0.015]} scale={[1.06, 1, 1.06]}>
        <sphereGeometry args={[0.165, 20, 12, 0, Math.PI * 2, 0, style === 'bowl' ? 1.75 : 1.35]} />
      </mesh>
      {spikes.map(([x, y, z, rx, rz], i) => (
        <mesh key={i} material={mat} position={[x, y - 0.08, z]} rotation={[rx, 0, rz]}>
          <coneGeometry args={[0.06, 0.2, 6]} />
        </mesh>
      ))}
      {style === 'long' && (
        <mesh material={mat} position={[0, -0.18, -0.08]}>
          <boxGeometry args={[0.34, 0.42, 0.12]} />
        </mesh>
      )}
      {style === 'twintails' &&
        [-0.2, 0.2].map((x) => (
          <mesh key={x} material={mat} position={[x, -0.12, -0.04]}>
            <capsuleGeometry args={[0.055, 0.3, 4, 8]} />
          </mesh>
        ))}
      {style === 'ponytail' && (
        <mesh material={mat} position={[0, -0.14, -0.17]} rotation={[0.35, 0, 0]}>
          <capsuleGeometry args={[0.05, 0.36, 4, 8]} />
        </mesh>
      )}
    </group>
  )
}
