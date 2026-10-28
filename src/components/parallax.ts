import { useEffect, type RefObject } from 'react'

/**
 * Mouse parallax: keeps `--px` and `--py` (-1…1, the pointer's place across the window) on the element, once a
 * frame at most. Layers inside move by them (the parallax-* classes in index.css), deeper ones less.
 */
export function useParallax(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    let raf = 0
    let x = 0
    let y = 0
    const move = (e: PointerEvent) => {
      x = (e.clientX / window.innerWidth) * 2 - 1
      y = (e.clientY / window.innerHeight) * 2 - 1
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        ref.current?.style.setProperty('--px', x.toFixed(3))
        ref.current?.style.setProperty('--py', y.toFixed(3))
      })
    }
    window.addEventListener('pointermove', move)
    return () => {
      window.removeEventListener('pointermove', move)
      cancelAnimationFrame(raf)
    }
  }, [ref])
}
