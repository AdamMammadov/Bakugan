import { useGame } from '../store/useGame'
import { useEventsView } from './progress'

/** Opens the events page on its board, remembering where to go back to (as openPage does for the other pages). */
export function openEvents() {
  // the board first, whichever panel was open last time
  useEventsView.getState().open({ kind: 'board' })
  useGame.getState().openPage('events')
}
