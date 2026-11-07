import { ShaderPass } from 'postprocessing'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

/**
 * The brightest a pixel may be before the glow (1 is plain white). The game's brightest lights and effects stay well
 * under it; only a broken value goes past it.
 */
const BRIGHTEST = 48

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`
const FRAGMENT = /* glsl */ `
uniform sampler2D inputBuffer;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(inputBuffer, vUv);
  // a broken value (not a number) becomes black; found from its bits, since some graphics drivers drop a plain
  // isnan() check as "impossible"
  uvec4 bits = floatBitsToUint(c) & 0x7fffffffu;
  c = mix(c, vec4(0.0), greaterThan(bits, uvec4(0x7f800000u)));
  // infinity, and anything brighter than the game draws, is capped; nothing is darker than black
  gl_FragColor = clamp(c, vec4(0.0), vec4(${BRIGHTEST.toFixed(1)}));
}
`

/**
 * Cleans the picture before the glow (bloom) and the screen effects. Some graphics cards turn a very bright
 * highlight or a stray sum into infinity or "not a number"; the glow then spread that one pixel over the whole
 * screen, which flashed white and black or stayed black. Here every pixel comes out as an ordinary colour.
 * Put it first inside the EffectComposer.
 */
export function CleanPicture() {
  const pass = useMemo(
    () =>
      new ShaderPass(
        new THREE.ShaderMaterial({
          uniforms: { inputBuffer: { value: null } },
          vertexShader: VERTEX,
          fragmentShader: FRAGMENT,
          depthTest: false,
          depthWrite: false,
        }),
      ),
    [],
  )
  useEffect(() => () => pass.dispose(), [pass])
  return <primitive object={pass} dispose={null} />
}
