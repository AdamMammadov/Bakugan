/**
 * Scrolls a sideways strip so `item` sits in its middle. Unlike scrollIntoView it moves only the
 * strip, never the page around it, which would throw a page scrolled down back up to the strip.
 */
export function centreInStrip(strip: HTMLElement | null, item: HTMLElement | null) {
  if (!strip || !item) return
  const s = strip.getBoundingClientRect()
  const i = item.getBoundingClientRect()
  strip.scrollLeft += i.left + i.width / 2 - (s.left + s.width / 2)
}
