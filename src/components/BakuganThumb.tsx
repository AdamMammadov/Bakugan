import { useEffect, useRef, useState } from 'react'
import type { Entrant } from '../data/bakugan'
import { ELEMENT_BY_ID } from '../data/elements'
import { BakuganPortrait } from './BakuganPortrait'

/** The nearest scrolling ancestor, so pictures a little below the fold start early. */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p)
    if (overflowY === 'auto' || overflowY === 'scroll') return p
  }
  return null
}

/**
 * A Bakugan's picture (current form and skin) that only asks for its 3D snapshot once it scrolls into view, so a big
 * collection does not queue every picture at once. The attribute icon stands in until then.
 */
export function BakuganThumb({ entrant, mirror }: { entrant: Entrant; mirror?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (seen || !el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true)
          io.disconnect()
        }
      },
      { root: scrollParent(el), rootMargin: '200px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [seen])
  const el = ELEMENT_BY_ID[entrant.bakugan.element]
  return (
    <div ref={ref} className="h-full w-full">
      {seen ? (
        <BakuganPortrait entrant={entrant} mirror={mirror} />
      ) : (
        // the same stand-in the portrait shows while its picture is taken
        <div
          className="relative h-full w-full overflow-hidden"
          style={{ background: `radial-gradient(circle at 50% 40%, ${el.color}aa, #07080d 78%)` }}
        >
          <img src={el.icon} alt="" className="absolute inset-[22%] h-[56%] w-[56%] opacity-50" />
        </div>
      )}
    </div>
  )
}
