/** Glides running per strip: the frame to cancel and where the strip is heading. */
const glides = new WeakMap<HTMLElement, { frame: number; to: number }>()

/** Where a gliding strip is heading (its scroll position when it is still). */
export const stripTarget = (strip: HTMLElement) => glides.get(strip)?.to ?? strip.scrollLeft

/** Stops a glide where it is (before the player scrolls the strip themselves). */
export function stopGlide(strip: HTMLElement) {
  const g = glides.get(strip)
  if (g) cancelAnimationFrame(g.frame)
  glides.delete(strip)
}

/**
 * Scrolls a strip sideways to `left`, eased over a time that grows with the distance. Done frame by frame
 * rather than with the browser's smooth scrolling, which some browsers skip or cut short.
 */
export function glideStrip(strip: HTMLElement, left: number) {
  // already moving: carry on at speed (ease out) instead of starting slow again
  const moving = glides.has(strip)
  stopGlide(strip)
  const from = strip.scrollLeft
  const to = Math.max(0, Math.min(left, strip.scrollWidth - strip.clientWidth))
  const ms = Math.min(1100, 280 + Math.abs(to - from) * 0.3)
  const start = performance.now()
  const step = (now: number) => {
    const k = Math.min(1, Math.max(0, (now - start) / ms))
    const ease = moving ? 1 - (1 - k) ** 2 : k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2
    strip.scrollLeft = from + (to - from) * ease
    if (k < 1) glides.set(strip, { frame: requestAnimationFrame(step), to })
    else glides.delete(strip)
  }
  glides.set(strip, { frame: requestAnimationFrame(step), to })
}

/**
 * Scrolls a sideways strip so `item` sits in its middle, at once or gliding there ('smooth'). Unlike
 * scrollIntoView it moves only the strip, never the page around it, which would throw a page scrolled
 * down back up to the strip.
 */
export function centreInStrip(strip: HTMLElement | null, item: HTMLElement | null, behavior: 'instant' | 'smooth' = 'instant') {
  if (!strip || !item) return
  const s = strip.getBoundingClientRect()
  const i = item.getBoundingClientRect()
  const left = strip.scrollLeft + i.left + i.width / 2 - (s.left + s.width / 2)
  if (behavior === 'smooth') glideStrip(strip, left)
  else {
    stopGlide(strip)
    strip.scrollLeft = left
  }
}
