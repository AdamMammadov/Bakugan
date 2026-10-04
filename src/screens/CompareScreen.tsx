import { motion } from 'framer-motion'
import { useState } from 'react'
import { playSfx } from '../audio/sfx'
import { matchedOpponent, TEAM_SIZE } from '../battle/engine'
import { GRID, GRID_SIZE } from '../components/grid'
import { abilityLabel, BAKUGAN, formBrawlG, formOf, type Entrant } from '../data/bakugan'
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
import { botCharacter } from '../profile/avatar'
import { useGame } from '../store/useGame'

/** Fills a team up to three with Bakugan not already in it. */
function fillTeam(start: Entrant[]): Entrant[] {
  const team = [...start]
  for (const bakugan of BAKUGAN) {
    if (team.length >= TEAM_SIZE) break
    if (!team.some((e) => e.bakugan.id === bakugan.id)) team.push({ bakugan, form: 0 })
  }
  return team
}

/** Fills a player's team up to three from their collection. */
function fillOwn(start: Entrant[], collection: OwnedBakugan[]): Entrant[] {
  const team = [...start]
  for (const o of collection) {
    if (team.length >= TEAM_SIZE) break
    if (!team.some((e) => e.bakugan.id === o.id))
      team.push({
        bakugan: BAKUGAN.find((b) => b.id === o.id)!,
        form: o.form,
        cards: unlockedCards(o).map((a) => a.id),
      })
  }
  return team
}

export function CompareScreen() {
  const bakuganId = useGame((s) => s.bakuganId)
  const compareForm = useGame((s) => s.compareForm)
  const go = useGame((s) => s.go)
  const enterArena = useGame((s) => s.enterArena)
  const mine = BAKUGAN.find((b) => b.id === bakuganId) ?? BAKUGAN[0]

  const profile = useActiveProfile()
  const setTeam = useProfiles((s) => s.setTeam)
  // a player always brawls with their own collection; ranked earns rewards, free play is practice.
  // Without a profile (guest) any Bakugan can be picked.
  const [ranked, setRanked] = useState(profile !== null)
  const [free, setFree] = useState<Entrant[]>(() => fillTeam([{ bakugan: mine, form: compareForm }]))
  const [own, setOwn] = useState<Entrant[]>(() => (profile ? fillOwn(teamEntrants(profile), profile.collection) : []))
  const left = profile ? own : free
  // the system always picks the opponent, on the player's level; nobody chooses their rival's forms
  const [right, setRight] = useState<Entrant[]>(() => matchedOpponent(left))
  const tier = profile ? tierOf(rankScore(profile)).index : 0
  const bot = botCharacter(right[0].bakugan.element)

  const setLeft = (team: Entrant[]) => {
    if (profile) setOwn(team)
    else setFree(team)
    setRight(matchedOpponent(team))
  }

  function brawl() {
    playSfx('brawl')
    const pack = (team: Entrant[]) => team.map((e) => ({ id: e.bakugan.id, form: e.form, cards: e.cards, bonusG: e.bonusG }))
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
        onClick={() => go('viewer')}
        className="font-display text-xs tracking-[0.4em] text-white/50 transition hover:text-white"
      >
        ← BACK
      </button>
      <h1 className="font-display mt-4 text-4xl font-black tracking-wider">TEAM FACE-OFF</h1>
      <p className="mt-1 max-w-3xl text-white/50">
        Pick your team. The system matches you with an opponent on your level: as many Bakugan as you bring, the same forms and
        the same number of ability cards. Every round a Gate Card is set on the field. Defeat every opposing Bakugan to win.
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
                setRight(matchedOpponent(own))
              }}
              className="font-display rounded border px-3 py-1.5 text-xs tracking-[0.3em] transition"
              style={{
                borderColor: (m === 'ranked') === ranked ? '#fff' : 'rgba(255,255,255,0.15)',
                color: (m === 'ranked') === ranked ? '#fff' : 'rgba(255,255,255,0.5)',
              }}
            >
              {m === 'ranked' ? 'RANKED' : 'FREE PLAY'}
            </button>
          ))}
        </div>
      )}

      <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-start gap-8">
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
                  setRight(matchedOpponent(left))
                }
          }
        />
      </div>

      <div className="mt-10 flex justify-center">
        <motion.button
          onClick={brawl}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.96 }}
          className="font-display skew-x-[-12deg] border-2 border-white/70 bg-white/10 px-12 py-4 text-xl font-black tracking-[0.3em]"
        >
          ENTER THE ARENA
        </motion.button>
      </div>
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
  const [slot, setSlot] = useState(0)
  const current = team[slot]
  const element = ELEMENT_BY_ID[current.bakugan.element]
  const power = (e: Entrant) => formBrawlG(e) + (e.bonusG ?? 0)
  const total = team.reduce((sum, e) => sum + power(e), 0)

  const ownedOf = (id: string) => owned?.find((o) => o.id === id)
  const replace = (pick: Entrant) => {
    const o = ownedOf(pick.bakugan.id)
    if (owned && (!o || pick.form > o.form)) return
    const entrant = o ? { ...pick, cards: unlockedCards(o).map((a) => a.id) } : pick
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

      {/* the three slots */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        {team.map((e, i) => {
          const el = ELEMENT_BY_ID[e.bakugan.element]
          const on = i === slot
          return (
            <button
              key={i}
              onClick={() => setSlot(i)}
              disabled={!onChange}
              className="flex flex-col items-center rounded-lg border-2 bg-black/40 p-3 transition"
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
                {e.bonusG ? <span className="text-white/35"> ({e.bonusG > 0 ? '+' : ''}{e.bonusG} level match)</span> : null}
              </span>
            </button>
          )
        })}
      </div>

      {onChange && (
        <>
          <p className="font-display mt-5 text-xs tracking-[0.4em] text-white/40">SLOT {slot + 1} · BAKUGAN</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {BAKUGAN.filter((b) => !owned || ownedOf(b.id)).map((b) => (
              <button
                key={b.id}
                title={b.name}
                onClick={() => replace({ bakugan: b, form: ownedOf(b.id)?.form ?? 0 })}
                className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition ${
                  b.id === current.bakugan.id ? 'border-white/60 bg-white/10' : 'border-white/10 opacity-50 hover:opacity-90'
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
                  className="rounded-md border px-3 py-1.5 text-left text-sm transition disabled:opacity-30"
                  style={{
                    borderColor: on ? element.color : 'rgba(255,255,255,0.15)',
                    background: on ? `${element.color}33` : 'transparent',
                    color: on ? '#fff' : 'rgba(255,255,255,0.6)',
                  }}
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
        ABILITY DECK ({team.reduce((n, e) => n + (e.cards?.length ?? e.bakugan.abilities.length), 0)} CARDS)
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {team.flatMap((e) =>
          e.bakugan.abilities
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
