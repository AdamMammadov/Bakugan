import type { ElementId } from '../data/elements'

/** Parts of the drawn avatar; every field picks one option from the lists below. */
export interface AvatarParts {
  skin: string
  hair: HairStyle
  hairColor: string
  eyes: EyeStyle
  eyeColor: string
  outfit: string
  accessory: Accessory
}

export type HairStyle = 'spiky' | 'twintails' | 'bowl' | 'ponytail' | 'long' | 'short' | 'swept' | 'bald'
export type EyeStyle = 'bright' | 'sharp' | 'calm' | 'happy'
export type Accessory = 'none' | 'glasses' | 'mask' | 'goggles' | 'headband' | 'cap' | 'visor' | 'crown' | 'halo'

export type Avatar = { kind: 'preset'; id: string } | { kind: 'custom'; parts: AvatarParts } | { kind: 'photo'; dataUrl: string }

export const SKINS = ['#ffe0c7', '#f6cfae', '#e8b48f', '#c98e66', '#9a6646', '#6b4430']
export const HAIR_STYLES: HairStyle[] = ['spiky', 'twintails', 'bowl', 'ponytail', 'long', 'short', 'swept', 'bald']
export const HAIR_COLORS = [
  '#4a2a1a',
  '#1a1a22',
  '#f0d060',
  '#f3e6a0',
  '#3fb8b0',
  '#d8dce6',
  '#e07a2a',
  '#c8262b',
  '#2a62c8',
  '#7a3ab8',
  '#e870a8',
  '#3a8a4a',
]
export const EYE_STYLES: EyeStyle[] = ['bright', 'sharp', 'calm', 'happy']
export const EYE_COLORS = ['#5a3220', '#2a62c8', '#2c8a4a', '#7a3ab8', '#c8262b', '#1a1a22', '#c89a20']
export const OUTFITS = ['#c8262b', '#2a62c8', '#2c8a4a', '#f2c230', '#6a3a9a', '#e8e8f0', '#e870a8', '#c8761e', '#22252e']
export const ACCESSORIES: Accessory[] = ['none', 'glasses', 'mask', 'goggles', 'headband', 'cap', 'visor', 'crown', 'halo']
/** Accessories that must be earned in the Season Pass first. */
export const LOCKED_ACCESSORIES: Accessory[] = ['visor', 'crown', 'halo']

/** The Battle Brawlers, drawn as simple fan avatars. */
export interface Character {
  id: string
  name: string
  element: ElementId
  bakugan: string
  parts: AvatarParts
  /** Portrait rendered from the character's game model, when we have one. */
  image?: string
  /** 3D model (arms split off at the shoulders as `armL` / `armR`) used on the battlefield. */
  model?: string
  /** How the brawler sounds when calling out in battle. */
  voice: Voice
}

/** A brawler's speaking voice: a female or male browser voice, pitched for the character. */
export interface Voice {
  female: boolean
  pitch: number
  rate?: number
}

/** Used for a self-made avatar or a photo, whose voice we cannot know. */
export const DEFAULT_VOICE: Voice = { female: false, pitch: 1 }

export const CHARACTERS: Character[] = [
  {
    id: 'dan',
    name: 'Dan Kuso',
    element: 'pyrus',
    bakugan: 'Drago',
    image: 'characters/dan.webp',
    model: 'models/brawlers/dan.glb',
    voice: { female: false, pitch: 1.05, rate: 1.12 },
    parts: {
      skin: '#f6cfae',
      hair: 'spiky',
      hairColor: '#4a2a1a',
      eyes: 'bright',
      eyeColor: '#5a3220',
      outfit: '#c8262b',
      accessory: 'none',
    },
  },
  {
    id: 'runo',
    name: 'Runo Misaki',
    element: 'haos',
    bakugan: 'Tigrerra',
    image: 'characters/runo.webp',
    model: 'models/brawlers/runo.glb',
    voice: { female: true, pitch: 1.3 },
    parts: {
      skin: '#ffe0c7',
      hair: 'twintails',
      hairColor: '#3fb8b0',
      eyes: 'bright',
      eyeColor: '#c89a20',
      outfit: '#f2c230',
      accessory: 'none',
    },
  },
  {
    id: 'marucho',
    name: 'Marucho Marukura',
    element: 'aquos',
    bakugan: 'Preyas',
    image: 'characters/marucho.webp',
    model: 'models/brawlers/marucho.glb',
    voice: { female: false, pitch: 1.45, rate: 1.1 },
    parts: {
      skin: '#ffe0c7',
      hair: 'bowl',
      hairColor: '#f0d060',
      eyes: 'calm',
      eyeColor: '#2a62c8',
      outfit: '#2a62c8',
      accessory: 'glasses',
    },
  },
  {
    id: 'shun',
    name: 'Shun Kazami',
    element: 'ventus',
    bakugan: 'Skyress',
    image: 'characters/shun.webp',
    model: 'models/brawlers/shun.glb',
    voice: { female: false, pitch: 0.9, rate: 1.0 },
    parts: {
      skin: '#f6cfae',
      hair: 'ponytail',
      hairColor: '#1a1a22',
      eyes: 'sharp',
      eyeColor: '#2c8a4a',
      outfit: '#2c8a4a',
      accessory: 'none',
    },
  },
  {
    id: 'julie',
    name: 'Julie Makimoto',
    element: 'subterra',
    bakugan: 'Gorem',
    image: 'characters/julie.webp',
    model: 'models/brawlers/julie.glb',
    voice: { female: true, pitch: 1.5, rate: 1.15 },
    parts: {
      skin: '#e8b48f',
      hair: 'long',
      hairColor: '#d8dce6',
      eyes: 'happy',
      eyeColor: '#2a62c8',
      outfit: '#e870a8',
      accessory: 'none',
    },
  },
  {
    id: 'alice',
    name: 'Alice Gehabich',
    element: 'darkus',
    bakugan: 'Hydranoid',
    image: 'characters/alice.webp',
    model: 'models/brawlers/alice.glb',
    voice: { female: true, pitch: 1.2, rate: 0.98 },
    parts: {
      skin: '#ffe0c7',
      hair: 'long',
      hairColor: '#e07a2a',
      eyes: 'calm',
      eyeColor: '#5a3220',
      outfit: '#6a3a9a',
      accessory: 'none',
    },
  },
  {
    id: 'klaus',
    name: 'Klaus von Hertzon',
    element: 'aquos',
    bakugan: 'Sirenoid',
    image: 'characters/klaus.webp',
    model: 'models/brawlers/klaus.glb',
    voice: { female: false, pitch: 0.85, rate: 0.98 },
    parts: {
      skin: '#ffe0c7',
      hair: 'swept',
      hairColor: '#d8dce6',
      eyes: 'sharp',
      eyeColor: '#2c8a4a',
      outfit: '#e8e8f0',
      accessory: 'none',
    },
  },
  {
    id: 'shuji',
    name: 'Shuji',
    element: 'darkus',
    bakugan: 'Fear Ripper',
    image: 'characters/shuji.webp',
    model: 'models/brawlers/shuji.glb',
    voice: { female: false, pitch: 0.75, rate: 1.08 },
    parts: {
      skin: '#c98e66',
      hair: 'spiky',
      hairColor: '#1a1a22',
      eyes: 'sharp',
      eyeColor: '#5a3220',
      outfit: '#c8761e',
      accessory: 'none',
    },
  },
  {
    id: 'masquerade',
    name: 'Masquerade',
    element: 'darkus',
    bakugan: 'Hydranoid',
    image: 'characters/masquerade.webp',
    model: 'models/brawlers/masquerade.glb',
    voice: { female: false, pitch: 0.6, rate: 0.95 },
    parts: {
      skin: '#ffe0c7',
      hair: 'swept',
      hairColor: '#f3e6a0',
      eyes: 'sharp',
      eyeColor: '#2a62c8',
      outfit: '#e8e8f0',
      accessory: 'mask',
    },
  },
]

export const CHARACTER_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c])) as Record<string, Character>

export const DEFAULT_PARTS: AvatarParts = CHARACTERS[0].parts

/** Center-crops an uploaded image and shrinks it so it fits comfortably in localStorage. */
export function photoToDataUrl(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const side = Math.min(img.width, img.height)
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = size
      canvas.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image.'))
    }
    img.src = url
  })
}

/** The series character a bot brawler plays as, chosen by its lead Bakugan's attribute. */
const BOT_FOR: Record<ElementId, string> = {
  pyrus: 'dan',
  aquos: 'marucho',
  subterra: 'julie',
  ventus: 'shun',
  haos: 'runo',
  darkus: 'masquerade',
}
export const botCharacter = (element: ElementId) => CHARACTER_BY_ID[BOT_FOR[element]]

/**
 * The CPU brawler who brings this Bakugan: its own brawler when they are in the cast (Sirenoid →
 * Klaus, Fear Ripper → Shuji), otherwise a random brawler of the attribute, so Alice, Shuji and the
 * rest all show up. `avoid` is the player's own character, so nobody brawls against themselves.
 */
export function opponentCharacter(bakugan: { id: string; element: ElementId; brawler: string }, avoid?: string): Character {
  const own = CHARACTERS.find(
    (c) => c.name === bakugan.brawler || bakugan.brawler.startsWith(c.name) || c.name.startsWith(bakugan.brawler),
  )
  if (own && own.id !== avoid) return own
  const pool = CHARACTERS.filter((c) => c.element === bakugan.element && c.id !== avoid)
  const list = pool.length ? pool : CHARACTERS.filter((c) => c.id !== avoid)
  return list[Math.floor(Math.random() * list.length)]
}
