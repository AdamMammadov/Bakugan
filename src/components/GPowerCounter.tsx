import { animate, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { playSfx } from '../audio/sfx'

export function GPowerCounter({ value, color }: { value: number; color: string }) {
  const [shown, setShown] = useState(value)
  const [delta, setDelta] = useState<{ id: number; amount: number } | null>(null)
  const prev = useRef(value)

  useEffect(() => {
    const from = prev.current
    prev.current = value
    if (from === value) return
    setDelta({ id: Date.now(), amount: value - from })
    let lastTick = 0
    const controls = animate(from, value, {
      duration: 1.2,
      ease: 'easeOut',
      onUpdate: (v) => {
        setShown(Math.round(v))
        const now = performance.now()
        if (now - lastTick > 45) {
          lastTick = now
          playSfx('gPower')
        }
      },
    })
    return () => controls.stop()
  }, [value])

  return (
    <div className="text-right">
      <p className="font-display text-xs tracking-[0.5em] text-white/50">G-POWER</p>
      <motion.p
        key={delta?.id}
        className="font-display text-7xl font-black tabular-nums"
        style={{ color, textShadow: `0 0 24px ${color}` }}
        initial={{ scale: delta ? 1.25 : 1 }}
        animate={{ scale: 1 }}
      >
        {shown}
        <span className="text-4xl">G</span>
      </motion.p>
      {delta && (
        <motion.p
          key={`d${delta.id}`}
          className="font-display text-xl font-bold text-white"
          initial={{ opacity: 1, y: 0 }}
          animate={{ opacity: 0, y: -30 }}
          transition={{ duration: 1.6 }}
        >
          {delta.amount > 0 ? '+' : ''}
          {delta.amount}G
        </motion.p>
      )}
    </div>
  )
}
