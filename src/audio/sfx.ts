import { Howl } from 'howler'
import { useGame } from '../store/useGame'

/**
 * Sound effects. Each one first tries a real file from /public/sounds/<name>.mp3;
 * until that file exists, a synthesized placeholder plays instead.
 */
export type SfxName = 'tick' | 'select' | 'start' | 'gateCard' | 'brawl' | 'ability' | 'gPower'

let ctx: AudioContext | null = null
const files = new Map<SfxName, Howl | null>()

function audio(): AudioContext {
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
    const howl = new Howl({ src: [`/sounds/${name}.mp3`], preload: true })
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
}

export function playSfx(name: SfxName) {
  if (useGame.getState().muted) return
  const file = fileFor(name)
  if (file) file.play()
  else synth[name]()
}
