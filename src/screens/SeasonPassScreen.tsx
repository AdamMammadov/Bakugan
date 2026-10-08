import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { playSfx } from '../audio/sfx'
import { GRID, GRID_SIZE } from '../components/grid'
import { PageNav } from '../components/PageNav'
import { RewardIcon } from '../components/RewardIcon'
import { ELEMENT_BY_ID } from '../data/elements'
import { bakuganById, seasonFor, useActiveProfile, useProfiles, type Profile } from '../profile/useProfiles'
import { currentSeason, seasonBakugan } from '../season/current'
import {
  challengeRequirement,
  dailyChallenges,
  isPremiumLevel,
  LEVEL_XP,
  levelCost,
  PASS_LEVELS,
  PASS_TOTAL_XP,
  PASS_XP,
  RARITY,
  passLevel,
  passRewards,
  rewardLabel,
  SEASON_DAYS,
  timeLeft,
  weeklyChallenges,
  type Challenge,
} from '../season/season'
import { formatUsd, passPrice, rewardRarity, rewardWorth } from '../shop/shop'

const GOLD = '#f5c518'

/** Shop value of the premium levels of a season's pass. */
const premiumWorth = (season: number) =>
  passRewards(season)
    .map((r, l) => (l > 0 && isPremiumLevel(l) ? rewardWorth(r) : { usd: 0, bp: 0 }))
    .reduce((a, b) => ({ usd: a.usd + b.usd, bp: a.bp + b.bp }))

export function SeasonPassScreen() {
  const profile = useActiveProfile()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])
  const info = currentSeason(now)

  return (
    <motion.div
      className="absolute inset-0 overflow-y-auto px-12 py-10"
      style={{
        backgroundImage: `radial-gradient(circle at 80% 0%, ${GOLD}22, transparent 45%), ${GRID}`,
        backgroundSize: `100% 100%, ${GRID_SIZE}`,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <PageNav current="pass" />
      <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-display text-xs tracking-[0.5em]" style={{ color: GOLD }}>
            {SEASON_DAYS}-DAY SEASON · ENDS IN {timeLeft(info.endsAt - now).toUpperCase()}
          </p>
          <h1 className="font-display text-5xl font-black tracking-wider">SEASON {info.id} PASS</h1>
        </div>
      </div>
      {!profile ? (
        <p className="mt-10 text-white/60">Create a player profile to take part in the season.</p>
      ) : (
        <Pass profile={profile} />
      )}
    </motion.div>
  )
}

function Pass({ profile }: { profile: Profile }) {
  const claimLevel = useProfiles((s) => s.claimLevel)
  const claimAll = useProfiles((s) => s.claimAll)
  const season = seasonFor(profile)
  const rewards = passRewards(season.id)
  const level = passLevel(season.passXp)
  const passIds = seasonBakugan(season.id).pass
  const price = passPrice()
  const worth = premiumWorth(season.id)
  const bakuganName = (slot: number) => (passIds[slot] ? bakuganById(passIds[slot]).name : null)
  const into = season.passXp - LEVEL_XP[level]
  const need = level < PASS_LEVELS ? levelCost(level + 1) : 1
  const claimable = Array.from({ length: PASS_LEVELS }, (_, i) => i + 1).filter(
    (l) => l <= level && !season.claimed.includes(l) && (!isPremiumLevel(l) || season.premium),
  )

  return (
    <>
      {/* level and premium status */}
      <div className="mt-6 grid grid-cols-[1fr_auto] gap-6 rounded-2xl border border-white/10 bg-black/50 p-6 backdrop-blur">
        <div>
          <div className="flex items-baseline gap-4">
            <span className="font-display text-6xl font-black">{level}</span>
            <span className="font-display text-sm tracking-[0.3em] text-white/50">/ {PASS_LEVELS} LEVEL</span>
            <span className="ml-auto text-sm text-white/60">
              {season.passXp.toLocaleString('en')} / {PASS_TOTAL_XP.toLocaleString('en')} XP
            </span>
          </div>
          <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${level >= PASS_LEVELS ? 100 : (into / need) * 100}%`,
                background: `linear-gradient(90deg, #7ec8e3, ${GOLD})`,
              }}
            />
          </div>
          <p className="mt-2 text-sm text-white/55">
            {level >= PASS_LEVELS ? 'Pass complete!' : `${need - into} XP to level ${level + 1}`} · battles today{' '}
            {season.battleXp}/{PASS_XP.dailyBattleCap} XP (win {PASS_XP.win}, loss {PASS_XP.loss}) · challenges have no cap
          </p>
        </div>
        <div className="flex w-64 flex-col items-stretch justify-center gap-2 text-center">
          {season.premium ? (
            <p
              className="font-display rounded-lg border-2 py-3 font-black tracking-[0.3em]"
              style={{ borderColor: GOLD, color: GOLD }}
            >
              ★ PREMIUM PASS
            </p>
          ) : (
            <>
              <button
                disabled
                title="Payments open with the online version"
                className="font-display rounded-lg border-2 py-3 font-black tracking-[0.3em] opacity-80"
                style={{ borderColor: GOLD, color: GOLD }}
              >
                BUY PASS · {formatUsd(price.price)}
              </button>
              {price.discount > 0 && (
                <p className="text-xs font-bold text-emerald-300">
                  LAST WEEK: {Math.round(price.discount * 100)}% OFF{' '}
                  <span className="text-white/40 line-through">{formatUsd(price.full)}</span>
                </p>
              )}
              <p className="text-xs text-white/55">
                23 premium levels worth {formatUsd(worth.usd)} + {worth.bp.toLocaleString('en')} BP in the shop: 4 season Bakugan,
                Epic and Legendary skins, sets and more.
              </p>
              <p className="text-[10px] text-white/35">Payments open with the online version.</p>
            </>
          )}
          {claimable.length > 0 && (
            <button
              onClick={() => {
                playSfx('victory')
                claimAll()
              }}
              className="font-display rounded-lg border border-white/50 bg-white/10 py-2 text-xs tracking-[0.3em] hover:bg-white/20"
            >
              CLAIM ALL ({claimable.length})
            </button>
          )}
        </div>
      </div>

      {/* the track */}
      <div className="mt-6 flex gap-3 overflow-x-auto pb-4">
        {rewards.slice(1).map((r, i) => {
          const l = i + 1
          const premium = isPremiumLevel(l)
          const reached = level >= l
          const claimed = season.claimed.includes(l)
          const locked = premium && !season.premium
          const slotMissing = r.kind === 'seasonBakugan' && !passIds[r.slot]
          return (
            <div
              key={l}
              className="relative flex w-36 shrink-0 flex-col rounded-xl border-2 bg-black/60 p-3"
              style={{
                borderColor: premium ? `${GOLD}${reached ? 'ff' : '55'}` : reached ? '#7ec8e3' : 'rgba(255,255,255,0.12)',
                opacity: reached ? 1 : 0.7,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-black">{l}</span>
                <span
                  className="font-display rounded px-1.5 text-[9px] tracking-widest"
                  style={{ background: premium ? GOLD : '#ffffff22', color: premium ? '#000' : '#fff' }}
                >
                  {premium ? 'PASS' : 'FREE'}
                </span>
              </div>
              <span className="mt-2">
                <RewardIcon
                  kind={r.kind}
                  accent={
                    r.kind === 'seasonBakugan' && passIds[r.slot]
                      ? ELEMENT_BY_ID[bakuganById(passIds[r.slot]).element].color
                      : undefined
                  }
                />
              </span>
              <span className="mt-1 min-h-10 text-xs leading-tight text-white/80">
                {rewardLabel(r, (s) => bakuganName(s) ?? 'Season Bakugan (to be announced)')}
              </span>
              {rewardRarity(r) && (
                <span className="text-[9px] tracking-widest" style={{ color: RARITY[rewardRarity(r)!].color }}>
                  {RARITY[rewardRarity(r)!].name.toUpperCase()}
                </span>
              )}
              <div className="mt-auto pt-2">
                {claimed ? (
                  <span className="text-xs text-emerald-300">✓ CLAIMED</span>
                ) : locked ? (
                  <span className="text-xs" style={{ color: GOLD }}>
                    🔒 PASS
                  </span>
                ) : reached && !slotMissing ? (
                  <button
                    onClick={() => {
                      if (claimLevel(l)) playSfx('gPower')
                    }}
                    className="font-display w-full rounded border border-white/60 py-1 text-[10px] tracking-[0.2em] hover:bg-white/15"
                  >
                    CLAIM
                  </button>
                ) : (
                  <span className="text-[10px] text-white/40">
                    {reached ? 'COMING SOON' : `${(LEVEL_XP[l] - season.passXp).toLocaleString('en')} XP`}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-6">
        <Challenges
          title="DAILY CHALLENGES"
          list={dailyChallenges()}
          stats={season.day.stats}
          done={season.day.done}
          resets="day"
        />
        <Challenges
          title="WEEKLY CHALLENGES"
          list={weeklyChallenges()}
          stats={season.week.stats}
          done={season.week.done}
          resets="week"
        />
      </div>

      <SeasonBakugan profile={profile} />
    </>
  )
}

function Challenges({
  title,
  list,
  stats,
  done,
  resets,
}: {
  title: string
  list: Challenge[]
  stats: Partial<Record<Challenge['stat'], number>>
  done: string[]
  resets: 'day' | 'week'
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-black/50 p-5">
      <h2 className="font-display text-xs tracking-[0.4em] text-white/50">
        {title} <span className="text-white/30">· new every {resets}</span>
      </h2>
      <div className="mt-3 space-y-3">
        {list.map((c) => {
          const v = Math.min(c.goal, stats[c.stat] ?? 0)
          const ok = done.includes(c.id)
          return (
            <div key={c.id}>
              <div className="flex justify-between text-sm">
                <span className={ok ? 'text-emerald-300' : 'text-white/85'}>
                  {ok ? '✓ ' : ''}
                  {c.text}
                </span>
                <span className="text-white/50">
                  {v}/{c.goal} · <span style={{ color: '#7ec8e3' }}>+{c.xp} XP</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(v / c.goal) * 100}%`, background: ok ? '#3ee07a' : '#7ec8e3' }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function SeasonBakugan({ profile }: { profile: Profile }) {
  const claimSeasonBakugan = useProfiles((s) => s.claimSeasonBakugan)
  const season = seasonFor(profile)
  const { pass, challenge } = seasonBakugan(season.id)
  const level = passLevel(season.passXp)
  const owned = (id: string) => profile.collection.some((o) => o.id === id)

  return (
    <section className="mt-6 mb-10 rounded-2xl border border-white/10 bg-black/50 p-5">
      <h2 className="font-display text-xs tracking-[0.4em] text-white/50">SEASON {season.id} BAKUGAN</h2>
      <p className="mt-1 text-sm text-white/50">
        Every season brings 12 new Bakugan: 4 in the pass and 8 earned in play — Bakugan of your attribute are easier to earn.
        When the season ends, the pass Bakugan move to the shop at a high price.
      </p>
      {pass.length + challenge.length === 0 && (
        <p className="mt-4 rounded-lg border border-dashed border-white/15 p-4 text-sm text-white/45">
          This season&apos;s new Bakugan have not been announced yet.
        </p>
      )}
      <div className="mt-4 grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {pass.map((id, slot) => {
          const b = bakuganById(id)
          const el = ELEMENT_BY_ID[b.element]
          return (
            <div key={id} className="rounded-xl border-2 bg-black/40 p-3" style={{ borderColor: `${GOLD}88` }}>
              <div className="flex items-center gap-2">
                <img src={el.icon} alt="" className="h-9 w-9" />
                <div>
                  <p className="font-display font-bold">{b.name}</p>
                  <p className="text-xs" style={{ color: GOLD }}>
                    PASS · level {[10, 20, 30, 40][slot]}
                  </p>
                </div>
                {owned(id) && <span className="ml-auto text-xs text-emerald-300">✓ OWNED</span>}
              </div>
            </div>
          )
        })}
        {challenge.map((id) => {
          const b = bakuganById(id)
          const el = ELEMENT_BY_ID[b.element]
          const req = challengeRequirement(b.element === profile.element)
          const ready = season.wins >= req.wins && level >= req.level && profile.bp >= req.bp
          return (
            <div key={id} className="rounded-xl border bg-black/40 p-3" style={{ borderColor: `${el.color}66` }}>
              <div className="flex items-center gap-2">
                <img src={el.icon} alt="" className="h-9 w-9" />
                <div>
                  <p className="font-display font-bold">{b.name}</p>
                  <p className="text-xs text-white/50">
                    {b.element === profile.element ? 'Your attribute · easier' : 'Other attribute'}
                  </p>
                </div>
              </div>
              {owned(id) ? (
                <p className="mt-2 text-xs text-emerald-300">✓ OWNED</p>
              ) : (
                <>
                  <ul className="mt-2 space-y-0.5 text-xs">
                    <Req ok={season.wins >= req.wins} text={`${season.wins}/${req.wins} season wins`} />
                    <Req ok={level >= req.level} text={`Pass level ${level}/${req.level}`} />
                    <Req ok={profile.bp >= req.bp} text={`${req.bp.toLocaleString('en')} BP`} />
                  </ul>
                  <button
                    disabled={!ready}
                    onClick={() => claimSeasonBakugan(id) && playSfx('victory')}
                    className="font-display mt-2 w-full rounded border border-white/40 py-1 text-[10px] tracking-[0.2em] enabled:hover:bg-white/15 disabled:opacity-35"
                  >
                    UNLOCK
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

const Req = ({ ok, text }: { ok: boolean; text: string }) => (
  <li className={ok ? 'text-emerald-300' : 'text-white/55'}>
    {ok ? '✓' : '○'} {text}
  </li>
)
