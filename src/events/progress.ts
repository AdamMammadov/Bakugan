import { create } from 'zustand'
import type { ElementId } from '../data/elements'
import { useProfiles, type Profile } from '../profile/useProfiles'
import type { Reward } from '../season/season'
import { useGame } from '../store/useGame'
import {
  BOSS_BOUNTY,
  BOSS_BY_ID,
  bossPrize,
  cupPrize,
  dayKey,
  DIFFICULTY_BY_ID,
  PLACE_NAME,
  ROUND_NAME,
  ruleEventById,
  weekKey,
  type CupStage,
  type Difficulty,
  type RuleEvent,
  type Boss,
} from './catalog'
import { bossSetup, cupSetup, ruleSetup } from './matches'
import { onEventResult, type EventResult } from './results'
import { EMPTY_BOSS, EMPTY_EVENTS, useEvents, type CupRun, type ProfileEvents } from './store'
import { advance, myMatch, newRun } from './tournament'

// ---------------------------------------------------------------- toasts and the open panel

export interface EventToast {
  key: number
  title: string
  text: string
  tone: 'win' | 'loss' | 'gold'
  element: ElementId
  rewards: Reward[]
}

interface ToastState {
  queue: EventToast[]
  push: (t: Omit<EventToast, 'key'>) => void
  dismiss: (key: number) => void
}

let toastKey = 0
/** Event progress shown once the player is back from the arena. */
export const useEventToasts = create<ToastState>((set) => ({
  queue: [],
  push: (t) => set((s) => ({ queue: [...s.queue, { ...t, key: ++toastKey }] })),
  dismiss: (key) => set((s) => ({ queue: s.queue.filter((t) => t.key !== key) })),
}))

export type EventsView = { kind: 'board' } | { kind: 'cup' } | { kind: 'boss'; id: string }

/** Which panel of the events page is open; kept while the player is in the arena. */
export const useEventsView = create<{ view: EventsView; open: (view: EventsView) => void }>((set) => ({
  view: { kind: 'board' },
  open: (view) => set({ view }),
}))

// ---------------------------------------------------------------- helpers

const activeProfile = (): Profile | null => {
  const s = useProfiles.getState()
  return s.profiles.find((p) => p.id === s.activeId) ?? null
}
const patch = (id: string, fn: (e: ProfileEvents) => ProfileEvents) => useEvents.getState().patch(id, fn)
const eventsOf = (id: string) => useEvents.getState().byProfile[id]
const pay = (rewards: Reward[]) => rewards.length > 0 && useProfiles.getState().grantRewards(rewards)

/** Battles the player won and lost in a match. */
function battleScore(r: EventResult): [number, number] {
  const lives = r.event.lives?.[0] ?? 3
  const lost = Math.max(0, lives - r.livesLeft)
  return [Math.max(0, r.battles - lost), lost]
}

// ---------------------------------------------------------------- starting matches

/** Whether the player may start a new cup run today (one entry a day; a run in progress is played on). */
export function cupEntry(e: ProfileEvents, now = Date.now()) {
  const running = !!e.cup && !['out', 'champion'].includes(e.cup.stage)
  return { running, enteredToday: e.cupDays.includes(dayKey(now)) }
}

/** Enters the current cup: a fresh bracket. */
export function enterCup(): CupRun | null {
  const p = activeProfile()
  if (!p) return null
  const e = eventsOf(p.id)
  const entry = cupEntry(e ?? EMPTY_EVENTS)
  if (entry.running || entry.enteredToday) return null
  const run = newRun(p)
  patch(p.id, (x) => ({ ...x, cup: run, cupDays: [...x.cupDays, dayKey()] }))
  return run
}

export function playCup() {
  const p = activeProfile()
  const run = p && eventsOf(p.id)?.cup
  const setup = p && run ? cupSetup(p, run) : null
  if (!p || !run || !setup) return
  patch(p.id, (x) => ({ ...x, pending: { run: run.id, stage: run.stage } }))
  useGame.getState().enterArena(setup)
}

export function playBoss(boss: Boss, d: Difficulty) {
  const p = activeProfile()
  const setup = p ? bossSetup(p, boss, d) : null
  if (setup) useGame.getState().enterArena(setup)
}

export function playRule(ev: RuleEvent) {
  const p = activeProfile()
  const setup = p ? ruleSetup(p, ev) : null
  if (setup) useGame.getState().enterArena(setup)
}

/** Collects a finished rule event's reward. */
export function claimRule(ev: RuleEvent) {
  const p = activeProfile()
  const prog = p && eventsOf(p.id)?.rules[ev.id]
  if (!p || !prog || prog.claimed || prog.wins < ev.goal) return false
  if (!pay(ev.rewards)) return false
  patch(p.id, (x) => ({ ...x, rules: { ...x.rules, [ev.id]: { ...prog, claimed: true } } }))
  return true
}

// ---------------------------------------------------------------- results

function cupResult(p: Profile, runId: string, r: EventResult, left = false) {
  const run = eventsOf(p.id)?.cup
  // only the match the player is due to play counts (not a stale or repeated report)
  if (!run || run.id !== runId || run.stage !== r.event.stage || !myMatch(run)) return
  patch(p.id, (x) => ({ ...x, pending: null }))
  const stage = run.stage as CupStage
  const foe = run.entrants[myMatch(run)!.foe]
  const next = advance(run, r.won, battleScore(r))
  let trophy = false
  if (next.place) {
    const prize = cupPrize(next.place, run.name)
    pay(prize)
    trophy = next.place <= 2
    useEventToasts.getState().push({
      title:
        next.place === 1
          ? `${run.name.toUpperCase()} CHAMPION!`
          : `${run.name.toUpperCase()} · ${PLACE_NAME[next.place].toUpperCase()}`,
      text:
        next.place === 1
          ? `You beat ${foe.name} in the final and lift the cup!`
          : left
            ? `You left the ${ROUND_NAME[stage].toLowerCase()} against ${foe.name}: a match left counts as lost.`
            : `${foe.name} knocked you out in the ${ROUND_NAME[stage].toLowerCase()}.`,
      tone: next.place === 1 ? 'gold' : 'loss',
      element: run.element,
      rewards: prize,
    })
  } else {
    const after = myMatch(next)
    useEventToasts.getState().push({
      title: `${run.name.toUpperCase()} · ${ROUND_NAME[stage].toUpperCase()} WON`,
      text: `You beat ${foe.name}. Next: the ${ROUND_NAME[next.stage as CupStage].toLowerCase()}${
        after ? ` against ${next.entrants[after.foe].name}` : ''
      }.`,
      tone: 'win',
      element: run.element,
      rewards: [],
    })
  }
  patch(p.id, (x) => ({
    ...x,
    cup: next,
    trophies: trophy && next.place ? [...x.trophies, { cup: run.name, place: next.place, at: Date.now() }] : x.trophies,
  }))
  useEventsView.getState().open({ kind: 'cup' })
}

function bossResult(p: Profile, bossId: string, r: EventResult) {
  const boss = BOSS_BY_ID[bossId]
  const d = r.event.stage as Difficulty
  if (!boss || !DIFFICULTY_BY_ID[d]) return
  const prog = eventsOf(p.id)?.bosses[bossId] ?? EMPTY_BOSS
  const first = r.won && !prog.cleared.includes(d)
  const bounty = r.won && prog.bounty !== weekKey()
  const rewards = [...(first ? bossPrize(boss, d) : []), ...(bounty ? BOSS_BOUNTY : [])]
  pay(rewards)
  patch(p.id, (x) => {
    const b = x.bosses[bossId] ?? EMPTY_BOSS
    return {
      ...x,
      bosses: {
        ...x.bosses,
        [bossId]: {
          cleared: first ? [...b.cleared, d] : b.cleared,
          wins: b.wins + (r.won ? 1 : 0),
          losses: b.losses + (r.won ? 0 : 1),
          bounty: bounty ? weekKey() : b.bounty,
        },
      },
    }
  })
  const diff = DIFFICULTY_BY_ID[d].name.toUpperCase()
  useEventToasts.getState().push(
    r.won
      ? {
          title: `${boss.name.toUpperCase()} DEFEATED · ${diff}`,
          text: first
            ? `First clear on ${DIFFICULTY_BY_ID[d].name}!`
            : bounty
              ? 'Weekly bounty collected.'
              : 'Another win against the boss.',
          tone: first && d === 'brutal' ? 'gold' : 'win',
          element: boss.element,
          rewards,
        }
      : {
          title: `${boss.name.toUpperCase()} WINS · ${diff}`,
          text: `"${boss.quote}" Try again, or pick an easier difficulty.`,
          tone: 'loss',
          element: boss.element,
          rewards: [],
        },
  )
  useEventsView.getState().open({ kind: 'boss', id: bossId })
}

function ruleResult(p: Profile, id: string, r: EventResult) {
  const ev = ruleEventById(id)
  patch(p.id, (x) => {
    const prog = x.rules[id] ?? { wins: 0, played: 0, claimed: false }
    return { ...x, rules: { ...x.rules, [id]: { ...prog, wins: prog.wins + (r.won ? 1 : 0), played: prog.played + 1 } } }
  })
  if (!ev) return
  const prog = eventsOf(p.id)!.rules[id]
  const done = prog.wins >= ev.goal
  useEventToasts.getState().push({
    title: `${ev.name.toUpperCase()} · ${Math.min(prog.wins, ev.goal)}/${ev.goal} WINS`,
    text: done
      ? prog.claimed
        ? 'Event complete. Keep brawling for XP and BP.'
        : 'Event complete! Claim your reward on the events page.'
      : r.won
        ? `${ev.goal - prog.wins} more ${ev.goal - prog.wins === 1 ? 'win' : 'wins'} for the reward.`
        : 'No win this time — the next match counts too.',
    tone: done && !prog.claimed ? 'gold' : r.won ? 'win' : 'loss',
    element: ev.element,
    rewards: done && !prog.claimed ? ev.rewards : [],
  })
  useEventsView.getState().open({ kind: 'board' })
}

/** Where every finished event match goes. */
export function handleEventResult(r: EventResult) {
  const p = activeProfile()
  if (!p) return
  const at = r.event.id.indexOf(':')
  const kind = r.event.id.slice(0, at)
  const key = r.event.id.slice(at + 1)
  if (kind === 'cup') cupResult(p, key, r)
  else if (kind === 'boss') bossResult(p, key, r)
  else if (kind === 'rule') ruleResult(p, key, r)
}

/**
 * A cup match left before it ended (LEAVE, or a reload mid-match) counts as lost, so a match about to be lost
 * cannot be played again. A finished match has already reported by the time the player leaves the arena.
 */
function forfeitLeftMatch() {
  if (useGame.getState().screen === 'arena') return
  const p = activeProfile()
  const e = p && eventsOf(p.id)
  if (!p || !e?.pending) return
  const { run, stage } = e.pending
  patch(p.id, (x) => ({ ...x, pending: null }))
  cupResult(p, run, { event: { id: `cup:${run}`, stage, title: '' }, won: false, livesLeft: 0, battles: 3 }, true)
}

// registered once, on import, so no result is missed whichever screen is open
const stops = [onEventResult(handleEventResult), useGame.subscribe((s, prev) => s.screen !== prev.screen && forfeitLeftMatch())]
import.meta.hot?.dispose(() => stops.forEach((stop) => stop()))
