import * as THREE from 'three'

const blobTexture = (() => {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(0,0,0,0.75)')
  grad.addColorStop(0.55, 'rgba(0,0,0,0.35)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
})()

/**
 * A soft round shadow drawn on the ground. Unlike a rendered contact shadow it holds no
 * image of the scene, so nothing can linger after a Bakugan leaves the field.
 */
export function BlobShadow({ ref, size = 1 }: { ref?: React.Ref<THREE.Mesh>; size?: number }) {
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} scale={size} renderOrder={1}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={blobTexture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  )
}
