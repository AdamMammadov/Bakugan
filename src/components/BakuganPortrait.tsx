import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import type { Entrant } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { MonsterModel } from '../three/BakuganModels'

/**
 * A Bakugan's picture for the battle HUD: its 3D model is rendered once, off screen, from the front at an angle,
 * and kept as an image (one small WebGL canvas at a time, closed again straight after). Until then the attribute
 * icon stands in.
 */
const pictures = new Map<string, string>()
const waiting: { key: string; entrant: Entrant }[] = []
const listeners = new Set<() => void>()
let current: { key: string; entrant: Entrant } | null = null
/** The mounted portrait that hosts the off-screen canvas (any one will do). */
let host: number | null = null
let ids = 0
/** How each mounted portrait takes over as host. */
const claims = new Map<number, () => void>()

const keyOf = (e: Entrant) => `${e.bakugan.id}-${e.form}-${e.skin ?? ''}`

function pump() {
  if (current || !waiting.length) return
  current = waiting.shift()!
  listeners.forEach((fn) => fn())
}

function done(key: string, url: string | null) {
  if (url) pictures.set(key, url)
  current = null
  listeners.forEach((fn) => fn())
  pump()
}

function request(e: Entrant) {
  const key = keyOf(e)
  if (pictures.has(key) || current?.key === key || waiting.some((w) => w.key === key)) return
  waiting.push({ key, entrant: e })
  pump()
}

export function BakuganPortrait({ entrant, mirror = false }: { entrant: Entrant; mirror?: boolean }) {
  const key = keyOf(entrant)
  const [id] = useState(() => ++ids)
  const [, setTick] = useState(0)
  useEffect(() => {
    const fn = () => setTick((t) => t + 1)
    listeners.add(fn)
    claims.set(id, () => {
      host = id
      listeners.forEach((l) => l())
    })
    if (host === null) host = id
    request(entrant)
    fn()
    return () => {
      listeners.delete(fn)
      claims.delete(id)
      if (host === id) {
        host = null
        // another portrait takes the canvas over (and redoes the picture it was taking)
        claims.values().next().value?.()
      }
    }
  }, [entrant, id])
  const el = ELEMENT_BY_ID[entrant.bakugan.element]
  const url = pictures.get(key)
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: `radial-gradient(circle at 50% 40%, ${el.color}aa, #07080d 78%)` }}
    >
      {url ? (
        <img
          src={url}
          alt={entrant.bakugan.name}
          className="h-full w-full object-contain"
          style={{ transform: mirror ? 'scaleX(-1)' : undefined }}
          draggable={false}
        />
      ) : (
        <img src={el.icon} alt="" className="absolute inset-[22%] h-[56%] w-[56%] opacity-50" />
      )}
      {host === id && current && createPortal(<Snapshot key={current.key} entrant={current.entrant} />, document.body)}
    </div>
  )
}

/** The off-screen canvas that renders one picture. */
function Snapshot({ entrant }: { entrant: Entrant }) {
  const key = keyOf(entrant)
  // a model that never loads gives up after a while, so the queue moves on
  useEffect(() => {
    const t = window.setTimeout(() => done(key, null), 20000)
    return () => clearTimeout(t)
  }, [key])
  return (
    <div style={{ position: 'fixed', left: -2000, top: 0, width: 220, height: 220, pointerEvents: 'none' }} aria-hidden>
      <Canvas
        gl={{ preserveDrawingBuffer: true, alpha: true, antialias: true }}
        dpr={1}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 6, 5]} intensity={2.4} />
        <directionalLight position={[-4, 3, -3]} intensity={0.8} color={ELEMENT_BY_ID[entrant.bakugan.element].glow} />
        <Suspense fallback={null}>
          <Shot entrant={entrant} onShot={(url) => done(key, url)} />
        </Suspense>
      </Canvas>
    </div>
  )
}

/** Frames the loaded model (front, a little from the side and above) and grabs the frame. */
function Shot({ entrant, onShot }: { entrant: Entrant; onShot: (url: string) => void }) {
  const group = useRef<THREE.Group>(null)
  const { gl, scene } = useThree()
  const camera = useRef(new THREE.PerspectiveCamera(30, 1, 0.1, 100))
  const frames = useRef(0)
  const shot = useRef(false)
  useFrame(() => {
    const g = group.current
    if (!g || shot.current) return
    // a few frames for the model to settle into its idle pose
    if (++frames.current < 6) return
    const box = new THREE.Box3().setFromObject(g)
    if (box.isEmpty()) return
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    // the upper body: the head and chest fill the picture
    const target = center.clone().setY(box.max.y - size.y * 0.42)
    const cam = camera.current
    const reach = Math.max(size.y * 0.62, size.x * 0.5, size.z * 0.4)
    const dist = reach / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2))
    const dir = new THREE.Vector3(0.5, 0.18, 1).normalize()
    cam.position.copy(target).addScaledVector(dir, dist)
    cam.near = dist / 20
    cam.far = dist * 6
    cam.updateProjectionMatrix()
    cam.lookAt(target)
    gl.render(scene, cam)
    shot.current = true
    onShot(gl.domElement.toDataURL('image/png'))
  })
  return (
    <group ref={group}>
      <MonsterModel entrant={entrant} showcase />
    </group>
  )
}
