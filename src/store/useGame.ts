import { create } from 'zustand'
import { useProfiles } from '../profile/useProfiles'
import type { ElementId } from '../data/elements'

export type Screen =
  | 'intro'
  | 'wheel'
  | 'hub'
  | 'viewer'
  | 'compare'
  | 'arena'
  /** Watching CPU brawlers' live matches. */
  | 'live'
  | 'profile'
  | 'profileEdit'
  | 'rankings'
  | 'clans'
  | 'friends'
  | 'encyclopedia'
  | 'characters'
  | 'showroom'
  | 'shop'
  | 'inventory'
  | 'pass'
  /** Tournaments, boss battles and rule events. */
  | 'events'

export type PageScreen =
  | 'profile'
  | 'inventory'
  | 'pass'
  | 'shop'
  | 'rankings'
  | 'clans'
  | 'friends'
  | 'encyclopedia'
  | 'showroom'
  | 'characters'
const PAGES: PageScreen[] = [
  'profile',
  'inventory',
  'pass',
  'shop',
  'rankings',
  'clans',
  'friends',
  'encyclopedia',
  'showroom',
  'characters',
]

export interface TeamMember {
  id: string
  form: number
  /** Unlocked ability card ids (player profiles); every card when omitted. */
  cards?: string[]
  /** Level-matching G adjustment (opponents). */
  bonusG?: number
  skin?: string
}

export interface ArenaSetup {
  left: TeamMember[]
  right: TeamMember[]
  /** True when the left team is the active player's own; the result then earns XP. */
  ranked: boolean
  /**
   * The CPU brawler: series character it plays as and the rank tier that sets its strength; `name` is a
   * friend's own name when the player invited them (the arena can show it instead of the character's).
   */
  bot: { characterId: string; tier: number; name?: string }
  /** A 2v2 tag match: the player's partner and the two opponents (see TagSetup). */
  tag?: TagSetup
  /** An event match (tournament round, boss battle, rule event): its own rules, reported back to src/events. */
  event?: ArenaEvent
}

/** A CPU brawler (or a friend, who is a CPU brawler too) taking part in a tag match. */
export interface TagMember {
  /** Bot id from src/profile/bots.ts. */
  botId: string
  name: string
  /** Series character it plays as (look, model, voice). */
  characterId: string
  /** Rank tier that sets its strength. */
  tier: number
  team: TeamMember[]
}

/**
 * A 2v2 tag match: the player and `partner` against the two `opponents`. Every round has two duels at once, the
 * player against one opponent and the partner against the other; between rounds the pairs may swap.
 */
export interface TagSetup {
  partner: TagMember
  opponents: [TagMember, TagMember]
  /** True when the partner is one of the player's friends (otherwise a random CPU partner). */
  friend: boolean
}

/** An event's rules for one match, and where its result goes. */
export interface ArenaEvent {
  /** Event id from src/events. */
  id: string
  /** Which match of the event: a tournament round ('qf', 'sf', 'final'), a boss's id… */
  stage?: string
  /** Shown in the battle HUD, e.g. "SPRING CUP · SEMI-FINAL". */
  title: string
  /** Gate cards both sides use instead of their own decks (ids from src/data/gates.ts). */
  gates?: string[]
  /** Extra G-Power for every Bakugan on the CPU side (a boss). */
  cpuBoost?: number
  /** Lives per side [player, CPU], if not 3 each. */
  lives?: [number, number]
}

interface GameState {
  screen: Screen
  element: ElementId | null
  bakuganId: string | null
  /** Evolution the player brings into a face-off. */
  compareForm: number
  arena: ArenaSetup | null
  muted: boolean
  /** Background music on/off (sound effects stay). */
  music: boolean
  toggleMusic: () => void
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
  /** Where leaving the live matches goes back to. */
  liveFrom: Screen
  watchLive: () => void
  toggleMute: () => void
  openProfile: () => void
  /** Opens one of the player pages (profile, rankings, clans), remembering where to go back to. */
  openPage: (screen: PageScreen) => void
  editProfile: (id: string | null) => void
}

export const useGame = create<GameState>((set) => ({
  screen: 'intro',
  element: null,
  bakuganId: null,
  compareForm: 0,
  arena: null,
  muted: false,
  music: true,
  toggleMusic: () => set((s) => ({ music: !s.music })),
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
  liveFrom: 'compare',
  watchLive: () => set((s) => ({ screen: 'live', liveFrom: s.screen === 'live' ? s.liveFrom : s.screen })),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  openProfile: () => useGame.getState().openPage('profile'),
  openPage: (screen) =>
    set((s) => ({ screen, back: PAGES.includes(s.screen as PageScreen) || s.screen === 'profileEdit' ? s.back : s.screen })),
  editProfile: (editProfileId) =>
    set((s) => ({
      screen: 'profileEdit',
      editProfileId,
      back: PAGES.includes(s.screen as PageScreen) ? s.screen : s.screen === 'profileEdit' ? s.back : s.screen,
    })),
}))
