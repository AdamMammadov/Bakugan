import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { useSettings } from '../store/useSettings'

/** A message about the settings at the top of the screen for a few seconds (e.g. the quality lowered by itself). */
export function SettingsNotice() {
  const notice = useSettings((s) => s.notice)
  const set = useSettings((s) => s.set)
  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => set({ notice: null }), 7000)
    return () => clearTimeout(t)
  }, [notice, set])
  return (
    <AnimatePresence>
      {notice && (
        <motion.div
          className="fixed top-4 left-1/2 z-[65] -translate-x-1/2 rounded-lg border border-amber-300/60 bg-black/85 px-5 py-3 text-sm text-amber-100 shadow-xl backdrop-blur"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
        >
          {notice}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
