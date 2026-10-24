import { ELEMENT_BY_ID } from '../data/elements'
import type { Clan } from '../profile/useClans'

/** A clan's hexagon badge in its attribute's colour. */
export function ClanEmblem({ clan, size = 56 }: { clan: Pick<Clan, 'element' | 'tag'>; size?: number }) {
  const el = ELEMENT_BY_ID[clan.element]
  return (
    <div
      className="flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        clipPath: 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)',
        background: `linear-gradient(160deg, ${el.color}, #07080d)`,
      }}
    >
      <img src={el.icon} alt="" style={{ width: size * 0.55, height: size * 0.55 }} />
    </div>
  )
}
