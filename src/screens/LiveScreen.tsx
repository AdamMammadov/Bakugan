import { useEffect, useRef, useState } from 'react'
import { aiForTier } from '../battle/engine'
import { abilitiesOf, BAKUGAN, type Entrant } from '../data/bakugan'
import { CHARACTER_BY_ID } from '../profile/avatar'
import { BOTS, botNow, botTeam, type BotBrawler } from '../profile/bots'
import { rankScore, tierOf, TIERS } from '../profile/useProfiles'
import { useGame } from '../store/useGame'
import { Brawl, type BrawlerSide } from './ArenaScreen'

/** The result stays up this long before the next live match starts. */
const NEXT_MATCH_MS = 6000

interface LiveMatch {
  id: number
  teams: readonly [Entrant[], Entrant[]]
  brawlers: [BrawlerSide, BrawlerSide]
  viewers: number
}

let matchId = 0

/** A bot's team as it brawls: its Bakugan with as many cards as its rating has unlocked. */
function teamOf(bot: BotBrawler): Entrant[] {
  const cards = 3 + Math.floor(bot.rating / 800)
  return botTeam(bot).map(({ id, form }) => {
    const bakugan = BAKUGAN.find((b) => b.id === id)!
    return {
      bakugan,
      form,
      cards: abilitiesOf(bakugan, form)
        .slice(0, cards)
        .map((a) => a.id),
    }
  })
}

function sideOf(bot: BotBrawler): BrawlerSide {
  const c = CHARACTER_BY_ID[bot.characterId]
  const tier = tierOf(rankScore(bot)).index
  return {
    name: bot.name,
    tag: `${TIERS[tier].name.toUpperCase()} · ${bot.rating} BR`,
    avatar: { kind: 'preset', id: bot.characterId },
    parts: c.parts,
    model: c.model,
    voice: c.voice,
    ai: aiForTier(tier),
    hsp: rankScore(bot),
  }
}

/** Two CPU brawlers close in the rankings (as they stand now), picked at random. */
function liveMatch(): LiveMatch {
  const now = Date.now()
  const ranked = BOTS.map((bot) => botNow(bot, now)).sort((a, b) => rankScore(b) - rankScore(a))
  const i = Math.floor(Math.random() * (ranked.length - 1))
  const j = Math.min(ranked.length - 1, i + 1 + Math.floor(Math.random() * 3))
  const [a, b] = Math.random() < 0.5 ? [ranked[i], ranked[j]] : [ranked[j], ranked[i]]
  // stronger brawlers draw a bigger crowd
  const viewers = Math.round(300 + ((a.rating + b.rating) / 2) * (0.8 + Math.random() * 0.6))
  const sideB = sideOf(b)
  // two CPU brawlers playing the same character still sound different
  if (a.characterId === b.characterId) sideB.voice = { ...sideB.voice, id: b.name }
  return { id: ++matchId, teams: [teamOf(a), teamOf(b)], brawlers: [sideOf(a), sideB], viewers }
}

/** Watch live: CPU brawlers' matches, one after another, until the player leaves. Nothing is recorded. */
export function LiveScreen() {
  const go = useGame((s) => s.go)
  const from = useGame((s) => s.liveFrom)
  const [match, setMatch] = useState(liveMatch)
  const [viewers, setViewers] = useState(match.viewers)
  const next = useRef(0)

  // the audience comes and goes a little
  useEffect(() => {
    const t = window.setInterval(() => setViewers((v) => Math.max(40, Math.round(v * (0.97 + Math.random() * 0.065)))), 2500)
    return () => {
      clearInterval(t)
      clearTimeout(next.current)
    }
  }, [])

  return (
    <Brawl
      key={match.id}
      teams={match.teams}
      brawlers={match.brawlers}
      live
      onLeave={() => go(from)}
      onOver={() => {
        next.current = window.setTimeout(() => {
          const m = liveMatch()
          setMatch(m)
          setViewers(m.viewers)
        }, NEXT_MATCH_MS)
      }}
      badge={
        <div className="font-display mb-2 flex items-center gap-2 rounded-full border border-red-500/60 bg-black/70 px-3 py-1 text-[10px] tracking-[0.3em]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
          <span className="font-bold text-red-400">LIVE</span>
          <span className="text-white/70">👁 {viewers.toLocaleString('en')}</span>
        </div>
      }
    />
  )
}
