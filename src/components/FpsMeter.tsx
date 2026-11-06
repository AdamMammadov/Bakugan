import { useEffect, useRef, useState } from 'react'

/** Frames per second in the top-left corner (a setting), counted over half-second spans. */
export function FpsMeter() {
  const [fps, setFps] = useState(0)
  const frames = useRef(0)
  useEffect(() => {
    let raf = 0
    let from = performance.now()
    const tick = (now: number) => {
      frames.current++
      if (now - from >= 500) {
        setFps(Math.round((frames.current * 1000) / (now - from)))
        frames.current = 0
        from = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  const color = fps >= 50 ? '#4ade80' : fps >= 30 ? '#facc15' : '#f87171'
  return (
    <div className="font-display pointer-events-none fixed top-2 left-2 z-[70] rounded bg-black/70 px-2 py-0.5 text-[11px] tracking-widest tabular-nums">
      <span style={{ color }}>{fps}</span> <span className="text-white/50">FPS</span>
    </div>
  )
}
