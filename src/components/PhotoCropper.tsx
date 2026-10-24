import { useCallback, useEffect, useRef, useState } from 'react'
import { cropPhoto } from '../profile/avatar'

/** The crop area on screen and the round frame inside it (px). */
const VIEW = 320
const RING = 264
const MAX_ZOOM = 4

interface Props {
  /** The picture to crop (an object URL or a data URL). */
  src: string
  color: string
  onDone: (dataUrl: string) => void
  onCancel: () => void
}

/**
 * Lets the player place their face in the round portrait frame: drag the photo, zoom with the slider, the
 * mouse wheel or two fingers. The saved portrait is what shows inside the frame.
 */
export function PhotoCropper({ src, color, onDone, onCancel }: Props) {
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [error, setError] = useState('')
  /** zoom 1 = the photo just covers the frame; x, y = the photo's centre from the frame's centre (screen px). */
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 })
  const area = useRef<HTMLDivElement>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const pinch = useRef<{ dist: number; zoom: number } | null>(null)

  useEffect(() => {
    const image = new Image()
    image.onload = () => {
      setImg(image)
      setView({ zoom: 1, x: 0, y: 0 })
    }
    image.onerror = () => setError('Could not read that image. Try a JPG or PNG.')
    image.src = src
  }, [src])

  const base = img ? RING / Math.min(img.naturalWidth, img.naturalHeight) : 1
  const scale = base * view.zoom

  /** The view moved or zoomed (around the frame's centre), keeping the frame covered by the photo. */
  const fit = useCallback(
    (v: { zoom: number; x: number; y: number }) => {
      if (!img) return v
      const zoom = Math.max(1, Math.min(MAX_ZOOM, v.zoom))
      const s = (RING / Math.min(img.naturalWidth, img.naturalHeight)) * zoom
      const mx = Math.max(0, (img.naturalWidth * s - RING) / 2)
      const my = Math.max(0, (img.naturalHeight * s - RING) / 2)
      return { zoom, x: Math.max(-mx, Math.min(mx, v.x)), y: Math.max(-my, Math.min(my, v.y)) }
    },
    [img],
  )
  const zoomBy = useCallback(
    (k: number) =>
      setView((v) => {
        const zoom = Math.max(1, Math.min(MAX_ZOOM, v.zoom * k))
        return fit({ zoom, x: (v.x * zoom) / v.zoom, y: (v.y * zoom) / v.zoom })
      }),
    [fit],
  )
  const moveBy = (dx: number, dy: number) => setView((v) => fit({ ...v, x: v.x + dx, y: v.y + dy }))

  // the wheel zooms (a native listener, so the page does not scroll meanwhile)
  useEffect(() => {
    const el = area.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomBy(Math.exp(-e.deltaY * 0.0015))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomBy])

  function down(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: view.zoom }
    }
  }
  function move(e: React.PointerEvent) {
    const last = pointers.current.get(e.pointerId)
    if (!last) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const p = pinch.current
    if (pointers.current.size === 2 && p) {
      const [a, b] = [...pointers.current.values()]
      const zoom = (p.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / p.dist
      setView((v) => fit({ zoom, x: (v.x * zoom) / v.zoom, y: (v.y * zoom) / v.zoom }))
    } else moveBy(e.clientX - last.x, e.clientY - last.y)
  }
  function up(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }
  function key(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 20 : 6
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    }
    if (moves[e.key]) {
      e.preventDefault()
      moveBy(...moves[e.key])
    }
    if (e.key === '+' || e.key === '=') zoomBy(1.1)
    if (e.key === '-') zoomBy(1 / 1.1)
  }

  function done() {
    if (!img) return
    const side = RING / scale
    const x = img.naturalWidth / 2 + (-RING / 2 - view.x) / scale
    const y = img.naturalHeight / 2 + (-RING / 2 - view.y) / scale
    onDone(cropPhoto(img, x, y, side))
  }

  const inset = (VIEW - RING) / 2
  return (
    <div className="flex flex-col items-center">
      <div
        ref={area}
        tabIndex={0}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={key}
        aria-label="Drag to place your face in the circle"
        data-testid="photo-crop-area"
        className="relative cursor-grab touch-none overflow-hidden rounded-2xl bg-black outline-none select-none active:cursor-grabbing"
        style={{ width: VIEW, height: VIEW }}
      >
        {img && (
          <img
            src={src}
            alt=""
            draggable={false}
            className="pointer-events-none absolute top-1/2 left-1/2"
            style={{
              width: img.naturalWidth * scale,
              height: img.naturalHeight * scale,
              maxWidth: 'none',
              transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px))`,
            }}
          />
        )}
        {/* everything outside the round frame is dimmed */}
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            left: inset,
            top: inset,
            width: RING,
            height: RING,
            boxShadow: '0 0 0 9999px rgba(5,6,10,0.72)',
            border: `3px solid ${color}`,
          }}
        />
        {!img && (
          <p className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-white/60">
            {error || 'Loading…'}
          </p>
        )}
      </div>
      <p className="mt-3 text-xs text-white/50">Drag to move · scroll or pinch to zoom</p>
      <label className="mt-3 flex w-[320px] items-center gap-3 text-xs text-white/50">
        <span className="font-display tracking-[0.3em]">ZOOM</span>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={view.zoom}
          onChange={(e) => {
            const zoom = Number(e.target.value)
            setView((v) => fit({ zoom, x: (v.x * zoom) / v.zoom, y: (v.y * zoom) / v.zoom }))
          }}
          aria-label="Zoom"
          className="flex-1"
          style={{ accentColor: color }}
        />
      </label>
      <div className="mt-5 flex gap-3">
        <button
          onClick={onCancel}
          className="font-display rounded-md border-2 border-white/25 px-5 py-2.5 text-xs tracking-[0.3em] text-white/70 hover:bg-white/10"
        >
          CANCEL
        </button>
        <button
          onClick={() => setView({ zoom: 1, x: 0, y: 0 })}
          className="font-display rounded-md border-2 border-white/25 px-5 py-2.5 text-xs tracking-[0.3em] text-white/70 hover:bg-white/10"
        >
          RESET
        </button>
        <button
          disabled={!img}
          onClick={done}
          className="font-display rounded-md border-2 px-6 py-2.5 text-xs tracking-[0.3em] transition enabled:hover:bg-white/10 disabled:opacity-40"
          style={{ borderColor: color, background: `${color}33` }}
        >
          USE PHOTO
        </button>
      </div>
    </div>
  )
}
