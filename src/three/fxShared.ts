import { createContext } from 'react'
import * as THREE from 'three'

/** Shared pieces of the arena's effects (fxKit, BattleFx, BodyAura) that are not components. */

/** A multiplier on every kit effect's opacity under it: an effect cut short (nullified) fades through it. */
export const FxFade = createContext<{ current: number } | null>(null)

/** Neutral gold for command and character gates. */
export const GATE_GOLD = '#ffc94a'
export const GATE_GOLD_GLOW = '#fff0b0'

/** When the bus last played an ability: the older action effects step aside for it. */
let lastAbility = -1e9
export const markAbility = () => void (lastAbility = performance.now())
export const busAbilityRecently = () => performance.now() - lastAbility < 2500

export const GLSL_NOISE = /* glsl */ `
float fxHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float fxNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(fxHash(i), fxHash(i + vec2(1.0, 0.0)), u.x), mix(fxHash(i + vec2(0.0, 1.0)), fxHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
`

/** `n` random numbers. */
export function randoms(n: number) {
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) out[i] = Math.random()
  return out
}

let glareTextures: Record<'burst' | 'rays', THREE.Texture> | null = null
/** Textures for Glare: a soft round burst, and a sunburst of thin rays. */
export function glareTexture(kind: 'burst' | 'rays') {
  if (!glareTextures) {
    const make = (draw: (g: CanvasRenderingContext2D) => void) => {
      const c = document.createElement('canvas')
      c.width = c.height = 256
      draw(c.getContext('2d')!)
      return new THREE.CanvasTexture(c)
    }
    glareTextures = {
      burst: make((g) => {
        const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128)
        grad.addColorStop(0, 'rgba(255,255,255,1)')
        grad.addColorStop(0.18, 'rgba(255,255,255,.65)')
        grad.addColorStop(0.5, 'rgba(255,255,255,.15)')
        grad.addColorStop(1, 'rgba(255,255,255,0)')
        g.fillStyle = grad
        g.fillRect(0, 0, 256, 256)
      }),
      rays: make((g) => {
        g.translate(128, 128)
        for (let i = 0; i < 28; i++) {
          const a = (i / 28) * Math.PI * 2 + (i % 2) * 0.05
          const len = i % 2 ? 90 : 124
          const w = i % 2 ? 0.025 : 0.045
          const grad = g.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len)
          grad.addColorStop(0, 'rgba(255,255,255,.9)')
          grad.addColorStop(1, 'rgba(255,255,255,0)')
          g.fillStyle = grad
          g.beginPath()
          g.moveTo(0, 0)
          g.arc(0, 0, len, a - w, a + w)
          g.closePath()
          g.fill()
        }
        const core = g.createRadialGradient(0, 0, 0, 0, 0, 60)
        core.addColorStop(0, 'rgba(255,255,255,.9)')
        core.addColorStop(1, 'rgba(255,255,255,0)')
        g.fillStyle = core
        g.fillRect(-128, -128, 256, 256)
      }),
    }
  }
  return glareTextures[kind]
}

/** How long each body aura (BodyAura) plays, seconds after its delay. */
export const AURA_LIFE = { aura: 1.45, gain: 1.05, hit: 0.6, burst: 1.0 }

/**
 * The effects' own clock (seconds), advanced by the arena's effects each frame. Dev builds can play the effects in
 * slow motion for a closer look (window.__fxSlow = 0.1).
 */
export const fxClock = { now: 0 }
export const fxScale = () => (import.meta.env.DEV ? ((window as unknown as { __fxSlow?: number }).__fxSlow ?? 1) : 1)
