import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { useActiveProfile, useProfiles } from '../profile/useProfiles'
import { useGame } from '../store/useGame'

/** Rolls the player into a new season when one ended, and announces it once. */
export function SeasonNotice() {
  const profile = useActiveProfile()
  const screen = useGame((s) => s.screen)
  const syncSeason = useProfiles((s) => s.syncSeason)
  const dismiss = useProfiles((s) => s.dismissSeasonNotice)
  const openPage = useGame((s) => s.openPage)

  useEffect(() => {
    if (profile) syncSeason()
    // re-check whenever the player moves between screens
  }, [profile?.id, screen, syncSeason]) // eslint-disable-line react-hooks/exhaustive-deps

  const notice = profile?.seasonNotice
  return (
    <AnimatePresence>
      {notice && screen !== 'intro' && screen !== 'arena' && (
        <motion.div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div
            className="w-[30rem] rounded-2xl border-2 border-amber-300/70 bg-[#0b0c12] p-8 text-center"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
          >
            <p className="font-display text-xs tracking-[0.5em] text-amber-300">SEASON {notice.ended} HAS ENDED</p>
            <h2 className="font-display mt-2 text-4xl font-black">NEW SEASON!</h2>
            <p className="mt-4 text-white/70">
              You finished the pass at level {notice.level} and earned the title{' '}
              <span className="font-bold text-amber-200">“{notice.title}”</span>. Your rating was softly reset and a fresh pass with
              new Bakugan is waiting.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => {
                  dismiss()
                  openPage('pass')
                }}
                className="font-display border-2 border-amber-300/80 px-6 py-2 tracking-[0.3em] text-amber-200 hover:bg-amber-300/10"
              >
                OPEN PASS
              </button>
              <button onClick={dismiss} className="font-display border border-white/30 px-6 py-2 tracking-[0.3em] hover:bg-white/10">
                LATER
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
