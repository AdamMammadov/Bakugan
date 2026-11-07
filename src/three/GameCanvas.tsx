import { Canvas, type CanvasProps, type RootState } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import { lowerQuality, useQuality, useSettings } from '../store/useSettings'

/** How long a lost drawing context may take to come back by itself before a new canvas replaces it. */
const WAIT_MS = 1200
/** New canvases in a minute before giving up (the browser keeps dropping them: 3D is failing on this computer). */
const MAX_TRIES = 3

/**
 * A 3D canvas that comes back by itself when the browser drops its drawing (WebGL) context, as a browser may after a
 * heavy scene or when the graphics card resets: the scene would otherwise stay black for good. If it keeps happening,
 * it says so and offers a reload instead of a black screen.
 */
export function GameCanvas({ onCreated, gl, ...props }: CanvasProps) {
  const quality = useQuality()
  const [generation, setGeneration] = useState(0)
  const [failed, setFailed] = useState(false)
  const current = useRef<HTMLCanvasElement | null>(null)
  const mounted = useRef(true)
  const tries = useRef<number[]>([])
  const timer = useRef(0)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      clearTimeout(timer.current)
    }
  }, [])

  const created = useCallback(
    (state: RootState) => {
      const canvas = state.gl.domElement
      current.current = canvas
      canvas.addEventListener('webglcontextlost', (e) => {
        // a canvas closed on purpose (the page left, or replaced below) drops its context too: not a failure
        if (!mounted.current || canvas !== current.current) return
        // asks the browser to give the context back
        e.preventDefault()
        clearTimeout(timer.current)
        timer.current = window.setTimeout(() => {
          // (a canvas replaced on purpose, e.g. for another quality, has left the page by now)
          if (!mounted.current || canvas !== current.current || !canvas.isConnected) return
          // the graphics could not keep up: one quality step down (the new canvas comes with it), and say so
          const settings = useSettings.getState()
          const lower = lowerQuality(settings.quality)
          if (lower) {
            settings.set({
              quality: lower,
              notice: `The 3D stopped drawing at ${settings.quality.toUpperCase()} quality: switched to ${lower.toUpperCase()}.`,
            })
            return
          }
          const now = Date.now()
          tries.current = [...tries.current.filter((t) => now - t < 60_000), now]
          if (tries.current.length > MAX_TRIES) setFailed(true)
          else setGeneration((g) => g + 1)
        }, WAIT_MS)
      })
      canvas.addEventListener('webglcontextrestored', () => clearTimeout(timer.current))
      onCreated?.(state)
    },
    [onCreated],
  )

  if (failed) return <Stopped />
  // a new canvas for each quality: anti-aliasing is only set when a canvas is made
  return (
    <Canvas
      key={`${generation}-${quality.quality}`}
      {...props}
      gl={{ ...quality.gl, ...(typeof gl === 'object' && gl ? gl : {}) }}
      onCreated={created}
    />
  )
}

function Stopped() {
  const setOpen = useSettings((s) => s.setOpen)
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="max-w-md rounded-xl border border-white/15 bg-black/70 p-6 text-center backdrop-blur">
        <p className="font-display text-lg font-black tracking-[0.2em]">3D STOPPED DRAWING</p>
        <p className="mt-2 text-sm text-white/65">
          The browser stopped drawing the 3D scenes. Reload the game; if it happens again, set the graphics to LOW in the
          settings.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button
            onClick={() => location.reload()}
            className="font-display skew-x-[-10deg] border-2 border-white/70 bg-white/10 px-6 py-2 text-xs font-black tracking-[0.3em] hover:bg-white/20"
          >
            RELOAD
          </button>
          <button
            onClick={() => setOpen(true)}
            className="font-display skew-x-[-10deg] border-2 border-white/30 bg-black/30 px-6 py-2 text-xs font-black tracking-[0.3em] hover:bg-white/10"
          >
            ⚙ SETTINGS
          </button>
        </div>
      </div>
    </div>
  )
}
