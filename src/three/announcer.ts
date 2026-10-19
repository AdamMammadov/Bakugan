import { useGame } from '../store/useGame'

/**
 * The stadium announcer: each line shows as a lower-third banner over the arena and is read out by the browser's
 * voice. A new line replaces the one on screen; the voice never builds up a backlog (an old line still being read
 * is cut off, and one that could not start in time is dropped). It waits for brawlers who are mid-call instead of
 * talking over them, and stays quiet while the game's sound is off.
 */
export interface Announcer {
  say: (text: string) => void
  dispose: () => void
}

const hasSpeech = () => typeof speechSynthesis !== 'undefined'

/** An energetic English voice: the natural male ones first, then any English voice. */
function announcerVoice(): SpeechSynthesisVoice | undefined {
  const english = speechSynthesis.getVoices().filter((v) => /^en([-_]|$)/i.test(v.lang))
  const prefer = [
    /Microsoft (Guy|Davis|Tony|Jason|Andrew|Brian|Christopher|Eric|Ryan)/i,
    /Google UK English Male/i,
    /\b(Daniel|Alex|Aaron|Arthur|Fred|Rishi|Tom)\b/i,
    /Google US English/i,
    /\bmale\b/i,
  ]
  for (const re of prefer) {
    const v = english.find((x) => re.test(x.name))
    if (v) return v
  }
  return english.find((v) => v.default) ?? english[0]
}

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
  let poll = 0
  let mine: SpeechSynthesisUtterance | null = null
  let waiting: { text: string; at: number } | null = null

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

  const speakNow = (msg: string) => {
    const u = new SpeechSynthesisUtterance(msg)
    u.lang = 'en-US'
    const v = announcerVoice()
    if (v) u.voice = v
    u.rate = 1.05
    u.pitch = 1
    u.volume = 1
    const done = () => {
      if (mine === u) mine = null
    }
    u.onend = done
    u.onerror = done
    mine = u
    speechSynthesis.speak(u)
  }

  // a line that had to wait for a brawler is read once the voice is free, if it is still fresh
  const check = () => {
    if (!waiting) {
      clearInterval(poll)
      poll = 0
      return
    }
    if (useGame.getState().muted || performance.now() - waiting.at > 3500) {
      waiting = null
      return
    }
    if (!speechSynthesis.speaking && !speechSynthesis.pending) {
      const msg = waiting.text
      waiting = null
      speakNow(msg)
    }
  }

  const speak = (msg: string) => {
    if (!hasSpeech() || useGame.getState().muted) return
    const busy = speechSynthesis.speaking || speechSynthesis.pending
    if (!busy) speakNow(msg)
    else if (mine && !speechSynthesis.pending) {
      // only our own previous line is playing: cut it off
      speechSynthesis.cancel()
      speakNow(msg)
    } else {
      // a brawler is talking (or queued): wait for them, keeping just the newest line
      waiting = { text: msg, at: performance.now() }
      poll ||= window.setInterval(check, 120)
    }
  }

  // sound switched off mid-line: stop talking
  const unsubscribe = useGame.subscribe((s) => {
    if (s.muted && mine && hasSpeech()) {
      mine = null
      waiting = null
      speechSynthesis.cancel()
    }
  })

  return {
    say: (msg: string) => {
      const clean = msg.trim()
      if (!clean) return
      show(clean)
      speak(clean)
    },
    dispose: () => {
      clearTimeout(hideTimer)
      clearInterval(poll)
      unsubscribe()
      if (mine && hasSpeech()) speechSynthesis.cancel()
      root.remove()
    },
  }
}
