import { announceLine } from '../audio/sfx'
import { useGame } from '../store/useGame'

/**
 * The stadium announcer: each line shows as a lower-third banner over the arena and is read out by the browser's
 * voice. Its lines wait their turn in the shared speech queue (sfx.ts), so it never talks over a brawler or itself;
 * the banner comes up as the line is said, and a line that waited too long is dropped. With the sound off the lines
 * still come up one after another.
 */
export interface Announcer {
  /** Shows and says a line; `onShow` runs as it comes up. */
  say: (text: string, onShow?: () => void) => void
  dispose: () => void
}

/** With the sound off, each line stays up at least this long before the next one replaces it. */
const SILENT_GAP = 2200

export function createAnnouncer(host: HTMLElement): Announcer {
  // the banner: an "ANNOUNCER" tag and the line, slanted, sliding in just above the hand of cards
  const root = document.createElement('div')
  root.style.cssText =
    'position:absolute;left:50%;bottom:29%;transform:translateX(-50%);pointer-events:none;z-index:5;max-width:min(92vw,720px);'
  const box = document.createElement('div')
  box.style.cssText =
    'display:flex;align-items:stretch;opacity:0;filter:drop-shadow(0 8px 18px rgba(0,0,0,.65));font-family:var(--font-display,sans-serif);'
  const tag = document.createElement('div')
  tag.textContent = 'ANNOUNCER'
  tag.style.cssText =
    'display:flex;align-items:center;padding:0 16px 0 12px;background:linear-gradient(135deg,#ffe066,#ff9d00);color:#1a1000;' +
    'font-size:10px;font-weight:900;letter-spacing:.28em;clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%);'
  const line = document.createElement('div')
  line.style.cssText =
    'position:relative;overflow:hidden;margin-left:-6px;padding:9px 26px 9px 22px;color:#fff;font-size:17px;font-weight:800;' +
    'font-style:italic;letter-spacing:.04em;line-height:1.2;text-transform:uppercase;text-shadow:0 0 12px rgba(255,200,80,.45);' +
    'background:linear-gradient(90deg,rgba(14,16,30,.94),rgba(30,26,52,.9));border-top:2px solid #ffc94a;' +
    'border-bottom:2px solid rgba(255,201,74,.35);clip-path:polygon(8px 0,100% 0,calc(100% - 8px) 100%,0 100%);'
  const text = document.createElement('span')
  // a glint that sweeps across as the line comes in
  const shine = document.createElement('div')
  shine.style.cssText =
    'position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.35) 50%,transparent 70%);transform:translateX(-120%);'
  line.append(text, shine)
  box.append(tag, line)
  root.append(box)
  host.append(root)

  let hideTimer = 0
  let alive = true
  // lines shown without a voice, one after another
  const silentLines: { text: string; onShow?: () => void }[] = []
  let silentTimer = 0
  let silentNext = 0

  const show = (msg: string) => {
    text.textContent = msg
    box.getAnimations().forEach((a) => a.cancel())
    box.animate(
      [
        { opacity: 0, transform: 'translateX(-48px) skewX(-10deg)' },
        { opacity: 1, transform: 'translateX(6px) skewX(-4deg)', offset: 0.7 },
        { opacity: 1, transform: 'none' },
      ],
      { duration: 340, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' },
    )
    shine.animate([{ transform: 'translateX(-120%)' }, { transform: 'translateX(120%)' }], {
      duration: 700,
      delay: 180,
      easing: 'ease-out',
    })
    clearTimeout(hideTimer)
    hideTimer = window.setTimeout(
      () => {
        box.animate(
          [
            { opacity: 1, transform: 'none' },
            { opacity: 0, transform: 'translateX(40px)' },
          ],
          {
            duration: 300,
            easing: 'ease-in',
            fill: 'forwards',
          },
        )
      },
      Math.min(6500, 2000 + msg.length * 55),
    )
  }

  const showSilent = () => {
    silentTimer = 0
    const line = silentLines.shift()
    if (!line || !alive) return
    show(line.text)
    line.onShow?.()
    silentNext = performance.now() + SILENT_GAP
    if (silentLines.length) silentTimer = window.setTimeout(showSilent, SILENT_GAP)
  }

  return {
    say: (msg: string, onShow?: () => void) => {
      const clean = msg.trim()
      if (!clean) return
      if (!useGame.getState().muted && typeof speechSynthesis !== 'undefined')
        return announceLine(clean, () => {
          if (!alive) return
          show(clean)
          onShow?.()
        })
      // no voice: the newest two lines wait their turn on screen
      silentLines.push({ text: clean, onShow })
      while (silentLines.length > 2) silentLines.shift()
      if (!silentTimer) silentTimer = window.setTimeout(showSilent, Math.max(0, silentNext - performance.now()))
    },
    dispose: () => {
      alive = false
      clearTimeout(hideTimer)
      clearTimeout(silentTimer)
      root.remove()
    },
  }
}
