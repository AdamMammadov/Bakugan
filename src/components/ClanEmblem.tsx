import { ELEMENT_BY_ID } from '../data/elements'
import type { Clan } from '../profile/useClans'

/** Badge outlines (CSS clip paths). */
const CLIP = {
  hex: 'polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)',
  shield: 'polygon(0 0, 100% 0, 100% 55%, 50% 100%, 0 55%)',
  circle: 'circle(50% at 50% 50%)',
  star: 'polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
  crown: 'polygon(0 25%, 25% 45%, 50% 5%, 75% 45%, 100% 25%, 92% 100%, 8% 100%)',
}

/** A clan's badge: its shape and colour (the attribute's colour and a hexagon unless the leader changed them). */
export function ClanEmblem({ clan, size = 56 }: { clan: Pick<Clan, 'element' | 'tag' | 'emblem'>; size?: number }) {
  const el = ELEMENT_BY_ID[clan.element]
  const shape = clan.emblem?.shape ?? 'hex'
  const color = clan.emblem?.color ?? el.color
  // the icon sits lower in a crown and higher in a shield, where the shape has room
  const nudge = shape === 'crown' ? 0.12 : shape === 'shield' ? -0.06 : shape === 'star' ? 0.05 : 0
  const icon = shape === 'star' ? 0.42 : 0.55
  return (
    <div
      className="flex shrink-0 items-center justify-center"
      style={{
        width: size,
        height: size,
        clipPath: CLIP[shape],
        background: `linear-gradient(160deg, ${color}, #07080d)`,
      }}
    >
      <img src={el.icon} alt="" style={{ width: size * icon, height: size * icon, transform: `translateY(${nudge * size}px)` }} />
    </div>
  )
}
