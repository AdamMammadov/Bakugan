import type { ElementId } from './elements'

/**
 * How an ability works in battle:
 * - attack: a strike that deals damage, scaled by the G-Power ratio
 * - boost:  raises the user's G-Power
 * - weaken: lowers the opponent's G-Power
 * - drain:  steals G-Power (and some life) from the opponent
 * - shield: blocks the opponent's next attack or ability
 */
export type AbilityType = 'attack' | 'boost' | 'weaken' | 'drain' | 'shield'

export type EffectPreset =
  | 'fireball'
  | 'flameWave'
  | 'waterSphere'
  | 'waterJet'
  | 'quake'
  | 'tornado'
  | 'lightBeam'
  | 'shadowOrb'
  | 'shieldDome'
  | 'aura'

export interface Ability {
  id: string
  name: string
  description: string
  type: AbilityType
  /** G amount the ability adds, removes or transfers (attack power for attacks). */
  amount: number
  /** Visual effect preset played on activation. */
  effect: EffectPreset
  /** True when the G value is not stated by the wiki and was picked for balance. */
  estimated?: boolean
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
  models?: {
    ball?: string
    monster?: string
    /** Extra rotation (radians) if the monster model does not face +Z. */
    monsterYaw?: number
  }
}

/**
 * Ability names, effects and G values follow the Bakugan Wiki (Battle Brawlers anime).
 * `estimated: true` marks values the wiki does not state; those were chosen for game balance.
 */
export const BAKUGAN: Bakugan[] = [
  {
    id: 'dragonoid',
    name: 'Dragonoid',
    element: 'pyrus',
    brawler: 'Dan Kuso',
    series: 'Battle Brawlers',
    baseG: 340,
    brawlG: 440,
    description: 'A proud dragon Bakugan and Dan’s partner, destined to evolve into the Perfect Core guardian.',
    abilities: [
      { id: 'boosted-dragon', name: 'Boosted Dragon', type: 'boost', amount: 100, effect: 'aura', description: 'Adds 100 Gs to Dragonoid for the rest of the game.' },
      { id: 'fire-wall', name: 'Fire Wall', type: 'weaken', amount: 50, effect: 'flameWave', description: 'Subtracts 50 Gs from the opponent.' },
      { id: 'fire-tornado', name: 'Fire Tornado', type: 'drain', amount: 100, effect: 'flameWave', description: 'Transfers 100 Gs from the opponent to Dragonoid.' },
      { id: 'boosted-ultima', name: 'Boosted Ultima', type: 'attack', amount: 200, effect: 'fireball', description: 'Adds 200 Gs to Dragonoid and subtracts 100 Gs from the opponent.' },
      { id: 'd-strike', name: 'D-Strike', type: 'attack', amount: 200, effect: 'fireball', description: 'Adds 200 Gs to Delta Dragonoid.' },
      { id: 'wall-burst', name: 'Wall Burst', type: 'shield', amount: 100, effect: 'shieldDome', description: 'Reflects the opponent’s ability back at it.', estimated: true },
    ],
    evolutions: [
      { name: 'Dragonoid', series: 'Battle Brawlers', gPower: 340 },
      { name: 'Delta Dragonoid', series: 'Battle Brawlers', gPower: 450 },
      { name: 'Ultimate Dragonoid', series: 'Battle Brawlers', gPower: 550 },
      { name: 'Neo Dragonoid', series: 'New Vestroia', gPower: 500 },
    ],
  },
  {
    id: 'preyas',
    name: 'Preyas',
    element: 'aquos',
    brawler: 'Marucho Marukura',
    series: 'Battle Brawlers',
    baseG: 340,
    brawlG: 440,
    description: 'A playful chameleon-like Bakugan that can shift its attribute in the middle of a brawl.',
    abilities: [
      { id: 'blue-stealth', name: 'Blue Stealth', type: 'drain', amount: 50, effect: 'waterJet', description: 'Transfers 50 Gs from the opponent to Preyas.' },
      { id: 'blue-squall', name: 'Blue Squall', type: 'weaken', amount: 200, effect: 'waterJet', description: 'Subtracts 200 Gs from the opponent.' },
      { id: 'wave-shield', name: 'Wave Shield', type: 'shield', amount: 100, effect: 'shieldDome', description: 'Nullifies the opponent’s ability.', estimated: true },
      { id: 'water-refrain', name: 'Water Refrain', type: 'shield', amount: 100, effect: 'waterSphere', description: 'Blocks the opponent’s abilities from activating for a short time.', estimated: true },
      { id: 'dive-mirage', name: 'Dive Mirage', type: 'attack', amount: 100, effect: 'waterSphere', description: 'Preyas dives into water and strikes from another Gate Card.', estimated: true },
      { id: 'aquos-torrent', name: 'Aquos Torrent', type: 'attack', amount: 150, effect: 'waterJet', description: 'A crushing water jet slams into the opponent.', estimated: true },
    ],
    evolutions: [
      { name: 'Preyas', series: 'Battle Brawlers', gPower: 340 },
      { name: 'Preyas II', series: 'Battle Brawlers', gPower: 400 },
      { name: 'Preyas', series: 'New Vestroia', gPower: 500 },
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
      { id: 'mega-impact', name: 'Mega Impact', type: 'attack', amount: 100, effect: 'quake', description: 'Adds 50 Gs to Gorem and subtracts 100 Gs from the opponent.' },
      { id: 'gorem-punch', name: 'Gorem Punch', type: 'attack', amount: 200, effect: 'quake', description: 'Adds 200 Gs to Gorem and subtracts 100 Gs from the opponent.' },
      { id: 'grand-impact', name: 'Grand Impact', type: 'drain', amount: 200, effect: 'quake', description: 'Transfers 200 Gs from the opponent to Hammer Gorem.' },
      { id: 'magma-prominence', name: 'Magma Prominence', type: 'boost', amount: 100, effect: 'aura', description: 'Changes the Gate Card’s attribute to Subterra.', estimated: true },
      { id: 'copycat', name: 'Copycat', type: 'shield', amount: 100, effect: 'shieldDome', description: 'Copies the ability the opponent is using.', estimated: true },
      { id: 'grand-slide', name: 'Grand Slide', type: 'attack', amount: 100, effect: 'quake', description: 'A landslide shifts the battlefield and hits the opponent.', estimated: true },
    ],
    evolutions: [
      { name: 'Gorem', series: 'Battle Brawlers', gPower: 380 },
      { name: 'Hammer Gorem', series: 'Battle Brawlers', gPower: 450 },
      { name: 'Hammer Gorem', series: 'New Vestroia', gPower: 500 },
    ],
  },
  {
    id: 'skyress',
    name: 'Skyress',
    element: 'ventus',
    brawler: 'Shun Kazami',
    series: 'Battle Brawlers',
    baseG: 360,
    brawlG: 460,
    description: 'A phoenix of the winds that can be reborn from its own ashes.',
    abilities: [
      { id: 'green-nobility', name: 'Green Nobility', type: 'boost', amount: 100, effect: 'tornado', description: 'Adds 100 Gs to Skyress.' },
      { id: 'winds-of-fury', name: 'Winds of Fury', type: 'weaken', amount: 50, effect: 'tornado', description: 'Subtracts 50 Gs from the opponent.' },
      { id: 'destruction-meteor-storm', name: 'Destruction Meteor Storm', type: 'attack', amount: 100, effect: 'tornado', description: 'Adds 100 Gs to Storm Skyress; meteors rain down on the opponent.' },
      { id: 'whirlwind-lightning-sword', name: 'Whirlwind Lightning Sword', type: 'drain', amount: 200, effect: 'tornado', description: 'Transfers 200 Gs from the opponent to Storm Skyress.' },
      { id: 'green-wave', name: 'Green Wave', type: 'boost', amount: 200, effect: 'aura', description: 'Adds 200 Gs to Storm Skyress.' },
      { id: 'blow-away', name: 'Blow Away', type: 'shield', amount: 100, effect: 'shieldDome', description: 'Blasts the opponent off the Gate Card.', estimated: true },
    ],
    evolutions: [
      { name: 'Skyress', series: 'Battle Brawlers', gPower: 360 },
      { name: 'Storm Skyress', series: 'Battle Brawlers', gPower: 450 },
    ],
  },
  {
    id: 'tigrerra',
    name: 'Tigrerra',
    element: 'haos',
    brawler: 'Runo Misaki',
    series: 'Battle Brawlers',
    baseG: 340,
    brawlG: 440,
    description: 'A fierce tiger guardian with razor claws and lightning reflexes.',
    abilities: [
      { id: 'lightning-shield', name: 'Lightning Shield', type: 'shield', amount: 100, effect: 'shieldDome', description: 'Nullifies the opponent’s Gate Card.', estimated: true },
      { id: 'lightning-tornado', name: 'Lightning Tornado', type: 'attack', amount: 100, effect: 'lightBeam', description: 'Adds 100 Gs to Tigrerra and subtracts 100 Gs from the opponent.' },
      { id: 'velocity-fang', name: 'Velocity Fang', type: 'attack', amount: 100, effect: 'lightBeam', description: 'Nullifies the opponent’s ability and subtracts 100 Gs from the opponent.' },
      { id: 'hyper-velocity-fang', name: 'Hyper Velocity Fang', type: 'weaken', amount: 300, effect: 'lightBeam', description: 'Nullifies the opponent’s ability and subtracts 300 Gs from the opponent.' },
      { id: 'saber-glosser', name: 'Saber Glosser', type: 'drain', amount: 400, effect: 'lightBeam', description: 'Transfers 400 Gs from the opponent to Blade Tigrerra.' },
      { id: 'shade-ability', name: 'Shade Ability', type: 'shield', amount: 100, effect: 'shieldDome', description: 'Nullifies the opponent’s abilities anywhere on the field.', estimated: true },
    ],
    evolutions: [
      { name: 'Tigrerra', series: 'Battle Brawlers', gPower: 340 },
      { name: 'Blade Tigrerra', series: 'Battle Brawlers', gPower: 450 },
      { name: 'Blade Tigrerra', series: 'New Vestroia', gPower: 500 },
    ],
  },
  {
    id: 'hydranoid',
    name: 'Hydranoid',
    element: 'darkus',
    brawler: 'Masquerade',
    series: 'Battle Brawlers',
    baseG: 450,
    brawlG: 550,
    description: 'A ravenous dark dragon that grows more heads — and more power — with each evolution.',
    abilities: [
      { id: 'chaos-of-the-darkness', name: 'Chaos of the Darkness', type: 'drain', amount: 100, effect: 'shadowOrb', description: 'Steals 100 Gs from the opponent.' },
      { id: 'gravity-chamber', name: 'Gravity Chamber', type: 'attack', amount: 150, effect: 'shadowOrb', description: 'A black gravity vortex pulls the opponent in.', estimated: true },
      { id: 'destruction-buster', name: 'Destruction Buster', type: 'boost', amount: 100, effect: 'aura', description: 'Adds 100 Gs to Hydranoid and nullifies the opponent’s ability.' },
      { id: 'auragano-revenge', name: 'Auragano Revenge', type: 'attack', amount: 100, effect: 'shadowOrb', description: 'Adds 100 Gs to Hydranoid and subtracts 100 Gs from the opponent.' },
      { id: 'dual-gazer', name: 'Dual Gazer', type: 'attack', amount: 50, effect: 'shadowOrb', description: 'Adds 50 Gs; twin dark beams from both heads.' },
      { id: 'gazer-exedra', name: 'Gazer Exedra', type: 'attack', amount: 100, effect: 'shadowOrb', description: 'Adds 100 Gs and attacks the opponent from any position.' },
    ],
    evolutions: [
      { name: 'Hydranoid', series: 'Battle Brawlers', gPower: 450 },
      { name: 'Dual Hydranoid', series: 'Battle Brawlers', gPower: 480 },
      { name: 'Alpha Hydranoid', series: 'Battle Brawlers', gPower: 550 },
    ],
  },
]

export const bakuganForElement = (element: ElementId) => BAKUGAN.filter((b) => b.element === element)

/** Short label for an ability's battle effect, e.g. "+100G" or "BLOCK". */
export function abilityLabel(a: Ability) {
  switch (a.type) {
    case 'attack':
      return `${a.amount} ATK`
    case 'boost':
      return `+${a.amount}G`
    case 'weaken':
      return `−${a.amount}G FOE`
    case 'drain':
      return `STEAL ${a.amount}G`
    case 'shield':
      return 'BLOCK'
  }
}

/** G-Power an ability adds to its user outside of battle (the Viewer's showcase). */
export const abilitySelfBonus = (a: Ability) => (a.type === 'shield' || a.type === 'weaken' ? 0 : a.amount)
