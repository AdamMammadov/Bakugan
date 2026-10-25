import {
  act,
  aiForTier,
  chooseAction,
  chooseGate,
  chooseThrow,
  nextBattle,
  resolveBattle,
  setGate,
  startBattle,
  throwBakugan,
  throwerOf,
  type BattleState,
} from '../battle/engine'
import { abilitiesOf, BAKUGAN, type Entrant } from '../data/bakugan'
import { gateDeck } from '../data/gates'
import { botCharacter } from '../profile/avatar'
import { BOTS, botNow, botTeam } from '../profile/bots'
import { rankScore, tierOf, type Profile } from '../profile/useProfiles'
import { cupAt, CUP_ROUNDS, dayKey, type CupStage, type Place } from './catalog'
import type { CupEntrant, CupMatch, CupRun } from './store'

/** A seeded random number generator (mulberry32): the same seed plays the same cup. */
export function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** The player as a cup entrant. */
function meOf(p: Profile): CupEntrant {
  return {
    id: 'me',
    name: `${p.firstName} ${p.lastName}`.trim(),
    characterId: p.avatar.kind === 'preset' ? p.avatar.id : botCharacter(p.element).id,
    element: p.element,
    score: rankScore(p),
    team: p.team.map((id) => ({ id, form: p.collection.find((o) => o.id === id)?.form ?? 0 })),
    cards: 3,
  }
}

/** Seven CPU brawlers close to the player in the rankings (as they stand now), picked by the seed. */
function field(p: Profile, now: number, rng: () => number): CupEntrant[] {
  const mine = rankScore(p)
  const near = BOTS.map((b) => botNow(b, now))
    .sort((a, b) => Math.abs(rankScore(a) - mine) - Math.abs(rankScore(b) - mine))
    .slice(0, 14)
  return shuffle(near, rng)
    .slice(0, 7)
    .map((bot) => ({
      id: bot.id,
      name: bot.name,
      characterId: bot.characterId,
      element: bot.element,
      score: rankScore(bot),
      team: botTeam(bot),
      // as many cards as a bot's rating has unlocked (as in the live matches)
      cards: 3 + Math.floor(bot.rating / 800),
    }))
}

/** Bracket order for seeds 1–8: 1 v 8 and 4 v 5 meet in one semi-final, 2 v 7 and 3 v 6 in the other. */
const SEED_ORDER = [0, 7, 3, 4, 1, 6, 2, 5]

/** A new cup run for the player: eight brawlers seeded by ranking score. */
export function newRun(p: Profile, now = Date.now()): CupRun {
  const cup = cupAt(now)
  const id = `${cup.index}-${dayKey(now)}`
  const rng = seeded(hash(`${p.id}:${id}`))
  const seeds = [meOf(p), ...field(p, now, rng)].sort((a, b) => b.score - a.score)
  const entrants = SEED_ORDER.map((i) => seeds[i])
  return {
    id,
    cup: cup.index,
    name: cup.name,
    element: cup.element,
    startedAt: now,
    entrants,
    me: entrants.findIndex((e) => e.id === 'me'),
    rounds: [[0, 2, 4, 6].map((a) => ({ a, b: a + 1, winner: null }))],
    stage: 'qf',
    place: null,
  }
}

/** The player's match in the round they are in, and who they face. */
export function myMatch(run: CupRun): { match: CupMatch; foe: number } | null {
  const ri = CUP_ROUNDS.indexOf(run.stage as CupStage)
  const match = run.rounds[ri]?.find((m) => m.a === run.me || m.b === run.me)
  return match ? { match, foe: match.a === run.me ? match.b : match.a } : null
}

/** A CPU entrant's own team with its cards. */
function teamOf(e: CupEntrant): Entrant[] {
  return e.team
    .map(({ id, form }) => ({ bakugan: BAKUGAN.find((b) => b.id === id)!, form }))
    .filter((x) => x.bakugan)
    .map(({ bakugan, form }) => ({
      bakugan,
      form: Math.min(form, bakugan.evolutions.length - 1),
      cards: abilitiesOf(bakugan, form)
        .slice(0, e.cards)
        .map((a) => a.id),
    }))
}

/** Two CPU brawlers play a whole match, off screen, with the battle engine and their own AI levels. */
export function simulate(a: CupEntrant, b: CupEntrant, seed: number): { winner: 0 | 1; score: [number, number] } {
  const rng = seeded(seed)
  const teams = [teamOf(a), teamOf(b)]
  const ai = [aiForTier(tierOf(a.score).index), aiForTier(tierOf(b.score).index)]
  let s: BattleState = startBattle(teams[0], teams[1], [gateDeck(teams[0]), gateDeck(teams[1])], rng() < 0.5 ? 0 : 1)
  for (let guard = 0; s.winner === null && s.phase !== 'over' && guard < 3000; guard++) {
    if (s.phase === 'set') s = setGate(s, chooseGate(s, ai[s.setter], rng))
    else if (s.phase === 'throw') {
      const side = throwerOf(s)
      if (side === null) break
      s = throwBakugan(s, side, chooseThrow(s, side, ai[side], rng), rng)
    } else if (s.phase === 'battle') s = act(s, chooseAction(s, ai[s.duel!.turn], rng)).state
    else if (s.phase === 'clash') s = resolveBattle(s).state
    else if (s.phase === 'result') s = nextBattle(s)
  }
  const winner = s.winner ?? (s.sides[0].lives >= s.sides[1].lives ? 0 : 1)
  return { winner, score: [s.sides[0].wins, s.sides[1].wins] }
}

/** Plays every match of a round that has no winner yet and does not involve the player. */
function playRound(run: CupRun, round: CupMatch[], ri: number) {
  round.forEach((m, i) => {
    if (m.winner !== null || m.a === run.me || m.b === run.me) return
    const r = simulate(run.entrants[m.a], run.entrants[m.b], hash(`${run.id}:${ri}:${i}`))
    m.winner = r.winner === 0 ? m.a : m.b
    m.score = r.score
  })
}

/** The next round's pairs: winners of matches 1 and 2, 3 and 4… */
const pairsAfter = (round: CupMatch[]): CupMatch[] =>
  Array.from({ length: round.length / 2 }, (_, i) => ({ a: round[2 * i].winner!, b: round[2 * i + 1].winner!, winner: null }))

const PLACE_OUT: Place[] = [5, 3, 2]

/**
 * The player's match is over: the rest of the round is played, then the next round is drawn. A player who lost
 * watches the cup played out to its champion.
 */
export function advance(run: CupRun, won: boolean, score: [number, number]): CupRun {
  const ri = CUP_ROUNDS.indexOf(run.stage as CupStage)
  if (ri < 0) return run
  const rounds = run.rounds.map((r) => r.map((m) => ({ ...m })))
  const mine = rounds[ri].find((m) => m.a === run.me || m.b === run.me)
  if (!mine) return run
  const foe = mine.a === run.me ? mine.b : mine.a
  mine.winner = won ? run.me : foe
  mine.score = mine.a === run.me ? score : [score[1], score[0]]
  const next = { ...run, rounds }
  playRound(next, rounds[ri], ri)
  if (!won) {
    for (let i = ri + 1; i < CUP_ROUNDS.length; i++) {
      rounds[i] = pairsAfter(rounds[i - 1])
      playRound(next, rounds[i], i)
    }
    return { ...next, stage: 'out', place: PLACE_OUT[ri] }
  }
  if (ri === CUP_ROUNDS.length - 1) return { ...next, stage: 'champion', place: 1 }
  rounds[ri + 1] = pairsAfter(rounds[ri])
  return { ...next, stage: CUP_ROUNDS[ri + 1] }
}

/** The cup's champion, once the final is played. */
export const championOf = (run: CupRun): number | null => run.rounds[2]?.[0]?.winner ?? null
