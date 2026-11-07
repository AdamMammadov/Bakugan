import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useGame } from './useGame'

/** How much the 3D scenes draw: low for slow computers, high for the sharpest picture. */
export type Quality = 'low' | 'medium' | 'high'
/** The announcer: every line, the first sentence of each (the battle never waits for it), or on screen only. */
export type Commentary = 'full' | 'short' | 'off'
/** How full the arena's stands are (fewer fans draw faster). */
export type CrowdSize = 'few' | 'normal' | 'packed'

interface SettingsState {
  /** Volumes, 0 to 1. */
  musicVolume: number
  sfxVolume: number
  /** The announcer and the brawlers' calls. */
  voiceVolume: number
  crowdVolume: number
  quality: Quality
  commentary: Commentary
  /** The brawlers shout their moves ("Gate Card, open!"). */
  brawlerCalls: boolean
  crowdSize: CrowdSize
  /** A frame-rate counter in the corner. */
  showFps: boolean
  /** Fewer screen animations (pages slide and pop less). */
  reduceMotion: boolean
  /** Silent while the game's tab is in the background. */
  muteInBackground: boolean
  /** A message for the player about the settings (e.g. the quality was lowered by itself); not kept. */
  notice?: string | null
  /** The settings panel is open (over whatever screen is showing). */
  open: boolean
  set: (part: Partial<Omit<SettingsState, 'set' | 'reset' | 'setOpen'>>) => void
  setOpen: (open: boolean) => void
  reset: () => void
}

const DEFAULTS = {
  musicVolume: 0.8,
  sfxVolume: 1,
  voiceVolume: 1,
  crowdVolume: 0.8,
  quality: 'medium' as Quality,
  commentary: 'short' as Commentary,
  brawlerCalls: true,
  crowdSize: 'packed' as CrowdSize,
  showFps: false,
  reduceMotion: false,
  muteInBackground: true,
}

/** The player's settings, kept in this browser. Music and sound on/off stay in useGame (the quick switches). */
export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      open: false,
      set: (part) => set(part),
      setOpen: (open) => set({ open }),
      reset: () => set(DEFAULTS),
    }),
    {
      name: 'bakugan-settings',
      partialize: ({ open: _open, set: _set, setOpen: _setOpen, reset: _reset, notice: _notice, ...kept }) => kept,
    },
  ),
)

// the music and sound switches are kept too: read back on load, saved when they change
const SWITCHES = 'bakugan-sound-switches'
try {
  const saved = JSON.parse(localStorage.getItem(SWITCHES) ?? 'null') as { muted?: boolean; music?: boolean } | null
  if (saved) useGame.setState({ muted: !!saved.muted, music: saved.music !== false })
} catch {
  // no storage (private mode): the defaults stay
}
useGame.subscribe((s, prev) => {
  if (s.muted === prev.muted && s.music === prev.music) return
  try {
    localStorage.setItem(SWITCHES, JSON.stringify({ muted: s.muted, music: s.music }))
  } catch {
    // no storage: nothing to keep
  }
})

/**
 * Whether this computer's graphics can draw the glow (bloom): it needs colour buffers of half-float precision. Some
 * graphics chips cannot, and the glow then left the screen black. Checked once.
 */
let floatBuffers: boolean | null = null
function canGlow() {
  if (floatBuffers !== null) return floatBuffers
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    floatBuffers = !!gl && !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'))
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch {
    floatBuffers = false
  }
  return floatBuffers
}

/**
 * What a 3D canvas draws at each quality. LOW: a lighter picture (rendered at 80% and scaled up, no anti-aliasing,
 * shadows, glow, sparkles or show lights, half the fans). MEDIUM: everything, at the screen's own size, without
 * multisampling. HIGH: sharper on high-density screens (up to 1.5×) with smoother edges and finer shadows. The glow
 * used 8× multisampled float buffers, which took 450–800 MB of video memory and left weaker computers black or crashed.
 */
const PRESETS = {
  low: { scale: 0.8, maxDpr: 1, antialias: false, shadows: false, shadowMap: 512, effects: false, samples: 0, extras: false },
  medium: { scale: 1, maxDpr: 1, antialias: true, shadows: true, shadowMap: 1024, effects: true, samples: 0, extras: true },
  high: { scale: 1, maxDpr: 1.5, antialias: true, shadows: true, shadowMap: 2048, effects: true, samples: 2, extras: true },
} satisfies Record<Quality, unknown>

/** The drawing settings for a 3D canvas, from the quality setting; `maxDpr` is the canvas's own sharpest. */
export function useQuality(maxDpr = 2) {
  const quality = useSettings((s) => s.quality)
  const q = PRESETS[quality]
  const screen = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1
  const dpr = Math.min(maxDpr, q.maxDpr, screen) * q.scale
  return {
    quality,
    dpr: [dpr, dpr] as [number, number],
    /** The canvas's own options (anti-aliasing only takes effect when the canvas is made). */
    gl: { antialias: q.antialias, powerPreference: 'high-performance' as const },
    shadows: q.shadows,
    shadowMapSize: [q.shadowMap, q.shadowMap] as [number, number],
    /** Glow (bloom) and other screen effects. */
    effects: q.effects && canGlow(),
    /** Multisampling of the screen effects' buffers. */
    samples: q.samples,
    /** Sparkles in the air, the arena's show lights and sparks. */
    extras: q.extras,
  }
}

/** One step down (after the 3D failed at this quality); null at the lowest. */
export const lowerQuality = (q: Quality): Quality | null => (q === 'high' ? 'medium' : q === 'medium' ? 'low' : null)
