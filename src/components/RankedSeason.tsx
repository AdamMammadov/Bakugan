import { playSfx } from '../audio/sfx'
import { TIER_COLORS, TOP_COLOR } from '../profile/brawlers'
import { bestTier, gloryFor, RANKS, rankScore, tierOf, TIERS, useActiveProfile, useProfiles } from '../profile/useProfiles'
import { currentSeason } from '../season/current'
import { GLORY_STORE } from '../season/glory'
import { rewardLabel, timeLeft } from '../season/season'
import { RankEmblem } from './RankEmblem'

/** Glory's mark. */
export const GloryIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
    <path
      d="M8 1l2 4.3 4.7.6-3.4 3.2.9 4.7L8 11.6 3.8 13.8l.9-4.7L1.3 5.9 6 5.3z"
      fill="#ffd76a"
      stroke="#8a5a10"
      strokeWidth="0.8"
    />
  </svg>
)

/**
 * The ranked season: when it ends, the best rank reached so far and the Glory it will pay, what each rank pays, and the
 * Glory store (rewards sold nowhere else).
 */
export function RankedSeason({ now }: { now: number }) {
  const profile = useActiveProfile()
  const buy = useProfiles((s) => s.buyGlory)
  const season = currentSeason(now)
  const played = !!profile && ((profile.season?.wins ?? 0) > 0 || !!profile.season?.peak)
  const peak = profile ? Math.max(profile.season?.peak ?? 0, played ? rankScore(profile) : 0) : 0
  const peakRank = tierOf(peak)
  const glory = profile?.glory ?? 0
  const reached = profile ? bestTier(profile) : -1
  const color = peakRank.top ? TOP_COLOR : TIER_COLORS[peakRank.index]

  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-[22rem_1fr]">
      <div className="flex flex-col gap-4">
        {/* this season */}
        <div className="rounded-xl border border-white/10 bg-black/40 p-5">
          <p className="font-display text-[10px] tracking-[0.2em] text-white/45">RANKED SEASON {season.id}</p>
          <p className="font-display mt-1 text-sm tracking-[0.2em] text-amber-200">
            ENDS IN {timeLeft(season.endsAt - now).toUpperCase()}
          </p>
          {profile ? (
            <>
              <div className="mt-4 flex items-center gap-4">
                <RankEmblem color={color} tier={peakRank.index} division={peakRank.division} size={64} />
                <div>
                  <p className="text-xs text-white/50">Best rank this season</p>
                  <p className="font-display text-lg font-black" style={{ color }}>
                    {played ? peakRank.rank : '—'}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm text-white/70">
                {played ? (
                  <>
                    At the season’s end you get{' '}
                    <span className="font-bold text-amber-200">
                      <GloryIcon /> {gloryFor(peak).toLocaleString('en')} Glory
                    </span>{' '}
                    for it. Climb higher before then for more.
                  </>
                ) : (
                  'Win a ranked brawl this season to earn Glory at its end.'
                )}
              </p>
              <p className="font-display mt-4 flex items-center gap-2 text-2xl font-black text-amber-200">
                <GloryIcon size={22} /> {glory.toLocaleString('en')}
                <span className="text-xs tracking-[0.16em] text-white/45">GLORY</span>
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm text-white/55">Make a profile to brawl ranked and earn Glory.</p>
          )}
        </div>

        {/* what each rank pays */}
        <div className="rounded-xl border border-white/10 bg-black/40 p-5">
          <p className="font-display text-[10px] tracking-[0.2em] text-white/45">GLORY AT THE SEASON’S END</p>
          <div className="mt-3 flex flex-col gap-1.5">
            {TIERS.map((t, i) => {
              const low = RANKS.find((r) => r.tier === i && r.division === 'V')!
              const high = RANKS.find((r) => r.tier === i && r.division === 'I')!
              return (
                <div key={t.name} className="flex items-center justify-between text-sm">
                  <span style={{ color: TIER_COLORS[i] }}>{t.name}</span>
                  <span className="text-white/70 tabular-nums">
                    {gloryFor(low.min)}–{gloryFor(high.min)}
                  </span>
                </div>
              )
            })}
            <div className="flex items-center justify-between text-sm">
              <span style={{ color: TOP_COLOR }}>✦ {RANKS[RANKS.length - 1].name}</span>
              <span className="text-white/70 tabular-nums">{gloryFor(RANKS[RANKS.length - 1].min)}</span>
            </div>
          </div>
          <p className="mt-3 text-xs text-white/40">Your rating is softly reset when a season ends; your best rank is kept.</p>
        </div>
      </div>

      {/* the Glory store */}
      <div className="rounded-xl border border-white/10 bg-black/40 p-5">
        <p className="font-display text-[10px] tracking-[0.2em] text-white/45">GLORY STORE · REWARDS SOLD NOWHERE ELSE</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {GLORY_STORE.map((item) => {
            const owned = !item.repeat && !!profile?.cosmetics?.owned.includes(item.key)
            const locked = item.tier !== undefined && reached < item.tier
            const short = glory < item.price
            const tierColor = item.tier !== undefined ? TIER_COLORS[item.tier] : undefined
            return (
              <div key={item.key} className="flex flex-col rounded-lg border border-white/10 bg-black/40 p-4">
                <p className="font-display text-sm font-bold">{rewardLabel(item.reward)}</p>
                <p className="mt-1 text-xs text-white/45">
                  {item.repeat ? 'Can be bought again' : 'Yours to keep'}
                  {item.tier !== undefined && (
                    <>
                      {' · needs '}
                      <span style={{ color: tierColor }}>{TIERS[item.tier].name}</span>
                    </>
                  )}
                </p>
                <button
                  disabled={!profile || owned || locked || short}
                  onClick={() => {
                    if (buy(item.key)) playSfx('victory')
                  }}
                  className="font-display mt-auto flex items-center justify-center gap-2 rounded border border-amber-300/60 px-3 py-2 pt-2 text-xs tracking-[0.14em] text-amber-200 transition enabled:hover:bg-amber-300/10 disabled:border-white/15 disabled:text-white/35"
                  style={{ marginTop: 14 }}
                >
                  {owned ? (
                    'OWNED'
                  ) : locked ? (
                    'LOCKED'
                  ) : (
                    <>
                      <GloryIcon /> {item.price.toLocaleString('en')}
                    </>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
