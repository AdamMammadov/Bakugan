import { motion } from 'framer-motion'
import { useState } from 'react'
import { playSfx } from '../audio/sfx'
import { LIVES } from '../battle/engine'
import { Avatar } from '../components/Avatar'
import { BAKUGAN, formBrawlG, formOf } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { CHARACTER_BY_ID } from '../profile/avatar'
import { rankColor } from '../profile/brawlers'
import { tierOf, useProfiles, type Profile } from '../profile/useProfiles'
import { useGame, type TagMember, type TeamMember } from '../store/useGame'
import { findOpponents, memberScore, randomPartner, tagArena, teamNote } from './tagSetup'

/**
 * The tag battle face-off: the player and their partner against two CPU brawlers matched to the team's rank.
 * A friend as partner makes a friendly (unranked) tag battle; a random CPU partner a ranked one, like matchmaking.
 */
export function TagFaceOff({
  me,
  team,
  partner: chosen,
  score,
  onClose,
}: {
  /** The player as shown (name, avatar, colour). */
  me: { name: string; avatar: Parameters<typeof Avatar>[0]['avatar']; color: string }
  /** The player's own team (1–3 Bakugan). */
  team: TeamMember[]
  /** A friend as partner; a random CPU partner of the player's rank when left out. */
  partner?: TagMember
  /** The player's rank score (0 for a guest). */
  score: number
  onClose: () => void
}) {
  const friend = !!chosen
  // a random partner is matchmaking: ranked (with a profile); a friend's tag battle is friendly
  const ranked = !friend && score > 0
  const [now] = useState(() => Date.now())
  const profiles = useProfiles.getState().profiles
  const [partner, setPartner] = useState(() => chosen ?? randomPartner(score, [], profiles, now))
  const level = (score + memberScore(partner.botId, profiles, now)) / 2
  const [opponents, setOpponents] = useState(() => findOpponents(level, [partner.botId], profiles, now))

  function enter() {
    playSfx('brawl')
    // leaving the arena goes back to the face-off page with the player's lead
    useGame.setState({ bakuganId: team[0].id, compareForm: team[0].form })
    useGame.getState().enterArena(tagArena(team, partner, opponents, ranked, friend))
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClose}
    >
      <div
        className="max-h-full w-full max-w-5xl overflow-y-auto rounded-2xl border border-white/15 bg-[#0b0c12]/95 p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-black tracking-wider">TAG BATTLE · 2 VS 2</h2>
            <p className="mt-1 max-w-3xl text-sm text-white/55">
              Every round has two battles at once: you against one opponent, {firstName(partner.name)} against the other. Between
              rounds you keep the pairs or swap opponents (the other team may swap too). Each brawler has {LIVES} lives; out of
              lives, they are out. When a side is down to one brawler, they take on both opponents in turn. Beat both opponents to
              win.
            </p>
          </div>
          <button onClick={onClose} className="font-display text-xs tracking-[0.3em] text-white/50 hover:text-white">
            ✕ CLOSE
          </button>
        </div>

        <p
          className="font-display mt-4 inline-block rounded border px-3 py-1 text-[11px] tracking-[0.25em]"
          style={{
            borderColor: ranked ? '#f5c518' : 'rgba(255,255,255,0.3)',
            color: ranked ? '#f5c518' : 'rgba(255,255,255,0.7)',
          }}
        >
          {ranked
            ? 'RANKED · RANDOM PARTNER, LIKE MATCHMAKING: A WIN EARNS XP, BATTLE POINTS AND RATING'
            : friend
              ? 'FRIENDLY · WITH YOUR FRIEND: NO RATING OR REWARDS AT STAKE'
              : 'FREE PLAY · NO REWARDS'}
        </p>

        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-start gap-6">
          <TeamColumn
            label="YOUR TEAM"
            rows={[
              { name: me.name, sub: 'YOU', avatar: me.avatar, color: me.color, team },
              memberRow(partner, friend ? 'YOUR FRIEND' : 'CPU PARTNER', profiles, now),
            ]}
            action={
              !friend && !ranked
                ? {
                    label: '⟳ NEW PARTNER',
                    onClick: () => {
                      playSfx('select')
                      const p = randomPartner(score, [partner.botId], profiles, now)
                      setPartner(p)
                      setOpponents(findOpponents((score + memberScore(p.botId, profiles, now)) / 2, [p.botId], profiles, now))
                    },
                  }
                : undefined
            }
          />
          <div className="font-display mt-24 text-5xl font-black text-white/30 italic">VS</div>
          <TeamColumn
            label={`OPPONENTS${teamNote(opponents) ? ` · ${teamNote(opponents)!.toUpperCase()}` : ''}`}
            rows={opponents.map((o) => memberRow(o, 'CPU', profiles, now))}
            action={
              ranked
                ? undefined
                : {
                    label: '⟳ NEW OPPONENTS',
                    onClick: () => {
                      playSfx('select')
                      setOpponents(findOpponents(level, [partner.botId, ...opponents.map((o) => o.botId)], profiles, now))
                    },
                  }
            }
          />
        </div>

        <div className="mt-8 flex justify-center">
          <motion.button
            onClick={enter}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            className="font-display skew-x-[-12deg] border-2 border-white/70 bg-white/10 px-12 py-4 text-xl font-black tracking-[0.3em]"
          >
            ENTER THE ARENA
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

const firstName = (name: string) => name.split(' ')[0]

interface Row {
  name: string
  sub: string
  avatar: Parameters<typeof Avatar>[0]['avatar']
  color: string
  team: TeamMember[]
  /** Their rank now, e.g. "Battle Brawler II". */
  rank?: ReturnType<typeof tierOf>
}

function memberRow(m: TagMember, sub: string, profiles: Profile[], now: number): Row {
  const c = CHARACTER_BY_ID[m.characterId]
  const lead = BAKUGAN.find((b) => b.id === m.team[0]?.id)
  return {
    name: m.name,
    sub,
    avatar: { kind: 'preset', id: m.characterId },
    color: ELEMENT_BY_ID[lead?.element ?? c?.element ?? 'pyrus'].color,
    team: m.team,
    rank: tierOf(memberScore(m.botId, profiles, now)),
  }
}

function TeamColumn({ label, rows, action }: { label: string; rows: Row[]; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-xs tracking-[0.4em] text-white/40">{label}</p>
        {action && (
          <button onClick={action.onClick} className="font-display text-xs tracking-[0.25em] text-white/50 hover:text-white">
            {action.label}
          </button>
        )}
      </div>
      <div className="mt-4 space-y-4">
        {rows.map((r) => (
          <div key={r.name} className="flex items-start gap-3">
            <Avatar avatar={r.avatar} color={r.color} size={52} />
            <div className="min-w-0 flex-1">
              <p className="font-display truncate text-lg leading-tight font-bold">{r.name}</p>
              <p className="font-display text-[10px] tracking-[0.3em] text-white/45">
                {r.sub}
                {r.rank && <span style={{ color: rankColor(r.rank) }}> · {r.rank.rank.toUpperCase()}</span>}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {r.team.map((t) => {
                  const bakugan = BAKUGAN.find((b) => b.id === t.id)
                  if (!bakugan) return null
                  const el = ELEMENT_BY_ID[bakugan.element]
                  return (
                    <span
                      key={t.id}
                      className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                      style={{ borderColor: `${el.color}88` }}
                    >
                      <img src={el.icon} alt="" className="h-4 w-4" />
                      {formOf({ bakugan, form: t.form }).name}
                      <span className="text-white/45">{formBrawlG({ bakugan, form: t.form }) + (t.bonusG ?? 0)}G</span>
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
