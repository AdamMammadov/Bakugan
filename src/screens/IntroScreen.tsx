import { motion } from 'framer-motion'
import { useEffect } from 'react'
import { asset } from '../asset'
import { playSfx, unlockAudio } from '../audio/sfx'
import { useGame } from '../store/useGame'

export function IntroScreen() {
  const go = useGame((s) => s.go)

  useEffect(() => {
    const start = () => {
      unlockAudio()
      playSfx('start')
      go('wheel')
    }
    window.addEventListener('keydown', start)
    window.addEventListener('pointerdown', start)
    return () => {
      window.removeEventListener('keydown', start)
      window.removeEventListener('pointerdown', start)
    }
  }, [go])

  return (
    <motion.div
      className="bg-grid absolute inset-0 flex flex-col items-center justify-center gap-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.6 }}
    >
      <motion.img
        src={asset('brand/pyrus-logo.webp')}
        alt=""
        draggable={false}
        className="h-32 w-32 object-contain drop-shadow-[0_0_36px_rgba(255,70,40,0.75)]"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: [1, 1.06, 1], opacity: 1 }}
        transition={{ scale: { repeat: Infinity, duration: 2.4, ease: 'easeInOut' }, opacity: { duration: 0.6 } }}
      />
      <div className="text-center">
        <h1 className="font-display text-6xl font-black tracking-[0.2em] text-white">BAKUGAN</h1>
        <p className="font-display mt-3 text-sm tracking-[0.6em] text-white/50">BRAWL VAULT</p>
      </div>
      <motion.p
        className="font-display text-sm tracking-[0.4em] text-white/80"
        animate={{ opacity: [0.25, 1, 0.25] }}
        transition={{ repeat: Infinity, duration: 2 }}
      >
        CLICK OR PRESS ANY KEY
      </motion.p>
      <p className="absolute bottom-4 text-xs text-white/30">
        Non-commercial fan project. Bakugan is a trademark of Spin Master Ltd. and Sega Toys.
      </p>
    </motion.div>
  )
}
