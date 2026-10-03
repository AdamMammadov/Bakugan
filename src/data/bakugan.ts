import type { ElementId } from './elements'

export interface Ability {
  id: string
  name: string
  /** G-Power added while the ability is active. */
  gBoost: number
  description: string
  /** Visual effect preset played on activation. */
  effect: 'fireball' | 'flameWave' | 'waterSphere' | 'waterJet' | 'quake' | 'tornado' | 'lightBeam' | 'shadowOrb'
}

export interface Evolution {
  name: string
  series: string
  gPower: number
}

export interface Bakugan {
  id: string
  name: string
  element: ElementId
  brawler: string
  series: string
  /** G-Power in ball form and after standing on a Gate Card. */
  baseG: number
  brawlG: number
  description: string
  abilities: Ability[]
  evolutions: Evolution[]
  /**
   * Optional glTF models dropped into /public/models/<id>/.
   * When missing, the viewer renders a procedural placeholder.
   */
  models?: { ball?: string; monster?: string }
}

export const BAKUGAN: Bakugan[] = [
  {
    id: 'dragonoid',
    name: 'Dragonoid',
    element: 'pyrus',
    brawler: 'Dan Kuso',
    series: 'Battle Brawlers',
    baseG: 340,
    brawlG: 450,
    description: 'A proud dragon Bakugan and Dan’s partner, destined to evolve into the Perfect Core guardian.',
    abilities: [
      { id: 'boosted-dragon', name: 'Boosted Dragon', gBoost: 100, description: 'Fires a blazing fireball from its jaws.', effect: 'fireball' },
      { id: 'fire-tornado', name: 'Fire Tornado', gBoost: 100, description: 'A spiralling wave of flame engulfs the field.', effect: 'flameWave' },
    ],
    evolutions: [
      { name: 'Dragonoid', series: 'Battle Brawlers', gPower: 340 },
      { name: 'Delta Dragonoid', series: 'Battle Brawlers', gPower: 400 },
      { name: 'Ultimate Dragonoid', series: 'Battle Brawlers', gPower: 600 },
      { name: 'Neo Dragonoid', series: 'New Vestroia', gPower: 900 },
    ],
  },
  {
    id: 'preyas',
    name: 'Preyas',
    element: 'aquos',
    brawler: 'Marucho Marukura',
    series: 'Battle Brawlers',
    baseG: 330,
    brawlG: 400,
    description: 'A playful chameleon-like Bakugan that can shift its attribute in the middle of a brawl.',
    abilities: [
      { id: 'aqua-sphere', name: 'Aqua Sphere', gBoost: 80, description: 'Traps the opponent in a sphere of water.', effect: 'waterSphere' },
      { id: 'water-jet', name: 'Blue Stream', gBoost: 100, description: 'A high-pressure water jet blasts forward.', effect: 'waterJet' },
    ],
    evolutions: [
      { name: 'Preyas', series: 'Battle Brawlers', gPower: 330 },
      { name: 'Preyas II', series: 'Battle Brawlers', gPower: 400 },
      { name: 'Preyas (New Vestroia)', series: 'New Vestroia', gPower: 500 },
    ],
  },
  {
    id: 'gorem',
    name: 'Gorem',
    element: 'subterra',
    brawler: 'Julie Makimoto',
    series: 'Battle Brawlers',
    baseG: 380,
    brawlG: 480,
    description: 'A towering stone warrior with near-impenetrable armour and crushing fists.',
    abilities: [
      { id: 'quake-crusher', name: 'Quake Crusher', gBoost: 100, description: 'Slams the ground, sending a shockwave outward.', effect: 'quake' },
      { id: 'rock-hammer', name: 'Gorem Hammer', gBoost: 80, description: 'A crushing double-fisted strike.', effect: 'quake' },
    ],
    evolutions: [
      { name: 'Gorem', series: 'Battle Brawlers', gPower: 380 },
      { name: 'Hammer Gorem', series: 'Battle Brawlers', gPower: 550 },
    ],
  },
  {
    id: 'skyress',
    name: 'Skyress',
    element: 'ventus',
    brawler: 'Shun Kazami',
    series: 'Battle Brawlers',
    baseG: 350,
    brawlG: 440,
    description: 'A phoenix of the winds that can be reborn from its own ashes.',
    abilities: [
      { id: 'green-tornado', name: 'Green Tornado', gBoost: 100, description: 'Summons a cutting cyclone of wind.', effect: 'tornado' },
      { id: 'blowing-wind', name: 'Blowing Wind', gBoost: 80, description: 'A gale that pushes the opponent back.', effect: 'tornado' },
    ],
    evolutions: [
      { name: 'Skyress', series: 'Battle Brawlers', gPower: 350 },
      { name: 'Storm Skyress', series: 'Battle Brawlers', gPower: 500 },
    ],
  },
  {
    id: 'tigrerra',
    name: 'Tigrerra',
    element: 'haos',
    brawler: 'Runo Misaki',
    series: 'Battle Brawlers',
    baseG: 340,
    brawlG: 430,
    description: 'A fierce tiger guardian with razor claws and lightning reflexes.',
    abilities: [
      { id: 'lightning-shield', name: 'Lightning Shield', gBoost: 100, description: 'A wall of blinding light repels attacks.', effect: 'lightBeam' },
      { id: 'velocity-fang', name: 'Velocity Fang', gBoost: 80, description: 'A lightning-fast slashing strike.', effect: 'lightBeam' },
    ],
    evolutions: [
      { name: 'Tigrerra', series: 'Battle Brawlers', gPower: 340 },
      { name: 'Blade Tigrerra', series: 'Battle Brawlers', gPower: 500 },
    ],
  },
  {
    id: 'hydranoid',
    name: 'Hydranoid',
    element: 'darkus',
    brawler: 'Masquerade',
    series: 'Battle Brawlers',
    baseG: 400,
    brawlG: 500,
    description: 'A ravenous dark dragon that grows more heads — and more power — with each evolution.',
    abilities: [
      { id: 'destruction-ray', name: 'Destruction Ray', gBoost: 100, description: 'A beam of pure darkness erupts from its maw.', effect: 'shadowOrb' },
      { id: 'dark-hole', name: 'Dark Hole', gBoost: 120, description: 'A gravity well that swallows the light.', effect: 'shadowOrb' },
    ],
    evolutions: [
      { name: 'Hydranoid', series: 'Battle Brawlers', gPower: 400 },
      { name: 'Dual Hydranoid', series: 'Battle Brawlers', gPower: 500 },
      { name: 'Alpha Hydranoid', series: 'Battle Brawlers', gPower: 600 },
    ],
  },
]

export const bakuganForElement = (element: ElementId) => BAKUGAN.filter((b) => b.element === element)
