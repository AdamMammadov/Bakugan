import { abilitiesOf, BAKUGAN } from '../data/bakugan'
import { botCharacter } from '../profile/avatar'
import { BOTS, botById, botNow, isBot } from '../profile/bots'
import { brawlerOf } from '../profile/brawlers'
import { clanOf, useClans } from '../profile/useClans'
import { rankScore, tierOf, unlockedCards, type Profile } from '../profile/useProfiles'
import type { ArenaSetup, TagMember, TeamMember } from '../store/useGame'

/**
 * Who brawls in a tag battle: the player's partner (a friend, or a random CPU brawler of their rank) and two CPU
 * opponents matched to the team's rank, preferably clan mates (they brawl as a team too).
 */

/** A CPU brawler's Bakugan with as many ability cards as their rating has unlocked (as in live matches). */
function botMembers(team: { id: string; form: number }[], rating: number): TeamMember[] {
  const cards = 3 + Math.floor(rating / 800)
  return team.flatMap(({ id, form }) => {
    const bakugan = BAKUGAN.find((b) => b.id === id)
    if (!bakugan) return []
    return [
      {
        id,
        form,
        cards: abilitiesOf(bakugan, form)
          .slice(0, cards)
          .map((a) => a.id),
      },
    ]
  })
}

/** A brawler (a CPU brawler, or another player on this device) as a member of a tag match. */
export function tagMember(id: string, profiles: Profile[], now: number): TagMember | null {
  const b = brawlerOf(id, profiles, now)
  if (!b) return null
  const local = profiles.find((p) => p.id === id)
  // another player here brings their own team with their unlocked cards; a CPU brawler their bot team
  let team: TeamMember[] = local
    ? local.team.flatMap((t) => {
        const owned = local.collection.find((o) => o.id === t)
        return owned ? [{ id: t, form: owned.form, cards: unlockedCards(owned).map((a) => a.id), skin: owned.skin }] : []
      })
    : botMembers(b.team, b.rating)
  if (!team.length) team = botMembers(b.collection.slice(0, 1), b.rating)
  const characterId = botById(id)?.characterId ?? (b.avatar.kind === 'preset' ? b.avatar.id : botCharacter(b.element).id)
  return { botId: id, name: b.name, characterId, tier: tierOf(b.score).index, team }
}

/** The rank score of a tag member (a CPU brawler now, or a player here). */
export function memberScore(id: string, profiles: Profile[], now: number) {
  return brawlerOf(id, profiles, now)?.score ?? 0
}

const ranked = (now: number, exclude: Set<string>) =>
  BOTS.filter((b) => !exclude.has(b.id)).map((b) => ({ id: b.id, score: rankScore(botNow(b, now)) }))

/** A random CPU partner close to the player's rank score. */
export function randomPartner(score: number, exclude: string[], profiles: Profile[], now: number, rng = Math.random) {
  const pool = ranked(now, new Set(exclude)).sort((a, b) => Math.abs(a.score - score) - Math.abs(b.score - score))
  const near = pool.filter((b) => Math.abs(b.score - score) <= 300)
  const list = near.length >= 3 ? near : pool.slice(0, 4)
  return tagMember(list[Math.floor(rng() * list.length)].id, profiles, now)!
}

/**
 * Two CPU opponents for a team of the given rank score (the average of the player's and the partner's): clan mates
 * close to that level when there are any, else the two CPU brawlers closest to it. Picks among the best few, so
 * a new search can bring other opponents.
 */
export function findOpponents(
  score: number,
  exclude: string[],
  profiles: Profile[],
  now: number,
  rng = Math.random,
): [TagMember, TagMember] {
  const bots = ranked(now, new Set(exclude))
  const byId = new Map(bots.map((b) => [b.id, b]))
  const options: { a: string; b: string; cost: number }[] = []
  for (const clan of useClans.getState().clans) {
    const members = clan.members.filter((id) => isBot(id) && byId.has(id)).map((id) => byId.get(id)!)
    for (let i = 0; i < members.length; i++)
      for (let j = i + 1; j < members.length; j++) {
        const [a, b] = [members[i], members[j]]
        options.push({ a: a.id, b: b.id, cost: Math.abs((a.score + b.score) / 2 - score) + Math.abs(a.score - b.score) * 0.5 })
      }
  }
  // brawlers who are not clan mates come after clan mates of the same level
  const near = [...bots].sort((a, b) => Math.abs(a.score - score) - Math.abs(b.score - score)).slice(0, 6)
  for (let i = 0; i < near.length; i++)
    for (let j = i + 1; j < near.length; j++) {
      const [a, b] = [near[i], near[j]]
      if (options.some((o) => (o.a === a.id && o.b === b.id) || (o.a === b.id && o.b === a.id))) continue
      options.push({
        a: a.id,
        b: b.id,
        cost: Math.abs((a.score + b.score) / 2 - score) + Math.abs(a.score - b.score) * 0.5 + 250,
      })
    }
  options.sort((x, y) => x.cost - y.cost)
  const pick = options[Math.floor(rng() * Math.min(3, options.length))]
  // the stronger one leads
  const [first, second] = [pick.a, pick.b].sort((x, y) => byId.get(y)!.score - byId.get(x)!.score)
  return [tagMember(first, profiles, now)!, tagMember(second, profiles, now)!]
}

/** "[VEST] clan mates" when both opponents are in the same clan. */
export function teamNote(members: TagMember[]) {
  const clans = useClans.getState().clans
  const clan = clanOf(clans, members[0].botId)
  return clan && members.every((m) => clanOf(clans, m.botId)?.id === clan.id) ? `[${clan.tag}] clan mates` : null
}

/** The arena setup of a tag battle (the first opponent also fills the 1v1 fields). */
export function tagArena(
  left: TeamMember[],
  partner: TagMember,
  opponents: [TagMember, TagMember],
  isRanked: boolean,
  friend: boolean,
): ArenaSetup {
  const lead = opponents[0]
  return {
    left,
    right: lead.team,
    ranked: isRanked,
    bot: { characterId: lead.characterId, tier: lead.tier, name: lead.name },
    tag: { partner, opponents, friend },
  }
}
