import { create } from 'zustand'
import type { ElementId } from '../data/elements'

export type Screen = 'intro' | 'wheel' | 'hub' | 'viewer' | 'compare' | 'arena'

export interface TeamMember {
  id: string
  form: number
}

export interface ArenaSetup {
  left: TeamMember[]
  right: TeamMember[]
}

interface GameState {
  screen: Screen
  element: ElementId | null
  bakuganId: string | null
  /** Evolution the player brings into a face-off. */
  compareForm: number
  arena: ArenaSetup | null
  muted: boolean
  go: (screen: Screen) => void
  chooseElement: (element: ElementId) => void
  openBakugan: (id: string) => void
  /** Opens the compare screen with `id` on the player's side. */
  compareWith: (id: string, form?: number) => void
  enterArena: (setup: ArenaSetup) => void
  toggleMute: () => void
}

export const useGame = create<GameState>((set) => ({
  screen: 'intro',
  element: null,
  bakuganId: null,
  compareForm: 0,
  arena: null,
  muted: false,
  go: (screen) => set({ screen }),
  chooseElement: (element) => set({ element, screen: 'hub' }),
  openBakugan: (bakuganId) => set({ bakuganId, screen: 'viewer' }),
  compareWith: (bakuganId, compareForm = 0) => set({ bakuganId, compareForm, screen: 'compare' }),
  enterArena: (arena) => set({ arena, screen: 'arena' }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
}))
