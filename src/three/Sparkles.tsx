import { Sparkles as BaseSparkles } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, type ComponentProps } from 'react'
import * as THREE from 'three'

/** No speck grows bigger than this on screen (in CSS pixels), however close the camera comes. */
const MAX_SIZE = 96

/**
 * The floating specks' look, made safe for the glow. The library's own shader divides by the distance to each speck's
 * centre and by the speck's depth: with the camera right among the specks (looking down on the field from above) that
 * came to infinity, and the glow spread it over the whole picture, which flashed black or white. Here every value
 * stays between 0 and 1, which is what a plain screen showed anyway.
 */
class SafeSparklesMaterial extends THREE.ShaderMaterial {
  constructor(pixelRatio: number) {
    super({
      uniforms: { time: { value: 0 }, pixelRatio: { value: pixelRatio } },
      transparent: true,
      depthWrite: false,
      vertexShader: /* glsl */ `
        uniform float pixelRatio;
        uniform float time;
        attribute float size;
        attribute float speed;
        attribute float opacity;
        attribute vec3 noise;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vOpacity;
        void main() {
          vec4 p = modelMatrix * vec4(position, 1.0);
          p.y += sin(time * speed + p.x * noise.x * 100.0) * 0.2;
          p.z += cos(time * speed + p.x * noise.y * 100.0) * 0.2;
          p.x += cos(time * speed + p.x * noise.z * 100.0) * 0.2;
          vec4 view = viewMatrix * p;
          gl_Position = projectionMatrix * view;
          float depth = max(-view.z, 0.5);
          gl_PointSize = min(size * 25.0 * pixelRatio / depth, ${MAX_SIZE.toFixed(1)} * pixelRatio);
          vColor = color;
          vOpacity = opacity;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        varying float vOpacity;
        void main() {
          float d = max(distance(gl_PointCoord, vec2(0.5)), 0.001);
          float strength = clamp(0.05 / d - 0.1, 0.0, 1.0);
          if (strength <= 0.0) discard;
          gl_FragColor = vec4(vColor, strength * clamp(vOpacity, 0.0, 1.0));
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    })
  }
  // the library sets the time on the material every frame
  get time() {
    return this.uniforms.time.value as number
  }
  set time(value: number) {
    this.uniforms.time.value = value
  }
}

/** Floating specks of light (drei's Sparkles, same props), with a shader that cannot blow the glow up. */
export function Sparkles(props: ComponentProps<typeof BaseSparkles>) {
  const dpr = useThree((s) => s.viewport.dpr)
  const material = useMemo(() => new SafeSparklesMaterial(dpr), [dpr])
  useEffect(() => () => material.dispose(), [material])
  return (
    <BaseSparkles {...props}>
      <primitive object={material} attach="material" />
    </BaseSparkles>
  )
}
