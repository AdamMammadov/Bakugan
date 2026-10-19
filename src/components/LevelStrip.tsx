import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { centreInStrip, glideStrip, stopGlide, stripTarget } from './strip'

const card = (strip: HTMLElement, level: number) => strip.querySelector<HTMLElement>(`[data-level="${level}"]`)

/**
 * A sideways row of levels (children carry data-level="n"). It opens with `from` in the middle and, when
 * `focus` is further on (a level-up), glides on to it. ◀ ▶ move a page at a time (held, they keep going);
 * the mouse wheel and dragging scroll it too. Only the strip ever scrolls, never the page around it.
 */
export function LevelStrip({
  from,
  focus,
  title,
  children,
}: {
  from: number
  focus: number
  title: React.ReactNode
  children: React.ReactNode
}) {
  const strip = useRef<HTMLDivElement>(null)
  const [ends, setEnds] = useState({ start: true, end: false, away: false })
  const focused = useRef(focus)
  const check = useCallback(() => {
    const el = strip.current
    if (!el) return
    const start = el.scrollLeft <= 2
    const end = el.scrollLeft >= el.scrollWidth - el.clientWidth - 2
    // the focus level scrolled out of sight: offer the way back
    const c = card(el, focused.current)
    const s = el.getBoundingClientRect()
    const r = c?.getBoundingClientRect()
    const away = !!r && (r.right < s.left + 40 || r.left > s.right - 40)
    setEnds((e) => (e.start === start && e.end === end && e.away === away ? e : { start, end, away }))
  }, [])
  useEffect(() => {
    focused.current = focus
  }, [focus])

  // where the strip stands: opens at `from` straight away, then glides to each new focus
  const shown = useRef<number | null>(null)
  useLayoutEffect(() => {
    const el = strip.current
    if (!el) return
    if (shown.current === null) {
      shown.current = from
      centreInStrip(el, card(el, from))
      check()
    }
    if (focus === shown.current) return
    const t = window.setTimeout(() => {
      centreInStrip(el, card(el, focus), 'smooth')
      shown.current = focus
    }, 500)
    return () => clearTimeout(t)
  }, [from, focus, check])

  // ◀ ▶: a page per press; held down, the row keeps paging on until let go
  const held = useRef(0)
  const release = useCallback(() => clearTimeout(held.current), [])
  useEffect(() => release, [release])
  const page = (dir: number) => {
    const el = strip.current
    const first = el && card(el, 1)
    if (!el || !first) return
    const step = first.offsetWidth + parseFloat(getComputedStyle(el).columnGap || '0')
    const by = Math.max(1, Math.floor((el.clientWidth * 0.8) / step)) * step
    // from where a glide is heading, so quick presses add up
    glideStrip(el, stripTarget(el) + dir * by)
  }
  const press = (dir: number) => {
    release()
    page(dir)
    const again = (wait: number) =>
      (held.current = window.setTimeout(() => {
        page(dir)
        again(320)
      }, wait))
    again(450)
  }

  // the mouse wheel scrolls the row sideways, unless the page is already scrolling or the row is at its end
  useEffect(() => {
    const el = strip.current
    if (!el) return
    const pageEl = el.parentElement?.closest<HTMLElement>('.overflow-y-auto')
    let pageMoved = 0
    const onPageScroll = () => (pageMoved = performance.now())
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return
      const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY
      const room = dy < 0 ? el.scrollLeft > 1 : el.scrollLeft < el.scrollWidth - el.clientWidth - 1
      if (!room || performance.now() - pageMoved < 250) return
      e.preventDefault()
      stopGlide(el)
      el.scrollLeft += dy
    }
    pageEl?.addEventListener('scroll', onPageScroll, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      pageEl?.removeEventListener('scroll', onPageScroll)
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  // dragging with the mouse (touch scrolls on its own); a drag does not count as a click on a card
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null)
  const dragged = useRef(false)

  const arrow = (dir: number) => (
    <button
      aria-label={dir < 0 ? 'Earlier levels' : 'Later levels'}
      onPointerDown={(e) => e.button === 0 && press(dir)}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      // keyboard presses (no pointer)
      onClick={(e) => e.detail === 0 && page(dir)}
      className={`absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/75 text-sm text-white/85 shadow-lg backdrop-blur transition hover:border-white/60 hover:bg-white/15 hover:text-white ${
        dir < 0 ? 'left-0' : 'right-0'
      } ${(dir < 0 ? ends.start : ends.end) ? 'pointer-events-none opacity-0' : 'opacity-100'}`}
    >
      {dir < 0 ? '◀' : '▶'}
    </button>
  )

  return (
    <div>
      <div className="mb-2 flex h-7 items-center justify-between gap-4">
        {title}
        {ends.away && (
          <button
            onClick={() => centreInStrip(strip.current, strip.current && card(strip.current, focus), 'smooth')}
            className="font-display rounded-full border border-white/25 px-3 py-1 text-[10px] tracking-[0.3em] text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            ◎ BACK TO LEVEL {focus}
          </button>
        )}
      </div>
      <div className="relative">
        <div
          ref={strip}
          onScroll={check}
          onPointerDown={(e) => {
            if (e.pointerType !== 'mouse' || e.button !== 0) return
            stopGlide(e.currentTarget)
            drag.current = { x: e.clientX, left: e.currentTarget.scrollLeft, moved: false }
          }}
          onPointerMove={(e) => {
            const d = drag.current
            if (!d || !(e.buttons & 1)) return
            const dx = e.clientX - d.x
            if (!d.moved && Math.abs(dx) < 6) return
            if (!d.moved) e.currentTarget.setPointerCapture(e.pointerId)
            d.moved = true
            e.currentTarget.scrollLeft = d.left - dx
          }}
          onPointerUp={() => {
            dragged.current = !!drag.current?.moved
            drag.current = null
            window.setTimeout(() => (dragged.current = false))
          }}
          onClickCapture={(e) => {
            if (!dragged.current) return
            e.stopPropagation()
            e.preventDefault()
          }}
          className="no-scrollbar flex cursor-grab gap-3 overflow-x-auto px-14 pt-3 pb-4 active:cursor-grabbing"
          style={{
            maskImage: `linear-gradient(to right, ${ends.start ? '#000 0' : 'transparent 0, #000 56px'}, ${
              ends.end ? '#000 100%' : '#000 calc(100% - 56px), transparent 100%'
            })`,
          }}
        >
          {children}
        </div>
        {arrow(-1)}
        {arrow(1)}
      </div>
    </div>
  )
}
