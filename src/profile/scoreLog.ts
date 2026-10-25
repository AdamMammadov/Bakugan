import { rankScore, useProfiles } from './useProfiles'

/**
 * A short history of each profile's rank score, so the rankings can show how much it moved in the last 24 hours
 * (the CPU brawlers' history is worked out from the clock instead). An entry is added whenever a score changes;
 * entries older than three days are dropped, keeping the newest of them so a 24-hour lookup always has a start.
 */
// v2: the rank score formula changed; scores logged under the old one are dropped so the 24h column starts afresh
const KEY = 'bakugan-score-log-v2'
const OLD_KEYS = ['bakugan-score-log']
const DAY = 86_400_000
const KEEP = 3 * DAY

/** [time, score] pairs, oldest first, per profile id. */
type Log = Record<string, [number, number][]>

function read(): Log {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Log
  } catch {
    return {}
  }
}

function write(log: Log) {
  try {
    localStorage.setItem(KEY, JSON.stringify(log))
  } catch {
    // storage full or blocked: the 24h column just shows no change
  }
}

/** Notes every profile's current score if it changed since the last entry. */
export function logScores(now = Date.now()) {
  const profiles = useProfiles.getState().profiles
  const log = read()
  let changed = false
  for (const p of profiles) {
    const list = log[p.id] ?? []
    const score = rankScore(p)
    if (list[list.length - 1]?.[1] !== score) {
      list.push([now, score])
      changed = true
    }
    while (list.length > 1 && list[1][0] < now - KEEP) {
      list.shift()
      changed = true
    }
    log[p.id] = list
  }
  for (const id of Object.keys(log))
    if (!profiles.some((p) => p.id === id)) {
      delete log[id]
      changed = true
    }
  if (changed) write(log)
}

/** How much a profile's score moved in the last 24 hours (since its first entry if it is newer than that). */
export function dayChange(id: string, score: number, now = Date.now()): number {
  const list = read()[id]
  if (!list?.length) return 0
  let start = list[0][1]
  for (const [t, s] of list) {
    if (t > now - DAY) break
    start = s
  }
  return score - start
}

/** Starts keeping the log: now, and on every change to the profiles (battles, XP, a new profile). */
export function startScoreLog() {
  try {
    for (const key of OLD_KEYS) localStorage.removeItem(key)
  } catch {
    // storage blocked: nothing to clear
  }
  logScores()
  useProfiles.subscribe(() => logScores())
}
