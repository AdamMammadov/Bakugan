import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { playSfx } from '../audio/sfx'
import { aiForTier, leaderOf, LIVES, powerOf, type BattleResult, type BattleState, type SideIndex } from '../battle/engine'
import {
  aiStep,
  applyBattle,
  canSwap,
  inTeam,
  isIn,
  nextRound,
  pairBattle,
  pairsOf,
  SLOTS,
  startTag,
  swapPairs,
  teamOf,
  wantsSwap,
  type Pair,
  type Slot,
  type TagResult,
  type TagState,
} from '../battle/tag'
import { BakuganPortrait } from '../components/BakuganPortrait'
import { BAKUGAN, type Entrant } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { GATE_BY_ID, gateDeck, gateLabel, type GateCard } from '../data/gates'
import { reportEventResult } from '../events/results'
import { botCharacter, CHARACTER_BY_ID, DEFAULT_PARTS, DEFAULT_VOICE } from '../profile/avatar'
import { botById, botNow } from '../profile/bots'
import { rankScore, TIERS, useActiveProfile, useProfiles, type BattleReward, type Profile } from '../profile/useProfiles'
import { useGame, type ArenaSetup, type TagMember, type TagSetup, type TeamMember } from '../store/useGame'
import type { BrawlerInfo } from '../three/ArenaScene'
import { crowd } from '../three/stadium'
import { Brawl, RewardList, type BrawlerSide, type BrawlHost, type HostBattle, type HostTools } from './ArenaScreen'
import { BrawlerFace, LifeBalls } from './BattleHud'

/** The opening (BAKUGAN, BRAWL! and the first ROUND banner) before the partner's battle starts with the player's. */
const FIRST_START_MS = 3900
/** A new round's banner before both battles start. */
const NEXT_START_MS = 1300
/** The partner's battle: pause before each kind of step (it runs beside the player's, at about its pace). */
const PACE = { set: 3000, throw: 2000, battle: 3800, clash: 2600 }
/** The partner's battle once the player's is over: it plays out quickly. */
const FAST_MS = 750
/** Between rounds without a choice to make. */
const ROUND_PAUSE_MS = 4200
/** The new pairs show this long after the swap choice. */
const SWAP_SHOW_MS = 2200

const toTeam = (members: TeamMember[], boost = 0): Entrant[] =>
  members.flatMap((m) => {
    const bakugan = BAKUGAN.find((b) => b.id === m.id)
    if (!bakugan) return []
    return [{ bakugan, form: m.form, cards: m.cards, bonusG: (m.bonusG ?? 0) + boost || undefined, skin: m.skin }]
  })

const firstName = (name: string) => name.split(' ')[0]

/** The four brawlers of a tag match, in slot order (the player, the partner, the two opponents). */
interface Cast {
  sides: [BrawlerSide, BrawlerSide, BrawlerSide, BrawlerSide]
  teams: [Entrant[], Entrant[], Entrant[], Entrant[]]
  /** First names, for the announcer and the small panels. */
  short: [string, string, string, string]
  colors: [string, string, string, string]
}

function memberSide(m: TagMember, role: string, used: Set<string>): BrawlerSide {
  const c = CHARACTER_BY_ID[m.characterId] ?? botCharacter('pyrus')
  const bot = botById(m.botId)
  const local = useProfiles.getState().profiles.find((p) => p.id === m.botId)
  const hsp = bot ? rankScore(botNow(bot, Date.now())) : local ? rankScore(local) : 0
  // two brawlers playing the same character still sound different
  const voice = used.has(c.id) ? { ...c.voice, id: m.name } : c.voice
  used.add(c.id)
  return {
    name: m.name,
    tag: `${role} · ${(TIERS[m.tier]?.name ?? TIERS[0].name).toUpperCase()}`,
    avatar: { kind: 'preset', id: c.id },
    parts: c.parts,
    model: c.model,
    voice,
    ai: aiForTier(m.tier),
    hsp,
  }
}

function castOf(setup: ArenaSetup, tag: TagSetup, profile: Profile | null): Cast {
  const boost = Math.max(0, setup.event?.cpuBoost ?? 0)
  const teams: Cast['teams'] = [
    toTeam(setup.left),
    toTeam(tag.partner.team),
    toTeam(tag.opponents[0].team, boost),
    toTeam(tag.opponents[1].team, boost),
  ]
  const used = new Set<string>()
  let me: BrawlerSide
  const mode = setup.event ? 'EVENT' : setup.ranked ? 'RANKED TAG' : 'FRIENDLY TAG'
  if (!profile) {
    const c = botCharacter(teams[0][0].bakugan.element)
    me = {
      name: 'You',
      tag: 'YOU',
      avatar: { kind: 'preset', id: c.id },
      parts: c.parts,
      model: c.model,
      voice: c.voice,
      ai: null,
    }
  } else {
    const a = profile.avatar
    const preset = a.kind === 'preset' ? CHARACTER_BY_ID[a.id] : undefined
    me = {
      name: profile.firstName,
      tag: `YOU · ${mode}`,
      avatar: a,
      parts:
        a.kind === 'custom'
          ? a.parts
          : a.kind === 'preset'
            ? (preset?.parts ?? DEFAULT_PARTS)
            : botCharacter(profile.element).parts,
      model: preset?.model,
      voice: preset?.voice ?? DEFAULT_VOICE,
      ai: null,
      hsp: rankScore(profile),
    }
  }
  if (me.avatar.kind === 'preset') used.add(me.avatar.id)
  const sides: Cast['sides'] = [
    me,
    memberSide(tag.partner, tag.friend ? 'FRIEND' : 'PARTNER', used),
    memberSide(tag.opponents[0], 'CPU', used),
    memberSide(tag.opponents[1], 'CPU', used),
  ]
  return {
    sides,
    teams,
    short: sides.map((s, i) => (i === 0 ? s.name : firstName(s.name))) as Cast['short'],
    colors: teams.map((t) => ELEMENT_BY_ID[t[0].bakugan.element].color) as Cast['colors'],
  }
}

/** One round: the battle on the field (the player's, or the partner's when the player is not in this round) and the one beside it. */
interface Round {
  main: Pair
  mini: Pair | null
  miniState: BattleState | null
  battle: HostBattle
}

/** The partner's battle, as the small panel shows it. */
interface Mini {
  pair: Pair
  state: BattleState
  log: { key: number; text: string }[]
  result: BattleResult | null
}

/** Between rounds: what happened, and the swap choice (or the next pairs when there is none). */
interface Between {
  results: TagResult[]
  /** ask: the player picks · keep / swap / cpu: decided (cpu = the other team swapped) · auto: no choice this time */
  choice: 'ask' | 'keep' | 'swap' | 'cpu' | 'auto'
  next: Pair[]
  /** The pairs if swapped (shown on the SWAP button). */
  swapped: Pair[]
}

/** A 2v2 tag battle: the player and a partner against two CPU brawlers, two 1v1 battles at a time. */
export function TagArena({ setup, tag, onAgain }: { setup: ArenaSetup; tag: TagSetup; onAgain: () => void }) {
  const go = useGame((s) => s.go)
  const profile = useActiveProfile()
  // who brawls is fixed for the match (the profile changes once the result is recorded)
  const [cast] = useState(() => castOf(setup, tag, profile))
  const event = setup.event
  const pairsLine = (pairs: Pair[]) => pairs.map((p) => `${cast.short[p[0]]} vs ${cast.short[p[1]]}`).join(' · ')

  function roundOf(t: TagState, key: number): Round {
    const pairs = pairsOf(t)
    const main = pairs.find((p) => p[0] === 0) ?? pairs[0]
    const mini = pairs.find((p) => p !== main) ?? null
    const lone = SLOTS.find(
      (x) => isIn(t, x) && inTeam(t, teamOf(x)).length === 1 && inTeam(t, teamOf(x) === 0 ? 1 : 0).length === 2,
    )
    return {
      main,
      mini,
      miniState: mini ? pairBattle(t, mini) : null,
      battle: {
        key,
        state: pairBattle(t, main),
        title: `ROUND ${t.round}`,
        sub: `${pairsLine(pairs).toUpperCase()}${lone !== undefined ? ` · ${cast.short[lone].toUpperCase()} FACES BOTH IN TURN` : ''}`,
      },
    }
  }

  const [match, setMatch] = useState(() => {
    const lives = event?.lives
    const gates = (event?.gates ?? []).map((id) => GATE_BY_ID[id]).filter((g): g is GateCard => !!g)
    const t = startTag(
      cast.teams.map((team, i) => ({
        team,
        gates: gates.length ? [...gates] : gateDeck(team),
        lives: lives ? Math.max(1, Math.round(lives[i < 2 ? 0 : 1])) : LIVES,
      })) as Parameters<typeof startTag>[0],
    )
    return { tag: t, round: roundOf(t, 1) }
  })
  const [mini, setMini] = useState<Mini | null>(() =>
    match.round.mini ? { pair: match.round.mini, state: match.round.miniState!, log: [], result: null } : null,
  )
  // lives as they stand (the panels update as each battle ends, before the round is over)
  const [lives, setLives] = useState(() => match.tag.brawlers.map((b) => b.lives))
  const [between, setBetween] = useState<Between | null>(null)
  const [over, setOver] = useState<{ winner: SideIndex; reward: BattleReward | null } | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [mainDone, setMainDone] = useState(false)

  // the match as the timers and the brawl's callbacks see it
  const live = useRef({
    tag: match.tag,
    round: match.round,
    mini,
    mainEnd: null as BattleState | null,
    miniEnd: null as BattleState | null,
    tools: null as HostTools | null,
    timers: [] as number[],
    miniTimer: 0,
    key: 1,
    lineKey: 0,
    lives: match.tag.brawlers.map((b) => b.lives),
  })
  useEffect(() => {
    const l = live.current
    return () => {
      l.timers.forEach(clearTimeout)
      clearTimeout(l.miniTimer)
    }
  }, [])
  const later = (ms: number, fn: () => void) => void live.current.timers.push(window.setTimeout(fn, ms))
  const call = (line: string) => live.current.tools?.call(line)
  const levelOf = (slot: Slot) => cast.sides[slot].ai ?? aiForTier(0)

  /** A battle is decided: the two brawlers' lives as they stand now, and the call when one of them is out. */
  function livesAfter(pair: Pair, end: BattleState) {
    const l = live.current
    const before = [...l.lives]
    l.lives = l.lives.map((n, i) => (i === pair[0] ? end.sides[0].lives : i === pair[1] ? end.sides[1].lives : n))
    setLives(l.lives)
    for (const slot of pair) {
      if (before[slot] <= 0 || l.lives[slot] > 0) continue
      const mate = (slot ^ 1) as Slot
      // a whole team out: the end of the match says it
      if (l.lives[mate] <= 0) continue
      if (slot === 1) call(`Partner down! ${cast.short[1]} is out of the match! ${cast.short[0]} fights on alone!`)
      else if (slot === 0) call(`${cast.short[0]} is out! It's all on ${cast.short[1]} now!`)
      else call(`${cast.short[slot]} is out! ${cast.short[mate]} has to take on ${cast.short[0]} and ${cast.short[1]} alone!`)
      crowd('roar', slot < 2 ? 1 : 0)
    }
  }

  // ------------------------------------------------------------ the partner's battle, beside the player's

  function startMini(delay: number) {
    const l = live.current
    clearTimeout(l.miniTimer)
    if (l.mini) l.miniTimer = window.setTimeout(miniTick, delay)
  }

  /** One step of the partner's battle: a Gate Card set, a throw, a move, or the battle decided. */
  function miniTick() {
    const l = live.current
    const m = l.mini
    if (!m || m.result) return
    const [x, y] = m.pair
    const step = aiStep(m.state, [levelOf(x), levelOf(y)])
    if (!step) return
    const s = step.state
    const who = (side: SideIndex) => cast.short[m.pair[side]]
    let text = s.log[s.log.length - 1] ?? ''
    if (step.kind === 'set') text = `${who(step.side)} sets a Gate Card face-down.`
    else if (step.kind === 'throw') {
      const i = s.thrown[step.side]
      text = `${who(step.side)} throws ${i === null ? 'a Bakugan' : s.sides[step.side].team[i].name}!`
    } else if (step.kind === 'result' && step.result) {
      const loser = step.result.winner === 0 ? 1 : 0
      const left = s.sides[loser].lives
      text = `${text} ${who(loser)} loses a life${left ? ` (${left} left)` : ' and is out!'}`
    }
    const next: Mini = {
      ...m,
      state: s,
      log: [...m.log, { key: ++l.lineKey, text }].slice(-24),
      result: step.kind === 'result' ? (step.result ?? null) : null,
    }
    l.mini = next
    setMini(next)
    if (step.kind === 'result' && step.result) {
      const w = step.result.winner
      const loser = w === 0 ? 1 : 0
      livesAfter(m.pair, s)
      if (s.sides[loser].lives > 0)
        call(`On the other field, ${s.sides[w].team[step.result.thrown[w]].name} wins! ${who(loser)} loses a life!`)
      crowd(w === 0 ? 'cheer' : 'gasp', 0)
      l.miniEnd = s
      return roundOver()
    }
    // the next step comes at the pace of its kind, quickly once the player's battle is over
    const kind = s.phase === 'set' || s.phase === 'throw' || s.phase === 'battle' ? s.phase : 'clash'
    l.miniTimer = window.setTimeout(miniTick, l.mainEnd ? FAST_MS : PACE[kind] * (0.85 + Math.random() * 0.3))
  }

  // ------------------------------------------------------------ rounds

  /** The battle on the field is decided. */
  function onMainBattle(end: BattleState) {
    const l = live.current
    l.mainEnd = end
    livesAfter(l.round.main, end)
    setMainDone(true)
    if (l.mini && !l.miniEnd) {
      // the partner's battle is still on: watch it play out
      setExpanded(true)
      startMini(FAST_MS)
      call(`All eyes on the other field: ${pairsLine([l.mini.pair])}!`)
    }
    roundOver()
  }

  /** Both battles are decided: lives are counted, then the swap choice or the next round. */
  function roundOver() {
    const l = live.current
    if (!l.mainEnd || (l.mini && !l.miniEnd)) return
    let t = applyBattle(l.tag, l.round.main, l.mainEnd)
    if (l.mini && l.miniEnd) t = applyBattle(t, l.mini.pair, l.miniEnd)
    l.tag = t
    l.lives = t.brawlers.map((b) => b.lives)
    setMatch((m) => ({ ...m, tag: t }))
    setLives(l.lives)
    setExpanded(false)
    if (t.winner !== null) return later(2200, () => finish(t))
    const results = t.results.filter((r) => r.round === t.round)
    if (canSwap(t)) {
      setBetween({ results, choice: 'ask', next: pairsOf(t), swapped: pairsOf(swapPairs(t)) })
      call(`Round ${t.round} is over! Keep the pairs, or swap opponents?`)
    } else {
      setBetween({ results, choice: 'auto', next: pairsOf(nextRound(t)), swapped: [] })
      later(ROUND_PAUSE_MS, () => startRound(t))
    }
  }

  /** The player keeps the pairs or swaps opponents; if they keep them, the other team may still call a swap. */
  function choose(swap: boolean) {
    const l = live.current
    let t = l.tag
    let choice: Between['choice'] = 'keep'
    if (swap) {
      t = swapPairs(t)
      choice = 'swap'
      call(`They swap opponents! ${pairsLine(pairsOf(t))}!`)
    } else if (wantsSwap(t, 1, aiForTier(Math.max(tag.opponents[0].tier, tag.opponents[1].tier)))) {
      t = swapPairs(t)
      choice = 'cpu'
      call(`${cast.short[2]} and ${cast.short[3]} call for a swap! ${pairsLine(pairsOf(t))}!`)
    } else call(`Same pairs again! ${pairsLine(pairsOf(t))}!`)
    playSfx(choice === 'keep' ? 'select' : 'gateCard')
    l.tag = t
    setBetween((b) => b && { ...b, choice, next: pairsOf(t) })
    later(SWAP_SHOW_MS, () => startRound(t))
  }

  function startRound(prev: TagState) {
    const l = live.current
    const t = nextRound(prev)
    const round = roundOf(t, ++l.key)
    l.tag = t
    l.round = round
    l.mainEnd = null
    l.miniEnd = null
    l.mini = round.mini ? { pair: round.mini, state: round.miniState!, log: [], result: null } : null
    setMini(l.mini)
    setBetween(null)
    setMainDone(false)
    setExpanded(false)
    setMatch({ tag: t, round })
    const lone = SLOTS.find(
      (x) => isIn(t, x) && inTeam(t, teamOf(x)).length === 1 && inTeam(t, teamOf(x) === 0 ? 1 : 0).length === 2,
    )
    if (lone !== undefined) {
      const [x, y] = round.main
      const foe = lone === x ? y : x
      call(`Round ${t.round}! ${cast.short[lone]} faces them in turn: ${cast.short[foe]} steps in!`)
    } else call(`Round ${t.round}! ${pairsLine(pairsOf(t))}!`)
    startMini(NEXT_START_MS)
  }

  function finish(t: TagState) {
    const won = t.winner === 0
    playSfx(won ? 'victory' : 'defeat')
    call(`${won ? `${cast.short[0]} and ${cast.short[1]}` : `${cast.short[2]} and ${cast.short[3]}`} win the tag battle!`)
    crowd('roar', won ? 0 : 1)
    later(7000, () => crowd('calm'))
    let reward: BattleReward | null = null
    if (setup.ranked && profile) {
      // every battle the player won counts as a KO for the Bakugan that won it
      const kos: Record<string, number> = {}
      for (const r of t.results)
        if (r.pair[0] === 0 && r.winner === 0) {
          const id = t.brawlers[0].team[r.thrown[0]].bakugan.id
          kos[id] = (kos[id] ?? 0) + 1
        }
      reward = useProfiles.getState().recordBattle({
        won,
        team: t.brawlers[0].team.map((f) => f.bakugan.id),
        kos,
        abilities: live.current.tools?.abilities() ?? 0,
        flawless: t.brawlers[0].lives === t.brawlers[0].maxLives,
        // the opponents' rank: the average of the two
        foe: Math.round(((cast.sides[2].hsp ?? 0) + (cast.sides[3].hsp ?? 0)) / 2),
      })
    }
    if (event) reportEventResult({ event, won, livesLeft: t.brawlers[0].lives, battles: t.results.length })
    setOver({ winner: t.winner!, reward })
  }

  // the partner's battle starts with the player's (after the opening)
  useEffect(() => {
    const t = window.setTimeout(() => startMini(FIRST_START_MS), 0)
    return () => clearTimeout(t)
    // once, on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ------------------------------------------------------------ view

  const { round } = match
  const teams = useMemo(() => [cast.teams[round.main[0]], cast.teams[round.main[1]]] as const, [cast, round])
  const brawlers = useMemo(
    (): [BrawlerSide, BrawlerSide] => [cast.sides[round.main[0]], cast.sides[round.main[1]]],
    [cast, round],
  )
  const host = useMemo(
    (): BrawlHost => ({
      battle: round.battle,
      counter: 'ROUND',
      intro: {
        sub: `${cast.short[0]} & ${cast.short[1]} vs ${cast.short[2]} & ${cast.short[3]}`,
        lines: [
          `Tag battle! ${cast.short[0]} and ${cast.short[1]} versus ${cast.short[2]} and ${cast.short[3]}!`,
          `Two battles at once: ${pairsLine(pairsOf(match.tag))}! Beat both opponents to win!`,
        ],
      },
      connect: (tools) => {
        live.current.tools = tools
      },
      onBattle: (end) => onMainBattle(end),
    }),
    // the intro and callbacks only matter at the start; a new battle comes with a new round
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [round],
  )
  // each brawler's teammate stands next to them (slumped once out)
  const outKey = SLOTS.map((x) => (lives[x] > 0 ? 1 : 0)).join('')
  const partners = useMemo(
    (): [BrawlerInfo, BrawlerInfo] =>
      round.main.map((slot) => {
        const mate = (slot ^ 1) as Slot
        const out = outKey[mate] === '0'
        return {
          parts: cast.sides[mate].parts,
          model: cast.sides[mate].model,
          color: cast.colors[mate],
          gesture: { kind: out ? 'slump' : null, key: out ? 1 : 0 },
        }
      }) as [BrawlerInfo, BrawlerInfo],
    [cast, round, outKey],
  )
  const leave = () => go(event ? 'events' : tag.friend ? 'friends' : 'compare')
  const showMini = !!mini && !between && !over

  return (
    <Brawl
      teams={teams}
      brawlers={brawlers}
      host={host}
      boost={round.main[1] >= 2 ? Math.max(0, event?.cpuBoost ?? 0) : 0}
      title={event?.title}
      callInset={showMini ? ['4%', '20rem'] : undefined}
      partners={partners}
      onLeave={leave}
      badge={
        <TagRoster
          cast={cast}
          lives={lives}
          maxLives={match.tag.brawlers.map((b) => b.maxLives)}
          main={round.main}
          mini={mini?.pair ?? null}
        />
      }
      overlay={
        <>
          {showMini && (
            <DuelPanel mini={mini} cast={cast} expanded={expanded} waiting={mainDone} onToggle={() => setExpanded((e) => !e)} />
          )}
          <AnimatePresence>
            {between && !over && (
              <RoundPanel key={match.tag.round} between={between} cast={cast} round={match.tag.round} onChoose={choose} />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {over && (
              <TagResultView
                tag={match.tag}
                cast={cast}
                winner={over.winner}
                reward={over.reward}
                ranked={setup.ranked}
                event={!!event}
                onLeave={leave}
                onAgain={onAgain}
              />
            )}
          </AnimatePresence>
        </>
      }
    />
  )
}

// ---------------------------------------------------------------- HUD

/** Both teams at the top: the four faces with their lives, who is battling whom, and who is out. */
function TagRoster({
  cast,
  lives,
  maxLives,
  main,
  mini,
}: {
  cast: Cast
  lives: number[]
  maxLives: number[]
  main: Pair
  mini: Pair | null
}) {
  const face = (slot: Slot) => {
    const out = lives[slot] <= 0
    const onField = main.includes(slot)
    const beside = !!mini?.includes(slot)
    return (
      <div key={slot} className="flex w-[3.4rem] flex-col items-center gap-1" title={cast.sides[slot].name}>
        <div
          className="relative rounded-md p-0.5"
          style={{
            outline: onField ? '2px solid #fff' : beside ? '2px dashed rgba(255,255,255,0.6)' : 'none',
            filter: out ? 'grayscale(1) brightness(0.5)' : 'none',
          }}
        >
          <BrawlerFace avatar={cast.sides[slot].avatar} parts={cast.sides[slot].parts} color={cast.colors[slot]} size={34} />
          {out && (
            <span className="font-display absolute inset-0 flex items-center justify-center text-[10px] font-black tracking-widest text-[#ff4a3d]">
              OUT
            </span>
          )}
        </div>
        <span className="font-display w-full truncate text-center text-[9px] tracking-wider text-white/80">
          {cast.short[slot].toUpperCase()}
        </span>
        <LifeBalls lives={lives[slot]} max={maxLives[slot]} color={cast.colors[slot]} small right={slot >= 2} />
      </div>
    )
  }
  const pairs = [main, ...(mini ? [mini] : [])]
  return (
    <div className="mb-2 flex flex-col items-center rounded-lg border border-white/15 bg-black/60 px-2 py-1.5 backdrop-blur">
      <div className="flex items-start gap-1.5">
        {face(0)}
        {face(1)}
        <span className="font-display self-center px-1 text-sm font-black text-white/40 italic">VS</span>
        {face(2)}
        {face(3)}
      </div>
      <p className="font-display mt-1 text-[9px] tracking-[0.2em] text-white/60">
        {pairs.map((p) => `${cast.short[p[0]].toUpperCase()} ⚔ ${cast.short[p[1]].toUpperCase()}`).join('  ·  ')}
      </p>
    </div>
  )
}

/** The partner's battle, picture-in-picture: both Bakugan and their G-Power, the Gate Card, and its moves as they come. */
function DuelPanel({
  mini,
  cast,
  expanded,
  waiting,
  onToggle,
}: {
  mini: Mini
  cast: Cast
  expanded: boolean
  /** The player's battle is over: this one is being waited for. */
  waiting: boolean
  onToggle: () => void
}) {
  const s = mini.state
  const d = s.duel
  const log = useRef<HTMLDivElement>(null)
  useEffect(() => log.current?.scrollTo({ top: log.current.scrollHeight }), [mini.log.length, expanded])
  const row = (side: SideIndex) => {
    const slot = mini.pair[side]
    const pick = d ? s.sides[side].active : s.thrown[side]
    const fighter = pick === null ? null : s.sides[side].team[pick]
    const entrant = pick === null ? null : cast.teams[slot][pick]
    const el = entrant ? ELEMENT_BY_ID[entrant.bakugan.element] : null
    const won = mini.result?.winner === side
    const lost = !!mini.result && !won
    // while the battle goes on: whose move it is, and who is ahead
    const moving = !!d && !d.done && d.turn === side
    const leads = !!d && !d.done && leaderOf(d) === side
    return (
      <div className={`flex items-center gap-2 ${lost ? 'opacity-50' : ''}`}>
        <BrawlerFace
          avatar={cast.sides[slot].avatar}
          parts={cast.sides[slot].parts}
          color={cast.colors[slot]}
          size={expanded ? 44 : 30}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="font-display truncate text-[10px] font-bold tracking-wider">
            {cast.short[slot].toUpperCase()}
            {moving && <span className="ml-1 rounded-sm bg-white px-1 text-[8px] text-black">MOVE</span>}
          </p>
          <LifeBalls lives={s.sides[side].lives} max={s.sides[side].maxLives} color={cast.colors[slot]} small />
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`${expanded ? 'h-14 w-14' : 'h-9 w-9'} overflow-hidden rounded border border-white/15 bg-white/5`}>
            {entrant ? (
              <BakuganPortrait entrant={entrant} />
            ) : (
              <span className="flex h-full items-center justify-center text-white/30">?</span>
            )}
          </div>
          <div className="flex w-20 flex-col items-end">
            <span className="max-w-20 truncate text-[9px] tracking-wider text-white/60 uppercase">{fighter?.name ?? '…'}</span>
            <span className="font-display text-lg leading-none font-black tabular-nums" style={{ color: el?.color ?? '#fff' }}>
              {d ? powerOf(d, side) : (fighter?.g ?? '—')}
              <span className="text-[10px]">G</span>
            </span>
            {won && <span className="font-display text-[9px] font-bold tracking-widest text-[#3ee07a]">WINS</span>}
            {leads && <span className="font-display text-[9px] font-bold tracking-widest text-[#3ee07a]">▲ AHEAD</span>}
          </div>
        </div>
      </div>
    )
  }
  const gate = d?.gate
  return (
    <motion.div
      layout
      className={`absolute z-20 rounded-xl border border-white/25 bg-black/80 p-3 shadow-2xl backdrop-blur ${
        expanded ? 'top-[24%] left-1/2 w-[30rem] -translate-x-1/2' : 'top-[41%] right-3 w-72'
      }`}
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-display text-[10px] tracking-[0.3em] text-white/60">
          {waiting ? 'FINISHING · ' : ''}
          {mini.pair[0] === 1 ? "PARTNER'S BATTLE" : 'OTHER BATTLE'}
        </p>
        <button
          onClick={onToggle}
          className="font-display rounded border border-white/30 px-2 py-0.5 text-[9px] tracking-[0.2em] text-white/80 hover:bg-white/10"
        >
          {expanded ? '▾ SMALL' : '⤢ WATCH'}
        </button>
      </div>
      <div className="mt-2 space-y-1.5">
        {row(0)}
        <div className="flex items-center gap-2 text-[9px] tracking-widest text-white/45">
          <span className="h-px flex-1 bg-white/15" />
          {gate
            ? gate.open
              ? `GATE: ${gateLabel(gate.card).toUpperCase()}${gate.nullified ? ' · NULLIFIED' : ''}`
              : `GATE CARD FACE-DOWN · ${cast.short[mini.pair[gate.owner]].toUpperCase()}`
            : s.phase === 'set'
              ? 'SETTING THE GATE CARD…'
              : s.gate
                ? 'GATE CARD SET · THROWING…'
                : 'BAKUGAN, BRAWL!'}
          <span className="h-px flex-1 bg-white/15" />
        </div>
        {row(1)}
      </div>
      <div
        ref={log}
        className={`mt-2 space-y-0.5 overflow-y-auto border-t border-white/10 pt-1.5 ${expanded ? 'h-40' : 'h-[3.6rem]'}`}
      >
        {mini.log.length === 0 && <p className="text-[10px] text-white/40">The battle is about to start…</p>}
        {mini.log.map((l) => (
          <motion.p
            key={l.key}
            className="text-[10px] leading-snug text-white/75"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
          >
            · {l.text}
          </motion.p>
        ))}
      </div>
    </motion.div>
  )
}

/** Between rounds: the round's results, then KEEP PAIRS or SWAP OPPONENTS (or the next pairs, when there is no choice). */
function RoundPanel({
  between,
  cast,
  round,
  onChoose,
}: {
  between: Between
  cast: Cast
  round: number
  onChoose: (swap: boolean) => void
}) {
  const pairText = (pairs: Pair[]) =>
    pairs.map((p) => `${cast.short[p[0]].toUpperCase()} ⚔ ${cast.short[p[1]].toUpperCase()}`).join('   ·   ')
  return (
    <motion.div
      className="absolute inset-x-0 top-[27%] z-30 flex flex-col items-center bg-black/80 py-5 backdrop-blur"
      style={{ borderBlock: '2px solid rgba(255,255,255,0.35)' }}
      initial={{ opacity: 0, scaleY: 0 }}
      animate={{ opacity: 1, scaleY: 1 }}
      exit={{ opacity: 0 }}
    >
      <p className="font-display text-3xl font-black tracking-widest italic">ROUND {round} OVER</p>
      <div className="mt-2 flex flex-col items-center gap-0.5">
        {between.results.map((r) => {
          const w = r.pair[r.winner]
          const l = r.pair[r.winner === 0 ? 1 : 0]
          return (
            <p key={`${r.pair[0]}-${r.pair[1]}`} className="text-sm text-white/80">
              <span className="font-bold" style={{ color: cast.colors[w] }}>
                {cast.short[w]}
              </span>{' '}
              beat {cast.short[l]} · {Math.max(...r.power)}G to {Math.min(...r.power)}G
              {r.end === 'ko' ? ' (0 G: defeated)' : r.finisher ? ' (finisher)' : ''}
            </p>
          )
        })}
      </div>
      {between.choice === 'ask' ? (
        <>
          <p className="font-display mt-4 text-xs tracking-[0.4em] text-white/60">NEXT ROUND · YOUR CALL</p>
          <div className="mt-2 flex gap-4">
            <button
              onClick={() => onChoose(false)}
              className="font-display flex flex-col items-center border-2 border-white/70 px-6 py-2.5 tracking-[0.25em] hover:bg-white/10"
            >
              KEEP PAIRS
              <span className="mt-0.5 text-[10px] tracking-[0.15em] text-white/55">{pairText(between.next)}</span>
            </button>
            <button
              onClick={() => onChoose(true)}
              className="font-display flex flex-col items-center border-2 border-[#ffc94a] bg-[#ffc94a]/10 px-6 py-2.5 tracking-[0.25em] text-[#ffe3a0] hover:bg-[#ffc94a]/20"
            >
              SWAP OPPONENTS
              <span className="mt-0.5 text-[10px] tracking-[0.15em] text-white/55">{pairText(between.swapped)}</span>
            </button>
          </div>
          <p className="mt-2 text-[11px] text-white/45">If you keep the pairs, the other team may still call a swap.</p>
        </>
      ) : (
        <>
          <p
            className="font-display mt-4 text-lg font-black tracking-[0.3em]"
            style={{ color: between.choice === 'keep' || between.choice === 'auto' ? '#fff' : '#ffc94a' }}
          >
            {between.choice === 'swap'
              ? 'YOU SWAP OPPONENTS!'
              : between.choice === 'cpu'
                ? `${cast.short[2].toUpperCase()} & ${cast.short[3].toUpperCase()} SWAP OPPONENTS!`
                : between.choice === 'keep'
                  ? 'SAME PAIRS AGAIN'
                  : `ROUND ${round + 1}`}
          </p>
          <p className="font-display mt-1 text-sm tracking-[0.2em] text-white/75">{pairText(between.next)}</p>
          {between.choice === 'auto' && between.next.length === 1 && (
            <p className="mt-1 text-xs text-white/50">One brawler left on a side: they take on both opponents in turn.</p>
          )}
        </>
      )}
    </motion.div>
  )
}

/** The end of the tag battle: who won, each brawler's battles, the rewards, and the way out. */
function TagResultView({
  tag,
  cast,
  winner,
  reward,
  ranked,
  event,
  onLeave,
  onAgain,
}: {
  tag: TagState
  cast: Cast
  winner: SideIndex
  reward: BattleReward | null
  ranked: boolean
  event: boolean
  onLeave: () => void
  onAgain: () => void
}) {
  const won = winner === 0
  const color = cast.colors[won ? 0 : 2]
  const battlesWon = (slot: Slot) => tag.results.filter((r) => r.pair[r.winner] === slot).length
  return (
    <motion.div
      className="absolute inset-x-0 top-[24%] z-30 flex flex-col items-center bg-black/80 py-6 backdrop-blur"
      style={{ borderBlock: `2px solid ${won ? color : '#666'}` }}
      initial={{ opacity: 0, scaleY: 0 }}
      animate={{ opacity: 1, scaleY: 1 }}
    >
      <p className="font-display text-6xl font-black tracking-widest italic" style={{ textShadow: `0 0 40px ${color}` }}>
        {won ? 'VICTORY!' : 'DEFEAT'}
      </p>
      <p className="font-display mt-2 tracking-[0.3em] text-white/60">
        {won
          ? `YOU AND ${cast.short[1].toUpperCase()} WIN THE TAG BATTLE`
          : `${cast.short[2].toUpperCase()} & ${cast.short[3].toUpperCase()} WIN THE TAG BATTLE`}{' '}
        · {tag.round} ROUNDS · {tag.results.length} BATTLES
      </p>
      <div className="mt-4 flex gap-3">
        {SLOTS.map((slot) => (
          <div
            key={slot}
            className="flex items-center gap-2 rounded-lg border bg-black/50 px-3 py-1.5"
            style={{ borderColor: slot < 2 === won ? `${cast.colors[slot]}aa` : 'rgba(255,255,255,0.15)' }}
          >
            <BrawlerFace avatar={cast.sides[slot].avatar} parts={cast.sides[slot].parts} color={cast.colors[slot]} size={30} />
            <div>
              <p className="font-display text-xs font-bold">{cast.short[slot].toUpperCase()}</p>
              <p className="text-[10px] text-white/55">
                {battlesWon(slot)} won · {tag.brawlers[slot].lives > 0 ? `${tag.brawlers[slot].lives} left` : 'out'}
              </p>
            </div>
          </div>
        ))}
      </div>
      {reward ? (
        <RewardList reward={reward} />
      ) : (
        !event && (
          <p className="mt-3 text-xs text-white/45">{ranked ? '' : 'A friendly tag battle: no rating or rewards at stake.'}</p>
        )
      )}
      <div className="mt-5 flex gap-4">
        {!event && (
          <button
            onClick={onAgain}
            className="font-display border-2 border-white/70 px-8 py-3 tracking-[0.3em] hover:bg-white/10"
          >
            TAG AGAIN
          </button>
        )}
        <button
          onClick={onLeave}
          className={`font-display border-2 px-8 py-3 tracking-[0.3em] hover:bg-white/10 ${event ? 'border-white/70' : 'border-white/25 text-white/70'}`}
        >
          {event ? 'BACK TO EVENTS' : 'LEAVE'}
        </button>
      </div>
    </motion.div>
  )
}
