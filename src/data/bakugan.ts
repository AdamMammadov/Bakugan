import type { ElementId } from './elements'
import { ROSTER } from './roster'

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
  /** Optional models for this form; falls back to the Bakugan's own models. */
  models?: Bakugan['models']
}

/** A Bakugan in one of its evolved forms (index into `evolutions`). */
export interface Entrant {
  bakugan: Bakugan
  form: number
  /** Ability ids the player has unlocked; all of the Bakugan's cards when omitted. */
  cards?: string[]
  /** G added (or removed) so a matched opponent stands at the player's level. */
  bonusG?: number
  /** Cosmetic colour variant (see season/season.ts SKINS). */
  skin?: string
}

export const formOf = (e: Entrant) => e.bakugan.evolutions[e.form] ?? e.bakugan.evolutions[0]
/** G-Power once the form stands on a Gate Card. */
export const formBrawlG = (e: Entrant) => formOf(e).gPower + (e.bakugan.brawlG - e.bakugan.baseG)
export const formModels = (e: Entrant) => formOf(e).models ?? e.bakugan.models

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
    /** Winged Bakugan hover above the ground instead of standing on it. */
    fly?: boolean
    /** How big this Bakugan stands next to the others (1 = normal). */
    scale?: number
    /** Recolours the model, e.g. an evolution shown with its base form's model. */
    tint?: { color: string; glow: string }
  }
  /** Has its own Character Gate Card (doubles its power). */
  characterGate?: boolean
}

/**
 * Ability cards and their texts come from the BakuProject card database
 * (https://bakuproject.info/cards): each Bakugan's own character cards plus the
 * normal ability cards of its attribute. `estimated: true` marks cards whose text
 * states no G value (movement, gate effects…); their amount was chosen for balance.
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
    models: { ball: 'models/dragonoid/neo-ball.glb' },
    description: 'A proud dragon Bakugan and Dan’s partner, destined to evolve into the Perfect Core guardian.',
    abilities: [
      {
        id: 'boosted-dragon',
        name: 'Boosted Dragon',
        type: 'boost',
        amount: 100,
        effect: 'aura',
        description: "Dragonoid gains +100 G's for the rest of the game. (Non-Stackable)",
      },
      {
        id: 'melt-flare',
        name: 'Melt Flare',
        type: 'boost',
        amount: 120,
        effect: 'flameWave',
        description: "If Boosted Dragon is activated, Dragonoid gains +120 G's.",
      },
      {
        id: 'burning-dragon',
        name: 'Burning Dragon',
        type: 'attack',
        amount: 200,
        effect: 'fireball',
        description: "Pyrus Neo Dragonoid gains +200 G's, and keeps +100 G's for the rest of the game.",
      },
      {
        id: 'strike-dragon',
        name: 'Strike Dragon',
        type: 'attack',
        amount: 100,
        effect: 'fireball',
        description: "Neo Dragonoid individually attacks an opponent's Bakugan and moves to its Gate Card.",
        estimated: true,
      },
      {
        id: 'fire-tornado',
        name: 'Fire Tornado',
        type: 'drain',
        amount: 100,
        effect: 'flameWave',
        description: "Transfer 100 G's from an opponent's Bakugan to your Pyrus Bakugan in battle.",
      },
      {
        id: 'fire-wall',
        name: 'Fire Wall',
        type: 'weaken',
        amount: 50,
        effect: 'flameWave',
        description: "An opponent's Bakugan loses -50 G's.",
      },
      {
        id: 'ring-of-flames',
        name: 'Ring Of Flames',
        type: 'boost',
        amount: 150,
        effect: 'aura',
        description: "Your Pyrus Bakugan gains +150 G's, and loses -100 G's at the start of each of your turns.",
      },
      {
        id: 'pyrus-burst',
        name: 'Pyrus Burst',
        type: 'attack',
        amount: 150,
        effect: 'fireball',
        description:
          "Your Pyrus Bakugan attacks an opponent's Bakugan adjacent to it. If the attack fails, your Pyrus Bakugan is defeated.",
        estimated: true,
      },
    ],
    evolutions: [
      { name: 'Dragonoid', series: 'Battle Brawlers', gPower: 340 },
      { name: 'Delta Dragonoid', series: 'Battle Brawlers', gPower: 450 },
      { name: 'Ultimate Dragonoid', series: 'Battle Brawlers', gPower: 550 },
      // game model ripped from Bakugan: Defenders of the Core (Wii), via The Models Resource
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
    models: { monster: 'models/preyas/monster.glb' },
    description: 'A playful chameleon-like Bakugan that can shift its attribute in the middle of a brawl.',
    abilities: [
      {
        id: 'blue-stealth',
        name: 'Blue Stealth',
        type: 'drain',
        amount: 50,
        effect: 'waterJet',
        description: "Transfers 50 G's from the opponent's Bakugan to Preyas and nullifies the Gate Card he's standing on.",
      },
      {
        id: 'water-refrain',
        name: 'Water Refrain',
        type: 'shield',
        amount: 0,
        effect: 'shieldDome',
        description: 'All previous Ability Cards used in this chain are negated.',
      },
      {
        id: 'water-slap',
        name: 'Water Slap',
        type: 'weaken',
        amount: 50,
        effect: 'waterJet',
        description: "Your opponent's Bakugan loses -50 G's.",
      },
      {
        id: 'aquos-cyclone',
        name: 'Aquos Cyclone',
        type: 'boost',
        amount: 125,
        effect: 'waterSphere',
        description: "Your Aquos Bakugan gains +125 G's on your second turn after this Ability Card's activation.",
      },
      {
        id: 'holograph-divide',
        name: 'Holograph Divide',
        type: 'boost',
        amount: 50,
        effect: 'aura',
        description: "Your Aquos Bakugan gains +50 G's at the start of each of your turns.",
      },
      {
        id: 'dive-mirage',
        name: 'Dive Mirage',
        type: 'attack',
        amount: 100,
        effect: 'waterSphere',
        description: "Move your Aquos Bakugan to another Gate Card that was an opponent's; it is nullified.",
        estimated: true,
      },
      {
        id: 'freezing-wave',
        name: 'Freezing Wave',
        type: 'boost',
        amount: 50,
        effect: 'waterSphere',
        description: "Your Aquos Bakugan gains +50 G's for each continuous and delayed effect it has.",
        estimated: true,
      },
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
    models: { monster: 'models/gorem/monster.glb' },
    description: 'A towering stone warrior with near-impenetrable armour and crushing fists.',
    abilities: [
      {
        id: 'mega-impact',
        name: 'Mega Impact',
        type: 'attack',
        amount: 100,
        effect: 'quake',
        description: "Gorem gains +50 G's, and an opponent's Bakugan in battle loses -100 G's.",
      },
      {
        id: 'sand-trap',
        name: 'Sand Trap',
        type: 'attack',
        amount: 100,
        effect: 'quake',
        description: "Your Subterra Bakugan attacks an opponent's Bakugan adjacent to it.",
        estimated: true,
      },
      {
        id: 'grand-slide',
        name: 'Grand Slide',
        type: 'attack',
        amount: 120,
        effect: 'quake',
        description:
          "Move an opponent's Gate Card next to the Gate Card your Subterra Bakugan is on, then your Subterra Bakugan moves to it.",
        estimated: true,
      },
      {
        id: 'earth-power',
        name: 'Earth Power',
        type: 'boost',
        amount: 50,
        effect: 'aura',
        description: "Increase your Subterra Bakugan's power level by +50 G's.",
      },
      {
        id: 'magma-prominence',
        name: 'Magma Prominence',
        type: 'boost',
        amount: 100,
        effect: 'quake',
        description: 'Change the Attribute Gate Card your Subterra Bakugan is standing on to a Subterra Attribute Gate Card.',
        estimated: true,
      },
      {
        id: 'desert-hole',
        name: 'Desert Hole',
        type: 'boost',
        amount: 75,
        effect: 'aura',
        description:
          "If you have more Gate Cards on the field than your opponent, your Subterra Bakugan gains +75 G's for each more.",
      },
      {
        id: 'copycat',
        name: 'Copycat',
        type: 'shield',
        amount: 0,
        effect: 'shieldDome',
        description: "Copy any power level changes from your opponent's last Ability Card.",
      },
    ],
    evolutions: [
      { name: 'Gorem', series: 'Battle Brawlers', gPower: 380 },
      { name: 'Hammer Gorem', series: 'Battle Brawlers', gPower: 450, models: { monster: 'models/gorem/hammer.glb' } },
      { name: 'Hammer Gorem', series: 'New Vestroia', gPower: 500, models: { monster: 'models/gorem/hammer.glb' } },
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
    models: { monster: 'models/skyress/monster.glb', fly: true },
    description: 'A phoenix of the winds that can be reborn from its own ashes.',
    abilities: [
      {
        id: 'green-nobility-violent-wind',
        name: 'Green Nobility - Violent Wind',
        type: 'boost',
        amount: 100,
        effect: 'tornado',
        description: "Skyress gains +100 G's.",
      },
      {
        id: 'ventus-triple-chain-winds-of-fury',
        name: 'Ventus Triple Chain - Winds Of Fury',
        type: 'attack',
        amount: 100,
        effect: 'tornado',
        description:
          "If you control 3 Ventus Bakugan on the field, each of your opponent's Bakugan adjacent to your Ventus Bakugan loses -100 G's, then it attacks each of them.",
      },
      {
        id: 'air-battle',
        name: 'Air Battle',
        type: 'attack',
        amount: 100,
        effect: 'tornado',
        description: "Move your Ventus Bakugan to a Gate Card with an opponent's Bakugan present and prevent it from opening.",
        estimated: true,
      },
      {
        id: 'storm-breaker',
        name: 'Storm Breaker',
        type: 'weaken',
        amount: 50,
        effect: 'tornado',
        description: 'Nullify the Gate Card your Ventus Bakugan is battling on.',
        estimated: true,
      },
      {
        id: 'blower-plexus',
        name: 'Blower Plexus',
        type: 'boost',
        amount: 50,
        effect: 'aura',
        description: "1 of your Ventus Bakugan gains +50 G's each time it moves. (Non-Stackable)",
      },
      {
        id: 'blow-away',
        name: 'Blow Away',
        type: 'shield',
        amount: 0,
        effect: 'shieldDome',
        description: "Move an opponent's Bakugan to another Gate Card.",
      },
      {
        id: 'backdraft',
        name: 'Backdraft',
        type: 'shield',
        amount: 0,
        effect: 'tornado',
        description: 'Return a Bakugan back to its owner.',
      },
    ],
    evolutions: [
      { name: 'Skyress', series: 'Battle Brawlers', gPower: 360 },
      {
        name: 'Storm Skyress',
        series: 'Battle Brawlers',
        gPower: 450,
        models: { monster: 'models/skyress/storm.glb', fly: true },
      },
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
    models: { monster: 'models/tigrerra/monster.glb' },
    description: 'A fierce tiger guardian with razor claws and lightning reflexes.',
    abilities: [
      {
        id: 'crystal-fang',
        name: 'Crystal Fang',
        type: 'boost',
        amount: 80,
        effect: 'aura',
        description: "Tigrerra gains +80 G's.",
      },
      {
        id: 'cut-in-saber',
        name: 'Cut In Saber',
        type: 'attack',
        amount: 120,
        effect: 'lightBeam',
        description: 'Allows Tigrerra to enter the current battle from your hand or field.',
        estimated: true,
      },
      {
        id: 'lightning-tornado',
        name: 'Lightning Tornado',
        type: 'drain',
        amount: 100,
        effect: 'lightBeam',
        description: "Transfer 100 G's from your opponent's Bakugan to your Haos Bakugan.",
      },
      {
        id: 'enhancement',
        name: 'Enhancement',
        type: 'boost',
        amount: 75,
        effect: 'aura',
        description: "An allied Bakugan gains +75 G's.",
      },
      {
        id: 'shade-ability',
        name: 'Shade Ability',
        type: 'weaken',
        amount: 150,
        effect: 'lightBeam',
        description: "Negate all Ability Card effects and power level changes on an opponent's Bakugan.",
        estimated: true,
      },
      {
        id: 'ability-counter',
        name: 'Ability Counter',
        type: 'shield',
        amount: 0,
        effect: 'shieldDome',
        description: "Negate an opponent's Ability Card in battle, or that targets your Haos Bakugan.",
      },
      {
        id: 'lightning-shield',
        name: 'Lightning Shield',
        type: 'shield',
        amount: 0,
        effect: 'shieldDome',
        description: 'The Gate Card your Haos Bakugan is standing on is nullified.',
      },
    ],
    evolutions: [
      { name: 'Tigrerra', series: 'Battle Brawlers', gPower: 340 },
      { name: 'Blade Tigrerra', series: 'Battle Brawlers', gPower: 450, models: { monster: 'models/tigrerra/blade.glb' } },
      { name: 'Blade Tigrerra', series: 'New Vestroia', gPower: 500, models: { monster: 'models/tigrerra/blade.glb' } },
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
    models: { ball: 'models/hydranoid/ball.glb', monster: 'models/hydranoid/monster.glb', scale: 1.6 },
    description: 'A ravenous dark dragon that grows more heads — and more power — with each evolution.',
    abilities: [
      {
        id: 'oregano-revenge',
        name: 'Oregano Revenge',
        type: 'attack',
        amount: 100,
        effect: 'shadowOrb',
        description:
          "Each of your opponent's Bakugan in battle loses -100 G's, and up to the same number of yours in battle gain +100 G's.",
      },
      {
        id: 'dual-gazer',
        name: 'Dual Gazer',
        type: 'attack',
        amount: 50,
        effect: 'shadowOrb',
        description: "If Dual Hydranoid is your last remaining Bakugan, it gains +50 G's and attacks 2 Bakugan on the field.",
      },
      {
        id: 'eye-for-an-eye',
        name: 'Eye For An Eye',
        type: 'weaken',
        amount: 200,
        effect: 'shadowOrb',
        description: "Both 1 of your Darkus Bakugan and an opponent's Bakugan lose -200 G's.",
      },
      {
        id: 'destroy-force-down',
        name: 'Destroy Force Down',
        type: 'weaken',
        amount: 25,
        effect: 'shadowOrb',
        description: "Each Bakugan on the field unowned by you loses -25 G's. (-15 G's in Team Battles)",
      },
      {
        id: 'call-of-the-void',
        name: 'Call Of The Void',
        type: 'boost',
        amount: 200,
        effect: 'aura',
        description: "If your deck is empty, your Darkus Bakugan gains +200 G's.",
      },
      {
        id: 'merge-shield',
        name: 'Merge Shield',
        type: 'shield',
        amount: 0,
        effect: 'shieldDome',
        description: "Hydranoid copies all G's gained by an opponent's Bakugan in this battle.",
      },
      {
        id: 'dark-eye-superior',
        name: 'Dark Eye Superior',
        type: 'shield',
        amount: 0,
        effect: 'shieldDome',
        description: "Negate an opponent's Ability Card in battle, or that targets your Darkus Bakugan.",
      },
    ],
    evolutions: [
      { name: 'Hydranoid', series: 'Battle Brawlers', gPower: 450 },
      {
        name: 'Dual Hydranoid',
        series: 'Battle Brawlers',
        gPower: 480,
        models: { monster: 'models/hydranoid/dual.glb', scale: 1.25 },
      },
      // three-headed Alpha uses the closest model we have: the upright, many-headed Dual Hydranoid
      {
        name: 'Alpha Hydranoid',
        series: 'Battle Brawlers',
        gPower: 550,
        models: { monster: 'models/hydranoid/dual.glb', scale: 1.25 },
      },
    ],
  },
]

// the launch roster: 6 more Bakugan per attribute (src/data/roster.ts)
/** 3D models for roster Bakugan (the roster file itself is generated by tools/data/roster.py). */
const ROSTER_MODELS: Record<string, Bakugan['models']> = {
  ravenoid: { monster: 'models/ravenoid/monster.glb', fly: true },
  harpus: { monster: 'models/harpus/monster.glb', fly: true },
  sirenoid: { monster: 'models/sirenoid/monster.glb', fly: true },
  fourtress: { monster: 'models/fourtress/monster.glb' },
  tentaclear: { monster: 'models/tentaclear/monster.glb', fly: true },
  cycloid: { monster: 'models/cycloid/monster.glb' },
  wilda: { monster: 'models/wilda/monster.glb', scale: 1.15 },
}
for (const b of ROSTER) if (ROSTER_MODELS[b.id]) b.models = ROSTER_MODELS[b.id]
// Magma Wilda has no model of its own yet: Wilda's, glowing like lava
const magma = ROSTER.find((b) => b.id === 'wilda')?.evolutions.find((e) => e.name === 'Magma Wilda')
if (magma) magma.models = { ...ROSTER_MODELS.wilda, tint: { color: '#8a2a10', glow: '#ff6a1a' } }

BAKUGAN.push(...ROSTER)

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

/** Plain-language summary of what an ability does in the arena. */
export function battleEffect(a: Ability) {
  switch (a.type) {
    case 'attack':
      return `Strikes the opponent (power ${a.amount}). Damage grows with your G-Power.`
    case 'boost':
      return `Raises your G-Power by ${a.amount}, so every later hit lands harder.`
    case 'weaken':
      return `Cuts the opponent's G-Power by ${a.amount} and chips their life.`
    case 'drain':
      return `Steals ${a.amount}G from the opponent and drains some of their life into yours.`
    case 'shield':
      return `Raises a shield that blocks the opponent's next attack or ability.`
  }
}
