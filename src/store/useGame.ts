import { create } from 'zustand'
import { useProfiles } from '../profile/useProfiles'
import type { ElementId } from '../data/elements'

export type Screen = 'intro' | 'wheel' | 'hub' | 'viewer' | 'compare' | 'arena' | 'profile' | 'profileEdit'

export interface TeamMember {
  id: string
  form: number
  /** Unlocked ability card ids (player profiles); every card when omitted. */
  cards?: string[]
}

export interface ArenaSetup {
  left: TeamMember[]
  right: TeamMember[]
  /** True when the left team is the active player's own; the result then earns XP. */
  ranked: boolean
}

interface GameState {
  screen: Screen
  element: ElementId | null
  bakuganId: string | null
  /** Evolution the player brings into a face-off. */
  compareForm: number
  arena: ArenaSetup | null
  muted: boolean
  /** Profile being edited; null while creating a new one. */
  editProfileId: string | null
  /** Where the profile editor/screen returns to. */
  back: Screen
  go: (screen: Screen) => void
  chooseElement: (element: ElementId) => void
  openBakugan: (id: string) => void
  /** Opens the compare screen with `id` on the player's side. */
  compareWith: (id: string, form?: number) => void
  enterArena: (setup: ArenaSetup) => void
  toggleMute: () => void
  openProfile: () => void
  editProfile: (id: string | null) => void
}

export const useGame = create<GameState>((set) => ({
  screen: 'intro',
  element: null,
  bakuganId: null,
  compareForm: 0,
  arena: null,
  muted: false,
  editProfileId: null,
  back: 'wheel',
  go: (screen) => set({ screen }),
  // a new player creates a profile right after picking an attribute
  chooseElement: (element) =>
    set(
      useProfiles.getState().activeId
        ? { element, screen: 'hub' }
        : { element, screen: 'profileEdit', editProfileId: null, back: 'hub' },
    ),
  openBakugan: (bakuganId) => set({ bakuganId, screen: 'viewer' }),
  compareWith: (bakuganId, compareForm = 0) => set({ bakuganId, compareForm, screen: 'compare' }),
  enterArena: (arena) => set({ arena, screen: 'arena' }),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  openProfile: () =>
    set((s) => ({
      screen: 'profile',
      back: s.screen === 'profile' || s.screen === 'profileEdit' ? s.back : s.screen,
    })),
  editProfile: (editProfileId) =>
    set((s) => ({
      screen: 'profileEdit',
      editProfileId,
      back: s.screen === 'profile' ? 'profile' : s.screen === 'profileEdit' ? s.back : s.screen,
    })),
}))
