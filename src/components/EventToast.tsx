import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { playSfx } from '../audio/sfx'
import { ELEMENT_BY_ID } from '../data/elements'
import { useEventToasts } from '../events/progress'
import { rewardLabel } from '../season/season'
import { useGame } from '../store/useGame'
import { Trophy } from './EventArt'
import { RewardIcon } from './RewardIcon'

const TONE = { win: '#3ee07a', loss: '#ff6b6b', gold: '#f5c518' }
/** How long a toast stays up. */
const SHOW_MS = 7000

/** Event progress, shown once the player is back from the arena (one at a time; click to close). */
export function EventToast() {
  const screen = useGame((s) => s.screen)
  const toast = useEventToasts((s) => s.queue[0])
  const dismiss = useEventToasts((s) => s.dismiss)
  const showing = !!toast && screen !== 'arena' && screen !== 'live' && screen !== 'intro'

  useEffect(() => {
    if (!showing) return
    if (toast.tone !== 'loss') playSfx(toast.tone === 'gold' ? 'victory' : 'gPower')
    const t = window.setTimeout(() => dismiss(toast.key), SHOW_MS)
    return () => clearTimeout(t)
  }, [showing, toast, dismiss])

  return (
    <div className="pointer-events-none fixed inset-x-0 top-6 z-[60] flex justify-center px-4">
      <AnimatePresence>
        {showing && (
          <motion.button
            key={toast.key}
            onClick={() => dismiss(toast.key)}
            className="pointer-events-auto flex max-w-xl items-center gap-4 rounded-2xl border-2 bg-black/90 px-5 py-4 text-left backdrop-blur transition-[filter] hover:brightness-125"
            style={{
              borderColor: TONE[toast.tone],
              boxShadow: `0 0 30px ${TONE[toast.tone]}55, inset 0 0 40px ${ELEMENT_BY_ID[toast.element].color}22`,
            }}
            initial={{ opacity: 0, y: -30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20 }}
          >
            {toast.tone === 'gold' ? (
              <Trophy size={52} />
            ) : (
              <img src={ELEMENT_BY_ID[toast.element].icon} alt="" className="h-12 w-12 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-display text-[10px] tracking-[0.4em]" style={{ color: TONE[toast.tone] }}>
                EVENT PROGRESS
              </p>
              <p className="font-display text-lg leading-tight font-black">{toast.title}</p>
              <p className="mt-0.5 text-sm text-white/70">{toast.text}</p>
              {toast.rewards.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {toast.rewards.map((r, i) => (
                    <span
                      key={i}
                      className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 py-0.5 pr-3 pl-1 text-xs"
                    >
                      <RewardIcon kind={r.kind} size={22} />
                      {rewardLabel(r)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
