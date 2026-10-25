import { motion } from 'framer-motion'
import { ELEMENT_BY_ID } from '../data/elements'
import { CUP_ROUNDS, ROUND_NAME } from '../events/catalog'
import type { CupEntrant, CupMatch, CupRun } from '../events/store'
import { championOf } from '../events/tournament'
import type { Avatar as AvatarValue } from '../profile/avatar'
import { tierOf, TIERS } from '../profile/useProfiles'
import { Avatar } from './Avatar'
import { Trophy } from './EventArt'

/** Matches in each round of an 8-brawler cup. */
const SIZES = [4, 2, 1]

/** The cup bracket: quarter-finals, semi-finals, final and the champion, filled in as rounds are played. */
export function EventBracket({ run, myAvatar }: { run: CupRun; myAvatar: AvatarValue }) {
  const champion = championOf(run)
  const avatarOf = (e: CupEntrant): AvatarValue => (e.id === 'me' ? myAvatar : { kind: 'preset', id: e.characterId })
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_0.8fr] gap-6">
      {CUP_ROUNDS.map((stage, ri) => (
        <div key={stage} className="flex flex-col">
          <p className="font-display mb-3 text-center text-[10px] tracking-[0.4em] text-white/40">
            {ROUND_NAME[stage].toUpperCase()}
            {run.stage === stage && <span className="ml-2 text-amber-300">● NOW</span>}
          </p>
          <div className="flex flex-1 flex-col justify-around gap-3" style={{ minHeight: 440 }}>
            {Array.from({ length: SIZES[ri] }, (_, mi) => (
              <MatchBox key={mi} match={run.rounds[ri]?.[mi]} run={run} avatarOf={avatarOf} last={ri === CUP_ROUNDS.length - 1} />
            ))}
          </div>
        </div>
      ))}
      <div className="flex flex-col">
        <p className="font-display mb-3 text-center text-[10px] tracking-[0.4em] text-amber-300/70">CHAMPION</p>
        <div className="flex flex-1 flex-col items-center justify-center gap-3" style={{ minHeight: 440 }}>
          <Trophy size={96} metal={champion === null ? 'silver' : 'gold'} />
          {champion === null ? (
            <p className="font-display text-sm tracking-[0.3em] text-white/30">?</p>
          ) : (
            <motion.div
              className="flex flex-col items-center gap-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Avatar
                avatar={avatarOf(run.entrants[champion])}
                color={ELEMENT_BY_ID[run.entrants[champion].element].color}
                size={56}
              />
              <p
                className={`font-display text-center text-sm font-black ${champion === run.me ? 'text-amber-300' : 'text-white'}`}
              >
                {champion === run.me ? 'YOU!' : run.entrants[champion].name}
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}

function MatchBox({
  match,
  run,
  avatarOf,
  last,
}: {
  match: CupMatch | undefined
  run: CupRun
  avatarOf: (e: CupEntrant) => AvatarValue
  last: boolean
}) {
  const mine = !!match && (match.a === run.me || match.b === run.me)
  const live = mine && match.winner === null && run.stage !== 'out' && run.stage !== 'champion'
  return (
    <div className="relative">
      <div
        className="overflow-hidden rounded-lg border bg-black/55 backdrop-blur"
        style={{
          borderColor: live ? '#fcd34d' : mine ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.1)',
          boxShadow: live ? '0 0 18px #fcd34d44' : 'none',
        }}
      >
        {match ? (
          <>
            <Row run={run} index={match.a} match={match} avatarOf={avatarOf} side={0} />
            <div className="h-px bg-white/10" />
            <Row run={run} index={match.b} match={match} avatarOf={avatarOf} side={1} />
          </>
        ) : (
          <>
            <Empty />
            <div className="h-px bg-white/10" />
            <Empty />
          </>
        )}
      </div>
      {/* the line on to the next round */}
      <div className={`absolute top-1/2 -right-6 h-px w-6 ${last ? 'bg-amber-300/40' : 'bg-white/15'}`} />
    </div>
  )
}

function Row({
  run,
  index,
  match,
  avatarOf,
  side,
}: {
  run: CupRun
  index: number
  match: CupMatch
  avatarOf: (e: CupEntrant) => AvatarValue
  side: 0 | 1
}) {
  const e = run.entrants[index]
  const el = ELEMENT_BY_ID[e.element]
  const decided = match.winner !== null
  const won = match.winner === index
  const me = index === run.me
  return (
    <div className={`flex items-center gap-2 px-2.5 py-1.5 ${decided && !won ? 'opacity-40' : ''}`}>
      <Avatar avatar={avatarOf(e)} color={el.color} size={26} />
      <div className="min-w-0 flex-1 leading-tight">
        <p className={`truncate text-sm font-bold ${me ? 'text-amber-300' : 'text-white'}`}>{me ? `${e.name} (YOU)` : e.name}</p>
        <p className="truncate text-[10px] text-white/40">
          <img src={el.icon} alt="" className="mr-1 inline h-3 w-3 align-[-2px]" />
          {TIERS[tierOf(e.score).index].name}
        </p>
      </div>
      {decided && (
        <motion.span
          key={`${match.winner}`}
          initial={{ opacity: 0, scale: 1.6 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`font-display w-5 text-right text-sm font-black ${won ? 'text-emerald-300' : 'text-white/50'}`}
        >
          {match.score?.[side] ?? (won ? 'W' : 'L')}
        </motion.span>
      )}
    </div>
  )
}

function Empty() {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5">
      <span className="h-[26px] w-[26px] rounded-full border border-dashed border-white/20" />
      <span className="font-display text-xs tracking-[0.3em] text-white/25">TBD</span>
    </div>
  )
}
