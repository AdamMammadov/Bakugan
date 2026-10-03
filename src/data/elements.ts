export type ElementId = 'pyrus' | 'aquos' | 'subterra' | 'ventus' | 'haos' | 'darkus'

export interface ElementInfo {
  id: ElementId
  name: string
  attribute: string
  tagline: string
  brawler: string
  /** Primary UI color. */
  color: string
  /** Softer glow color used for shadows and gradients. */
  glow: string
  /** Angle on the selection wheel in degrees, clockwise from 12 o'clock. */
  wheelAngle: number
  /** Icon center on the 640×640 wheel art, relative to the wheel center. */
  wheelPos: { x: number; y: number }
  icon: string
}

export const ELEMENTS: ElementInfo[] = [
  {
    id: 'pyrus',
    name: 'Pyrus',
    attribute: 'Fire',
    tagline: 'Burning will. Unstoppable offense.',
    brawler: 'Dan Kuso',
    color: '#ff3b2f',
    glow: '#ff7a3d',
    wheelAngle: 0,
    wheelPos: { x: -1, y: -179.8 },
    icon: '/wheel/pyrus.webp',
  },
  {
    id: 'subterra',
    name: 'Subterra',
    attribute: 'Earth',
    tagline: 'Unbreakable ground. Raw strength.',
    brawler: 'Julie Makimoto',
    color: '#c8782e',
    glow: '#e8a25a',
    wheelAngle: 60,
    wheelPos: { x: 153.5, y: -88.2 },
    icon: '/wheel/subterra.webp',
  },
  {
    id: 'haos',
    name: 'Haos',
    attribute: 'Light',
    tagline: 'Blinding radiance. Pure focus.',
    brawler: 'Runo Misaki',
    color: '#f5d90a',
    glow: '#fff27a',
    wheelAngle: 120,
    wheelPos: { x: 152.2, y: 88.5 },
    icon: '/wheel/haos.webp',
  },
  {
    id: 'darkus',
    name: 'Darkus',
    attribute: 'Darkness',
    tagline: 'Shadow and fear. Hidden power.',
    brawler: 'Masquerade',
    color: '#9b3dff',
    glow: '#c08bff',
    wheelAngle: 180,
    wheelPos: { x: -0.3, y: 181.3 },
    icon: '/wheel/darkus.webp',
  },
  {
    id: 'aquos',
    name: 'Aquos',
    attribute: 'Water',
    tagline: 'Fluid and cunning. Endless flow.',
    brawler: 'Marucho Marukura',
    color: '#2f6bff',
    glow: '#6fa2ff',
    wheelAngle: 240,
    wheelPos: { x: -155.4, y: 91.6 },
    icon: '/wheel/aquos.webp',
  },
  {
    id: 'ventus',
    name: 'Ventus',
    attribute: 'Wind',
    tagline: 'Swift as the storm. Strike first.',
    brawler: 'Shun Kazami',
    color: '#19c79a',
    glow: '#6fffd0',
    wheelAngle: 300,
    wheelPos: { x: -157.3, y: -88.2 },
    icon: '/wheel/ventus.webp',
  },
]

export const ELEMENT_BY_ID = Object.fromEntries(ELEMENTS.map((e) => [e.id, e])) as Record<
  ElementId,
  ElementInfo
>
