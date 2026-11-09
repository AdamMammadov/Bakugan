import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { playSfx } from '../audio/sfx'
import { formBrawlG, formOf, type Entrant } from '../data/bakugan'
import { ELEMENT_BY_ID, type ElementId } from '../data/elements'
import type { Avatar as AvatarValue } from '../profile/avatar'
import type { Rival } from '../profile/rivals'
import { tierOf } from '../profile/useProfiles'
import { Avatar } from './Avatar'

/** How long the arena waits after the opponent is found. */
const COUNTDOWN_MS = 3500

export interface Searcher {
  name: string
  avatar: AvatarValue
  element: ElementId
  score: number
  rating: number
  team: Entrant[]
}

/**
 * Ranked matchmaking: searches for an opponent near the player's rank (a few seconds, with a clock and a way out),
 * then shows who was found and the teams, and starts the match. The opponent is fixed once found.
 */
export function Matchmaking({
  me,
  rival,
  searchMs,
  onCancel,
  onReady,
}: {
  me: Searcher
  /** Chosen when the search starts; shown when the search ends. */
  rival: Rival
  searchMs: number
  onCancel: () => void
  onReady: () => void
}) {
  const [start] = useState(() => Date.now())
  const [now, setNow] = useState(start)
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(id)
  }, [])
  const found = now - start >= searchMs
  const left = Math.max(0, Math.ceil((start + searchMs + COUNTDOWN_MS - now) / 1000))

  useEffect(() => {
    if (!found) return
    playSfx('start')
    const id = window.setTimeout(onReady, COUNTDOWN_MS)
    return () => clearTimeout(id)
    // onReady is the screen's own function: the match starts once, when found
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [found])

  const seconds = Math.floor((Math.min(now, start + searchMs) - start) / 1000)
  const myRank = tierOf(me.score)

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-md"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {!found ? (
        <div className="flex flex-col items-center text-center">
          {/* the player in the middle of widening rings: the search reaching further out */}
          <div className="relative flex h-56 w-56 items-center justify-center">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="absolute inset-0 rounded-full border-2"
                style={{ borderColor: ELEMENT_BY_ID[me.element].color }}
                initial={{ scale: 0.45, opacity: 0.9 }}
                animate={{ scale: 1.25, opacity: 0 }}
                transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
              />
            ))}
            <Avatar avatar={me.avatar} color={ELEMENT_BY_ID[me.element].color} size={96} />
          </div>
          <p className="font-display mt-6 text-2xl font-black tracking-[0.16em]">SEARCHING FOR AN OPPONENT</p>
          <p className="font-display mt-2 text-4xl font-black tabular-nums">
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
          </p>
          <p className="mt-3 text-sm text-white/55">
            Ranked · {me.team.length} vs {me.team.length} · a brawler near your rank, {myRank.rank}
          </p>
          <button
            onClick={() => {
              playSfx('select')
              onCancel()
            }}
            className="font-display mt-8 rounded-full border border-white/25 px-8 py-2.5 text-xs tracking-[0.18em] text-white/70 transition hover:border-white/60 hover:text-white"
          >
            CANCEL
          </button>
        </div>
      ) : (
        <motion.div
          className="w-full max-w-4xl"
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35 }}
        >
          <p className="font-display text-center text-sm tracking-[0.22em] text-emerald-300">OPPONENT FOUND</p>
          <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-6">
            <Side name={me.name} avatar={me.avatar} element={me.element} rank={myRank.rank} rating={me.rating} team={me.team} />
            <p className="font-display text-6xl font-black text-white/30 italic">VS</p>
            <Side
              name={rival.bot.name}
              avatar={{ kind: 'preset', id: rival.bot.characterId }}
              element={rival.bot.element}
              rank={tierOf(rival.score).rank}
              rating={rival.bot.rating}
              team={rival.team}
              right
            />
          </div>
          <p className="font-display mt-10 text-center text-xs tracking-[0.2em] text-white/50">
            ENTERING THE ARENA IN <span className="text-base text-white">{left}</span>
          </p>
        </motion.div>
      )}
    </motion.div>
  )
}

function Side({
  name,
  avatar,
  element,
  rank,
  rating,
  team,
  right,
}: {
  name: string
  avatar: AvatarValue
  element: ElementId
  rank: string
  rating: number
  team: Entrant[]
  right?: boolean
}) {
  const color = ELEMENT_BY_ID[element].color
  return (
    <div
      className={`rounded-2xl border bg-black/50 p-5 ${right ? 'text-right' : ''}`}
      style={{ borderColor: `${color}88`, boxShadow: `0 0 40px ${color}33` }}
    >
      <div className={`flex items-center gap-4 ${right ? 'flex-row-reverse' : ''}`}>
        <Avatar avatar={avatar} color={color} size={64} />
        <div className="min-w-0">
          <p className="font-display truncate text-xl font-black tracking-wider">{name.toUpperCase()}</p>
          <p className="font-display mt-0.5 text-[11px] tracking-[0.14em] text-white/55">
            {rank.toUpperCase()} · {rating.toLocaleString('en-US')} BR
          </p>
        </div>
      </div>
      <div className={`mt-4 flex flex-wrap gap-2 ${right ? 'justify-end' : ''}`}>
        {team.map((e) => {
          const el = ELEMENT_BY_ID[e.bakugan.element]
          return (
            <span
              key={e.bakugan.id}
              className="rounded-lg border px-2.5 py-1.5 text-xs"
              style={{ borderColor: `${el.color}66`, background: `${el.color}1a` }}
            >
              <span className="font-bold">{formOf(e).name}</span>{' '}
              <span className="text-white/60">{(formBrawlG(e) + (e.bonusG ?? 0)).toLocaleString('en-US')}G</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
