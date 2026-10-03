import { create } from 'zustand'
import type { ElementId } from '../data/elements'

export type Screen = 'intro' | 'wheel' | 'hub' | 'viewer' | 'compare'

interface GameState {
  screen: Screen
  element: ElementId | null
  bakuganId: string | null
  muted: boolean
  go: (screen: Screen) => void
  chooseElement: (element: ElementId) => void
  openBakugan: (id: string) => void
  /** Opens the compare screen with `id` on the player's side. */
  compareWith: (id: string) => void
  toggleMute: () => void
}

export const useGame = create<GameState>((set) => ({
  screen: 'intro',
  element: null,
  bakuganId: null,
  muted: false,
  go: (screen) => set({ screen }),
  chooseElement: (element) => set({ element, screen: 'hub' }),
  openBakugan: (bakuganId) => set({ bakuganId, screen: 'viewer' }),
  compareWith: (bakuganId) => set({ bakuganId, screen: 'compare' }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
}))
