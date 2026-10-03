import { asset } from '../asset'

export type ElementId = 'pyrus' | 'aquos' | 'subterra' | 'ventus' | 'haos' | 'darkus'

export interface ElementInfo {
  id: ElementId
  name: string
  attribute: string
  tagline: string
  /** A few sentences of flavour shown on the attribute wheel. */
  lore: string
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
    lore: 'The attribute of fire and passion. Pyrus Bakugan overwhelm opponents with raw power-ups and relentless attacks, and their brawlers never back down from a fight.',
    brawler: 'Dan Kuso',
    color: '#ff3b2f',
    glow: '#ff7a3d',
    wheelAngle: 0,
    wheelPos: { x: -1, y: -179.8 },
    icon: asset('wheel/pyrus.webp'),
  },
  {
    id: 'subterra',
    name: 'Subterra',
    attribute: 'Earth',
    tagline: 'Unbreakable ground. Raw strength.',
    lore: 'The attribute of earth and stone. Subterra Bakugan are sturdy and patient, bending the battlefield itself — moving Gate Cards and turning the ground to their advantage.',
    brawler: 'Julie Makimoto',
    color: '#c8782e',
    glow: '#e8a25a',
    wheelAngle: 60,
    wheelPos: { x: 153.5, y: -88.2 },
    icon: asset('wheel/subterra.webp'),
  },
  {
    id: 'haos',
    name: 'Haos',
    attribute: 'Light',
    tagline: 'Blinding radiance. Pure focus.',
    lore: 'The attribute of light. Haos Bakugan protect and support: they negate enemy abilities, reflect attacks and lift the power of their allies.',
    brawler: 'Runo Misaki',
    color: '#f5d90a',
    glow: '#fff27a',
    wheelAngle: 120,
    wheelPos: { x: 152.2, y: 88.5 },
    icon: asset('wheel/haos.webp'),
  },
  {
    id: 'darkus',
    name: 'Darkus',
    attribute: 'Darkness',
    tagline: 'Shadow and fear. Hidden power.',
    lore: "The attribute of darkness. Darkus Bakugan feed on their opponent's strength, draining G-Power and turning every exchange into a trap.",
    brawler: 'Masquerade',
    color: '#9b3dff',
    glow: '#c08bff',
    wheelAngle: 180,
    wheelPos: { x: -0.3, y: 181.3 },
    icon: asset('wheel/darkus.webp'),
  },
  {
    id: 'aquos',
    name: 'Aquos',
    attribute: 'Water',
    tagline: 'Fluid and cunning. Endless flow.',
    lore: 'The attribute of water. Aquos Bakugan are tricksters — slippery, adaptable and patient, wearing opponents down until the tide turns.',
    brawler: 'Marucho Marukura',
    color: '#2f6bff',
    glow: '#6fa2ff',
    wheelAngle: 240,
    wheelPos: { x: -155.4, y: 91.6 },
    icon: asset('wheel/aquos.webp'),
  },
  {
    id: 'ventus',
    name: 'Ventus',
    attribute: 'Wind',
    tagline: 'Swift as the storm. Strike first.',
    lore: 'The attribute of wind. Ventus Bakugan are the fastest on the field, striking first and blowing opponents off their Gate Cards.',
    brawler: 'Shun Kazami',
    color: '#19c79a',
    glow: '#6fffd0',
    wheelAngle: 300,
    wheelPos: { x: -157.3, y: -88.2 },
    icon: asset('wheel/ventus.webp'),
  },
]

export const ELEMENT_BY_ID = Object.fromEntries(ELEMENTS.map((e) => [e.id, e])) as Record<
  ElementId,
  ElementInfo
>

/**
 * Attribute relationships from the Ability Card set (BakuProject): "Correlation" cards
 * pair neighbouring attributes, "Diagonal Link" cards pair opposite ones.
 */
export const CORRELATIONS: Record<ElementId, ElementId[]> = {
  pyrus: ['subterra', 'ventus'],
  subterra: ['pyrus', 'haos'],
  haos: ['subterra', 'darkus'],
  darkus: ['haos', 'aquos'],
  aquos: ['darkus', 'ventus'],
  ventus: ['aquos', 'pyrus'],
}

export const DIAGONAL: Record<ElementId, ElementId> = {
  pyrus: 'darkus',
  darkus: 'pyrus',
  aquos: 'subterra',
  subterra: 'aquos',
  ventus: 'haos',
  haos: 'ventus',
}
