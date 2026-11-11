// Dev-only model preview used to compare Blender output with reference renders.
// http://localhost:5173/tools/preview/?model=hydranoid/ball.glb&az=-0.6&el=0.1&d=3.85&open=1
// ?bakugan=embral&open=1 shows the game's own ball of a Bakugan (with the creature rising out of a pod ball)
import { useGLTF } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { Suspense, useMemo, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import * as THREE from 'three'
import { BAKUGAN } from '../../src/data/bakugan'
import { BallModel } from '../../src/three/BakuganModels'

const q = new URLSearchParams(location.search)
const model = q.get('model') ?? 'hydranoid/ball.glb'
const open = q.get('open') === '1'
const az = Number(q.get('az') ?? 0)
const el = Number(q.get('el') ?? 0)
const d = Number(q.get('d') ?? 4.2)
/** Spin of the model around the wheel (X) axis, for views where the ball has rolled. */
const spin = Number(q.get('spin') ?? 0)
/** Height of the point the camera looks at. */
const ty = Number(q.get('ty') ?? 0)
/** Sideways and forward offsets of that point. */
const tx = Number(q.get('tx') ?? 0)
const tz = Number(q.get('tz') ?? 0)
/**
 * studio=1: a clean picture of a model for drawing over: white background, plain white lights, no glow, no ink
 * outline, the model standing on the ground (its feet at height 0, its middle over the centre) with a soft shadow.
 */
const studio = q.get('studio') === '1'
/** pose=<node>:<rx>:<ry>:<rz>,...: turns rigged parts (radians), to look at their joints mid-move. */
const pose = (q.get('pose') ?? '')
  .split(',')
  .filter(Boolean)
  .map((p) => p.split(':'))

/**
 * faces=1: shows which side of the surface is seen. The outside is drawn grey, the inside red: any
 * red seen from outside is a hole in the model (or a face turned inside out). The ink outline shells are hidden.
 */
function showSides(scene: THREE.Object3D) {
  const skins: THREE.Mesh[] = []
  scene.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.isMesh) skins.push(m)
  })
  for (const m of skins) {
    const ink = (Array.isArray(m.material) ? m.material : [m.material]).every(
      (x) => (x as THREE.MeshBasicMaterial).isMeshBasicMaterial,
    )
    if (ink) {
      m.visible = false
      continue
    }
    m.material = [
      new THREE.MeshStandardMaterial({ color: '#6f7480', roughness: 0.9, side: THREE.FrontSide }),
      new THREE.MeshBasicMaterial({ color: '#ff0000', side: THREE.BackSide }),
    ]
    const count = m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count
    m.geometry.clearGroups()
    m.geometry.addGroup(0, count, 0)
    m.geometry.addGroup(0, count, 1)
  }
}

function Model() {
  const { scene } = useGLTF(`/models/${model}`)
  const stand = useMemo(() => {
    if (!studio) return null
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (
        m.isMesh &&
        (Array.isArray(m.material) ? m.material : [m.material]).every((x) => (x as THREE.MeshBasicMaterial).isMeshBasicMaterial)
      )
        m.visible = false
    })
    scene.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(scene)
    const c = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    // a soft shadow on the ground under it: a dark round patch fading out, as wide and long as the model
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 256
    const g = canvas.getContext('2d')!
    const fade = g.createRadialGradient(128, 128, 0, 128, 128, 128)
    fade.addColorStop(0, 'rgba(0,0,0,0.5)')
    fade.addColorStop(0.55, 'rgba(0,0,0,0.26)')
    fade.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = fade
    g.fillRect(0, 0, 256, 256)
    return {
      at: [-c.x, -box.min.y, -c.z] as const,
      shadow: new THREE.CanvasTexture(canvas),
      size: [size.x * 1.25, size.z * 1.15] as const,
    }
  }, [scene])
  useMemo(() => {
    if (q.get('faces') === '1') showSides(scene)
    scene.traverse((o) => {
      const u = o.userData
      if (u.openOnly) o.visible = open
      if (u.closedOnly) o.visible = !open
      if (open && u.openPos) o.position.add(new THREE.Vector3(...u.openPos))
      if (open && u.openRot) o.rotation.set(o.rotation.x + u.openRot[0], o.rotation.y + u.openRot[1], o.rotation.z + u.openRot[2])
      for (const [name, x, y, z] of pose) if (o.name === name) o.rotation.set(Number(x), Number(y), Number(z))
    })
  }, [scene])
  if (stand)
    return (
      <>
        <group position={stand.at}>
          <primitive object={scene} />
        </group>
        <mesh rotation-x={-Math.PI / 2} position-y={0.004} scale={[stand.size[0], stand.size[1], 1]}>
          <planeGeometry />
          <meshBasicMaterial map={stand.shadow} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      </>
    )
  return <primitive object={scene} rotation-x={spin} />
}

/** The game's ball of `?bakugan=`, open or closed, twice its game size (about the size of a model shown here). */
function GameBall({ id }: { id: string }) {
  const bakugan = BAKUGAN.find((b) => b.id === id) ?? BAKUGAN[0]
  const openRef = useRef(open)
  return (
    <group scale={2}>
      <BallModel bakugan={bakugan} form={Number(q.get('form') ?? 0)} openRef={openRef} />
    </group>
  )
}

createRoot(document.getElementById('root')!).render(
  <Canvas
    camera={{
      position: [tx + Math.sin(az) * Math.cos(el) * d, ty + Math.sin(el) * d, tz + Math.cos(az) * Math.cos(el) * d],
      fov: 30,
    }}
    onCreated={({ camera }) => camera.lookAt(tx, ty, tz)}
  >
    <color attach="background" args={[q.get('bg') ?? (studio ? '#ffffff' : '#000000')]} />
    {studio ? (
      <>
        <hemisphereLight args={['#ffffff', '#b9b2a8', 0.9]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[3, 5, 5]} intensity={2.4} />
        <directionalLight position={[-5, 3, 2]} intensity={0.9} />
        <directionalLight position={[0, 3, -6]} intensity={0.7} />
      </>
    ) : (
      <>
        <hemisphereLight args={['#ffffff', '#444466', 0.6]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[2, 4, 5]} intensity={2.2} />
        <directionalLight position={[-4, 2, -3]} intensity={0.8} color="#b48cff" />
      </>
    )}
    <Suspense fallback={null}>{q.get('bakugan') ? <GameBall id={q.get('bakugan')!} /> : <Model />}</Suspense>
    {!studio && (
      <EffectComposer>
        <Bloom luminanceThreshold={0.9} intensity={1} mipmapBlur />
      </EffectComposer>
    )}
  </Canvas>,
)
