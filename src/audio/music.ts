import { useGame } from '../store/useGame'
import { audio } from './sfx'

/**
 * Background music, synthesised live with WebAudio (no files to download). Each part of the
 * game has its own theme so the same tune does not follow the player everywhere; it ducks while
 * the brawlers are talking.
 */
export type Track = 'menu' | 'home' | 'gallery' | 'shop' | 'anthem' | 'faceoff' | 'battle'

interface Song {
  bpm: number
  /** Chord roots as MIDI notes, one per bar, with minor/major quality. */
  chords: [number, 'min' | 'maj'][]
  kick: number[]
  snare: number[]
  hat: number[]
  /** Bass pattern: step → interval above the chord root (in octaves below). */
  bass: Record<number, number>
  /** Arpeggio steps (16th notes) playing chord tones; empty for none. */
  arp: number[]
  pad: boolean
  /** Melody: step → chord tone (0 root, 1 third, 2 fifth, 3 octave), so it always fits the harmony. */
  lead?: Record<number, number>
  /** Melody on every bar instead of every other one. */
  leadEveryBar?: boolean
  leadWave?: OscillatorType
  arpWave?: OscillatorType
}

const SONGS: Record<Track, Song> = {
  menu: {
    bpm: 88,
    chords: [
      [57, 'min'],
      [53, 'maj'],
      [48, 'maj'],
      [55, 'maj'],
    ],
    kick: [0, 8],
    snare: [],
    hat: [2, 6, 10, 14],
    bass: { 0: 0, 6: 0, 8: 7, 12: 0 },
    arp: [0, 2, 4, 6, 8, 10, 12, 14],
    pad: true,
  },
  // the attribute wheel, the attribute pages and the 3D viewer: a light adventure theme in G
  home: {
    bpm: 104,
    chords: [
      [55, 'maj'],
      [52, 'min'],
      [48, 'maj'],
      [50, 'maj'],
    ],
    kick: [0, 10],
    snare: [8],
    hat: [2, 6, 10, 14],
    bass: { 0: 0, 3: 7, 8: 0, 11: 12, 14: 7 },
    arp: [0, 2, 4, 6, 8, 10, 12, 14],
    arpWave: 'sine',
    pad: true,
    lead: { 0: 2, 4: 3, 6: 2, 8: 1, 12: 0 },
    leadWave: 'triangle',
  },
  // encyclopedia and showrooms: slow and spacious, for reading and looking around
  gallery: {
    bpm: 72,
    chords: [
      [50, 'min'],
      [53, 'maj'],
      [48, 'maj'],
      [45, 'min'],
    ],
    kick: [],
    snare: [],
    hat: [4, 12],
    bass: { 0: 0, 8: 7 },
    arp: [0, 6, 12],
    arpWave: 'sine',
    pad: true,
  },
  // shop and inventory: a bouncy groove in C
  shop: {
    bpm: 112,
    chords: [
      [48, 'maj'],
      [45, 'min'],
      [53, 'maj'],
      [55, 'maj'],
    ],
    kick: [0, 6, 8],
    snare: [4, 12],
    hat: [2, 6, 10, 14],
    bass: { 0: 0, 3: 0, 6: 12, 8: 7, 11: 0, 14: 12 },
    arp: [],
    pad: false,
    lead: { 0: 0, 2: 1, 4: 2, 7: 3, 10: 2, 12: 1 },
    leadEveryBar: true,
    leadWave: 'triangle',
  },
  // profile, Season Pass, rankings and clans: a proud anthem in B-flat
  anthem: {
    bpm: 94,
    chords: [
      [46, 'maj'],
      [53, 'maj'],
      [55, 'min'],
      [51, 'maj'],
    ],
    kick: [0, 8],
    snare: [4, 12],
    hat: [0, 4, 8, 12],
    bass: { 0: 0, 4: 0, 8: 7, 12: 12 },
    arp: [],
    pad: true,
    lead: { 0: 0, 4: 1, 8: 2, 12: 3 },
    leadWave: 'sawtooth',
  },
  // team face-off: tense, a pulse building up to the brawl
  faceoff: {
    bpm: 120,
    chords: [
      [52, 'min'],
      [52, 'min'],
      [48, 'maj'],
      [47, 'maj'],
    ],
    kick: [0, 4, 8, 12],
    snare: [],
    hat: [2, 6, 10, 14],
    bass: { 0: 0, 2: 0, 4: 0, 6: 0, 8: 0, 10: 0, 12: 0, 14: 0 },
    arp: [0, 3, 6, 9, 12],
    pad: true,
  },
  battle: {
    bpm: 132,
    // D minor: i – VI – VII – i
    chords: [
      [50, 'min'],
      [46, 'maj'],
      [48, 'maj'],
      [50, 'min'],
    ],
    kick: [0, 4, 8, 12],
    snare: [4, 12],
    hat: [0, 2, 4, 6, 8, 10, 12, 14, 15],
    bass: { 0: 0, 2: 0, 4: 0, 6: 12, 8: 0, 10: 0, 12: 7, 14: 12 },
    arp: [],
    pad: true,
    lead: { 0: 2, 3: 1, 6: 0, 8: 1, 10: 2, 12: 3 },
  },
}

const LOOKAHEAD = 0.12
const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12)
const triad = (root: number, q: 'min' | 'maj') => [root, root + (q === 'min' ? 3 : 4), root + 7]

let current: Track | null = null
/** Each track plays into its own bus, so the old one can fade out cleanly when the track changes. */
let bus: GainNode | null = null
let master: DynamicsCompressorNode | null = null
let timer = 0
let step = 0
let nextTime = 0

function out(): GainNode {
  const a = audio()
  if (!master) {
    master = a.createDynamicsCompressor()
    master.connect(a.destination)
  }
  if (!bus) {
    bus = a.createGain()
    bus.gain.value = 0
    bus.connect(master)
  }
  return bus
}

/** Fades the current bus out and drops it, together with every note already scheduled on it. */
function retireBus() {
  if (!bus) return
  const old = bus
  bus = null
  const a = audio()
  old.gain.cancelScheduledValues(a.currentTime)
  old.gain.setTargetAtTime(0, a.currentTime, 0.15)
  window.setTimeout(() => old.disconnect(), 1500)
}

function voice(type: OscillatorType, freq: number, at: number, dur: number, gain: number, cutoff = 4000, attack = 0.01) {
  const a = audio()
  const osc = a.createOscillator()
  const f = a.createBiquadFilter()
  const g = a.createGain()
  osc.type = type
  osc.frequency.value = freq
  f.type = 'lowpass'
  f.frequency.value = cutoff
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  osc.connect(f).connect(g).connect(out())
  osc.start(at)
  osc.stop(at + dur + 0.05)
}

function drum(kind: 'kick' | 'snare' | 'hat', at: number) {
  const a = audio()
  if (kind === 'kick') {
    const osc = a.createOscillator()
    const g = a.createGain()
    osc.frequency.setValueAtTime(140, at)
    osc.frequency.exponentialRampToValueAtTime(40, at + 0.18)
    g.gain.setValueAtTime(0.9, at)
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.25)
    osc.connect(g).connect(out())
    osc.start(at)
    osc.stop(at + 0.3)
    return
  }
  const len = kind === 'snare' ? 0.18 : 0.05
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * len), a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  const src = a.createBufferSource()
  src.buffer = buf
  const f = a.createBiquadFilter()
  f.type = kind === 'snare' ? 'bandpass' : 'highpass'
  f.frequency.value = kind === 'snare' ? 1800 : 7000
  const g = a.createGain()
  g.gain.setValueAtTime(kind === 'snare' ? 0.5 : 0.18, at)
  g.gain.exponentialRampToValueAtTime(0.0001, at + len)
  src.connect(f).connect(g).connect(out())
  src.start(at)
}

function schedule(song: Song, s: number, at: number) {
  const sixteenth = 60 / song.bpm / 4
  const bar = Math.floor(s / 16) % song.chords.length
  const i = s % 16
  const [root, q] = song.chords[bar]
  const notes = triad(root, q)
  if (song.kick.includes(i)) drum('kick', at)
  if (song.snare.includes(i)) drum('snare', at)
  if (song.hat.includes(i)) drum('hat', at)
  if (i in song.bass) voice('sawtooth', midi(root - 24 + song.bass[i]), at, sixteenth * 1.8, 0.22, 600)
  if (song.pad && i === 0) notes.forEach((n) => voice('sawtooth', midi(n), at, sixteenth * 16, 0.045, 1400, 0.6))
  if (song.arp.includes(i))
    voice(song.arpWave ?? 'triangle', midi(notes[Math.floor(i / 2) % 3] + 12), at, sixteenth * 1.6, 0.07, 3000)
  if (song.lead && i in song.lead && (song.leadEveryBar || bar % 2 === 1)) {
    const tone = song.lead[i]
    const note = tone === 3 ? root + 12 : notes[tone]
    voice(song.leadWave ?? 'square', midi(note + 12), at, sixteenth * 1.5, 0.045, 2200)
  }
}

function speaking() {
  return typeof speechSynthesis !== 'undefined' && speechSynthesis.speaking
}

function tick() {
  const song = current && SONGS[current]
  if (!song) return
  const a = audio()
  const sixteenth = 60 / song.bpm / 4
  while (nextTime < a.currentTime + LOOKAHEAD) {
    schedule(song, step, nextTime)
    nextTime += sixteenth
    step++
  }
  // music level: off when muted, quieter while someone is talking
  const muted = useGame.getState().muted || !useGame.getState().music
  const level = muted ? 0 : speaking() ? 0.12 : 0.32
  out().gain.setTargetAtTime(level, a.currentTime, 0.25)
}

/** Switches the background track (null stops the music). */
export function playMusic(track: Track | null) {
  if (track === current) return
  current = track
  clearInterval(timer)
  retireBus()
  if (!track) return
  step = 0
  nextTime = audio().currentTime + 0.1
  timer = window.setInterval(tick, 40)
  tick()
}
