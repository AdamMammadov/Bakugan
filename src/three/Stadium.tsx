import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { asset } from '../asset'
import { CHANT_BARS, CHANT_BEAT, CHANT_CLAPS, CHANT_LENGTH, CHANT_SHOUTS, crowdSound, startCrowd } from '../audio/crowd'
import { ELEMENT_BY_ID, type ElementId } from '../data/elements'
import { CHARACTERS } from '../profile/avatar'
import { createAnnouncer, type Announcer } from './announcer'
import { Crowd, type CrowdLevels, type Seat } from './Crowd'
import { listenStadium, type CrowdMood, type StadiumCall } from './stadium'

/**
 * The stadium round the field, like the brawl arenas of the anime: terraced stands all the way round, packed with
 * fans who cheer, jump, boo, gasp, clap and do the wave (each half of the stands backing one brawler, in their
 * attribute's colour), cut-outs of famous brawlers in the front row, name banners, light towers, and a screen
 * that shows what the announcer calls. It listens to the battle's calls on the stadium bus (stadium.ts).
 * Sizes are for the usual view; `scale` grows it with the view when a giant Bakugan is on the field.
 */

/** Radius of the wall round the field. */
export const FIELD_RADIUS = 100
const ROWS = 9
const ROW_START = 103
const ROW_DEPTH = 5
const ROW_RISE = 3.4
const WALL = 6
const BACK = ROW_START + ROWS * ROW_DEPTH
const BACK_TOP = WALL + ROWS * ROW_RISE + 12
const TOWERS = 8
const TOWER_R = BACK + 10
const TOWER_H = 82

/** Seeded random numbers, so the stands look the same every time. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Angle round the stadium (0 = the far end, behind the field; positive towards the opponent's side). */
const at = (angle: number, r: number, y = 0) => new THREE.Vector3(Math.sin(angle) * r, y, -Math.cos(angle) * r)

const SHIRTS = ['#eeeef2', '#2a2e3a', '#d43c3c', '#3b6fd6', '#f2c230', '#3fae5a', '#9a4fd8', '#f07a2a', '#e85aa8', '#36b7c9']
const SKINS = ['#f6d2b4', '#ebbd93', '#cf9466', '#9a6542', '#6a4129', '#fde3cc']

/** The famous brawlers who came to watch (cut-outs in the front row), and where they stand. */
const VIP_ANGLES = [-0.36, 0.36, -0.95, 0.95, -0.66, 0.66, -1.3, 1.3]
/** Names on the banners round the top of the stands. */
const BANNERS: [string, ElementId | null][] = [
  ['GO DAN!', 'pyrus'],
  ['RUNO', 'haos'],
  ['MARUCHO', 'aquos'],
  ['SHUN', 'ventus'],
  ['JULIE ♥ GOREM', 'subterra'],
  ['ALICE', 'darkus'],
  ['KLAUS', 'aquos'],
  ['JOE', 'haos'],
  ['BILLY', 'subterra'],
  ['CHAN LEE', 'pyrus'],
  ['JULIO', 'haos'],
  ['KOMBA', 'ventus'],
  ['ACE', 'darkus'],
  ['BARON', 'haos'],
  ['MIRA', 'subterra'],
  ['SPECTRA', 'pyrus'],
  ['GUS', 'subterra'],
  ['KATO', null],
]

/** Places every fan: rows of seats round the stands, with aisles, empty seats and room for the cut-outs. */
function seatsFor(vips: number[]): Seat[] {
  const rand = rng(7)
  const seats: Seat[] = []
  for (let row = 0; row < ROWS; row++) {
    const r = ROW_START + row * ROW_DEPTH + ROW_DEPTH * 0.45
    const y = WALL + (row + 1) * ROW_RISE
    const n = Math.floor((Math.PI * 2 * r) / 3.3)
    for (let i = 0; i < n; i++) {
      const angle = ((i + rand() * 0.3) / n) * Math.PI * 2 - Math.PI
      // aisles every 30 degrees
      const aisle = Math.abs(((angle + Math.PI) % (Math.PI / 6)) - Math.PI / 12)
      if (aisle > Math.PI / 12 - 3 / r) continue
      if (rand() > 0.74 - row * 0.012) continue
      if (row < 2 && vips.some((v) => Math.abs(v - angle) < 5.4 / r)) continue
      const p = at(angle, r + (rand() - 0.5) * 1.2, y)
      // each half of the stands backs one brawler; around the ends they mix
      const side = Math.abs(p.x) < 18 ? (rand() < 0.5 ? 0 : 1) : p.x < 0 ? 0 : 1
      seats.push({
        x: p.x,
        y,
        z: p.z,
        size: 4.3 + rand() * 0.9,
        seed: rand(),
        side,
        team: rand() < 0.15 ? 0 : 0.35 + rand() * 0.55,
        angle,
        shirt: new THREE.Color(SHIRTS[Math.floor(rand() * SHIRTS.length)]),
        skin: new THREE.Color(SKINS[Math.floor(rand() * SKINS.length)]),
      })
    }
  }
  return seats
}

/** The stands: front wall, terraces and back wall, turned all the way round. */
function standsGeometry() {
  const pts: THREE.Vector2[] = [new THREE.Vector2(FIELD_RADIUS, 0), new THREE.Vector2(FIELD_RADIUS, WALL)]
  pts.push(new THREE.Vector2(ROW_START, WALL))
  for (let row = 0; row < ROWS; row++) {
    const r = ROW_START + row * ROW_DEPTH
    const y = WALL + (row + 1) * ROW_RISE
    pts.push(new THREE.Vector2(r, y), new THREE.Vector2(r + ROW_DEPTH, y))
  }
  pts.push(new THREE.Vector2(BACK, BACK_TOP), new THREE.Vector2(BACK + 4, BACK_TOP), new THREE.Vector2(BACK + 4, 0))
  return new THREE.LatheGeometry(pts, 128)
}

/** A band round the inside of a circle (normals and text facing the middle). */
function band(radius: number, y0: number, y1: number, segments: number, repeat: number) {
  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2 - Math.PI
    const p = at(a, radius)
    pos.push(p.x, y0, p.z, p.x, y1, p.z)
    uv.push((i / segments) * repeat, 0, (i / segments) * repeat, 1)
    if (i < segments) {
      const k = i * 2
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

/** Glowing lines along the front wall and the top of the stands. */
function trimGeometry() {
  const ring = (r0: number, r1: number, y: number) => {
    const g = new THREE.RingGeometry(r0, r1, 128)
    g.rotateX(-Math.PI / 2)
    g.translate(0, y, 0)
    return g
  }
  return mergeGeometries([
    ring(FIELD_RADIUS - 0.2, FIELD_RADIUS + 0.9, WALL + 0.03),
    ring(BACK - 0.2, BACK + 4, BACK_TOP + 0.03),
  ])!
}

/** Canvas texture helper. */
function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  draw(g)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

const DISPLAY = '"Orbitron", "Rajdhani", sans-serif'

/** The LED boards along the front wall: brawlers' names and slogans, scrolling round. */
function boardTexture() {
  const t = canvasTexture(2048, 64, (g) => {
    const grad = g.createLinearGradient(0, 0, 0, 64)
    grad.addColorStop(0, '#0a0d1c')
    grad.addColorStop(1, '#141a33')
    g.fillStyle = grad
    g.fillRect(0, 0, 2048, 64)
    const words: [string, string][] = [
      ['BAKUGAN BATTLE BRAWLERS', '#ffd23f'],
      ['RUNO', ELEMENT_BY_ID.haos.color],
      ['MARUCHO', ELEMENT_BY_ID.aquos.color],
      ['SHUN', ELEMENT_BY_ID.ventus.color],
      ['JULIE', ELEMENT_BY_ID.subterra.color],
      ['ALICE', ELEMENT_BY_ID.darkus.color],
      ['BRAWL!', '#ffffff'],
      ['CHAN LEE', ELEMENT_BY_ID.pyrus.color],
      ['BILLY', ELEMENT_BY_ID.subterra.color],
      ['JULIO', ELEMENT_BY_ID.haos.color],
    ]
    g.font = `italic 900 34px ${DISPLAY}`
    g.textBaseline = 'middle'
    let x = 30
    for (const [w, c] of words) {
      g.fillStyle = c
      g.fillText(w, x, 34)
      x += g.measureText(w).width + 26
      g.fillStyle = 'rgba(255,255,255,.5)'
      g.fillText('◆', x, 34)
      x += 52
    }
  })
  t.wrapS = THREE.RepeatWrapping
  return t
}

/** Name banners: one cell each in a 3 × 6 atlas. */
function bannerTexture() {
  return canvasTexture(1024, 512, (g) => {
    BANNERS.forEach(([name, el], i) => {
      const x = (i % 3) * 341
      const y = Math.floor(i / 3) * 85
      const color = el ? ELEMENT_BY_ID[el].color : '#c9ced8'
      g.fillStyle = '#10131f'
      g.fillRect(x, y, 341, 85)
      g.fillStyle = color
      g.globalAlpha = 0.35
      g.fillRect(x, y, 341, 85)
      g.globalAlpha = 1
      g.fillRect(x, y, 341, 8)
      g.fillRect(x, y + 77, 341, 8)
      g.fillStyle = '#ffffff'
      g.font = `italic 900 ${name.length > 9 ? 34 : 42}px ${DISPLAY}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(name, x + 170, y + 44, 320)
    })
  })
}

/** Quads (one per item) in one geometry, each showing its own cell of an atlas. */
function quads(items: { pos: THREE.Vector3; w: number; h: number; cell: [number, number, number, number] }[]) {
  return mergeGeometries(
    items.map(({ pos, w, h, cell: [u0, v0, u1, v1] }) => {
      const g = new THREE.PlaneGeometry(w, h)
      const uv = g.getAttribute('uv')
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) ? u1 : u0, uv.getY(i) ? v1 : v0)
      // face the middle of the field
      g.rotateY(Math.atan2(-pos.x, -pos.z))
      g.translate(pos.x, pos.y, pos.z)
      return g
    }),
  )!
}

function bannersGeometry() {
  return quads(
    BANNERS.map((_, i) => {
      const angle = ((i + 0.5) / BANNERS.length) * Math.PI * 2 - Math.PI
      const col = i % 3
      const row = Math.floor(i / 3)
      return {
        pos: at(angle, BACK - 0.3, BACK_TOP - 5.5),
        w: 19,
        h: 4.75,
        cell: [(col * 341) / 1024, 1 - ((row + 1) * 85) / 512, ((col + 1) * 341) / 1024, 1 - (row * 85) / 512],
      }
    }),
  )
}

/** Light towers round the back of the stands, each with a bank of lamps facing the field. */
function towerGeometries() {
  const poles: THREE.BufferGeometry[] = []
  const lamps: THREE.BufferGeometry[] = []
  for (let i = 0; i < TOWERS; i++) {
    const angle = ((i + 0.5) / TOWERS) * Math.PI * 2 - Math.PI
    const p = at(angle, TOWER_R)
    const face = Math.atan2(-p.x, -p.z)
    const pole = new THREE.BoxGeometry(2.4, TOWER_H, 2.4)
    pole.translate(p.x, TOWER_H / 2, p.z)
    poles.push(pole)
    const head = new THREE.BoxGeometry(18, 8, 1.6)
    head.rotateX(-0.35)
    head.rotateY(face)
    head.translate(p.x, TOWER_H + 3, p.z)
    poles.push(head)
    // two rows of lamps on the front of the head
    for (let r = 0; r < 2; r++)
      for (let c = 0; c < 6; c++) {
        const lamp = new THREE.PlaneGeometry(2.2, 2.2)
        lamp.translate(-6.5 + c * 2.6, 1.6 - r * 3.2, 0.85)
        lamp.rotateX(-0.35)
        lamp.rotateY(face)
        lamp.translate(p.x, TOWER_H + 3, p.z)
        lamps.push(lamp)
      }
  }
  const strip = (g: THREE.BufferGeometry) => {
    g.deleteAttribute('uv')
    return g.index ? g.toNonIndexed() : g
  }
  return { poles: mergeGeometries(poles.map(strip))!, lamps: mergeGeometries(lamps.map(strip))! }
}

/** Cut-outs of famous brawlers held up in the front row: portrait and name, from one atlas. */
function useVips(exclude: string[]) {
  return useMemo(() => {
    const chars = CHARACTERS.filter((c) => c.image && !exclude.includes(c.model ?? '')).slice(0, VIP_ANGLES.length)
    const cols = 4
    const W = 256
    const H = 320
    const c = document.createElement('canvas')
    c.width = cols * W
    c.height = Math.ceil(chars.length / cols) * H || H
    const g = c.getContext('2d')!
    const texture = new THREE.CanvasTexture(c)
    texture.colorSpace = THREE.SRGBColorSpace
    const cell = (i: number) => [(i % cols) * W, Math.floor(i / cols) * H] as const
    const frame = (i: number) => {
      const [x, y] = cell(i)
      const color = ELEMENT_BY_ID[chars[i].element].color
      g.clearRect(x, y, W, H)
      g.fillStyle = color
      g.beginPath()
      g.roundRect(x + 6, y + 6, W - 12, H - 12, 22)
      g.fill()
      g.fillStyle = '#0d1020'
      g.beginPath()
      g.roundRect(x + 14, y + 14, W - 28, H - 28, 16)
      g.fill()
      g.fillStyle = '#ffffff'
      g.font = `italic 900 30px ${DISPLAY}`
      g.textAlign = 'center'
      g.textBaseline = 'middle'
      g.fillText(chars[i].name.split(' ')[0].toUpperCase(), x + W / 2, y + H - 40, W - 40)
    }
    chars.forEach((_, i) => frame(i))
    const images = chars.map((ch, i) => {
      const img = new Image()
      img.onload = () => {
        const [x, y] = cell(i)
        g.save()
        g.beginPath()
        g.roundRect(x + 14, y + 14, W - 28, H - 76, 16)
        g.clip()
        g.drawImage(img, x + 14, y + 14, W - 28, W - 28)
        g.restore()
        texture.needsUpdate = true
      }
      img.src = asset(ch.image!)
      return img
    })
    const rows = Math.ceil(chars.length / cols) || 1
    const geometry = chars.length
      ? quads(
          chars.map((_, i) => {
            const [x, y] = cell(i)
            const r = ROW_START + ROW_DEPTH * 0.45
            return {
              pos: at(VIP_ANGLES[i], r, WALL + ROW_RISE + 8),
              w: 8.8,
              h: 11,
              cell: [x / c.width, 1 - (y + H) / (rows * H), (x + W) / c.width, 1 - y / (rows * H)],
            }
          }),
        )
      : null
    return { geometry, texture, images }
  }, [exclude])
}

/** The big screen over the far stands: what the announcer just said, under the two Bakugan's names. */
function paintScreen(texture: THREE.CanvasTexture, names: [string, string], colors: [string, string], line: string) {
  const g = (texture.image as HTMLCanvasElement).getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 384)
  grad.addColorStop(0, '#0b1024')
  grad.addColorStop(1, '#170d2a')
  g.fillStyle = grad
  g.fillRect(0, 0, 1024, 384)
  // scan lines
  g.fillStyle = 'rgba(255,255,255,.035)'
  for (let y = 0; y < 384; y += 4) g.fillRect(0, y, 1024, 1)
  g.textBaseline = 'middle'
  g.font = `italic 900 54px ${DISPLAY}`
  g.textAlign = 'right'
  g.fillStyle = colors[0]
  g.fillText(names[0].toUpperCase(), 450, 70, 420)
  g.textAlign = 'left'
  g.fillStyle = colors[1]
  g.fillText(names[1].toUpperCase(), 574, 70, 420)
  g.textAlign = 'center'
  g.fillStyle = '#ffffff'
  g.font = `italic 900 46px ${DISPLAY}`
  g.fillText('VS', 512, 72)
  g.fillStyle = '#ffd23f'
  g.fillRect(60, 128, 904, 4)
  // the announcer's line, wrapped onto up to three lines
  g.font = `italic 800 ${line ? 44 : 60}px ${DISPLAY}`
  g.fillStyle = '#ffffff'
  const words = (line || 'BAKUGAN BRAWL!').toUpperCase().split(/\s+/)
  const rows: string[] = []
  for (const w of words) {
    const last = rows[rows.length - 1]
    if (last !== undefined && g.measureText(`${last} ${w}`).width < 900) rows[rows.length - 1] = `${last} ${w}`
    else rows.push(w)
  }
  rows.slice(0, 3).forEach((r, i, all) => g.fillText(r, 512, 256 + (i - (all.length - 1) / 2) * 56, 940))
  texture.needsUpdate = true
}

function screenTexture() {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 384
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

type Level = 'hype' | 'arms' | 'jump' | 'boo' | 'clap' | 'gasp' | 'wave'
/** One reaction rising to `amp` over `attack` s, holding `hold` s and fading over `release` s, for one side or both. */
interface Swell {
  key: Level
  side: 0 | 1 | null
  amp: number
  start: number
  attack: number
  hold: number
  release: number
}

const swellAt = (s: Swell, now: number) => {
  const t = now - s.start
  if (t < 0) return 0
  if (t < s.attack) return (s.amp * t) / s.attack
  if (t < s.attack + s.hold) return s.amp
  return Math.max(0, s.amp * (1 - (t - s.attack - s.hold) / s.release))
}

/** What each mood does to the stands: [level, whose fans (lead / other / both), amount, attack, hold, release]. */
const MOODS: Record<CrowdMood, [Level, 'lead' | 'other' | 'both', number, number, number, number][]> = {
  cheer: [
    ['hype', 'lead', 0.9, 0.15, 2.2, 1.2],
    ['arms', 'lead', 0.85, 0.15, 1.8, 0.9],
    ['jump', 'lead', 0.45, 0.2, 1.6, 0.8],
    ['hype', 'other', 0.3, 0.3, 1.2, 1],
  ],
  roar: [
    ['hype', 'lead', 1, 0.1, 3.2, 1.5],
    ['arms', 'lead', 1, 0.1, 2.8, 1.2],
    ['jump', 'lead', 1, 0.15, 2.6, 1.2],
    ['hype', 'other', 0.55, 0.2, 2, 1.2],
    ['arms', 'other', 0.35, 0.2, 1.5, 1],
  ],
  boo: [
    ['boo', 'lead', 1, 0.3, 2, 0.8],
    ['hype', 'lead', 0.25, 0.3, 2, 0.8],
  ],
  gasp: [['gasp', 'both', 1, 0.08, 0.6, 0.9]],
  chant: [
    ['clap', 'lead', 1, 0.3, CHANT_LENGTH - 0.3, 0.6],
    ['hype', 'lead', 0.4, 0.3, CHANT_LENGTH - 0.3, 0.6],
  ],
  calm: [],
}

interface Props {
  /** How big the stadium is against the usual view (1 = usual). */
  scale: number
  /** The two sides' attribute colours. */
  colors: [string, string]
  /** The Bakugan on the field, for the big screen. */
  names: [string, string]
  /** Models of the brawlers on the field (they are not shown again in the stands). */
  exclude: string[]
}

export function Stadium({ scale, colors, names, exclude }: Props) {
  const group = useRef<THREE.Group>(null)
  const sized = useRef(false)
  const board = useRef<THREE.Mesh>(null)
  const container = useThree((s) => s.gl.domElement.parentElement?.parentElement ?? null)

  const vipAngles = useMemo(
    () => VIP_ANGLES.slice(0, CHARACTERS.filter((c) => c.image && !exclude.includes(c.model ?? '')).length),
    [exclude],
  )
  const seats = useMemo(() => seatsFor(vipAngles), [vipAngles])
  const parts = useMemo(
    () => ({
      stands: standsGeometry(),
      trim: trimGeometry(),
      board: band(FIELD_RADIUS - 0.05, 0.6, WALL - 0.6, 128, 4),
      boardTexture: boardTexture(),
      banners: bannersGeometry(),
      bannerTexture: bannerTexture(),
      ...towerGeometries(),
    }),
    [],
  )
  const vips = useVips(exclude)
  const screen = useMemo(screenTexture, [])
  const lastLine = useRef('')
  useEffect(() => paintScreen(screen, names, colors, lastLine.current), [screen, names, colors])

  useEffect(
    () => () => {
      for (const v of Object.values(parts)) v.dispose()
    },
    [parts],
  )
  useEffect(() => () => screen.dispose(), [screen])
  useEffect(
    () => () => {
      vips.geometry?.dispose()
      vips.texture.dispose()
      for (const img of vips.images) img.onload = null
    },
    [vips],
  )

  // the stands' moods, as swells that rise and fade
  const swells = useRef<Swell[]>([])
  const chant = useRef<{ start: number; side: 0 | 1 | null } | null>(null)
  const waveRun = useRef<{ start: number; from: number }>({ start: -99, from: 0 })
  const levels = useRef<CrowdLevels>({
    hype: [0, 0],
    arms: [0, 0],
    jump: [0, 0],
    boo: [0, 0],
    clap: [0, 0],
    clapHit: [0, 0],
    pump: [0, 0],
    gasp: 0,
    wave: 0,
    waveAt: 0,
    colors: [new THREE.Color(colors[0]), new THREE.Color(colors[1])],
  })
  useEffect(() => {
    levels.current.colors[0].set(colors[0])
    levels.current.colors[1].set(colors[1])
  }, [colors])

  const clock = useThree((s) => s.clock)
  // calls that arrive between frames are played on the next one
  const inbox = useRef<{ call: StadiumCall; at: number }[]>([])
  const lastCall = useRef({ at: 0, idleNext: 14 })
  const lastSound = useRef<Partial<Record<CrowdMood, number>>>({})
  const announcer = useRef<Announcer | null>(null)

  useEffect(() => {
    if (!container) return
    const a = createAnnouncer(container)
    announcer.current = a
    return () => {
      a.dispose()
      announcer.current = null
    }
  }, [container])

  useEffect(() => startCrowd(), [])
  useEffect(() => listenStadium((call) => inbox.current.push({ call, at: performance.now() })), [])

  useFrame((_, dt) => {
    const now = clock.elapsedTime
    // play what the battle asked for; after a pause (a hidden tab) only what is still fresh, and the last line
    const calls = inbox.current.splice(0)
    const lastAnnounce = calls.findLast(({ call }) => call.kind === 'announce')
    for (const { call, at } of calls) {
      if (call.kind === 'announce') {
        if (lastAnnounce?.call !== call) continue
        lastLine.current = call.text
        paintScreen(screen, names, colors, call.text)
        announcer.current?.say(call.text)
      } else if (performance.now() - at < 1500) react(call.mood, call.side ?? null, now)
    }
    // nothing has happened for a while: the fans start something themselves
    if (now - lastCall.current.at > lastCall.current.idleNext) {
      const r = (Math.sin(now * 12.9898) * 43758.5453) % 1
      const pick = Math.abs(r)
      if (pick < 0.55) react('chant', pick < 0.27 ? 0 : 1, now)
      else startWave(now, 1)
      lastCall.current.idleNext = 18 + pick * 16
    }

    const l = levels.current
    const sum: Record<Level, [number, number]> = {
      hype: [0.12, 0.12],
      arms: [0, 0],
      jump: [0, 0],
      boo: [0, 0],
      clap: [0, 0],
      gasp: [0, 0],
      wave: [0, 0],
    }
    swells.current = swells.current.filter((s) => now - s.start < s.attack + s.hold + s.release)
    for (const s of swells.current) {
      const v = swellAt(s, now)
      for (const side of [0, 1] as const) if (s.side === null || s.side === side) sum[s.key][side] = Math.max(sum[s.key][side], v)
    }
    for (const k of ['hype', 'arms', 'jump', 'boo', 'clap'] as const) l[k] = sum[k]
    l.gasp = sum.gasp[0]
    l.wave = sum.wave[0]
    const w = waveRun.current
    l.waveAt = w.from + (now - w.start) * 1.9
    // the chant's beat: fists up on "Ba-ku-gan!", hands together on the claps
    const c = chant.current
    l.clapHit = [0, 0]
    l.pump = [0, 0]
    if (c) {
      const beats = (now - c.start) / CHANT_BEAT
      if (beats > CHANT_BARS * 4 + 1) chant.current = null
      else if (beats >= 0) {
        const inBar = beats % 4
        const pulse = (marks: number[], width: number) =>
          Math.max(...marks.map((m) => Math.exp(-((((inBar - m) * CHANT_BEAT) / width) ** 2))))
        const hit = pulse(CHANT_CLAPS, 0.05)
        const pump = pulse(CHANT_SHOUTS, 0.16)
        for (const side of [0, 1] as const)
          if (c.side === null || c.side === side) {
            l.clapHit[side] = hit
            l.pump[side] = pump
          }
      }
    }
    // the LED boards scroll
    const b = board.current?.material as THREE.MeshBasicMaterial | undefined
    if (b?.map) b.map.offset.x = (b.map.offset.x + dt * 0.012) % 1
    // the stadium grows and shrinks with the view (and starts at the right size)
    const g = group.current
    if (g) g.scale.setScalar(sized.current ? THREE.MathUtils.damp(g.scale.x, scale, 3, dt) : scale)
    sized.current = true
  })

  function startWave(now: number, amp: number) {
    waveRun.current = { start: now, from: -Math.PI / 2 }
    swells.current.push({ key: 'wave', side: null, amp, start: now, attack: 0.4, hold: 3.6, release: 0.8 })
  }

  function react(mood: CrowdMood, side: 0 | 1 | null, now: number) {
    lastCall.current.at = now
    if (mood === 'calm') {
      // everything settles quickly
      for (const s of swells.current) {
        const t = now - s.start
        if (t < s.attack + s.hold) {
          s.hold = Math.max(0, t - s.attack)
          s.release = 0.8
        }
      }
      chant.current = null
      return
    }
    for (const [key, who, amp, attack, hold, release] of MOODS[mood]) {
      if (who === 'other' && side === null) continue
      const s = who === 'both' || side === null ? null : who === 'lead' ? side : ((1 - side) as 0 | 1)
      swells.current.push({ key, side: s, amp, start: now, attack, hold, release })
    }
    if (mood === 'chant') chant.current = { start: now + 0.02, side }
    if (mood === 'roar' && now - waveRun.current.start > 6) startWave(now + 0.6, 0.8)
    // the same reaction twice in a moment (the battle and the scene both calling it) is heard once
    const last = lastSound.current[mood] ?? -9
    if (now - last > (mood === 'chant' ? CHANT_LENGTH : 0.8)) {
      lastSound.current[mood] = now
      crowdSound(mood)
    }
  }

  return (
    <group ref={group}>
      <mesh geometry={parts.stands}>
        <meshLambertMaterial color="#1b2030" flatShading side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={parts.trim}>
        <meshBasicMaterial color="#4f8dff" />
      </mesh>
      <mesh ref={board} geometry={parts.board}>
        <meshBasicMaterial map={parts.boardTexture} color="#c8c8c8" side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={parts.banners}>
        <meshBasicMaterial map={parts.bannerTexture} color="#b4b4b4" side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={parts.poles}>
        <meshLambertMaterial color="#22283a" />
      </mesh>
      <mesh geometry={parts.lamps}>
        <meshBasicMaterial color={[2.4, 2.4, 2.1]} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {vips.geometry && (
        <mesh geometry={vips.geometry}>
          <meshBasicMaterial map={vips.texture} color="#d0d0d0" transparent alphaTest={0.05} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* the big screen over the far stands */}
      <group position={[0, BACK_TOP + 13, -(BACK - 2)]}>
        <mesh position={[0, 0, -0.8]}>
          <boxGeometry args={[46, 19, 1.2]} />
          <meshLambertMaterial color="#141826" />
        </mesh>
        <mesh>
          <planeGeometry args={[43, 16.1]} />
          <meshBasicMaterial map={screen} color="#d8d8d8" />
        </mesh>
      </group>
      <Crowd seats={seats} levels={levels} />
    </group>
  )
}
