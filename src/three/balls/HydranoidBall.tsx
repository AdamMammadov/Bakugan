import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { bandGeometry, outward, R, surfacePoint } from './shell'

const CAP = 0.78 // angular radius of the side "wheel" caps

const BLACK = { color: '#16141c', roughness: 0.72, metalness: 0.15 }
const PURPLE = { color: '#9b4dff', roughness: 0.25, metalness: 0.1, emissive: '#3a0f6b', emissiveIntensity: 0.6 }

/** Pose of each shell piece when fully open (closed = all zeros). */
const OPEN = {
  head: { pos: [0, 0.14, 0.26], rot: -0.3 },
  spine: { pos: [0, 0.1, -0.06], rot: 0.12 },
  tail: { pos: [0, -0.04, -0.24], rot: -0.32 },
  belly: { pos: [0, -0.04, 0.1], rot: 0.18 },
  lift: 0.2,
} as const

/**
 * G1 Darkus Hydranoid in ball form, built from shell segments. While `openRef` is true it
 * opens: the head rises with its jaws and red eyes, the spine arches, the tail swings back
 * and the feet come out.
 */
export function HydranoidBall({ openRef }: { openRef: RefObject<boolean> }) {
  const root = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  const spine = useRef<THREE.Group>(null)
  const tail = useRef<THREE.Group>(null)
  const belly = useRef<THREE.Group>(null)
  const extras = useRef<THREE.Group>(null)
  const headExtras = useRef<THREE.Group>(null)
  const k = useRef(0)

  const geo = useMemo(() => {
    const band = (a: number, b: number) => bandGeometry(a, b, CAP, Math.PI - CAP)
    return {
      head: band(0.4, 1.75),
      spine: band(-0.95, 0.4),
      belly: band(1.75, 2.85),
      tail: band(2.85, 2 * Math.PI - 0.95),
      core: new THREE.SphereGeometry(R * 0.82, 32, 24),
    }
  }, [])

  useFrame((_, dt) => {
    k.current = THREE.MathUtils.damp(k.current, openRef.current ? 1 : 0, 4, dt)
    const t = k.current
    const pose = (g: THREE.Group | null, o: { pos: readonly number[]; rot: number }) => {
      if (!g) return
      g.position.set(o.pos[0] * t, o.pos[1] * t, o.pos[2] * t)
      g.rotation.x = o.rot * t
    }
    pose(head.current, OPEN.head)
    pose(spine.current, OPEN.spine)
    pose(tail.current, OPEN.tail)
    pose(belly.current, OPEN.belly)
    if (root.current) root.current.position.y = OPEN.lift * t
    for (const g of [extras.current, headExtras.current]) {
      if (!g) continue
      g.scale.setScalar(Math.max(t, 0.001))
      g.visible = t > 0.02
    }
  })

  return (
    <group ref={root}>
      {/* glossy inner core, visible through the gaps */}
      <mesh geometry={geo.core}>
        <meshStandardMaterial color="#3b37a6" roughness={0.3} metalness={0.2} emissive="#140f45" emissiveIntensity={0.5} />
      </mesh>

      <WheelCap side={1} />
      <WheelCap side={-1} />

      {/* head: front-top band with eyes, teeth and horns */}
      <group ref={head}>
        <mesh geometry={geo.head} castShadow>
          <meshStandardMaterial {...BLACK} side={THREE.DoubleSide} />
        </mesh>
        <Head />
        <group ref={headExtras} visible={false}>
          <OpenJaw />
        </group>
      </group>

      {/* spine: top-back band with the purple dorsal spikes */}
      <group ref={spine}>
        <mesh geometry={geo.spine} castShadow>
          <meshStandardMaterial {...BLACK} side={THREE.DoubleSide} />
        </mesh>
        {[-0.8, -0.5, -0.2, 0.1].map((phi) => (
          <Spike key={phi} phi={phi} x={0} size={0.13} />
        ))}
      </group>

      {/* belly: bottom-front band */}
      <group ref={belly}>
        <mesh geometry={geo.belly} castShadow>
          <meshStandardMaterial {...BLACK} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* tail: bottom-back band; the tail tip unfolds when open */}
      <group ref={tail}>
        <mesh geometry={geo.tail} castShadow>
          <meshStandardMaterial {...BLACK} side={THREE.DoubleSide} />
        </mesh>
        {[3.6, 4.0, 4.4, 4.8].map((phi) => (
          <Spike key={phi} phi={phi} x={0} size={0.09} />
        ))}
      </group>

      {/* parts that only exist in the open form */}
      <group ref={extras} visible={false}>
        <TailTip />
        <Feet />
        {/* neck joining the core to the raised head */}
        <mesh position={[0, 0.3, 0.22]} rotation={[0.6, 0, 0]} castShadow>
          <cylinderGeometry args={[0.13, 0.18, 0.4, 16]} />
          <meshStandardMaterial {...BLACK} />
        </mesh>
      </group>
    </group>
  )
}

/** Side wheel: alternating black spokes and purple windows, a rim and a centre hub. */
function WheelCap({ side }: { side: 1 | -1 }) {
  const wedges = useMemo(() => {
    const n = 10
    return Array.from({ length: n }, (_, i) => {
      const g = new THREE.SphereGeometry(R * 1.003, 8, 8, (i / n) * Math.PI * 2, (Math.PI * 2) / n, 0.18, CAP - 0.24)
      g.rotateZ(-Math.PI / 2)
      if (side === -1) g.rotateY(Math.PI)
      return { g, purple: i % 2 === 1 }
    })
  }, [side])
  const rim = useMemo(() => {
    const g = new THREE.SphereGeometry(R * 1.006, 48, 4, 0, Math.PI * 2, CAP - 0.08, 0.08)
    g.rotateZ(-Math.PI / 2)
    if (side === -1) g.rotateY(Math.PI)
    return g
  }, [side])

  return (
    <group>
      {wedges.map(({ g, purple }, i) => (
        <mesh key={i} geometry={g} castShadow>
          <meshStandardMaterial {...(purple ? PURPLE : BLACK)} />
        </mesh>
      ))}
      <mesh geometry={rim}>
        <meshStandardMaterial {...BLACK} />
      </mesh>
      {/* hub */}
      <mesh position={[side * R * 0.97, 0, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.1, 0.11, 0.05, 32]} />
        <meshStandardMaterial {...BLACK} />
      </mesh>
    </group>
  )
}

function Spike({ phi, x, size }: { phi: number; x: number; size: number }) {
  const p = surfacePoint(phi, x, R * 0.98)
  return (
    <mesh position={p} quaternion={outward(p)} castShadow>
      <coneGeometry args={[size * 0.4, size, 4]} />
      <meshStandardMaterial {...PURPLE} />
    </mesh>
  )
}

/** Red slit eyes, purple slash marks, horn and a row of teeth along the jaw seam. */
function Head() {
  const eye = (x: number) => {
    const p = surfacePoint(1.38, x, R * 1.005)
    return (
      <mesh key={x} position={p} quaternion={outward(p)} rotation-z={x * 1.5}>
        <boxGeometry args={[0.1, 0.006, 0.035]} />
        <meshStandardMaterial color="#ff2a2a" emissive="#ff1a1a" emissiveIntensity={6} toneMapped={false} />
      </mesh>
    )
  }
  const teeth = []
  for (let x = -0.62; x <= 0.62; x += 0.155) {
    const p = surfacePoint(1.74, x, R * 0.99)
    // point the tooth down along the seam
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -0.6, 0.4).normalize())
    teeth.push(
      <mesh key={x} position={p} quaternion={q} castShadow>
        <coneGeometry args={[0.03, 0.09, 4]} />
        <meshStandardMaterial {...PURPLE} />
      </mesh>,
    )
  }
  const slash = (x: number) => {
    const p = surfacePoint(1.0, x, R * 1.004)
    return (
      <mesh key={x} position={p} quaternion={outward(p)}>
        <boxGeometry args={[0.035, 0.004, 0.22]} />
        <meshStandardMaterial {...PURPLE} />
      </mesh>
    )
  }
  const horn = surfacePoint(0.85, 0.55, R * 0.98)
  return (
    <group>
      {eye(-0.32)}
      {eye(0.32)}
      {slash(-0.45)}
      {slash(0.45)}
      {teeth}
      <mesh position={horn} quaternion={outward(horn)} castShadow>
        <coneGeometry args={[0.04, 0.18, 5]} />
        <meshStandardMaterial {...PURPLE} />
      </mesh>
    </group>
  )
}

function TailTip() {
  return (
    <group position={[0, -0.32, -0.62]} rotation={[-1.75, 0, 0]}>
      <mesh castShadow>
        <coneGeometry args={[0.13, 0.55, 8]} />
        <meshStandardMaterial {...BLACK} />
      </mesh>
      <mesh position={[0, 0.34, 0]} castShadow>
        <coneGeometry args={[0.06, 0.22, 6]} />
        <meshStandardMaterial {...PURPLE} />
      </mesh>
      {[-0.1, 0.1].map((y) => (
        <mesh key={y} position={[0, y, 0.09]} rotation={[0.8, 0, 0]} castShadow>
          <coneGeometry args={[0.03, 0.12, 4]} />
          <meshStandardMaterial {...PURPLE} />
        </mesh>
      ))}
    </group>
  )
}

function Feet() {
  return (
    <group>
      {[-0.2, 0.2].map((x) => (
        <group key={x} position={[x, -0.5, 0.22]}>
          <mesh position={[0, 0.08, 0]} castShadow>
            <capsuleGeometry args={[0.045, 0.14, 4, 8]} />
            <meshStandardMaterial {...BLACK} />
          </mesh>
          {[-0.04, 0, 0.04].map((cx) => (
            <mesh key={cx} position={[cx, -0.03, 0.06]} rotation={[1.3, 0, 0]} castShadow>
              <coneGeometry args={[0.018, 0.07, 4]} />
              <meshStandardMaterial {...PURPLE} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/** Solid skull under the head shell plus a dropped lower jaw lined with teeth. */
function OpenJaw() {
  return (
    <group>
      <mesh position={[0, 0.18, 0.26]} castShadow>
        <boxGeometry args={[0.46, 0.2, 0.36]} />
        <meshStandardMaterial {...BLACK} />
      </mesh>
      <group position={[0, 0.06, 0.12]} rotation={[0.55, 0, 0]}>
        <mesh position={[0, 0, 0.22]} castShadow>
          <boxGeometry args={[0.38, 0.06, 0.4]} />
          <meshStandardMaterial {...BLACK} />
        </mesh>
        {[-0.14, -0.07, 0, 0.07, 0.14].map((x) => (
          <mesh key={x} position={[x, 0.06, 0.36]} castShadow>
            <coneGeometry args={[0.022, 0.08, 4]} />
            <meshStandardMaterial {...PURPLE} />
          </mesh>
        ))}
      </group>
      {/* glowing throat */}
      <mesh position={[0, 0.1, 0.3]}>
        <boxGeometry args={[0.24, 0.05, 0.2]} />
        <meshStandardMaterial color="#c08bff" emissive="#9b4dff" emissiveIntensity={2.5} toneMapped={false} />
      </mesh>
    </group>
  )
}
