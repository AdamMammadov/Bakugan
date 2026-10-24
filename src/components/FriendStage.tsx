import { ContactShadows, OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense } from 'react'
import { BAKUGAN, formModels } from '../data/bakugan'
import { ELEMENT_BY_ID, type ElementId } from '../data/elements'
import { CHARACTER_BY_ID, DEFAULT_PARTS, lookOf, type Avatar } from '../profile/avatar'
import { MonsterModel } from '../three/BakuganModels'
import { Brawler } from '../three/Brawler'

/** Standing still: the stage has no gestures. */
const IDLE = { kind: null, key: 0 }

/**
 * A brawler in 3D next to their lead Bakugan, for a profile page. A photo is only a 2D portrait: here they
 * stand as their look (series character or drawn avatar).
 */
export default function FriendStage({
  avatar,
  element,
  lead,
}: {
  avatar: Avatar
  element: ElementId
  lead?: { id: string; form: number }
}) {
  const look = lookOf(avatar, element)
  const character = look.kind === 'preset' ? CHARACTER_BY_ID[look.id] : undefined
  const parts = look.kind === 'custom' ? look.parts : (character?.parts ?? DEFAULT_PARTS)
  const el = ELEMENT_BY_ID[element]
  const bakugan = lead && BAKUGAN.find((b) => b.id === lead.id)
  const entrant = bakugan && lead ? { bakugan, form: lead.form } : null
  const size = entrant ? (1 + entrant.form * 0.12) * (formModels(entrant)?.scale ?? 1) : 1
  const fly = entrant ? !!formModels(entrant)?.fly : false
  return (
    <Canvas camera={{ position: [0, 1.6, 5.4], fov: 36 }} dpr={[1, 2]}>
      <ambientLight intensity={0.9} />
      <directionalLight position={[2, 4, 3]} intensity={2.2} />
      <pointLight position={[-2, 2.5, -2]} intensity={14} color={el.glow} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.6, 64]} />
        <meshStandardMaterial color="#111219" emissive={el.color} emissiveIntensity={0.12} />
      </mesh>
      <Suspense fallback={null}>
        <group position={[-0.9, 0, 0.2]} rotation={[0, 0.35, 0]}>
          <Brawler parts={parts} model={character?.model} color={el.color} gesture={IDLE} />
        </group>
        {entrant && (
          <group position={[1.1, fly ? -0.25 : 0, -0.2]} rotation={[0, -0.45, 0]} scale={0.6 / Math.max(1, size)}>
            <MonsterModel entrant={entrant} showcase />
          </group>
        )}
      </Suspense>
      <ContactShadows position={[0, 0.002, 0]} opacity={0.55} scale={6} blur={2} far={2} />
      <OrbitControls
        makeDefault
        target={[0.1, 0.95, 0]}
        enablePan={false}
        enableZoom={false}
        minPolarAngle={1}
        maxPolarAngle={1.5}
        autoRotate
        autoRotateSpeed={0.6}
      />
    </Canvas>
  )
}
