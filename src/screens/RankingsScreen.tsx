import { motion } from 'framer-motion'
import { useState } from 'react'
import { Avatar } from '../components/Avatar'
import { GRID, GRID_SIZE } from '../components/grid'
import { PageNav } from '../components/PageNav'
import { ELEMENT_BY_ID, type ElementId } from '../data/elements'
import type { Avatar as AvatarValue } from '../profile/avatar'
import { BOT_CLANS, BOTS } from '../profile/bots'
import { clanOf, useClans } from '../profile/useClans'
import { rankScore, tierOf, TIERS, useProfiles } from '../profile/useProfiles'

interface Row {
  id: string
  name: string
  avatar: AvatarValue
  element: ElementId
  score: number
  rating: number
  xp: number
  wins: number
  losses: number
  clan: string | null
  cpu: boolean
}

export function RankingsScreen() {
  const profiles = useProfiles((s) => s.profiles)
  const activeId = useProfiles((s) => s.activeId)
  const clans = useClans((s) => s.clans)
  const [tab, setTab] = useState<'players' | 'clans'>('players')

  const rows: Row[] = [
    ...profiles.map((p) => ({
      id: p.id,
      name: `${p.firstName} ${p.lastName}`,
      avatar: p.avatar,
      element: p.element,
      score: rankScore(p),
      rating: p.rating,
      xp: p.xp,
      wins: p.stats.wins,
      losses: p.stats.losses,
      clan: clanOf(clans, p.id)?.tag ?? null,
      cpu: false,
    })),
    ...BOTS.map((b) => ({
      id: b.id,
      name: b.name,
      avatar: { kind: 'preset' as const, id: b.characterId },
      element: b.element,
      score: rankScore(b),
      rating: b.rating,
      xp: b.xp,
      wins: b.wins,
      losses: b.losses,
      clan: b.clan,
      cpu: true,
    })),
  ].sort((a, b) => b.score - a.score)

  const clanRows = [
    ...clans.map((c) => ({
      id: c.id,
      tag: c.tag,
      name: c.name,
      element: c.element,
      members: c.members.length,
      score: c.members.reduce((n, m) => n + (rows.find((r) => r.id === m)?.score ?? 0), 0),
      cpu: false,
    })),
    ...BOT_CLANS.map((c) => {
      const members = rows.filter((r) => r.cpu && r.clan === c.tag)
      return { id: c.tag, tag: c.tag, name: c.name, element: c.element, members: members.length, score: members.reduce((n, r) => n + r.score, 0), cpu: true }
    }),
  ].sort((a, b) => b.score - a.score)

  return (
    <motion.div
      className="absolute inset-0 overflow-y-auto px-16 py-10"
      style={{ backgroundImage: GRID, backgroundSize: GRID_SIZE }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <PageNav current="rankings" />
      <h1 className="font-display mt-8 text-4xl font-black tracking-wider">RANKINGS</h1>
      <p className="mt-1 max-w-3xl text-white/50">
        Rank score = Brawler Rating (+{25} per win, −{15} per loss) plus total XP ÷ 20 — wins and experience both count.
      </p>

      {/* tier ladder */}
      <div className="mt-6 flex flex-wrap gap-2">
        {TIERS.map((t, i) => (
          <div key={t.name} className="rounded-md border border-white/10 bg-black/40 px-3 py-2">
            <p className="font-display text-sm font-bold" style={{ color: TIER_COLORS[i] }}>
              {t.name}
            </p>
            <p className="text-xs text-white/45">{t.min}+ score</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex gap-2">
        {(['players', 'clans'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`font-display rounded border px-4 py-1.5 text-xs tracking-[0.3em] ${tab === t ? 'border-white text-white' : 'border-white/15 text-white/50'}`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === 'players' ? (
        <table className="mt-4 w-full border-separate border-spacing-y-1.5 text-left">
          <thead className="font-display text-[10px] tracking-[0.3em] text-white/40">
            <tr>
              <th className="px-3">#</th>
              <th>BRAWLER</th>
              <th>RANK</th>
              <th className="text-right">SCORE</th>
              <th className="text-right">RATING</th>
              <th className="text-right">XP</th>
              <th className="pr-4 text-right">W / L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const el = ELEMENT_BY_ID[r.element]
              const tier = tierOf(r.score)
              const me = r.id === activeId
              return (
                <tr key={r.id} className={me ? 'bg-white/15' : 'bg-black/40'} style={me ? { outline: `2px solid ${el.color}` } : undefined}>
                  <td className="font-display rounded-l-lg px-3 py-2 text-lg font-black text-white/70">{i + 1}</td>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar avatar={r.avatar} color={el.color} size={36} />
                      <img src={el.icon} alt="" className="h-5 w-5" />
                      <span className="font-semibold">
                        {r.clan && <span className="mr-1 text-white/45">[{r.clan}]</span>}
                        {r.name}
                      </span>
                      {r.cpu && <span className="rounded bg-white/10 px-1.5 text-[10px] tracking-widest text-white/50">CPU</span>}
                      {me && <span className="rounded px-1.5 text-[10px] tracking-widest" style={{ background: el.color }}>YOU</span>}
                    </div>
                  </td>
                  <td className="font-display text-sm font-bold" style={{ color: TIER_COLORS[tier.index] }}>
                    {tier.name}
                  </td>
                  <td className="font-display text-right font-bold">{r.score.toLocaleString('en')}</td>
                  <td className="text-right text-white/70">{r.rating}</td>
                  <td className="text-right text-white/70">{r.xp.toLocaleString('en')}</td>
                  <td className="rounded-r-lg pr-4 text-right text-white/70">
                    {r.wins} / {r.losses}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : (
        <div className="mt-4 space-y-1.5">
          {clanRows.map((c, i) => {
            const el = ELEMENT_BY_ID[c.element]
            return (
              <div key={c.id} className="flex items-center gap-4 rounded-lg bg-black/40 px-3 py-2">
                <span className="font-display w-6 text-lg font-black text-white/70">{i + 1}</span>
                <img src={el.icon} alt="" className="h-8 w-8" />
                <span className="font-display font-bold" style={{ color: el.color }}>
                  [{c.tag}]
                </span>
                <span className="flex-1 font-semibold">
                  {c.name} {c.cpu && <span className="ml-1 rounded bg-white/10 px-1.5 text-[10px] tracking-widest text-white/50">CPU</span>}
                </span>
                <span className="text-sm text-white/50">{c.members} members</span>
                <span className="font-display w-28 text-right font-bold">{c.score.toLocaleString('en')}</span>
              </div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}

const TIER_COLORS = ['#9aa3b5', '#7ec8e3', '#3ee07a', '#f5c518', '#ff7a2f', '#e040fb']
