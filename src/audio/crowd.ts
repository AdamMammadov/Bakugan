import type { CrowdMood } from '../three/stadium'
import { useGame } from '../store/useGame'
import { audio } from './sfx'

/**
 * The stadium crowd, synthesised with WebAudio (no files): a murmur that never stops while the arena is open,
 * and swells on top of it for cheers, roars, boos, gasps and the "Ba-ku-gan!" chant with its claps. It all runs
 * through one quiet bus that sits under the music and the effects, follows the sound on/off switch, and dips
 * while someone is talking.
 */

/** Overall crowd level. */
const LEVEL = 0.55

/** The chant: four bars of "Ba-ku-gan!" then three claps, at this many seconds a beat. */
export const CHANT_BEAT = 0.42
export const CHANT_BARS = 4
/** Beats in each 4-beat bar where the crowd shouts a syllable, and where it claps. */
export const CHANT_SHOUTS = [0, 0.5, 1]
export const CHANT_CLAPS = [2, 2.5, 3]
export const CHANT_LENGTH = CHANT_BEAT * 4 * CHANT_BARS

let bus: GainNode | null = null
let murmur: { stop: () => void } | null = null
let noiseBuf: AudioBuffer | null = null
let users = 0
let timer = 0

const muted = () => useGame.getState().muted
const talking = () => typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking

function out() {
  const a = audio()
  if (!bus) {
    bus = a.createGain()
    bus.gain.value = 0
    bus.connect(a.destination)
  }
  return bus
}

/** Bus level: off when muted or the arena is closed, lower while the announcer or a brawler speaks. */
function level() {
  if (!bus) return
  const a = audio()
  const want = users > 0 && !muted() ? LEVEL * (talking() ? 0.55 : 1) : 0
  bus.gain.setTargetAtTime(want, a.currentTime, 0.15)
}

/** Three seconds of pink noise, shared by every crowd sound. */
function noise() {
  const a = audio()
  if (noiseBuf && noiseBuf.sampleRate === a.sampleRate) return noiseBuf
  noiseBuf = a.createBuffer(1, a.sampleRate * 3, a.sampleRate)
  const d = noiseBuf.getChannelData(0)
  let b0 = 0
  let b1 = 0
  let b2 = 0
  for (let i = 0; i < d.length; i++) {
    const w = Math.random() * 2 - 1
    b0 = 0.99765 * b0 + w * 0.099046
    b1 = 0.963 * b1 + w * 0.2965164
    b2 = 0.57 * b2 + w * 1.0526913
    d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.2
  }
  return noiseBuf
}

function noiseSource(at: number, dur: number) {
  const a = audio()
  const src = a.createBufferSource()
  src.buffer = noise()
  src.loop = true
  src.start(at, Math.random() * 2.5)
  src.stop(at + dur + 0.1)
  return src
}

function filter(type: BiquadFilterType, freq: number, q: number) {
  const f = audio().createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  return f
}

/** Gain that rises to `peak` over `attack`, holds, and fades out over `release`. */
function envelope(at: number, peak: number, attack: number, hold: number, release: number) {
  const g = audio().createGain()
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(peak, at + attack)
  g.gain.setValueAtTime(peak, at + attack + hold)
  g.gain.exponentialRampToValueAtTime(0.0001, at + attack + hold + release)
  return g
}

/** A swell of crowd noise in a band of frequencies. */
function swell(at: number, peak: number, freq: number, q: number, attack: number, hold: number, release: number, sweep = 1) {
  const f = filter('bandpass', freq, q)
  f.frequency.setValueAtTime(freq, at)
  f.frequency.linearRampToValueAtTime(freq * sweep, at + attack + hold)
  const g = envelope(at, peak, attack, hold, release)
  noiseSource(at, attack + hold + release)
    .connect(f)
    .connect(g)
    .connect(out())
}

/** Vowel colours (two formants) a crowd of voices can shout. */
const VOWELS = { a: [780, 1180], e: [480, 1900], o: [480, 860], u: [330, 820] } as const
type Vowel = keyof typeof VOWELS

/**
 * Many people shouting one vowel together: `voices` buzzy voices around `pitch` Hz, each a little out of tune and
 * out of time with the others, through the vowel's formants. `glide` bends the pitch by the end.
 */
function shout(
  at: number,
  vowel: Vowel,
  opts: {
    voices: number
    pitch: number
    peak: number
    attack: number
    hold: number
    release: number
    glide?: number
    spread?: number
  },
) {
  const a = audio()
  const dur = opts.attack + opts.hold + opts.release
  const sum = a.createGain()
  sum.gain.value = 1
  const [f1, f2] = VOWELS[vowel]
  const b1 = filter('bandpass', f1, 5)
  const b2 = filter('bandpass', f2, 7)
  const g2 = a.createGain()
  g2.gain.value = 0.55
  const lp = filter('lowpass', 3200, 0.7)
  sum.connect(b1).connect(lp)
  sum.connect(b2).connect(g2).connect(lp)
  lp.connect(out())
  for (let i = 0; i < opts.voices; i++) {
    const t = at + Math.random() * (opts.spread ?? 0.06)
    const osc = a.createOscillator()
    osc.type = 'sawtooth'
    // men and women in the crowd
    const p = opts.pitch * (i % 3 === 0 ? 1.7 : 1) * (1 + (Math.random() - 0.5) * 0.12)
    osc.frequency.setValueAtTime(p, t)
    osc.frequency.linearRampToValueAtTime(p * (opts.glide ?? 1), t + dur)
    const vib = a.createOscillator()
    vib.frequency.value = 4 + Math.random() * 3
    const depth = a.createGain()
    depth.gain.value = p * 0.02
    vib.connect(depth).connect(osc.frequency)
    const g = envelope(t, opts.peak / Math.sqrt(opts.voices), opts.attack, opts.hold, opts.release)
    osc.connect(g).connect(sum)
    osc.start(t)
    vib.start(t)
    osc.stop(t + dur + 0.05)
    vib.stop(t + dur + 0.05)
  }
}

/** A short burst of noise: a consonant at the start of a shouted syllable, or a clap. */
function burst(at: number, freq: number, q: number, peak: number, len: number) {
  const g = audio().createGain()
  g.gain.setValueAtTime(peak, at)
  g.gain.exponentialRampToValueAtTime(0.0001, at + len)
  noiseSource(at, len)
    .connect(filter('bandpass', freq, q))
    .connect(g)
    .connect(out())
}

/** Hundreds of hands clapping on the same beat: layered claps a few milliseconds apart. */
function claps(at: number, peak: number) {
  for (let i = 0; i < 7; i++)
    burst(at + Math.random() * 0.035, 1100 + Math.random() * 1500, 1.1, peak, 0.05 + Math.random() * 0.04)
}

/** Whistles of a few excited fans. */
function whistle(at: number, peak: number) {
  const a = audio()
  const osc = a.createOscillator()
  osc.type = 'sine'
  const f = 1900 + Math.random() * 900
  osc.frequency.setValueAtTime(f * 0.85, at)
  osc.frequency.exponentialRampToValueAtTime(f * 1.15, at + 0.25)
  osc.frequency.exponentialRampToValueAtTime(f, at + 0.7)
  const g = envelope(at, peak, 0.05, 0.4, 0.3)
  osc.connect(g).connect(out())
  osc.start(at)
  osc.stop(at + 0.8)
}

/** Opens the arena's crowd: the murmur fades in. Returns the way to close it again. */
export function startCrowd() {
  users++
  const a = audio()
  if (!murmur) {
    // babble of thousands of voices: noise through a few voice bands, swaying slowly
    const at = a.currentTime
    const src = a.createBufferSource()
    src.buffer = noise()
    src.loop = true
    const sway = a.createGain()
    sway.gain.value = 0.7
    const lfos = [0.11, 0.23, 4.7, 6.3].map((f, i) => {
      const o = a.createOscillator()
      o.frequency.value = f
      const d = a.createGain()
      d.gain.value = i < 2 ? 0.18 : 0.06
      o.connect(d).connect(sway.gain)
      o.start(at)
      return o
    })
    for (const [freq, q, g] of [
      [420, 0.9, 0.11],
      [1050, 1.2, 0.07],
      [2300, 1.6, 0.03],
    ]) {
      const gain = a.createGain()
      gain.gain.value = g
      src
        .connect(filter('bandpass', freq, q))
        .connect(gain)
        .connect(sway)
    }
    sway.connect(out())
    src.start(at)
    murmur = {
      stop: () => {
        const t = audio().currentTime + 1.5
        src.stop(t)
        lfos.forEach((o) => o.stop(t))
        setTimeout(() => sway.disconnect(), 2000)
      },
    }
    timer = window.setInterval(level, 150)
  }
  level()
  return () => {
    users = Math.max(0, users - 1)
    level()
    if (users === 0 && murmur) {
      murmur.stop()
      murmur = null
      clearInterval(timer)
    }
  }
}

/** The crowd reacts out loud; `strength` 0–1 scales it. */
export function crowdSound(mood: CrowdMood, strength = 1) {
  if (muted() || !bus || users === 0) return
  const a = audio()
  const t = a.currentTime + 0.02
  const k = Math.max(0.2, Math.min(1, strength))
  switch (mood) {
    case 'cheer':
      swell(t, 0.5 * k, 1300, 0.6, 0.25, 0.9, 1.6, 1.2)
      shout(t + 0.05, 'e', {
        voices: 10,
        pitch: 210,
        peak: 0.16 * k,
        attack: 0.12,
        hold: 0.5,
        release: 0.6,
        glide: 1.25,
        spread: 0.3,
      })
      shout(t + 0.6, 'o', { voices: 8, pitch: 260, peak: 0.1 * k, attack: 0.2, hold: 0.3, release: 0.8, glide: 0.8, spread: 0.4 })
      whistle(t + 0.2 + Math.random() * 0.4, 0.035 * k)
      break
    case 'roar':
      swell(t, 0.42 * k, 900, 0.45, 0.2, 1.8, 2.4, 1.3)
      swell(t, 0.2 * k, 220, 0.8, 0.3, 1.4, 2)
      shout(t, 'a', { voices: 14, pitch: 170, peak: 0.15 * k, attack: 0.15, hold: 1.2, release: 1.2, glide: 1.15, spread: 0.25 })
      shout(t + 1, 'o', {
        voices: 10,
        pitch: 230,
        peak: 0.12 * k,
        attack: 0.3,
        hold: 0.6,
        release: 1.2,
        glide: 0.85,
        spread: 0.5,
      })
      whistle(t + 0.3, 0.04 * k)
      whistle(t + 0.9, 0.035 * k)
      break
    case 'boo':
      shout(t, 'u', { voices: 14, pitch: 125, peak: 0.26 * k, attack: 0.35, hold: 1.1, release: 0.9, glide: 0.88, spread: 0.35 })
      swell(t, 0.18 * k, 380, 1.2, 0.35, 1, 0.9)
      break
    case 'gasp':
      // the sharp intake of breath, then an "oh!"
      swell(t, 0.45 * k, 2400, 1.1, 0.06, 0.12, 0.45, 1.5)
      shout(t + 0.18, 'o', {
        voices: 12,
        pitch: 230,
        peak: 0.16 * k,
        attack: 0.08,
        hold: 0.25,
        release: 0.9,
        glide: 0.8,
        spread: 0.12,
      })
      break
    case 'chant':
      for (let bar = 0; bar < CHANT_BARS; bar++) {
        const b = t + bar * 4 * CHANT_BEAT
        ;(['a', 'u', 'a'] as const).forEach((v, i) => {
          const at = b + CHANT_SHOUTS[i] * CHANT_BEAT
          // B-, k-, g- at the start of each syllable
          burst(at, i === 1 ? 2600 : 500, 1, 0.12 * k, 0.04)
          shout(at, v, {
            voices: 10,
            pitch: 175,
            peak: (i === 2 ? 0.22 : 0.16) * k,
            attack: 0.03,
            hold: i === 2 ? 0.28 : 0.1,
            release: 0.12,
            spread: 0.04,
          })
        })
        for (const c of CHANT_CLAPS) claps(b + c * CHANT_BEAT, 0.22 * k)
      }
      break
    case 'calm':
      break
  }
}
