import { Canvas } from '@react-three/fiber'
import { animate, AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { afterSpeech, hush, playSfx, shout as callOut } from '../audio/sfx'
import {
  act,
  activeOf,
  canPlay,
  aiForTier,
  chooseAction,
  gateBonus,
  MAX_HP,
  powerOf,
  startBattle,
  type Action,
  type BattleEvent,
  type BattleState,
  type Fighter,
  other,
  type SideIndex,
} from '../battle/engine'
import { GateChip } from '../components/GateChip'
import { abilityLabel, BAKUGAN, battleEffect, type Ability, type Entrant } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { gateDeck, gateElementOf } from '../data/gates'
import { bakuganById, useActiveProfile, useProfiles, type BattleReward } from '../profile/useProfiles'
import { useGame, type TeamMember } from '../store/useGame'
import { botCharacter, CHARACTER_BY_ID, DEFAULT_PARTS, DEFAULT_VOICE, opponentCharacter } from '../profile/avatar'
import { ACTION_DURATION, ArenaScene, IMPACT_AT, type BrawlerInfo } from '../three/ArenaScene'
import type { BrawlerCall, BrawlerGesture } from '../three/Brawler'
import { preloadModels } from '../three/BakuganModels'

const INTRO_MS = 2000
const ENEMY_DELAY_MS = 700
/** Time for a new Bakugan to rise onto the field. */
const ENTRY_MS = 1400

const TYPE_ICON: Record<Ability['type'], string> = {
  attack: '⚔',
  boost: '▲',
  weaken: '▼',
  drain: '⇄',
  shield: '◆',
}

const toTeam = (members: TeamMember[]): Entrant[] =>
  members.map((m) => ({
    bakugan: BAKUGAN.find((b) => b.id === m.id)!,
    form: m.form,
    cards: m.cards,
    bonusG: m.bonusG,
    skin: m.skin,
  }))

const actives = (s: BattleState): [number, number] => [s.sides[0].active, s.sides[1].active]

export function ArenaScreen() {
  const setup = useGame((s) => s.arena)!
  const go = useGame((s) => s.go)
  const teams = useMemo(() => [toTeam(setup.left), toTeam(setup.right)] as const, [setup])
  useEffect(() => teams.flat().forEach((e) => preloadModels(e.bakugan)), [teams])

  // a coin toss decides who opens each round
  const fresh = useCallback(
    () => startBattle(teams[0], teams[1], [gateDeck(teams[0]), gateDeck(teams[1])], Math.random, Math.random() < 0.5 ? 0 : 1),
    [teams],
  )
  const [battle, setBattle] = useState<BattleState>(fresh)
  // What the HUD shows; lags `battle` until each hit lands.
  const [shown, setShown] = useState<BattleState>(battle)
  // Which team member stands on the field in the 3D scene; changes after the fallen one goes down.
  const [onField, setOnField] = useState<[number, number]>([0, 0])
  const [event, setEvent] = useState<{ event: BattleEvent; key: number } | null>(null)
  const [busy, setBusy] = useState(true)
  const [shout, setShout] = useState<{ text: string; sub?: string; key: number } | null>(null)
  const timers = useRef<number[]>([])
  // KOs scored by each of the player's Bakugan, for XP
  const kos = useRef<Record<string, number>>({})
  // ability cards the player activated, for Season Pass challenges
  const abilitiesUsed = useRef(0)
  const [reward, setReward] = useState<BattleReward | null>(null)
  // lets the turn loop call `run` without the two callbacks depending on each other
  const runRef = useRef<(state: BattleState, action: Action) => void>(() => {})

  // the two brawlers: who they are, what they do and what they call out
  const profile = useActiveProfile()
  const botChar = CHARACTER_BY_ID[setup.bot.characterId] ?? opponentCharacter(teams[1][0].bakugan)
  const player = useMemo(() => {
    if (!profile) {
      const c = botCharacter(teams[0][0].bakugan.element)
      return { parts: c.parts, photo: undefined, model: c.model, name: 'You', voice: c.voice }
    }
    const a = profile.avatar
    return {
      parts:
        a.kind === 'custom'
          ? a.parts
          : a.kind === 'preset'
            ? (CHARACTER_BY_ID[a.id]?.parts ?? DEFAULT_PARTS)
            : botCharacter(profile.element).parts,
      photo: a.kind === 'photo' ? a.dataUrl : undefined,
      model: a.kind === 'preset' ? CHARACTER_BY_ID[a.id]?.model : undefined,
      name: profile.firstName,
      voice: (a.kind === 'preset' ? CHARACTER_BY_ID[a.id]?.voice : undefined) ?? DEFAULT_VOICE,
    }
  }, [profile, teams])
  type Cue = Pick<BrawlerInfo, 'gesture'> & { call: BrawlerCall | null }
  const [cues, setCues] = useState<[Cue, Cue]>([
    { gesture: { kind: null, key: 0 }, call: null },
    { gesture: { kind: null, key: 0 }, call: null },
  ])
  /** A brawler gestures and calls out (speech bubble + voice). */
  const cue = (side: SideIndex, kind: BrawlerGesture, title?: string, sub?: string, voice?: string) => {
    const key = Date.now() + side
    setCues((c) => {
      const next = [...c] as typeof c
      next[side] = { gesture: { kind, key }, call: title ? { key, title, sub } : c[side].call }
      return next
    })
    if (voice) callOut(voice, side === 0 ? player.voice : botChar.voice)
    // the bubble disappears after a moment unless a newer call replaced it
    if (title)
      later(2200, () =>
        setCues((c) => {
          if (c[side].call?.key !== key) return c
          const next = [...c] as typeof c
          next[side] = { ...c[side], call: null }
          return next
        }),
      )
  }

  const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms))
  const stopWaits = useRef<(() => void)[]>([])
  /** Continue once nobody is talking any more (at least `minMs` from now). */
  const waitQuiet = (fn: () => void, minMs = 0) => stopWaits.current.push(afterSpeech(fn, 4500, minMs))
  const say = (text: string, sub?: string) => setShout({ text, sub, key: Date.now() })

  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
      stopWaits.current.forEach((stop) => stop())
      hush()
    },
    [],
  )

  const nextTurn = useCallback((next: BattleState, prev: BattleState) => {
    setBattle(next)
    if (next.winner !== null) {
      playSfx(next.winner === 0 ? 'victory' : 'defeat')
      cue(next.winner, 'cheer', 'I WIN!', undefined, 'Yes! Victory!')
      cue(other(next.winner), 'slump')
      if (useGame.getState().arena?.ranked) {
        setReward(
          useProfiles.getState().recordBattle({
            won: next.winner === 0,
            team: next.sides[0].team.map((f) => f.bakugan.id),
            kos: kos.current,
            abilities: abilitiesUsed.current,
            flawless: next.sides[0].team.every((f) => f.hp > 0),
          }),
        )
      }
      return
    }
    if (next.turn === 1)
      later(ENEMY_DELAY_MS, () => runRef.current(next, chooseAction(next, aiForTier(useGame.getState().arena?.bot.tier ?? 0))))
    else {
      setBusy(false)
      if (next.round !== prev.round && next.gate) {
        playSfx('gateCard')
        say(`ROUND ${next.round}`, `Gate Card: ${next.gate.card.name}`)
        cue(next.gate.owner, 'point', 'GATE CARD, SET!', next.gate.card.name, 'Gate card, set!')
      } else say('YOUR TURN')
    }
  }, [])

  const run = useCallback(
    (state: BattleState, action: Action) => {
      const { state: next, event: ev } = act(state, action)
      if (action.kind === 'ability' && ev.actor === 0) abilitiesUsed.current++
      if (ev.ko && ev.actor === 0) {
        const id = activeOf(state.sides[0]).bakugan.id
        kos.current[id] = (kos.current[id] ?? 0) + 1
      }
      setBusy(true)

      if (action.kind === 'switch') {
        setEvent({ event: ev, key: Date.now() })
        playSfx('brawl')
        const incoming = next.sides[ev.actor].team[action.to]
        cue(
          ev.actor,
          'point',
          `${incoming.name.toUpperCase()}, STAND!`,
          `${activeOf(state.sides[ev.actor]).name}, return!`,
          `${incoming.name}, stand!`,
        )
        later(300, () => {
          setShown(next)
          setOnField(actives(next))
        })
        later(ENTRY_MS, () => waitQuiet(() => nextTurn(next, state)))
        return
      }

      /** The Bakugan acts: animation, hit and HUD update. */
      const perform = () => {
        setEvent({ event: ev, key: Date.now() })
        if (ev.damage > 0 && !ev.blocked) later(IMPACT_AT * 1000, () => cue(ev.target, 'flinch'))
        later(IMPACT_AT * 1000, () => {
          if (ev.damage > 0 && !ev.blocked) playSfx('hit')
          if (ev.actorG || ev.targetG) playSfx('gPower')
          setShown(next)
        })
        later(ACTION_DURATION * 1000, () => {
          if (ev.enters) {
            // the defeated Bakugan has fallen; the next one rises in its place
            setOnField(actives(next))
            playSfx('brawl')
            const name = next.sides[ev.enters.side].team[ev.enters.index].name
            cue(ev.enters.side, 'point', 'BAKUGAN, STAND!', name, `Bakugan stand! Go, ${name}!`)
            later(ENTRY_MS, () => waitQuiet(() => nextTurn(next, state)))
          } else waitQuiet(() => nextTurn(next, state))
        })
      }

      if (action.kind === 'ability') {
        // the brawler raises the card and calls it out first; the Bakugan strikes when the call ends
        playSfx('ability')
        cue(ev.actor, 'card', 'ABILITY ACTIVATE!', action.card.ability.name, `Ability activate! ${action.card.ability.name}!`)
        waitQuiet(perform, 900)
      } else {
        playSfx('gateCard')
        cue(ev.actor, 'point')
        perform()
      }
    },
    [nextTurn],
  )
  useEffect(() => {
    runRef.current = run
  }, [run])

  const begin = useCallback(
    (delay: number) => {
      const s = fresh()
      setBattle(s)
      setShown(s)
      setOnField([0, 0])
      setEvent(null)
      setReward(null)
      kos.current = {}
      abilitiesUsed.current = 0
      setBusy(true)
      playSfx('brawl')
      say('BAKUGAN, BRAWL!', `${activeOf(s.sides[0]).name} vs ${activeOf(s.sides[1]).name}`)
      cue(0, 'point', 'BAKUGAN, BRAWL!', undefined, 'Bakugan, brawl!')
      later(900, () => cue(1, 'point', 'BAKUGAN, STAND!', activeOf(s.sides[1]).name))
      later(delay, () => {
        if (s.turn === 1) {
          say('OPPONENT GOES FIRST', s.gate ? `Gate Card: ${s.gate.card.name}` : undefined)
          later(ENEMY_DELAY_MS * 2, () => runRef.current(s, chooseAction(s, aiForTier(useGame.getState().arena?.bot.tier ?? 0))))
          return
        }
        setBusy(false)
        say('YOU GO FIRST', s.gate ? `Gate Card: ${s.gate.card.name}` : undefined)
      })
    },
    [fresh],
  )

  useEffect(() => begin(INTRO_MS), [begin])

  function rematch() {
    timers.current.forEach(clearTimeout)
    stopWaits.current.forEach((stop) => stop())
    hush()
    begin(1200)
  }

  const mySide = battle.sides[0]
  const myTurn = !busy && battle.turn === 0 && battle.winner === null
  const me = activeOf(mySide)
  const element = ELEMENT_BY_ID[me.bakugan.element]
  const fieldFighters = [0, 1].map((i) => shown.sides[i].team[onField[i]]) as [Fighter, Fighter]
  const gate = shown.gate?.card ?? null

  return (
    <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <Canvas shadows camera={{ position: [0, 11, 46], fov: 50 }} dpr={[1, 2]}>
        <ArenaScene
          fighters={[teams[0][onField[0]], teams[1][onField[1]]]}
          gate={gate ? gateElementOf(gate) : null}
          event={event}
          shields={[fieldFighters[0].shield, fieldFighters[1].shield]}
          defeated={[fieldFighters[0].hp === 0, fieldFighters[1].hp === 0]}
          brawlers={[
            { parts: player.parts, photo: player.photo, model: player.model, gesture: cues[0].gesture },
            { parts: botChar.parts, model: botChar.model, gesture: cues[1].gesture },
          ]}
        />
      </Canvas>

      {/* what each brawler calls out, above their head on the field */}
      {cues.map((c, i) =>
        c.call ? (
          <div
            key={c.call.key}
            className={`pointer-events-none absolute bottom-[31%] z-10 ${i === 0 ? 'left-[4%]' : 'right-[4%]'}`}
          >
            <div
              className="brawler-call"
              style={{
                borderColor: i === 0 ? element.color : ELEMENT_BY_ID[shown.sides[1].team[onField[1]].bakugan.element].color,
              }}
            >
              <span className="brawler-call-name text-white/60">{i === 0 ? player.name : botChar.name}</span>
              <span className="brawler-call-title">{c.call.title}</span>
              {c.call.sub && <span className="brawler-call-sub">{c.call.sub}</span>}
            </div>
          </div>
        ) : null,
      )}

      {/* life bars + team */}
      <div className="pointer-events-none absolute inset-x-0 top-0 grid grid-cols-[1fr_auto_1fr] items-start gap-6 p-6">
        <TeamPanel state={shown} side={0} field={onField[0]} label={player.name.toUpperCase()} />
        <div className="flex flex-col items-center pt-2 text-center">
          <p className="font-display text-xs tracking-[0.5em] text-white/40">ROUND</p>
          <p className="font-display text-3xl font-black">{shown.round}</p>
          {gate && (
            <div className="mt-2">
              <p className="font-display mb-1 text-[10px] tracking-[0.4em] text-white/40">GATE CARD</p>
              <GateChip gate={gate} />
            </div>
          )}
        </div>
        <TeamPanel state={shown} side={1} field={onField[1]} label={`${botChar.name.toUpperCase()} · CPU`} />
      </div>

      <button
        onClick={() => go('compare')}
        className="font-display absolute top-44 left-6 text-xs tracking-[0.4em] text-white/40 transition hover:text-white"
      >
        ← LEAVE
      </button>

      {/* battle log */}
      <div className="pointer-events-none absolute top-44 right-6 w-80 space-y-1 text-right text-sm">
        {shown.log.slice(-4).map((line, i, arr) => (
          <p key={shown.log.length - arr.length + i} className={i === arr.length - 1 ? 'text-white/90' : 'text-white/40'}>
            {line}
          </p>
        ))}
      </div>

      {/* bench: switching costs the turn */}
      <div className={`${battle.winner !== null ? 'hidden' : ''} absolute bottom-5 left-5 w-44 space-y-2`}>
        <p className="font-display text-[10px] tracking-[0.4em] text-white/40">SWITCH (ENDS TURN)</p>
        {mySide.team.map((f, i) =>
          i === mySide.active ? null : (
            <button
              key={i}
              disabled={!myTurn || f.hp === 0}
              onClick={() => run(battle, { kind: 'switch', to: i })}
              className="flex w-full items-center gap-2 rounded-md border border-white/15 bg-black/70 p-2 text-left backdrop-blur transition enabled:hover:border-white/60 disabled:opacity-35"
            >
              <img src={ELEMENT_BY_ID[f.bakugan.element].icon} alt="" className="h-8 w-8" />
              <span className="min-w-0 flex-1">
                <span className="font-display block truncate text-xs font-bold">{f.name}</span>
                <span className="text-[10px] text-white/50">{f.hp === 0 ? 'DEFEATED' : `${f.hp} LIFE · ${f.g}G`}</span>
              </span>
            </button>
          ),
        )}
      </div>

      {/* hand: the strip spans the screen, so only the cards take clicks and the bench beside it stays usable */}
      <div
        className={`${battle.winner !== null ? 'hidden' : ''} pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center gap-3 pr-28 pb-5 pl-56 *:pointer-events-auto`}
      >
        <HandButton
          disabled={!myTurn}
          onClick={() => run(battle, { kind: 'basic' })}
          color="#ffffff"
          title="ATTACK"
          tag="BASIC"
          text="A plain strike. Damage scales with your G-Power."
        />
        {mySide.hand.map((card) => {
          const owner = mySide.team.find((f) => f.bakugan.id === card.owner)!
          const ownerElement = ELEMENT_BY_ID[owner.bakugan.element]
          const playable = canPlay(mySide, card)
          const a = card.ability
          return (
            <HandButton
              key={card.uid}
              disabled={!myTurn || !playable}
              locked={!playable ? (owner.hp === 0 ? `${owner.name} is defeated` : `${owner.name} on the bench`) : undefined}
              onClick={() => run(battle, { kind: 'ability', card })}
              color={ownerElement.color}
              owner={owner.name}
              title={a.name}
              tag={`${TYPE_ICON[a.type]} ${abilityLabel(a)}`}
              text={a.description}
              effect={battleEffect(a)}
            />
          )
        })}
        <div className="font-display flex w-16 shrink-0 flex-col items-center self-center text-center text-[10px] tracking-widest text-white/40">
          <span className="text-2xl font-black text-white/70">{mySide.deck.length}</span>
          DECK
        </div>
      </div>

      <AnimatePresence>
        {shout && battle.winner === null && (
          <motion.div
            key={shout.key}
            className="pointer-events-none absolute inset-x-0 top-[28%] text-center"
            initial={{ opacity: 0, scale: 2 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            onAnimationComplete={() => window.setTimeout(() => setShout((s) => (s?.key === shout.key ? null : s)), 900)}
          >
            <p
              className="font-display text-5xl font-black tracking-wider italic"
              style={{ textShadow: `0 0 30px ${element.color}` }}
            >
              {shout.text}
            </p>
            {shout.sub && <p className="font-display mt-2 text-xl tracking-widest text-white/80">{shout.sub}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {battle.winner !== null && (
          <motion.div
            className="absolute inset-x-0 top-1/3 flex flex-col items-center bg-black/75 py-10 backdrop-blur"
            style={{ borderBlock: `2px solid ${battle.winner === 0 ? element.color : '#666'}` }}
            initial={{ opacity: 0, scaleY: 0 }}
            animate={{ opacity: 1, scaleY: 1 }}
          >
            <p
              className="font-display text-7xl font-black tracking-widest italic"
              style={{ textShadow: `0 0 40px ${element.color}` }}
            >
              {battle.winner === 0 ? 'VICTORY!' : 'DEFEAT'}
            </p>
            <p className="font-display mt-2 tracking-[0.3em] text-white/60">
              {battle.winner === 0 ? 'YOUR TEAM' : 'THE OPPONENT'} WINS IN {battle.round} ROUNDS ·{' '}
              {battle.sides[battle.winner].team.filter((f) => f.hp > 0).length} BAKUGAN STANDING
            </p>
            {reward && <RewardList reward={reward} />}
            <div className="mt-6 flex gap-4">
              <button
                onClick={rematch}
                className="font-display border-2 border-white/70 px-8 py-3 tracking-[0.3em] hover:bg-white/10"
              >
                REMATCH
              </button>
              <button
                onClick={() => go('compare')}
                className="font-display border-2 border-white/25 px-8 py-3 tracking-[0.3em] text-white/70 hover:bg-white/10"
              >
                CHANGE TEAMS
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/** XP and unlocks earned in a ranked brawl. */
function RewardList({ reward }: { reward: BattleReward }) {
  const lines = [
    {
      id: 'bp',
      color: '#f5c518',
      text: `+${reward.bp} BP`,
      extra: `${reward.rating >= 0 ? '+' : ''}${reward.rating} rating`,
    },
    {
      id: 'pass',
      color: '#7ec8e3',
      text: `+${reward.passXp} PASS XP`,
      extra: reward.passLevelUp
        ? `PASS LEVEL ${reward.passLevelUp}!`
        : reward.boosted
          ? 'XP boost used (+50% Bakugan XP)'
          : 'Season Pass',
    },
    ...reward.challengesDone.map((c, i) => ({ id: `ch-${i}`, color: '#3ee07a', text: 'CHALLENGE DONE', extra: c })),
    ...(reward.rankUp
      ? [{ id: 'rank', color: '#ffffff', text: `RANK UP: ${reward.rankUp.toUpperCase()}`, extra: 'new tier reached' }]
      : []),
    ...Object.entries(reward.xp).map(([id, xp]) => {
      const b = bakuganById(id)
      const extra = [
        reward.newCards[id] ? `+${reward.newCards[id]} ability card` : '',
        reward.evolveReady.includes(id) ? 'READY TO EVOLVE!' : '',
      ].filter(Boolean)
      return { id, color: ELEMENT_BY_ID[b.element].color, text: `${b.name} +${xp} XP`, extra: extra.join(' · ') }
    }),
    ...reward.unlocked.map((id) => ({
      id: `new-${id}`,
      color: ELEMENT_BY_ID[bakuganById(id).element].glow,
      text: `NEW BAKUGAN: ${bakuganById(id).name}`,
      extra: 'joined your collection',
    })),
  ]
  return (
    <div className="mt-5 flex flex-wrap justify-center gap-3">
      {lines.map((l, i) => (
        <motion.div
          key={l.id}
          className="rounded-md border bg-black/60 px-4 py-2 text-center"
          style={{ borderColor: `${l.color}aa` }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 + i * 0.15 }}
        >
          <p className="font-display font-bold" style={{ color: l.color }}>
            {l.text}
          </p>
          {l.extra && <p className="text-xs tracking-widest text-white/70">{l.extra}</p>}
        </motion.div>
      ))}
    </div>
  )
}

/** Life bar of the Bakugan on the field plus the state of the whole team. */
function TeamPanel({ state, side, field, label }: { state: BattleState; side: SideIndex; field: number; label: string }) {
  const s = state.sides[side]
  const right = side === 1
  const fighter = s.team[field]
  return (
    <div>
      <LifePanel
        fighter={fighter}
        power={powerOf(state, fighter)}
        bonus={gateBonus(state, fighter)}
        label={label}
        align={right ? 'right' : 'left'}
      />
      <div className={`mt-2 flex gap-2 ${right ? 'flex-row-reverse' : 'pl-20'} ${right ? 'pr-20' : ''}`}>
        {s.team.map((f, i) => {
          const el = ELEMENT_BY_ID[f.bakugan.element]
          return (
            <div
              key={i}
              className="w-24 rounded border bg-black/50 px-1.5 py-1"
              style={{ borderColor: i === field ? el.color : 'rgba(255,255,255,0.1)', opacity: f.hp === 0 ? 0.35 : 1 }}
            >
              <div className="flex items-center gap-1">
                <img src={el.icon} alt="" className="h-4 w-4" />
                <span className="truncate text-[10px] font-bold">
                  {f.hp === 0 ? '✕ ' : ''}
                  {f.name}
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded bg-white/10">
                <div
                  className="h-full transition-all duration-500"
                  style={{ width: `${(f.hp / MAX_HP) * 100}%`, background: el.color }}
                />
              </div>
            </div>
          )
        })}
        {side === 1 && <span className="self-center text-[10px] tracking-widest text-white/40">{s.hand.length} CARDS</span>}
      </div>
    </div>
  )
}

function LifePanel({
  fighter,
  power,
  bonus,
  label,
  align,
}: {
  fighter: Fighter
  power: number
  bonus: number
  label: string
  align: 'left' | 'right'
}) {
  const element = ELEMENT_BY_ID[fighter.bakugan.element]
  const pct = (fighter.hp / MAX_HP) * 100
  const right = align === 'right'
  const barColor = pct > 50 ? '#3ee07a' : pct > 25 ? '#f5c518' : '#ff3b2f'

  return (
    <div className={`flex items-center gap-4 ${right ? 'flex-row-reverse text-right' : ''}`}>
      <img src={element.icon} alt="" className="h-16 w-16" style={{ filter: `drop-shadow(0 0 12px ${element.glow})` }} />
      <div className="flex-1">
        <div className={`flex items-baseline gap-3 ${right ? 'flex-row-reverse' : ''}`}>
          <span className="font-display text-xs tracking-[0.4em] text-white/40">{label}</span>
          <span className="font-display text-2xl font-bold">{fighter.name}</span>
          {fighter.shield && (
            <span className="font-display text-xs tracking-widest" style={{ color: element.glow }}>
              ◆ SHIELD
            </span>
          )}
        </div>
        <div className="mt-2 h-4 overflow-hidden rounded-sm border border-white/15 bg-white/5">
          <motion.div
            className={`h-full ${right ? 'ml-auto' : ''}`}
            style={{ background: barColor, boxShadow: `0 0 12px ${barColor}` }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
        <div className={`mt-1 flex justify-between text-sm ${right ? 'flex-row-reverse' : ''}`}>
          <span className="text-white/60">
            LIFE <AnimatedNumber value={fighter.hp} />/{MAX_HP}
          </span>
          <span className="font-display font-bold" style={{ color: element.color }}>
            {bonus > 0 && <span className="mr-2 text-xs font-normal text-white/60">GATE +{bonus}</span>}
            <AnimatedNumber value={power} />G
          </span>
        </div>
      </div>
    </div>
  )
}

function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value)
  const prev = useRef(value)
  useEffect(() => {
    const controls = animate(prev.current, value, { duration: 0.6, onUpdate: (v) => setShown(Math.round(v)) })
    prev.current = value
    return () => controls.stop()
  }, [value])
  return <>{shown}</>
}

function HandButton({
  title,
  tag,
  text,
  effect,
  color,
  disabled,
  locked,
  owner,
  onClick,
}: {
  title: string
  tag: string
  text: string
  /** Arena effect summary shown in the hover popover. */
  effect?: string
  color: string
  disabled: boolean
  /** Why the card can't be played right now. */
  locked?: string
  /** Bakugan the card belongs to. */
  owner?: string
  onClick: () => void
}) {
  return (
    <div className="group relative flex min-w-0 flex-1 basis-0 [max-width:10rem]">
      <motion.button
        disabled={disabled}
        onClick={onClick}
        whileHover={disabled ? undefined : { y: -14 }}
        className="relative flex h-[clamp(6rem,24vh,11rem)] w-full flex-col rounded-lg border-2 bg-black/75 p-3 text-left backdrop-blur transition disabled:cursor-not-allowed"
        style={{
          borderColor: locked ? 'rgba(255,255,255,0.1)' : `${color}aa`,
          opacity: locked ? 0.4 : disabled ? 0.6 : 1,
          boxShadow: disabled ? 'none' : `0 0 18px ${color}44`,
        }}
      >
        <span className="font-display text-[11px] font-bold tracking-wider" style={{ color }}>
          {tag}
        </span>
        {owner && <span className="truncate text-[10px] tracking-wider text-white/45 uppercase">{owner}</span>}
        <span className="font-display mt-1 text-sm leading-tight font-bold">{title}</span>
        <span className="mt-1.5 line-clamp-2 text-xs leading-snug text-white/65 [@media(min-height:720px)]:line-clamp-4">
          {text}
        </span>
        {locked && (
          <span className="font-display absolute inset-x-0 bottom-2 px-2 text-center text-[10px] leading-tight tracking-widest text-white/80">
            {locked.toUpperCase()}
          </span>
        )}
      </motion.button>

      {/* full card text on hover, even while it is not your turn */}
      <div
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-4 w-64 -translate-x-1/2 rounded-lg border bg-black/90 p-4 opacity-0 shadow-2xl backdrop-blur transition group-hover:opacity-100"
        style={{ borderColor: `${color}aa` }}
      >
        <p className="font-display text-[11px] font-bold tracking-wider" style={{ color }}>
          {tag}
        </p>
        <p className="font-display mt-1 text-base font-bold">{title}</p>
        <p className="mt-2 text-sm leading-snug text-white/80">{text}</p>
        {effect && (
          <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-snug text-white/60">
            <span className="font-display tracking-widest text-white/40">IN THE ARENA · </span>
            {effect}
          </p>
        )}
      </div>
    </div>
  )
}
