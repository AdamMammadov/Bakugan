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
export type Accessory = 'none' | 'glasses' | 'mask' | 'goggles' | 'headband' | 'cap'

export type Avatar =
  | { kind: 'preset'; id: string }
  | { kind: 'custom'; parts: AvatarParts }
  | { kind: 'photo'; dataUrl: string }

export const SKINS = ['#ffe0c7', '#f6cfae', '#e8b48f', '#c98e66', '#9a6646', '#6b4430']
export const HAIR_STYLES: HairStyle[] = ['spiky', 'twintails', 'bowl', 'ponytail', 'long', 'short', 'swept', 'bald']
export const HAIR_COLORS = ['#4a2a1a', '#1a1a22', '#f0d060', '#f3e6a0', '#3fb8b0', '#d8dce6', '#e07a2a', '#c8262b', '#2a62c8', '#7a3ab8', '#e870a8', '#3a8a4a']
export const EYE_STYLES: EyeStyle[] = ['bright', 'sharp', 'calm', 'happy']
export const EYE_COLORS = ['#5a3220', '#2a62c8', '#2c8a4a', '#7a3ab8', '#c8262b', '#1a1a22', '#c89a20']
export const OUTFITS = ['#c8262b', '#2a62c8', '#2c8a4a', '#f2c230', '#6a3a9a', '#e8e8f0', '#e870a8', '#c8761e', '#22252e']
export const ACCESSORIES: Accessory[] = ['none', 'glasses', 'mask', 'goggles', 'headband', 'cap']

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
}

export const CHARACTERS: Character[] = [
  {
    id: 'dan',
    name: 'Dan Kuso',
    element: 'pyrus',
    bakugan: 'Drago',
    image: 'characters/dan.webp',
    model: 'models/brawlers/dan.glb',
    parts: { skin: '#f6cfae', hair: 'spiky', hairColor: '#4a2a1a', eyes: 'bright', eyeColor: '#5a3220', outfit: '#c8262b', accessory: 'none' },
  },
  {
    id: 'runo',
    name: 'Runo Misaki',
    element: 'haos',
    bakugan: 'Tigrerra',
    parts: { skin: '#ffe0c7', hair: 'twintails', hairColor: '#3fb8b0', eyes: 'bright', eyeColor: '#c89a20', outfit: '#f2c230', accessory: 'none' },
  },
  {
    id: 'marucho',
    name: 'Marucho Marukura',
    element: 'aquos',
    bakugan: 'Preyas',
    parts: { skin: '#ffe0c7', hair: 'bowl', hairColor: '#f0d060', eyes: 'calm', eyeColor: '#2a62c8', outfit: '#2a62c8', accessory: 'glasses' },
  },
  {
    id: 'shun',
    name: 'Shun Kazami',
    element: 'ventus',
    bakugan: 'Skyress',
    parts: { skin: '#f6cfae', hair: 'ponytail', hairColor: '#1a1a22', eyes: 'sharp', eyeColor: '#2c8a4a', outfit: '#2c8a4a', accessory: 'none' },
  },
  {
    id: 'julie',
    name: 'Julie Makimoto',
    element: 'subterra',
    bakugan: 'Gorem',
    parts: { skin: '#e8b48f', hair: 'long', hairColor: '#d8dce6', eyes: 'happy', eyeColor: '#2a62c8', outfit: '#e870a8', accessory: 'none' },
  },
  {
    id: 'alice',
    name: 'Alice Gehabich',
    element: 'darkus',
    bakugan: 'Hydranoid',
    parts: { skin: '#ffe0c7', hair: 'long', hairColor: '#e07a2a', eyes: 'calm', eyeColor: '#5a3220', outfit: '#6a3a9a', accessory: 'none' },
  },
  {
    id: 'masquerade',
    name: 'Masquerade',
    element: 'darkus',
    bakugan: 'Hydranoid',
    image: 'characters/masquerade.webp',
    model: 'models/brawlers/masquerade.glb',
    parts: { skin: '#ffe0c7', hair: 'swept', hairColor: '#f3e6a0', eyes: 'sharp', eyeColor: '#2a62c8', outfit: '#e8e8f0', accessory: 'mask' },
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
