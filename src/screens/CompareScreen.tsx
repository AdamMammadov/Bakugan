import { motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { playSfx } from '../audio/sfx'
import { aiForTier, LIVES, matchedOpponent, TEAM_SIZE } from '../battle/engine'
import { GRID, GRID_SIZE } from '../components/grid'
import { abilitiesOf, abilityLabel, BAKUGAN, formBrawlG, formOf, type Entrant } from '../data/bakugan'
import { isReleased, released } from '../season/release'
import { ELEMENT_BY_ID } from '../data/elements'
import { gateDeck } from '../data/gates'
import { GateChip } from '../components/GateChip'
import { Avatar } from '../components/Avatar'
import {
  rankScore,
  teamEntrants,
  tierOf,
  TIERS,
  unlockedCards,
  useActiveProfile,
  useProfiles,
  type OwnedBakugan,
} from '../profile/useProfiles'
import { botCharacter, opponentCharacter } from '../profile/avatar'
import { useGame, type Screen } from '../store/useGame'
import { TagFaceOff } from './TagFaceOff'

/** Fills a team up to `size` with Bakugan not already in it. */
function fillTeam(start: Entrant[], size = TEAM_SIZE): Entrant[] {
  const team = start.slice(0, size)
  for (const bakugan of released()) {
    if (team.length >= size) break
    if (!team.some((e) => e.bakugan.id === bakugan.id)) team.push({ bakugan, form: 0 })
  }
  return team
}

/** Fills a player's team up to `size` from their collection. */
function fillOwn(start: Entrant[], collection: OwnedBakugan[], size = TEAM_SIZE): Entrant[] {
  const team = start.slice(0, size)
  for (const o of collection) {
    if (team.length >= size) break
    if (!team.some((e) => e.bakugan.id === o.id))
      team.push({
        bakugan: BAKUGAN.find((b) => b.id === o.id)!,
        form: o.form,
        cards: unlockedCards(o).map((a) => a.id),
        skin: o.skin,
      })
  }
  return team
}

/** Where the face-off was opened from (the main menu's BRAWL, a Bakugan's FACE-OFF…): BACK returns there. */
let openedFrom: Screen = 'viewer'
// coming back from a brawl or a live match keeps where it was first opened from
useGame.subscribe((s, prev) => {
  if (s.screen === 'compare' && !['compare', 'arena', 'live'].includes(prev.screen)) openedFrom = prev.screen
})

export function CompareScreen() {
  const bakuganId = useGame((s) => s.bakuganId)
  const compareForm = useGame((s) => s.compareForm)
  const go = useGame((s) => s.go)
  const enterArena = useGame((s) => s.enterArena)
  const watchLive = useGame((s) => s.watchLive)
  const mine = BAKUGAN.find((b) => b.id === bakuganId) ?? BAKUGAN[0]

  const profile = useActiveProfile()
  const setTeam = useProfiles((s) => s.setTeam)
  // a player always brawls with their own collection; ranked earns rewards, free play is practice.
  // Without a profile (guest) any Bakugan can be picked.
  const [ranked, setRanked] = useState(profile !== null)
  const [free, setFree] = useState<Entrant[]>(() => fillTeam([{ bakugan: mine, form: compareForm }]))
  // the saved team, as many Bakugan as the player last brawled with
  const [own, setOwn] = useState<Entrant[]>(() => {
    if (!profile) return []
    const saved = teamEntrants(profile)
    return saved.length ? saved : fillOwn([], profile.collection, 1)
  })
  const left = profile ? own : free
  const tier = profile ? tierOf(rankScore(profile)).index : 0
  // the bot of the player's rank: its Bakugan get a small G edge on top of the level match
  const opponent = (team: Entrant[]) => matchedOpponent(team, Math.random, aiForTier(tier).edge)
  // the system always picks the opponent, on the player's level; nobody chooses their rival's forms
  const [right, setRight] = useState<Entrant[]>(() => opponent(left))
  // the tag battle face-off (a random CPU partner)
  const [tag, setTag] = useState(false)
  const avoid = profile?.avatar.kind === 'preset' ? profile.avatar.id : undefined
  // picked once per opponent team, not on every render
  const bot = useMemo(() => opponentCharacter(right[0].bakugan, avoid), [right, avoid])

  const setLeft = (team: Entrant[]) => {
    if (profile) setOwn(team)
    else setFree(team)
    setRight(opponent(team))
  }
  // how many Bakugan each side brings: the player's choice, up to as many as they own
  const most = profile ? Math.min(TEAM_SIZE, profile.collection.length) : TEAM_SIZE
  const resize = (size: number) => {
    playSfx('select')
    setLeft(profile ? fillOwn(own, profile.collection, size) : fillTeam(free, size))
  }

  const pack = (team: Entrant[]) =>
    team.map((e) => ({ id: e.bakugan.id, form: e.form, cards: e.cards, bonusG: e.bonusG, skin: e.skin }))

  function brawl() {
    playSfx('brawl')
    if (profile) setTeam(own.map((e) => e.bakugan.id))
    enterArena({
      left: pack(left),
      right: pack(right),
      ranked: ranked && profile !== null,
      bot: { characterId: bot.id, tier },
    })
  }

  return (
    <motion.div
      className="absolute inset-0 overflow-y-auto px-16 py-10"
      style={{ backgroundImage: GRID, backgroundSize: GRID_SIZE }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <button
        onClick={() => go(openedFrom)}
        className="font-display text-xs tracking-[0.4em] text-white/50 transition hover:text-white"
      >
        ← BACK
      </button>
      <h1 className="font-display mt-4 text-4xl font-black tracking-wider">TEAM FACE-OFF</h1>
      <p className="mt-1 max-w-3xl text-white/50">
        Pick your team. The system matches you with an opponent on your level: as many Bakugan as you bring, the same forms and
        the same number of ability cards. Each brawler has {LIVES} lives. Every battle one brawler sets a Gate Card face-down and
        both throw a Bakugan onto it, one after the other. Take turns: play an ability card, open your Gate Card, or pass. The
        higher G-Power is winning, so whoever is behind has to answer and get ahead; whoever is ahead can pass and hold. A Bakugan
        at 0 G is defeated at once, and a brawler behind who passes or has nothing left loses the battle and a life. Lose {LIVES}{' '}
        battles and you are defeated.
      </p>

      {profile && (
        <div className="mt-6 flex items-center gap-4 rounded-xl border border-white/10 bg-black/40 p-3 backdrop-blur">
          <Avatar avatar={profile.avatar} color={ELEMENT_BY_ID[profile.element].color} size={44} />
          <p className="flex-1 text-sm text-white/70">
            <span className="font-bold text-white">
              {profile.firstName} {profile.lastName}
            </span>{' '}
            {ranked
              ? `— ranked brawl with your own Bakugan against a ${TIERS[tier].name}-level bot. Wins earn XP, Battle Points and rating.`
              : '— free play: practise with your own Bakugan, no rewards.'}
          </p>
          {(['ranked', 'free'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setRanked(m === 'ranked')
                setRight(opponent(own))
              }}
              className={`font-display rounded border px-3 py-1.5 text-xs tracking-[0.3em] transition hover:bg-white/10 ${
                (m === 'ranked') === ranked
                  ? 'border-white text-white'
                  : 'border-white/15 text-white/50 hover:border-white/60 hover:text-white'
              }`}
            >
              {m === 'ranked' ? 'RANKED' : 'FREE PLAY'}
            </button>
          ))}
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <p className="font-display text-xs tracking-[0.4em] text-white/40">BAKUGAN PER SIDE</p>
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            disabled={n > most}
            title={n > most ? `Own ${n} Bakugan to brawl ${n} vs ${n}` : undefined}
            onClick={() => resize(n)}
            className={`font-display rounded border px-3 py-1.5 text-xs tracking-[0.3em] transition enabled:hover:bg-white/10 disabled:opacity-30 ${
              left.length === n
                ? 'border-white text-white'
                : 'border-white/15 text-white/50 enabled:hover:border-white/60 enabled:hover:text-white'
            }`}
          >
            {n} VS {n}
          </button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-start gap-8">
        <TeamCard team={left} onChange={setLeft} label="YOUR TEAM" owned={profile ? profile.collection : undefined} />
        <div className="font-display mt-40 text-5xl font-black text-white/30 italic">VS</div>
        <TeamCard
          team={right}
          label={`OPPONENT · ${bot.name.toUpperCase()} (CPU)`}
          onRandom={
            ranked && profile
              ? undefined
              : () => {
                  playSfx('select')
                  setRight(opponent(left))
                }
          }
        />
      </div>

      <div className="mt-10 flex items-center justify-center gap-6">
        <motion.button
          onClick={brawl}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.96 }}
          className="font-display skew-x-[-12deg] border-2 border-white/70 bg-white/10 px-12 py-4 text-xl font-black tracking-[0.3em]"
        >
          ENTER THE ARENA
        </motion.button>
        {/* other brawlers' matches, as they happen */}
        <motion.button
          onClick={() => {
            playSfx('select')
            watchLive()
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.96 }}
          className="font-display flex skew-x-[-12deg] items-center gap-3 border-2 border-red-500/60 bg-black/40 px-8 py-4 text-lg font-black tracking-[0.3em]"
        >
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500 shadow-[0_0_10px_#ef4444]" />
          WATCH LIVE
        </motion.button>
        {/* 2 vs 2 with a random CPU partner of the player's rank */}
        <motion.button
          onClick={() => {
            playSfx('select')
            if (profile) setTeam(own.map((e) => e.bakugan.id))
            setTag(true)
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.96 }}
          title="2 vs 2: you and a random CPU partner of your rank against two CPU brawlers"
          className="font-display skew-x-[-12deg] border-2 border-[#ffc94a]/80 bg-black/40 px-8 py-4 text-lg font-black tracking-[0.3em]"
        >
          ⚔⚔ RANDOM TAG BATTLE
        </motion.button>
      </div>
      {tag && (
        <TagFaceOff
          me={
            profile
              ? {
                  name: `${profile.firstName} ${profile.lastName}`,
                  avatar: profile.avatar,
                  color: ELEMENT_BY_ID[profile.element].color,
                }
              : {
                  name: 'You',
                  avatar: { kind: 'preset', id: botCharacter(left[0].bakugan.element).id },
                  color: ELEMENT_BY_ID[left[0].bakugan.element].color,
                }
          }
          team={pack(left)}
          score={profile ? rankScore(profile) : 0}
          onClose={() => setTag(false)}
        />
      )}
    </motion.div>
  )
}

function TeamCard({
  team,
  onChange,
  label,
  onRandom,
  owned,
}: {
  team: Entrant[]
  /** Omitted for the opponent, whose team the system picks. */
  onChange?: (team: Entrant[]) => void
  label: string
  onRandom?: () => void
  /** A player's collection: only these Bakugan, up to their current form, with their unlocked cards. */
  owned?: OwnedBakugan[]
}) {
  const [picked, setSlot] = useState(0)
  // the team can shrink under the picked slot
  const slot = Math.min(picked, team.length - 1)
  const current = team[slot]
  const element = ELEMENT_BY_ID[current.bakugan.element]
  const power = (e: Entrant) => formBrawlG(e) + (e.bonusG ?? 0)
  const total = team.reduce((sum, e) => sum + power(e), 0)

  const ownedOf = (id: string) => owned?.find((o) => o.id === id)
  const replace = (pick: Entrant) => {
    const o = ownedOf(pick.bakugan.id)
    if (owned && (!o || pick.form > o.form)) return
    const entrant = o ? { ...pick, cards: unlockedCards(o).map((a) => a.id), skin: o.skin } : pick
    playSfx('tick')
    const next = [...team]
    // picking a Bakugan already in the team swaps the two slots
    const dup = team.findIndex((e, i) => i !== slot && e.bakugan.id === entrant.bakugan.id)
    if (dup !== -1) next[dup] = team[slot]
    next[slot] = entrant
    onChange?.(next)
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-6 backdrop-blur">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-xs tracking-[0.5em] text-white/40">{label}</p>
        <div className="flex items-baseline gap-4">
          {onRandom && (
            <button onClick={onRandom} className="font-display text-xs tracking-[0.3em] text-white/50 hover:text-white">
              ⟳ NEW OPPONENT
            </button>
          )}
          <span className="font-display text-sm text-white/60">
            TEAM <span className="text-xl font-black text-white">{total}G</span>
          </span>
        </div>
      </div>

      {/* one slot per Bakugan */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {team.map((e, i) => {
          const el = ELEMENT_BY_ID[e.bakugan.element]
          const on = i === slot
          return (
            <button
              key={i}
              onClick={() => setSlot(i)}
              disabled={!onChange}
              className="flex flex-col items-center rounded-lg border-2 bg-black/40 p-3 transition enabled:hover:-translate-y-0.5 enabled:hover:bg-white/10"
              style={{
                borderColor: on ? el.color : 'rgba(255,255,255,0.1)',
                boxShadow: on ? `0 0 18px ${el.color}55` : 'none',
              }}
            >
              <span className="font-display self-start text-[10px] tracking-widest text-white/40">
                {i === 0 ? 'LEAD' : `#${i + 1}`}
              </span>
              <img src={el.icon} alt="" className="h-12 w-12" style={{ filter: `drop-shadow(0 0 10px ${el.glow})` }} />
              <span className="font-display mt-1 text-sm leading-tight font-bold">{formOf(e).name}</span>
              <span className="text-xs text-white/50">
                {power(e)}G
                {e.bonusG ? (
                  <span className="text-white/35">
                    {' '}
                    ({e.bonusG > 0 ? '+' : ''}
                    {e.bonusG} level match)
                  </span>
                ) : null}
              </span>
            </button>
          )
        })}
      </div>

      {onChange && (
        <>
          <p className="font-display mt-5 text-xs tracking-[0.4em] text-white/40">SLOT {slot + 1} · BAKUGAN</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {BAKUGAN.filter((b) => (owned ? ownedOf(b.id) : isReleased(b.id))).map((b) => (
              <button
                key={b.id}
                title={b.name}
                onClick={() => replace({ bakugan: b, form: ownedOf(b.id)?.form ?? 0 })}
                className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition hover:bg-white/15 ${
                  b.id === current.bakugan.id
                    ? 'border-white/60 bg-white/10'
                    : 'border-white/10 opacity-50 hover:border-white/40 hover:opacity-100'
                }`}
              >
                <img src={ELEMENT_BY_ID[b.element].icon} alt="" className="h-6 w-6" />
                {b.name}
              </button>
            ))}
          </div>

          <p className="font-display mt-4 text-xs tracking-[0.4em] text-white/40">FORM</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {current.bakugan.evolutions.map((evo, i) => {
              const on = i === current.form
              const locked = owned && i > (ownedOf(current.bakugan.id)?.form ?? 0)
              return (
                <button
                  key={`${evo.name}-${evo.series}`}
                  disabled={locked}
                  title={locked ? 'Evolve this Bakugan in your profile to unlock this form' : undefined}
                  onClick={() => replace({ bakugan: current.bakugan, form: i })}
                  className={`rounded-md border px-3 py-1.5 text-left text-sm transition disabled:opacity-30 ${
                    on
                      ? 'text-white'
                      : 'border-white/15 text-white/60 enabled:hover:border-white/50 enabled:hover:bg-white/10 enabled:hover:text-white'
                  }`}
                  style={on ? { borderColor: element.color, background: `${element.color}33` } : undefined}
                >
                  <span className="font-semibold">
                    {locked && '🔒 '}
                    {evo.name}
                  </span>
                  <span className="ml-2 text-xs text-white/50">{evo.gPower}G</span>
                </button>
              )
            })}
          </div>
        </>
      )}

      <p className="font-display mt-5 text-xs tracking-[0.4em] text-white/40">
        ABILITY DECK ({team.reduce((n, e) => n + (e.cards?.length ?? abilitiesOf(e.bakugan, e.form).length), 0)} CARDS)
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {team.flatMap((e) =>
          abilitiesOf(e.bakugan, e.form)
            .filter((a) => !e.cards || e.cards.includes(a.id))
            .map((a) => (
              <span
                key={`${e.bakugan.id}-${a.id}`}
                className="rounded border px-2 py-0.5 text-xs text-white/70"
                style={{
                  borderColor: `${ELEMENT_BY_ID[e.bakugan.element].color}66`,
                }}
                title={a.description}
              >
                {a.name} <span style={{ color: ELEMENT_BY_ID[e.bakugan.element].color }}>{abilityLabel(a)}</span>
              </span>
            )),
        )}
      </div>

      <p className="font-display mt-5 text-xs tracking-[0.4em] text-white/40">GATE DECK</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {gateDeck(team).map((g) => (
          <GateChip key={g.id} gate={g} />
        ))}
      </div>
    </div>
  )
}
