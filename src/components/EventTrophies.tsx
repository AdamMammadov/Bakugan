import { BOSSES } from '../events/catalog'
import { useProfileEvents } from '../events/store'
import { Trophy } from './EventArt'

/** A profile's event honours: Bakugan Cup trophies and bosses beaten on Brutal. Nothing when there are none. */
export function EventTrophies({ profileId }: { profileId: string }) {
  const events = useProfileEvents(profileId)
  const cups = events.trophies.filter((t) => t.place === 1)
  const finals = events.trophies.filter((t) => t.place === 2).length
  const brutal = BOSSES.filter((b) => events.bosses[b.id]?.cleared.includes('brutal'))
  if (!cups.length && !finals && !brutal.length) return null
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      {cups.length > 0 && (
        <span
          className="flex items-center gap-2 rounded-full border border-amber-300/50 bg-black/40 py-1 pr-3 pl-1"
          title={cups.map((t) => t.cup).join(', ')}
        >
          <Trophy size={26} />
          <span className="font-display text-xs tracking-widest text-amber-200">
            {cups.length} {cups.length === 1 ? 'CUP' : 'CUPS'} WON
          </span>
        </span>
      )}
      {finals > 0 && (
        <span className="flex items-center gap-2 rounded-full border border-white/25 bg-black/40 py-1 pr-3 pl-1">
          <Trophy size={26} metal="silver" />
          <span className="font-display text-xs tracking-widest text-white/70">{finals}× RUNNER-UP</span>
        </span>
      )}
      {brutal.length > 0 && (
        <span
          className="font-display rounded-full border border-red-400/50 bg-black/40 px-3 py-1.5 text-xs tracking-widest text-red-200"
          title={brutal.map((b) => b.name).join(', ')}
        >
          ☠ {brutal.length} BRUTAL {brutal.length === 1 ? 'BOSS' : 'BOSSES'}
        </span>
      )}
    </div>
  )
}
