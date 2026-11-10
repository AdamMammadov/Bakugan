import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { GLSL_NOISE } from './fxShared'

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const FRAGMENT = /* glsl */ `
varying vec2 vUv;
uniform float uT;
uniform float uSeed;
uniform float uHot;
uniform vec3 uCore;
uniform vec3 uMid;
uniform vec3 uEdge;
${GLSL_NOISE}
void main() {
  float y = vUv.y;
  // tongues of fire rising: noise scrolling upward, swaying the flame more the higher it reaches
  float n1 = fxNoise(vec2(vUv.x * 3.0 + uSeed, y * 2.6 - uT * 2.4));
  float n2 = fxNoise(vec2(vUv.x * 7.5 - uSeed, y * 6.0 - uT * 4.6));
  float n3 = fxNoise(vec2(vUv.x * 15.0 + uSeed * 2.0, y * 11.0 - uT * 7.0));
  float sway = (n1 - 0.5) * 0.32 * y;
  float dx = abs(vUv.x - 0.5 - sway);
  // wide at its root, narrowing to ragged tips
  float w = 0.44 * pow(max(1.0 - y, 0.0), 0.7) * smoothstep(-0.04, 0.16, y);
  float edge = w * (0.75 + 0.55 * n2 + 0.25 * n3);
  float shape = 1.0 - smoothstep(edge * 0.45, max(edge, 1e-4), dx);
  shape *= 1.0 - smoothstep(0.5 + 0.4 * n1, 1.0, y);
  float heat = shape * (1.0 - 0.7 * y) * (0.75 + 0.5 * n2);
  vec3 col = mix(uEdge, uMid, smoothstep(0.12, 0.5, heat));
  col = mix(col, uCore, smoothstep(0.5, 0.85, heat));
  float a = shape * smoothstep(0.0, 0.07, y);
  if (a < 0.01) discard;
  gl_FragColor = vec4(col * (1.0 + uHot * heat), a);
}
`

const linear = (c: string) => new THREE.Color(c).convertSRGBToLinear()

/** What a flame burns as: its core, middle and edge colours. */
export const FLAME_TONES = {
  /** White-hot core, orange body, red edge. */
  fire: ['#fff3c4', '#ffae2b', '#e8340c'],
  /** Water-fire: a pale core in blue. */
  water: ['#eefcff', '#52c6ff', '#1c58dc'],
} satisfies Record<string, [string, string, string]>
export type FlameTone = keyof typeof FLAME_TONES

/**
 * A living flame, burning upwards from where it stands (a fire on a Bakugan's crown or tail), turned to face the
 * camera. `height` and `width` are in the units of whatever it is placed in.
 */
export function LiveFlame({ height, width, tone = 'fire' }: { height: number; width: number; tone?: FlameTone }) {
  const group = useRef<THREE.Group>(null)
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const layers = useMemo(() => {
    const make = (w: number, h: number, seed: number, hot: number, c: [string, string, string]) => {
      const geometry = new THREE.PlaneGeometry(w, h, 1, 1)
      // rooted a little below its marker, so it grows out of the body rather than floating on it
      geometry.translate(0, h / 2 - h * 0.08, 0)
      const material = new THREE.ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
        uniforms: {
          uT: { value: 0 },
          uSeed: { value: seed },
          uHot: { value: hot },
          uCore: { value: linear(c[0]) },
          uMid: { value: linear(c[1]) },
          uEdge: { value: linear(c[2]) },
        },
      })
      return { geometry, material }
    }
    const [core, mid, edge] = FLAME_TONES[tone]
    return [
      // the outer flame, and a smaller, hotter one inside it, flickering out of step
      make(width, height, 0, 1.2, [mid, mid, edge]),
      make(width * 0.6, height * 0.72, 100, 2.2, [core, core, mid]),
    ]
  }, [height, width, tone])
  useEffect(
    () => () =>
      layers.forEach((l) => {
        l.geometry.dispose()
        l.material.dispose()
      }),
    [layers],
  )

  const parentQ = useMemo(() => new THREE.Quaternion(), [])
  const faceQ = useMemo(() => new THREE.Quaternion(), [])
  const pos = useMemo(() => new THREE.Vector3(), [])
  const up = useMemo(() => new THREE.Vector3(0, 1, 0), [])
  useFrame(({ camera, clock }) => {
    const g = group.current
    if (!g?.parent) return
    // (each flame out of step with the others: its own offset in time)
    for (const m of meshes.current)
      if (m) (m.material as THREE.ShaderMaterial).uniforms.uT.value = clock.elapsedTime + (g.id % 17) * 3.1
    // turned about the world's upright to face the camera, whatever the bone it rides on is doing
    g.getWorldPosition(pos)
    const yaw = Math.atan2(camera.position.x - pos.x, camera.position.z - pos.z)
    g.parent.getWorldQuaternion(parentQ)
    faceQ.setFromAxisAngle(up, yaw)
    g.quaternion.copy(parentQ.invert().multiply(faceQ))
  })

  return (
    <group ref={group}>
      {layers.map((l, i) => (
        <mesh
          key={i}
          ref={(m) => void (meshes.current[i] = m)}
          geometry={l.geometry}
          material={l.material}
          position={[0, 0, i * 0.002]}
          renderOrder={2}
        />
      ))}
    </group>
  )
}
