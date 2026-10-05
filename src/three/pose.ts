import * as THREE from 'three'
import type { Ability } from '../data/bakugan'

/**
 * Combat moves a monster can play. Each card maps to one of these, so different cards
 * look different in the arena.
 */
export type Move = 'bite' | 'breath' | 'clawSwipe' | 'tailWhip' | 'stomp' | 'roar' | 'guard' | 'hit'

/** One-off body animation a fighter is playing. `start` is filled in on the first frame. */
export interface Pose {
  kind: 'lunge' | 'cast' | 'hit'
  move: Move
  start: number | null
}

export type PoseRef = { current: Pose | null }

/** 0 → 1 → 0 envelope of a pose over `length` seconds (after `delay`), or 0 when idle. */
export function poseWeight(pose: Pose | null, kind: Pose['kind'], now: number, length = 0.9, delay = 0) {
  if (!pose || pose.kind !== kind || pose.start === null) return 0
  const k = THREE.MathUtils.clamp((now - pose.start - delay) / length, 0, 1)
  return Math.sin(k * Math.PI)
}

/** Smooth 0 → 1 → 0 bump between times a and b. */
export const env = (t: number, a: number, b: number) => (t <= a || t >= b ? 0 : Math.sin(((t - a) / (b - a)) * Math.PI))

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

const MOVES_BY_EFFECT: Record<Ability['effect'], Move[]> = {
  fireball: ['breath', 'bite'],
  waterJet: ['breath', 'bite'],
  lightBeam: ['breath', 'clawSwipe'],
  shadowOrb: ['breath', 'bite'],
  quake: ['stomp', 'clawSwipe'],
  tornado: ['tailWhip', 'clawSwipe'],
  flameWave: ['roar', 'stomp'],
  waterSphere: ['stomp', 'breath'],
  shieldDome: ['guard'],
  aura: ['roar'],
}

const BASIC_MOVES: Move[] = ['bite', 'clawSwipe', 'tailWhip']

/** Picks the move for an action: fixed per card, random for plain attacks. */
export function moveFor(ability: Ability | null): Move {
  if (!ability) return BASIC_MOVES[Math.floor(Math.random() * BASIC_MOVES.length)]
  switch (ability.type) {
    case 'boost':
      return 'roar'
    case 'shield':
      return 'guard'
    case 'drain':
      return 'bite'
    case 'weaken':
      return hash(ability.id) % 2 ? 'clawSwipe' : 'tailWhip'
    default: {
      const options = MOVES_BY_EFFECT[ability.effect]
      return options[hash(ability.id) % options.length]
    }
  }
}

/** Joint rotations (radians, local X/Y) for a part-rigged model at time t into a move. */
export interface RigPose {
  neck: number
  head: number
  jaw: number
  tailYaw: number
  tailLift: number
  tipYaw: number
  frontL: number
  frontR: number
  hindL: number
  hindR: number
  /** Wing beat: positive raises both wings. */
  wing: number
}

/** Idle breathing + the active move, layered. `t` is seconds since the move started. */
export function rigPose(move: Move | null, t: number, now: number): RigPose {
  const p: RigPose = {
    neck: Math.sin(now * 1.1) * 0.05,
    head: Math.sin(now * 1.3 + 1) * 0.06,
    jaw: 0.04 + Math.max(0, Math.sin(now * 0.7)) * 0.08,
    tailYaw: Math.sin(now * 0.9) * 0.12,
    tailLift: Math.sin(now * 0.6) * 0.04,
    tipYaw: Math.sin(now * 0.9 - 0.8) * 0.18,
    frontL: 0,
    frontR: 0,
    hindL: 0,
    hindR: 0,
    wing: Math.sin(now * 3.2) * 0.35,
  }
  switch (move) {
    case 'bite':
      p.neck += 0.55 * env(t, 0.1, 0.8)
      p.head += 0.35 * env(t, 0.45, 0.85) - 0.25 * env(t, 0.05, 0.5)
      p.jaw += 0.75 * env(t, 0.05, 0.62) - 0.15 * env(t, 0.62, 0.9)
      p.tailLift += 0.15 * env(t, 0.1, 0.8)
      p.wing -= 0.5 * env(t, 0.1, 0.8)
      break
    case 'breath':
      p.neck += 0.3 * env(t, 0, 1.4) - 0.25 * env(t, 0, 0.35)
      p.head += 0.25 * env(t, 0.2, 1.4) - 0.3 * env(t, 0, 0.35)
      p.jaw += 0.85 * env(t, 0.1, 1.5)
      // a big wing beat drives the blast
      p.wing += 0.7 * env(t, 0, 0.5) - 0.6 * env(t, 0.5, 1.1)
      break
    case 'clawSwipe':
      p.frontR -= 1.5 * env(t, 0.1, 0.85)
      p.frontL -= 0.6 * env(t, 0.35, 1.0)
      p.neck -= 0.3 * env(t, 0, 0.7)
      p.jaw += 0.55 * env(t, 0.1, 0.9)
      break
    case 'tailWhip':
      p.tailYaw += 1.3 * env(t, 0.05, 1.0)
      p.tipYaw += 1.1 * env(t, 0.15, 1.1)
      p.tailLift += 0.25 * env(t, 0.1, 0.9)
      p.neck += 0.2 * env(t, 0.1, 0.9)
      break
    case 'stomp':
      p.frontL -= 0.9 * env(t, 0, 0.75)
      p.frontR -= 0.9 * env(t, 0, 0.75)
      p.neck -= 0.45 * env(t, 0, 0.7) - 0.3 * env(t, 0.7, 1.2)
      p.jaw += 0.7 * env(t, 0.55, 1.3)
      break
    case 'roar':
      p.neck -= 0.5 * env(t, 0, 1.5)
      p.head -= 0.55 * env(t, 0.1, 1.4)
      p.jaw += 0.95 * env(t, 0.1, 1.4) + Math.sin(t * 45) * 0.04 * env(t, 0.2, 1.3)
      p.tailLift += 0.3 * env(t, 0, 1.5)
      p.wing += Math.sin(t * 14) * 0.6 * env(t, 0, 1.5)
      break
    case 'guard':
      p.neck += 0.35 * env(t, 0, 1.4)
      p.head -= 0.2 * env(t, 0, 1.4)
      p.tailYaw += 0.7 * env(t, 0, 1.4)
      p.frontL += 0.25 * env(t, 0, 1.4)
      p.frontR += 0.25 * env(t, 0, 1.4)
      // wings wrap round the body
      p.wing -= 1.0 * env(t, 0, 1.4)
      break
    case 'hit': {
      // the blow lands at ~0.75 s into the attacker's move
      const h = env(t, 0.72, 1.3)
      p.neck -= 0.55 * h
      p.head -= 0.45 * h
      p.jaw += 0.6 * h
      p.tailYaw += 0.4 * h
      p.frontL += 0.2 * h
      p.frontR -= 0.2 * h
      p.wing += 0.5 * h
      break
    }
  }
  return p
}
