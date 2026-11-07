import { AnimatePresence, motion } from 'framer-motion'
import { useRef } from 'react'
import { asset } from '../asset'
import { ELEMENT_BY_ID, type ElementInfo } from '../data/elements'
import { useActiveProfile } from '../profile/useProfiles'
import { useGame, type Screen } from '../store/useGame'
import { useParallax } from './parallax'

/**
 * The game's own arena, photographed from six places (rendered from the real 3D stadium: the stands full of fans, the
 * light towers, the big screen, the field and its Gate Card; see tools/preview/stadium.tsx).
 */
type Shot = 'wide' | 'side' | 'screen' | 'card' | 'corner' | 'low'

interface Theme {
  shot: Shot
  /** The page's colour, washed over the picture; 'el' is the player's attribute colour. */
  tint: string
  /** Where the picture's focus sits (CSS object-position), so the page's text falls on a quiet part. */
  focus?: string
}

const THEMES: Partial<Record<Screen, Theme>> = {
  hub: { shot: 'low', tint: 'el', focus: '60% 50%' },
  compare: { shot: 'corner', tint: 'el' },
  profileEdit: { shot: 'screen', tint: 'el' },
  profile: { shot: 'side', tint: 'el' },
  inventory: { shot: 'card', tint: '#38bdf8' },
  pass: { shot: 'wide', tint: '#fcd34d' },
  events: { shot: 'wide', tint: '#a78bfa', focus: '50% 30%' },
  shop: { shot: 'screen', tint: '#34d399' },
  rankings: { shot: 'wide', tint: '#f5c518', focus: '50% 60%' },
  clans: { shot: 'side', tint: '#ef4444' },
  friends: { shot: 'corner', tint: '#f472b6' },
  encyclopedia: { shot: 'card', tint: '#60a5fa' },
}

/**
 * The picture behind the pages (and the hub, face-off and editor): the game's own arena from a place of the page's,
 * darkened and softened so the page reads on it, washed in the page's colour, drifting very slowly. One fixed layer
 * under every page, so moving between pages fades from one picture to the next.
 */
export function PageBackdrop({ screen }: { screen: Screen }) {
  const profile = useActiveProfile()
  const chosen = useGame((s) => s.element)
  const theme = THEMES[screen]
  const el = ELEMENT_BY_ID[profile?.element ?? chosen ?? 'pyrus']
  // the picture drifts a little with the mouse
  const root = useRef<HTMLDivElement>(null)
  useParallax(root)
  return (
    <div ref={root} className="pointer-events-none fixed inset-0 overflow-hidden bg-[#05060a]" aria-hidden>
      <AnimatePresence>
        {theme && (
          <motion.div
            key={`${theme.shot}-${theme.tint}-${el.id}`}
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Photo theme={theme} el={el} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Photo({ theme, el }: { theme: Theme; el: ElementInfo }) {
  const tint = theme.tint === 'el' ? el.color : theme.tint
  return (
    <div className="absolute inset-0">
      <div className="parallax-far absolute inset-[-3%]">
        <img
          src={asset(`backdrops/${theme.shot}.jpg`)}
          alt=""
          draggable={false}
          className="bd-photo absolute inset-0 h-full w-full object-cover"
          style={{ objectPosition: theme.focus ?? '50% 50%' }}
        />
      </div>
      {/* the page's colour, washed over the picture */}
      <div className="absolute inset-0 mix-blend-soft-light" style={{ background: tint, opacity: 0.35 }} />
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse at 15% 0%, ${tint}33, transparent 60%)` }}
      />
      {/* darker towards the left and the bottom, where the page's text and lists sit, and round the edges */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,#05060ae6_0%,#05060ab3_38%,#05060a66_70%,#05060a99_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#05060a80_0%,transparent_30%,transparent_60%,#05060ad9_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,#05060ab3_100%)]" />
    </div>
  )
}
