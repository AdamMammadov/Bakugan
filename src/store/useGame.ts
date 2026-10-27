import { create } from 'zustand'
import { useProfiles } from '../profile/useProfiles'
import type { ElementId } from '../data/elements'

export type Screen =
  | 'intro'
  /** The main menu: home of every player with a profile. */
  | 'menu'
  /** Choosing an attribute, only while creating a new profile. */
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
  | 'events'
  | 'shop'
  | 'rankings'
  | 'clans'
  | 'friends'
  | 'encyclopedia'
  | 'showroom'
  | 'characters'
export const PAGES: PageScreen[] = [
  'profile',
  'inventory',
  'pass',
  'events',
  'shop',
  'rankings',
  'clans',
  'friends',
  'encyclopedia',
  'showroom',
  'characters',
]

/**
 * How far each screen sits below the main menu. A screen remembers where it was opened from only when that
 * screen is shallower, so BACK always climbs towards the menu and two screens can never send BACK to each other.
 * Matches, the title and the attribute wheel (-1) are never gone back to.
 */
function depthOf(screen: Screen) {
  if (screen === 'menu') return 0
  if (screen === 'hub') return 1
  if (screen === 'viewer') return 2
  if (screen === 'compare') return 3
  if (PAGES.includes(screen as PageScreen)) return 4
  if (screen === 'profileEdit') return 5
  return -1
}

/** The player pages share one way back: switching tabs keeps it. */
const parentKey = (screen: Screen) => (PAGES.includes(screen as PageScreen) ? 'page' : screen)

/** Where BACK on `screen` leads: the screen it was opened from (see depthOf), else the main menu. */
export const backOf = (screen: Screen): Screen => useGame.getState().parents[parentKey(screen)] ?? 'menu'

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
  /** Where the profile editor returns to. */
  back: Screen
  /** Where each screen (the pages share 'page') was opened from: see backOf. */
  parents: Partial<Record<string, Screen>>
  go: (screen: Screen) => void
  /** Shows an attribute's Bakugan: the hub for a player with a profile, else a new profile of that attribute. */
  chooseElement: (element: ElementId) => void
  /** Starts a new profile: the attribute wheel, then the profile editor, then the main menu. */
  newProfile: () => void
  /** The attribute picked on the wheel for the new profile. */
  pickAttribute: (element: ElementId) => void
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
  /** Edits a profile; null starts a new one (see newProfile). */
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
  back: 'menu',
  parents: {},
  go: (screen) => set({ screen }),
  chooseElement: (element) =>
    useProfiles.getState().activeId ? set({ element, screen: 'hub' }) : useGame.getState().pickAttribute(element),
  newProfile: () => set({ screen: 'wheel' }),
  // the profile editor comes next; saving it lands on the main menu
  pickAttribute: (element) => set({ element, screen: 'profileEdit', editProfileId: null, back: 'menu' }),
  openBakugan: (bakuganId) => set({ bakuganId, screen: 'viewer' }),
  compareWith: (bakuganId, compareForm = 0) => set({ bakuganId, compareForm, screen: 'compare' }),
  enterArena: (arena) => set({ arena, screen: 'arena' }),
  liveFrom: 'compare',
  watchLive: () => set((s) => ({ screen: 'live', liveFrom: s.screen === 'live' ? s.liveFrom : s.screen })),
  toggleMute: () => set((s) => ({ muted: !s.muted })),
  openProfile: () => useGame.getState().openPage('profile'),
  openPage: (screen) => set({ screen }),
  editProfile: (editProfileId) =>
    editProfileId === null
      ? useGame.getState().newProfile()
      : set((s) => ({
          screen: 'profileEdit',
          editProfileId,
          back: PAGES.includes(s.screen as PageScreen) ? s.screen : s.screen === 'profileEdit' ? s.back : s.screen,
        })),
}))

// a screen opened from a shallower one remembers it; returning (or coming out of a match) keeps what it had
useGame.subscribe((s, prev) => {
  if (s.screen === prev.screen) return
  const from = depthOf(prev.screen)
  if (from >= 0 && depthOf(s.screen) > from) useGame.setState({ parents: { ...s.parents, [parentKey(s.screen)]: prev.screen } })
})
