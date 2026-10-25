import { aiForTier, matchedOpponent } from '../battle/engine'
import { abilitiesOf, formBrawlG, type Entrant } from '../data/bakugan'
import { CHARACTER_GATES, COMMAND_GATES, GATE_BY_ID } from '../data/gates'
import { opponentCharacter } from '../profile/avatar'
import { bakuganById, rankScore, teamEntrants, tierOf, unlockedCards, type Profile } from '../profile/useProfiles'
import { isReleased, released } from '../season/release'
import type { ArenaEvent, ArenaSetup, TeamMember } from '../store/useGame'
import { DIFFICULTY_BY_ID, ROUND_BOOST, ROUND_NAME, type Boss, type CupStage, type Difficulty, type RuleEvent } from './catalog'
import type { CupRun } from './store'
import { hash, myMatch, seeded } from './tournament'

/** What goes into the arena for a team (as the face-off sends it). */
export const pack = (team: Entrant[]): TeamMember[] =>
  team.map((e) => ({ id: e.bakugan.id, form: e.form, cards: e.cards, bonusG: e.bonusG, skin: e.skin }))

/** The team the player brings to events: their saved face-off team, else their first Bakugan. */
export function eventTeam(p: Profile): Entrant[] {
  const saved = teamEntrants(p)
  if (saved.length) return saved
  const o = p.collection[0]
  return o ? [{ bakugan: bakuganById(o.id), form: o.form, cards: unlockedCards(o).map((a) => a.id), skin: o.skin }] : []
}

export const playerTier = (p: Profile) => tierOf(rankScore(p)).index

const gOf = (e: Entrant) => formBrawlG(e) + (e.bonusG ?? 0)
const cardCountOf = (e: Entrant) => e.cards?.length ?? abilitiesOf(e.bakugan, e.form).length

/** Highest G-Power on a Gate Card of any Bakugan players can get, at a form (as a ranked opponent is capped). */
function strongest(form: number) {
  return Math.max(...released().map((bakugan) => formBrawlG({ bakugan, form: Math.min(form, bakugan.evolutions.length - 1) })))
}

/** A CPU Bakugan brought to `level` G on a Gate Card, plus `edge` of it. */
const levelTo = (e: Entrant, level: number, edge = 0): Entrant => ({
  ...e,
  bonusG: level + Math.round(level * edge) - formBrawlG(e),
})

// ---------------------------------------------------------------- Bakugan Cup

/**
 * The player's next cup match. The CPU brawler brings its own Bakugan (filled up to as many as the player brings),
 * at the player's forms and card counts and levelled to them like a ranked opponent; later rounds add a little G.
 */
export function cupSetup(p: Profile, run: CupRun): ArenaSetup | null {
  const next = myMatch(run)
  if (!next) return null
  const stage = run.stage as CupStage
  const foe = run.entrants[next.foe]
  const team = eventTeam(p)
  if (!team.length) return null
  const mine = playerTier(p)
  const tier = Math.min(5, Math.max(mine - 1, Math.min(mine + 1, tierOf(foe.score).index)) + (stage === 'final' ? 1 : 0))
  const own = new Set(team.map((e) => e.bakugan.id))
  const rng = seeded(hash(`${run.id}:${foe.id}`))
  const species = foe.team.map((t) => t.id).filter((id) => !own.has(id) && isReleased(id))
  for (const b of released().sort(() => rng() - 0.5)) {
    if (species.length >= team.length) break
    if (!own.has(b.id) && !species.includes(b.id)) species.push(b.id)
  }
  const edge = aiForTier(tier).edge ?? 0
  const right = team.map((slot, i) => {
    const bakugan = bakuganById(species[i % species.length])
    const form = Math.min(slot.form, bakugan.evolutions.length - 1)
    const cards = abilitiesOf(bakugan, form)
      .slice(0, cardCountOf(slot))
      .map((a) => a.id)
    return levelTo({ bakugan, form, cards }, Math.min(gOf(slot), strongest(slot.form)), edge)
  })
  const event: ArenaEvent = {
    id: `cup:${run.id}`,
    stage,
    title: `${run.name.toUpperCase()} · ${ROUND_NAME[stage].toUpperCase()}`,
    ...(ROUND_BOOST[stage] ? { cpuBoost: ROUND_BOOST[stage] } : {}),
  }
  return {
    left: pack(team),
    right: pack(right),
    ranked: true,
    bot: { characterId: foe.characterId, tier, name: foe.name },
    event,
  }
}

// ---------------------------------------------------------------- bosses

/** The boss's own Bakugan (released ones), each as strong as the player's best, with the boss boost on top. */
export function bossTeam(p: Profile, boss: Boss, d: Difficulty): Entrant[] {
  const team = eventTeam(p)
  const info = DIFFICULTY_BY_ID[d]
  const best = Math.max(...team.map(gOf))
  const bestForm = Math.max(...team.map((e) => e.form))
  const cards = Math.max(...team.map(cardCountOf))
  const picks = boss.team.filter((t) => isReleased(t.id))
  const list = picks.length
    ? picks
    : released()
        .filter((b) => b.element === boss.element)
        .slice(0, 1)
        .map((b) => ({ id: b.id, form: 0 }))
  return list.map((t) => {
    const bakugan = bakuganById(t.id)
    const form = Math.min(t.form, bakugan.evolutions.length - 1)
    const entrant: Entrant = {
      bakugan,
      form,
      cards: info.allCards
        ? undefined
        : abilitiesOf(bakugan, form)
            .slice(0, cards)
            .map((a) => a.id),
    }
    return levelTo(entrant, Math.min(best, strongest(Math.max(form, bestForm))))
  })
}

export function bossSetup(p: Profile, boss: Boss, d: Difficulty): ArenaSetup | null {
  const team = eventTeam(p)
  if (!team.length) return null
  const info = DIFFICULTY_BY_ID[d]
  return {
    left: pack(team),
    right: pack(bossTeam(p, boss, d)),
    ranked: true,
    bot: { characterId: boss.look, tier: Math.max(info.tier, playerTier(p)), name: boss.name },
    event: {
      id: `boss:${boss.id}`,
      stage: d,
      title: `BOSS · ${boss.name.toUpperCase()} · ${info.name.toUpperCase()}`,
      cpuBoost: info.boost,
      lives: info.lives,
    },
  }
}

// ---------------------------------------------------------------- rule events

/** The player's team in its base forms, with the base form's unlocked cards. */
function baseForms(p: Profile, team: Entrant[]): Entrant[] {
  return team.map((e) => {
    const o = p.collection.find((x) => x.id === e.bakugan.id)
    const cards = o ? unlockedCards({ ...o, form: 0, cardsFrom: undefined }).map((a) => a.id) : undefined
    return { ...e, form: 0, cards }
  })
}

/** The Gate Cards both sides use in a rule event match (none: their own decks). */
export function ruleGates(ev: RuleEvent, left: Entrant[], right: Entrant[]): string[] | undefined {
  const rng = Math.random
  switch (ev.rule) {
    case 'command-chaos':
      return [...COMMAND_GATES]
        .sort(() => rng() - 0.5)
        .slice(0, 4)
        .map((g) => g.id)
    case 'character-clash': {
      // the Character cards of every Bakugan in the match, topped up with others
      const ids = [...new Set([...left, ...right].map((e) => `char-${e.bakugan.id}`))].filter((id) => GATE_BY_ID[id])
      for (const g of [...CHARACTER_GATES].sort(() => rng() - 0.5)) {
        if (ids.length >= 4) break
        if (!ids.includes(g.id)) ids.push(g.id)
      }
      return ids.slice(0, 5)
    }
    case 'reactor':
      return [200, 150, 100].map((n) => `${ev.element}-${n}`)
    default:
      return undefined
  }
}

export function ruleSetup(p: Profile, ev: RuleEvent): ArenaSetup | null {
  let team = eventTeam(p)
  if (!team.length) return null
  if (ev.rule === 'low-g') team = baseForms(p, team)
  const tier = playerTier(p)
  const right = matchedOpponent(team, Math.random, aiForTier(tier).edge)
  const avoid = p.avatar.kind === 'preset' ? p.avatar.id : undefined
  const bot = opponentCharacter(right[0].bakugan, avoid)
  const gates = ruleGates(ev, team, right)
  return {
    left: pack(team),
    right: pack(right),
    ranked: true,
    bot: { characterId: bot.id, tier },
    event: {
      id: `rule:${ev.id}`,
      title: ev.name.toUpperCase(),
      ...(gates ? { gates } : {}),
      ...(ev.rule === 'sudden-death' ? { lives: [1, 1] as [number, number] } : {}),
    },
  }
}
