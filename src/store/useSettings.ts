import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useGame } from './useGame'

/** How much the 3D scenes draw: low for slow computers, high for the sharpest picture. */
export type Quality = 'low' | 'medium' | 'high'
/** The announcer: every line, the first sentence of each (the battle never waits for it), or on screen only. */
export type Commentary = 'full' | 'short' | 'off'

interface SettingsState {
  /** Volumes, 0 to 1. */
  musicVolume: number
  sfxVolume: number
  /** The announcer and the brawlers' calls. */
  voiceVolume: number
  crowdVolume: number
  quality: Quality
  commentary: Commentary
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
  quality: 'high' as Quality,
  commentary: 'short' as Commentary,
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
      partialize: ({ open: _open, set: _set, setOpen: _setOpen, reset: _reset, ...kept }) => kept,
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

/** The drawing settings for a 3D canvas, from the quality setting; `maxDpr` is the canvas's own sharpest. */
export function useQuality(maxDpr = 2) {
  const quality = useSettings((s) => s.quality)
  const cap = quality === 'low' ? 1 : quality === 'medium' ? 1.5 : maxDpr
  return {
    dpr: [1, Math.min(maxDpr, cap)] as [number, number],
    shadows: quality !== 'low',
    /** Glow (bloom) and other screen effects. */
    effects: quality !== 'low',
  }
}
