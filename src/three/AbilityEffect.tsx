import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Ability } from '../data/bakugan'

type Pattern = 'stream' | 'ring' | 'spiral' | 'sphere' | 'beams'

const PATTERN: Record<Ability['effect'], Pattern> = {
  fireball: 'stream',
  waterJet: 'stream',
  flameWave: 'ring',
  quake: 'ring',
  tornado: 'spiral',
  waterSphere: 'sphere',
  shadowOrb: 'sphere',
  lightBeam: 'beams',
}

const COUNT = 900
export const EFFECT_DURATION = 2.4

let sprite: THREE.Texture | null = null
function softSprite() {
  if (sprite) return sprite
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, 'rgba(255,255,255,1)')
  grad.addColorStop(0.35, 'rgba(255,255,255,0.6)')
  grad.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  sprite = new THREE.CanvasTexture(c)
  return sprite
}

/** Particle show for an activated ability. Remount (change `key`) to replay. */
export function AbilityEffect({ effect, color, glow }: { effect: Ability['effect']; color: string; glow: string }) {
  const pattern = PATTERN[effect]
  const points = useRef<THREE.Points>(null)
  const t = useRef(0)

  const { positions, colors, seeds } = useMemo(() => {
    const positions = new Float32Array(COUNT * 3)
    const colors = new Float32Array(COUNT * 3)
    const seeds = new Float32Array(COUNT * 4)
    const a = new THREE.Color(color)
    const b = new THREE.Color(glow)
    const tmp = new THREE.Color()
    for (let i = 0; i < COUNT; i++) {
      tmp.copy(a).lerp(b, Math.random())
      if (effect === 'shadowOrb' && Math.random() < 0.4) tmp.set('#000000')
      colors.set([tmp.r, tmp.g, tmp.b], i * 3)
      seeds.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4)
    }
    return { positions, colors, seeds }
  }, [color, glow, effect])

  useFrame((_, dt) => {
    t.current += dt
    const time = t.current
    const life = time / EFFECT_DURATION
    for (let i = 0; i < COUNT; i++) {
      const [s0, s1, s2, s3] = [seeds[i * 4], seeds[i * 4 + 1], seeds[i * 4 + 2], seeds[i * 4 + 3]]
      let x = 0
      let y = 0
      let z = 0
      switch (pattern) {
        case 'stream': {
          // particles leave the mouth and fly forward in a cone
          const local = (time * 1.4 + s0) % 1
          const spread = local * 0.6
          const ang = s1 * Math.PI * 2
          x = Math.cos(ang) * spread * s2
          y = 2.5 + Math.sin(ang) * spread * s2 - local * 0.8
          z = 0.8 + local * 6
          break
        }
        case 'ring': {
          const ang = s0 * Math.PI * 2
          const r = 0.5 + life * 6 + s1 * 0.4
          x = Math.cos(ang) * r
          z = Math.sin(ang) * r
          y = 0.1 + s2 * 0.8 * (1 - life) + Math.abs(Math.sin(ang * 6 + time * 8)) * 0.3
          break
        }
        case 'spiral': {
          const h = (s0 * 5 + time * 2) % 5
          const ang = s1 * Math.PI * 2 + time * 6 + h
          const r = 0.6 + h * 0.45 + s2 * 0.2
          x = Math.cos(ang) * r
          z = Math.sin(ang) * r
          y = h
          break
        }
        case 'sphere': {
          const theta = s0 * Math.PI * 2 + time * (0.6 + s3)
          const phi = Math.acos(2 * s1 - 1)
          const r = 2.3 + Math.sin(time * 4 + s2 * 10) * 0.15
          x = Math.sin(phi) * Math.cos(theta) * r
          y = 1.6 + Math.cos(phi) * r
          z = Math.sin(phi) * Math.sin(theta) * r
          break
        }
        case 'beams': {
          const beam = Math.floor(s0 * 8)
          const ang = (beam / 8) * Math.PI * 2 + time * 0.5
          const r = 1.6 + s2 * 0.15
          x = Math.cos(ang) * r
          z = Math.sin(ang) * r
          y = ((s1 * 8 + time * 10) % 8) - 0.5
          break
        }
      }
      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z
    }
    const geom = points.current?.geometry
    if (geom) geom.attributes.position.needsUpdate = true
    const mat = points.current?.material as THREE.PointsMaterial | undefined
    if (mat) mat.opacity = life < 0.75 ? 1 : Math.max(0, 1 - (life - 0.75) / 0.25)
  })

  return (
    <points ref={points} frustumCulled={false}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={effect === 'shadowOrb' ? 0.32 : 0.22}
        map={softSprite()}
        vertexColors
        transparent
        depthWrite={false}
        blending={effect === 'shadowOrb' ? THREE.NormalBlending : THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}
