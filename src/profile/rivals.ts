import { matchedOpponent } from '../battle/engine'
import type { Entrant } from '../data/bakugan'
import type { LiveBot } from './botProgress'
import { BOTS, botNow, botTeam } from './bots'
import { rankScore } from './useProfiles'

/** An opponent from the rankings: who they are, their rank score, and the team they bring to this match. */
export interface Rival {
  bot: LiveBot
  score: number
  team: Entrant[]
}

/** How many of the nearest brawlers in the rankings a match may be made with. */
const NEAREST = 6

/**
 * Finds an opponent for the player among the brawlers in the rankings: one of those nearest the player's rank score.
 * They bring their own Bakugan first (when not in the player's team), levelled to the player's team with the CPU's
 * `edge` for the player's rank, as many as the player brings.
 */
export function findRival(score: number, team: Entrant[], edge: number, avoidLook?: string, rng = Math.random): Rival {
  const now = Date.now()
  const near = BOTS.map((b) => botNow(b, now))
    .filter((b) => b.characterId !== avoidLook)
    .map((bot) => ({ bot, score: rankScore(bot) }))
    .sort((a, b) => Math.abs(a.score - score) - Math.abs(b.score - score))
    .slice(0, NEAREST)
  const pick = near[Math.floor(rng() * near.length)]
  return {
    ...pick,
    team: matchedOpponent(
      team,
      rng,
      edge,
      botTeam(pick.bot).map((t) => t.id),
    ),
  }
}
