import { Howl } from 'howler'
import { asset } from '../asset'
import { DEFAULT_VOICE } from '../profile/avatar'
import { useGame } from '../store/useGame'
import { ANNOUNCER, deliveryFor, speakerOf, type Delivery, type SpeakerVoice } from './voices'

/**
 * Sound effects. Each one first tries a real file from /public/sounds/<name>.mp3;
 * until that file exists, a synthesized placeholder plays instead.
 */
export type SfxName = 'tick' | 'select' | 'start' | 'gateCard' | 'brawl' | 'ability' | 'gPower' | 'hit' | 'victory' | 'defeat'

let ctx: AudioContext | null = null
const files = new Map<SfxName, Howl | null>()

export function audio(): AudioContext {
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Must be called from a user gesture so the browser allows playback. */
export function unlockAudio() {
  audio()
}

function fileFor(name: SfxName): Howl | null {
  if (!files.has(name)) {
    const howl = new Howl({ src: [asset(`sounds/${name}.mp3`)], preload: true })
    howl.once('loaderror', () => files.set(name, null))
    files.set(name, howl)
  }
  const howl = files.get(name) ?? null
  return howl && howl.state() === 'loaded' ? howl : null
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, at = 0, slideTo?: number) {
  const a = audio()
  const t = a.currentTime + at
  const osc = a.createOscillator()
  const g = a.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(a.destination)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

function noise(dur: number, gain: number, from: number, to: number, at = 0) {
  const a = audio()
  const t = a.currentTime + at
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = a.createBufferSource()
  src.buffer = buf
  const filter = a.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 1.2
  filter.frequency.setValueAtTime(from, t)
  filter.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = a.createGain()
  g.gain.setValueAtTime(gain, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(filter).connect(g).connect(a.destination)
  src.start(t)
}

const synth: Record<SfxName, () => void> = {
  tick: () => {
    tone(1800, 0.05, 'square', 0.05)
    noise(0.04, 0.08, 4000, 2500)
  },
  select: () => {
    tone(440, 0.18, 'sawtooth', 0.08, 0, 880)
    tone(660, 0.3, 'triangle', 0.1, 0.08)
    tone(990, 0.45, 'triangle', 0.08, 0.16)
  },
  start: () => {
    noise(0.6, 0.25, 300, 3000)
    tone(110, 0.6, 'sawtooth', 0.08, 0, 440)
  },
  gateCard: () => {
    noise(0.35, 0.2, 2000, 400)
    tone(220, 0.3, 'square', 0.05, 0.25, 110)
  },
  brawl: () => {
    noise(1.2, 0.3, 200, 5000)
    tone(80, 1.2, 'sawtooth', 0.12, 0, 320)
    tone(523, 0.6, 'triangle', 0.08, 0.6)
    tone(784, 0.8, 'triangle', 0.08, 0.75)
  },
  ability: () => {
    tone(330, 0.25, 'square', 0.06, 0, 660)
    tone(660, 0.25, 'square', 0.06, 0.12, 1320)
    noise(0.6, 0.18, 800, 6000, 0.2)
  },
  gPower: () => tone(1200, 0.03, 'square', 0.025),
  hit: () => {
    noise(0.35, 0.35, 1800, 120)
    tone(90, 0.3, 'sine', 0.25, 0, 40)
  },
  victory: () => {
    ;[523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, 'triangle', 0.1, i * 0.12))
  },
  defeat: () => {
    ;[392, 330, 262].forEach((f, i) => tone(f, 0.6, 'sawtooth', 0.06, i * 0.2))
  },
}

export function playSfx(name: SfxName) {
  if (useGame.getState().muted) return
  const file = fileFor(name)
  if (file) file.play()
  else synth[name]()
}

// ---------------------------------------------------------------- speech

/**
 * Everyone who talks (the brawlers and the announcer) shares one queue, so nobody talks over anybody: a line starts
 * only once the last one has ended. The queue stays short and fresh, so the voices keep up with the action: a line
 * that waited too long is dropped, and when too many pile up the oldest announcer lines go first.
 */
interface Line {
  text: string
  delivery: Delivery
  /** When it was asked for, and how long it stays worth saying (ms). */
  at: number
  ttl: number
  /** An announcer line: it gives way to the brawlers' calls. */
  minor: boolean
  /** Runs as the line starts (or right away if it cannot be spoken), e.g. to show it on screen. */
  onStart?: () => void
}

/** Lines waiting at most (the one being spoken not counted). */
const QUEUE_MAX = 3
/** How long a brawler's call and an announcer line stay worth saying. */
const CALL_TTL = 3500
const LINE_TTL = 5000

const queue: Line[] = []
let talking: { u: SpeechSynthesisUtterance; timer: number } | null = null

const hasSpeech = () => typeof speechSynthesis !== 'undefined'
const silent = () => useGame.getState().muted || !hasSpeech()

/** About how long a line takes to say (ms), for when a voice never reports that it ended. */
const lengthOf = (text: string, rate: number) => (text.split(/\s+/).length / (2.6 * rate)) * 1000 + 800

function pump() {
  if (talking || !hasSpeech()) return
  const now = performance.now()
  let line = queue.shift()
  while (line && now - line.at > line.ttl) line = queue.shift()
  if (!line) return
  if (silent()) {
    line.onStart?.()
    queue.splice(0).forEach((l) => l.onStart?.())
    return
  }
  const u = new SpeechSynthesisUtterance(line.text)
  u.lang = 'en-US'
  const d = line.delivery
  if (d.voice) {
    u.voice = d.voice
    u.lang = d.voice.lang
  }
  u.pitch = d.pitch
  u.rate = d.rate
  u.volume = 1
  const done = () => {
    if (talking?.u !== u) return
    clearTimeout(talking.timer)
    talking = null
    pump()
  }
  u.onend = done
  u.onerror = done
  // a voice that never says it has ended does not hold up everyone else
  const timer = window.setTimeout(
    () => {
      if (talking?.u !== u) return
      speechSynthesis.cancel()
      done()
    },
    lengthOf(line.text, d.rate) * 1.5 + 1500,
  )
  talking = { u, timer }
  line.onStart?.()
  speechSynthesis.speak(u)
}

function enqueue(line: Line) {
  if (silent()) return line.onStart?.()
  // a brawler's call goes ahead of announcer lines still waiting: it belongs to what happens now
  const at = line.minor ? queue.length : queue.findIndex((l) => l.minor)
  queue.splice(at < 0 ? queue.length : at, 0, line)
  while (queue.length > QUEUE_MAX) {
    const i = queue.findIndex((l) => l.minor)
    queue.splice(i >= 0 ? i : 0, 1)
  }
  pump()
}

/**
 * A brawler calls out loud ("Ability activate! Dual Gazer!") in their own voice: every character (and every CPU
 * brawler, by name) has a browser voice, pitch and pace of their own (see voices.ts). A voice from the character
 * list is recognised as that character; `id` or `name` on the voice names the speaker for anyone else.
 */
export function shout(text: string, voice: SpeakerVoice = DEFAULT_VOICE) {
  if (silent()) return
  enqueue({ text, delivery: deliveryFor(speakerOf(voice), voice), at: performance.now(), ttl: CALL_TTL, minor: false })
}

/** The announcer says a line in its own voice; `onStart` runs as it starts (or at once when the sound is off). */
export function announceLine(text: string, onStart?: () => void) {
  enqueue({ text, delivery: deliveryFor(ANNOUNCER), at: performance.now(), ttl: LINE_TTL, minor: true, onStart })
}

/** Someone is talking, or a fresh line is waiting to be said. */
export function speaking() {
  if (talking) return true
  const now = performance.now()
  return queue.some((l) => now - l.at <= l.ttl)
}

/** Runs `fn` once everyone has finished talking (or after `maxMs` at the latest). */
export function afterSpeech(fn: () => void, maxMs = 4000, minMs = 0): () => void {
  const start = performance.now()
  let timer = 0
  const tick = () => {
    const t = performance.now() - start
    if (t >= maxMs || (t >= minMs && !speaking())) fn()
    else timer = window.setTimeout(tick, 120)
  }
  timer = window.setTimeout(tick, Math.min(minMs, 150))
  return () => clearTimeout(timer)
}

/** Stops every line, said or waiting, e.g. when leaving the arena. */
export function hush() {
  queue.length = 0
  if (talking) clearTimeout(talking.timer)
  talking = null
  if (hasSpeech()) speechSynthesis.cancel()
}

// the sound switched off mid-line: stop talking
useGame.subscribe((s, prev) => {
  if (s.muted && !prev.muted) hush()
})
