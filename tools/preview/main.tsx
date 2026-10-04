// Dev-only model preview used to compare Blender output with reference renders.
// http://localhost:5173/tools/preview/?model=hydranoid/ball.glb&az=-0.6&el=0.1&d=3.85&open=1
import { useGLTF } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { Suspense, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import * as THREE from 'three'

const q = new URLSearchParams(location.search)
const model = q.get('model') ?? 'hydranoid/ball.glb'
const open = q.get('open') === '1'
const az = Number(q.get('az') ?? 0)
const el = Number(q.get('el') ?? 0)
const d = Number(q.get('d') ?? 4.2)
/** Spin of the model around the wheel (X) axis, for views where the ball has rolled. */
const spin = Number(q.get('spin') ?? 0)

function Model() {
  const { scene } = useGLTF(`/models/${model}`)
  useMemo(() => {
    scene.traverse((o) => {
      const u = o.userData
      if (u.openOnly) o.visible = open
      if (open && u.openPos) o.position.add(new THREE.Vector3(...u.openPos))
      if (open && u.openRot) o.rotation.set(o.rotation.x + u.openRot[0], o.rotation.y + u.openRot[1], o.rotation.z + u.openRot[2])
    })
  }, [scene])
  return <primitive object={scene} rotation-x={spin} />
}

createRoot(document.getElementById('root')!).render(
  <Canvas
    camera={{ position: [Math.sin(az) * Math.cos(el) * d, Math.sin(el) * d, Math.cos(az) * Math.cos(el) * d], fov: 30 }}
    onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
  >
    <color attach="background" args={[q.get('bg') ?? '#000000']} />
    <ambientLight intensity={0.5} />
    <directionalLight position={[2, 4, 5]} intensity={2.2} />
    <directionalLight position={[-4, 2, -3]} intensity={0.8} color="#b48cff" />
    <Suspense fallback={null}>
      <Model />
    </Suspense>
    <EffectComposer>
      <Bloom luminanceThreshold={0.9} intensity={1} mipmapBlur />
    </EffectComposer>
  </Canvas>,
)
