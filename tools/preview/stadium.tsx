// Dev-only: the arena with nobody on the field (stands, fans, show lights, the field and its Gate Card), for the
// pictures behind the pages (public/backdrops). http://localhost:5173/tools/preview/stadium.html?view=wide
import { Sparkles } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { FieldGateCard } from '../../src/three/FieldGateCard'
import { crowd } from '../../src/three/stadium'
import { FIELD_RADIUS, Stadium } from '../../src/three/Stadium'

const q = new URLSearchParams(location.search)
/** Where the camera stands: the high stands looking over the field, low on the field, or behind a brawler. */
const VIEWS: Record<string, { pos: [number, number, number]; look: [number, number, number]; fov: number }> = {
  wide: { pos: [0, 78, 128], look: [0, 4, -30], fov: 50 },
  low: { pos: [-38, 9, 74], look: [10, 14, -40], fov: 50 },
  side: { pos: [112, 50, 24], look: [-40, 10, -40], fov: 48 },
  screen: { pos: [0, 26, 40], look: [0, 40, -140], fov: 50 },
  card: { pos: [0, 58, 34], look: [0, 0, -2], fov: 52 },
  corner: { pos: [-82, 18, 52], look: [60, 26, -90], fov: 50 },
}
const view = VIEWS[q.get('view') ?? 'wide']
const colors: [string, string] = [q.get('a') ?? '#ff4a2f', q.get('b') ?? '#3b82f6']

// the crowd gets going so the show lights flare up now and then
window.setInterval(() => crowd(Math.random() < 0.5 ? 'roar' : 'cheer', Math.random() < 0.5 ? 0 : 1), 2600)

createRoot(document.getElementById('root')!).render(
  <Canvas
    camera={{ position: view.pos, fov: view.fov, far: 2000 }}
    onCreated={({ camera }) => camera.lookAt(...view.look)}
    dpr={1}
  >
    <color attach="background" args={['#05060a']} />
    <fog attach="fog" args={['#05060a', 150, 430]} />
    <ambientLight intensity={0.45} />
    <hemisphereLight args={['#8fa6d8', '#0b0c12', 0.35]} />
    <directionalLight position={[12, 40, 24]} intensity={2.2} />
    <pointLight position={[-30, 14, -4]} intensity={45} color={colors[0]} />
    <pointLight position={[30, 14, -4]} intensity={45} color={colors[1]} />
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[FIELD_RADIUS + 2, 96]} />
      <meshStandardMaterial color="#0b0c12" metalness={0.3} roughness={0.85} />
    </mesh>
    <Sparkles count={300} scale={[70, 28, 44]} position={[0, 11, 0]} size={1.6} speed={0.3} color="#9aa3b5" />
    <Stadium scale={1} colors={colors} names={['', '']} exclude={[]} />
    <group scale={46}>
      <Suspense fallback={null}>
        <FieldGateCard element={null} glow={0.32} />
      </Suspense>
    </group>
    <EffectComposer>
      <Bloom luminanceThreshold={1} luminanceSmoothing={0.15} intensity={0.65} mipmapBlur />
      <Vignette offset={0.25} darkness={0.7} />
    </EffectComposer>
  </Canvas>,
)
