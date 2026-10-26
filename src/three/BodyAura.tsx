import { useMemo } from 'react'
import { Sprites } from './fxKit'

/**
 * Light that clings to a Bakugan's own shape, sampled from its body as it stands: the aura it bursts into when an
 * ability activates, G-Power rising off it, the red flash of a hit, and the burst when it is defeated. Drawn in the
 * model's frame (model units), so it moves with the Bakugan.
 */
export type AuraKind = 'aura' | 'gain' | 'hit' | 'burst'

const MOTION: Record<AuraKind, { count: number; dur: number; shape: 'glow' | 'ember'; glsl: string }> = {
  aura: {
    count: 800,
    dur: 1.45,
    shape: 'glow',
    glsl: /* glsl */ `
      vec3 o = normalize(base + vec3(0.0, 0.0001, 0.0));
      float ph = fract(s.x + t * (1.1 + 0.9 * s.y));
      float burst = exp(-t * 5.0);
      p = base * (1.0 + 0.08 * ph) + o * (ph * 0.16 + burst * 0.32 * r.y) + vec3(0.0, ph * (0.4 + 0.45 * r.x), 0.0);
      p.x += sin(t * 7.0 + s.z * 30.0) * 0.03;
      p.z += cos(t * 6.0 + s.w * 30.0) * 0.03;
      a = sin(ph * 3.14159) * smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.65, 1.0, life)) * 0.38;
      sz = (0.18 + 0.2 * r.z) * (1.0 - ph * 0.5) * (1.0 + burst * 0.6);
      mixc = ph;
      hot = burst * 0.6;
    `,
  },
  gain: {
    count: 320,
    dur: 1.05,
    shape: 'glow',
    glsl: /* glsl */ `
      float ph = fract(s.x + t * (1.6 + s.y));
      p = base * 1.04 + vec3(0.0, ph * (0.8 + 0.6 * r.x), 0.0);
      a = sin(ph * 3.14159) * smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.6, 1.0, life)) * 0.6;
      sz = 0.1 + 0.1 * r.z;
      mixc = ph;
      hot = 0.3 * ph;
    `,
  },
  hit: {
    count: 520,
    dur: 0.6,
    shape: 'ember',
    glsl: /* glsl */ `
      vec3 o = normalize(base + vec3(0.0, 0.0001, 0.0));
      float spark = step(0.62, s.y);
      float k = 1.0 - pow(1.0 - life, 2.0);
      p = base * 1.02 + o * k * (0.15 + 1.0 * s.x * spark);
      a = (1.0 - life) * mix(0.55 * (1.0 - smoothstep(0.0, 0.4, life)), 0.95, spark);
      sz = mix(0.26, 0.09, spark) * (1.0 + r.x);
      mixc = r.y;
      hot = 1.0 - smoothstep(0.0, 0.25, life);
    `,
  },
  burst: {
    count: 700,
    dur: 1.0,
    shape: 'ember',
    glsl: /* glsl */ `
      vec3 o = normalize(base + vec3(0.0, 0.0001, 0.0));
      float k = 1.0 - pow(1.0 - life, 3.0);
      p = base + o * k * (0.6 + 1.6 * s.x) + vec3(0.0, k * 0.6 * s.y, 0.0);
      a = 1.0 - smoothstep(0.3 + 0.4 * s.z, 1.0, life);
      sz = (0.16 + 0.2 * r.x) * (2.0 - life);
      mixc = s.w;
      hot = 1.0 - smoothstep(0.0, 0.25, life);
    `,
  },
}

/** Points round a Bakugan-sized body, for when its model has not been measured yet. */
function fallback() {
  const out = new Float32Array(600 * 3)
  for (let i = 0; i < 600; i++) {
    const a = Math.random() * Math.PI * 2
    const y = Math.random()
    out.set([Math.cos(a) * 0.9 * (1 - y * 0.4), 0.2 + y * 2.6, Math.sin(a) * 1.6 * (1 - y * 0.4)], i * 3)
  }
  return out
}

export function BodyAura({
  kind,
  colors,
  delay = 0,
  sample,
}: {
  kind: AuraKind
  colors: [string, string, string]
  delay?: number
  /** The body's points as it stands now (in the frame this is drawn in), or null when unknown. */
  sample: () => Float32Array | null
}) {
  // the body is sampled once, as the effect starts; the particles are placed round its middle
  const { bases, center } = useMemo(() => {
    const pts = sample() ?? fallback()
    const n = pts.length / 3
    let cx = 0
    let cy = 0
    let cz = 0
    for (let i = 0; i < n; i++) {
      cx += pts[i * 3]
      cy += pts[i * 3 + 1]
      cz += pts[i * 3 + 2]
    }
    cx /= n
    cy /= n
    cz /= n
    const rel = new Float32Array(pts.length)
    for (let i = 0; i < n; i++) rel.set([pts[i * 3] - cx, pts[i * 3 + 1] - cy, pts[i * 3 + 2] - cz], i * 3)
    return { bases: rel, center: [cx, cy, cz] as [number, number, number] }
    // sampled when the effect starts only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const m = MOTION[kind]
  return (
    <group position={center}>
      <Sprites count={m.count} motion={m.glsl} dur={m.dur} delay={delay} colors={colors} shape={m.shape} bases={bases} />
    </group>
  )
}
