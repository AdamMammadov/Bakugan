import { useGame, type Screen } from '../store/useGame'
import { useEventsView } from './progress'

/** The player pages (PageNav tabs): leaving one for another keeps where BACK goes. */
const PAGES: Screen[] = [
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
  'profileEdit',
  'events',
]

/** Opens the events page, remembering where to go back to (as openPage does for the other pages). */
export function openEvents() {
  // the board first, whichever panel was open last time
  useEventsView.getState().open({ kind: 'board' })
  useGame.setState((s) => ({ screen: 'events', back: PAGES.includes(s.screen) ? s.back : s.screen }))
}
