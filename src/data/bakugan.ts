import type { ElementId } from './elements'
import { ORIGINAL_ABILITIES, ROSTER } from './roster'

/**
 * How an ability works in battle (a card counts for the battle it is played in; playing one is a move). The higher
 * G-Power wins the clash, and a Bakugan that drops to 0 G is defeated at once:
 * - attack: the Bakugan strikes with it: the opponent's G-Power drops by its amount at once
 * - boost:  raises the user's G-Power
 * - weaken: lowers the opponent's G-Power
 * - drain:  steals G-Power from the opponent (they lose it, the user gains it)
 * - shield: NULLIFY: cancels the opponent's last ability card (its G change is undone)
 * - finisher: wins the battle outright; playable only once its Bakugan has gathered its power with other cards in
 *   the battle (engine FINISHER_CHARGE)
 */
export type AbilityType = 'attack' | 'boost' | 'weaken' | 'drain' | 'shield' | 'finisher'

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
  /** Chaos Magnalia's Darkus beam and pillar of darkness. */
  | 'chaosBeam'

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
  /** This form's own ability cards; the Bakugan's cards when omitted. */
  abilities?: Ability[]
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
/** The ability cards a Bakugan has in one of its forms (an evolution can bring cards of its own). */
export const abilitiesOf = (bakugan: Bakugan, form = 0) => bakugan.evolutions[form]?.abilities ?? bakugan.abilities

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
    /**
     * How much the inventory's try-on preview may grow this Bakugan if it is slim (default 1.3, so slim
     * ones keep up with bulky ones); lower for a tall one whose top would leave the preview, below 1 to
     * shrink one whose wings would. (The showroom frames every Bakugan to its stage by itself.)
     */
    fill?: number
    /**
     * How big this Bakugan stands next to the others (1 = normal). A giant (well above 1.4) makes the arena's
     * view pull back so it fits, and the others look small beside it.
     */
    scale?: number
    /**
     * How much bigger than its stage the showroom shows this Bakugan (default 1: it always fits). A giant can
     * reach past the stage's edges, behind the panels.
     */
    stage?: number
    /**
     * How long or wide the model may be, in heights (default 2, flyers 1.25). Long or wide-winged
     * Bakugan are shrunk to fit this, so raise it for those that would otherwise look small.
     */
    length?: number
    /** Recolours the model, e.g. an evolution shown with its base form's model. */
    tint?: { color: string; glow: string }
  }
  /** Has its own Character Gate Card (doubles its power). */
  characterGate?: boolean
}

/**
 * Each Bakugan's ability cards are its own: its character cards from the card database, then the abilities it uses in the anime and the video games, from its
 * page on the Bakugan Wiki (https://bakugan.fandom.com), with their G values halved to the card game's
 * scale. Only a Bakugan with too few of those gets normal ability cards of its attribute. All are picked
 * by tools/data/roster.py (the original six's into ORIGINAL_ABILITIES). `estimated: true` marks cards
 * whose text states no G value; their effect and amount were chosen for balance.
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
    // its wings are much bigger than its body, so it is drawn larger and may reach past the showroom's stage
    models: {
      ball: 'models/dragonoid/neo-ball.glb',
      monster: 'models/dragonoid/monster.glb',
      fly: true,
      scale: 1.35,
      stage: 1.5,
    },
    description: 'A proud dragon Bakugan and Dan’s partner, destined to evolve into the Perfect Core guardian.',
    abilities: ORIGINAL_ABILITIES.dragonoid,
    evolutions: [
      { name: 'Dragonoid', series: 'Battle Brawlers', gPower: 340 },
      {
        name: 'Delta Dragonoid',
        series: 'Battle Brawlers',
        gPower: 450,
        models: { monster: 'models/dragonoid/delta.glb', scale: 1.25 },
      },
      // Ultimate has no model of its own yet: Delta's, recoloured
      {
        name: 'Ultimate Dragonoid',
        series: 'Battle Brawlers',
        gPower: 550,
        models: { monster: 'models/dragonoid/delta.glb', scale: 1.3, tint: { color: '#b3121a', glow: '#ffc93c' } },
      },
      {
        name: 'Neo Dragonoid',
        series: 'New Vestroia',
        gPower: 500,
        // made from an anime picture (sent by the player), cut into parts by where they lie (the tail
        // curls round in front of the legs) and skinned, its loose spikes and ribs riding with the spot they sit on;
        // left without an ink outline, which broke up into dark blotches over the ribs
        models: { monster: 'models/dragonoid/neo.glb', scale: 1.15 },
      },
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
    abilities: ORIGINAL_ABILITIES.preyas,
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
    abilities: ORIGINAL_ABILITIES.gorem,
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
    models: { monster: 'models/skyress/monster.glb', fly: true, length: 1.7 },
    description: 'A phoenix of the winds that can be reborn from its own ashes.',
    abilities: ORIGINAL_ABILITIES.skyress,
    evolutions: [
      { name: 'Skyress', series: 'Battle Brawlers', gPower: 360 },
      {
        name: 'Storm Skyress',
        series: 'Battle Brawlers',
        gPower: 450,
        models: { monster: 'models/skyress/storm.glb', fly: true, length: 1.6 },
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
    abilities: ORIGINAL_ABILITIES.tigrerra,
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
    models: { ball: 'models/hydranoid/ball.glb', monster: 'models/hydranoid/monster.glb', scale: 1.2, length: 2.9 },
    description: 'A ravenous dark dragon that grows more heads — and more power — with each evolution.',
    abilities: ORIGINAL_ABILITIES.hydranoid,
    evolutions: [
      { name: 'Hydranoid', series: 'Battle Brawlers', gPower: 450 },
      {
        name: 'Dual Hydranoid',
        series: 'Battle Brawlers',
        gPower: 480,
        models: { monster: 'models/hydranoid/dual.glb', scale: 1.25 },
      },
      {
        name: 'Alpha Hydranoid',
        series: 'Battle Brawlers',
        gPower: 550,
        // made from an AI redraw of the anime art (sent by the player); its third tail, which came out
        // short and broken off, grown again from a copy of another (tools/ai/regrow_tail.py), its near-black colours
        // matched to the picture, skinned and inked
        models: { monster: 'models/hydranoid/alpha.glb', scale: 0.95 },
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
  'preyas-diablo': { monster: 'models/preyas-diablo/monster.glb' },
  trox: { monster: 'models/trox/monster.glb', scale: 1.1 },
  hydorous: { monster: 'models/hydorous/monster.glb', scale: 1.1 },
  howlkor: { monster: 'models/howlkor/monster.glb', scale: 1.15 },
  manion: { monster: 'models/manion/monster.glb', scale: 1.1 },
  pegatrix: { monster: 'models/pegatrix/monster.glb', scale: 1.15 },
  // made from a game render, its face and white armour fixed up from the render, inked and rigged
  nemus: { ball: 'models/nemus/ball.glb', monster: 'models/nemus/monster.glb', scale: 1.1 },
  // made from a picture, tinted towards the art and rigged like the others
  hades: { monster: 'models/hades/monster.glb', scale: 1.15 },
  elfin: { ball: 'models/elfin/ball.glb', monster: 'models/elfin/monster.glb', fly: true, scale: 1.1 },
  // shape made from an anime frame (tail shortened), painted from the same frame, with a
  // drawn face; inked and rigged
  ingram: { ball: 'models/ingram/ball.glb', monster: 'models/ingram/monster.glb', fly: true, scale: 0.8 },
  // made from a picture, its tail mace lifted off the wing it was fused into, inked and rigged
  leonidas: { monster: 'models/leonidas/monster.glb', scale: 1.15 },
  // made from the Wii game's render (lower legs drawn in after the anime), its face painted
  // back from the render, recoloured towards it, inked and rigged
  brontes: { monster: 'models/brontes/monster.glb', scale: 1.05, fill: 1.12 },
  // made from the Wii game's render (recoloured Aquos, a foot and a blade tip drawn in), its
  // face painted back from the render, the armour brightened towards it, inked and rigged
  elico: { monster: 'models/elico/monster.glb', scale: 1, fill: 1 },
  // made from the Wii game's render (a fin tip drawn in), which it turned into a front-facing
  // flyer with both wings spread; inked and rigged
  altair: { monster: 'models/altair/monster.glb', fly: true, scale: 0.85 },
  wilda: { monster: 'models/wilda/monster.glb', scale: 1.15 },
  // made from an anime picture (a tail blade it left floating removed); the orange spots on the
  // armour it lost painted back after the picture, the nose horn and eyes repainted, inked and rigged
  helios: { monster: 'models/helios/monster.glb', fly: true, length: 1.6, fill: 0.66 },
  // ripped from Bakugan Battle Brawlers (Xbox 360); its T-posed arms bent down, skinned and inked
  vladitor: { ball: 'models/vladitor/ball.glb', monster: 'models/vladitor/monster.glb', scale: 1.1 },
  // made from a picture (sent by the player), recoloured to the art's browns and near-black armour,
  // its eye visor repainted; skinned and inked (inkThin keeps the outline from specking through its bumpy surface)
  'premo-vulcan': { monster: 'models/premo-vulcan/monster.glb', scale: 1.1 },
  // ripped from Bakugan Battle Brawlers (Xbox 360) in the game's own Pyrus colours; skinned and inked
  falconeer: { monster: 'models/falconeer/monster.glb', fly: true, length: 1.6 },
  // ripped from Bakugan Battle Brawlers (Xbox 360) in the game's own Aquos colours; skinned and inked
  robotallion: { monster: 'models/robotallion/monster.glb' },
  // ripped from Bakugan Battle Brawlers (Xbox 360) with the game's Pyrus textures (the rip's material points at
  // its Subterra ones); skinned and inked, with its ball from the same game
  saurus: { ball: 'models/saurus/ball.glb', monster: 'models/saurus/monster.glb' },
  // ripped from Bakugan Battle Brawlers (Xbox 360) in the game's Ventus colours; skinned and inked (inkThin keeps the
  // outline from specking through its paper-thin wings), with its ball from the same game
  monarus: { ball: 'models/monarus/ball.glb', monster: 'models/monarus/monster.glb', fly: true, scale: 0.75 },
  // ripped from Bakugan Battle Brawlers (Xbox 360) in the game's Darkus colours; skinned and inked, with its ball
  'fear-ripper': { ball: 'models/fear-ripper/ball.glb', monster: 'models/fear-ripper/monster.glb' },
  // ripped from Bakugan Battle Brawlers (Xbox 360) with the game's Haos textures (the rip's material points at its
  // Darkus ones); its T-posed arms bent down, skinned and inked, with its ball
  laserman: { ball: 'models/laserman/ball.glb', monster: 'models/laserman/monster.glb' },
  // made from an AI picture after two anime frames (sent by the player); a hole in its back capped,
  // the brown lifted and the leg armour turned bronze after the picture; skinned and inked
  baliton: { monster: 'models/baliton/monster.glb', scale: 0.85 },
  // the game owner's own Bakugan: made from an AI picture after the anime (sent by the owner); the
  // glowing wing markings brightened to the picture's green; skinned and inked (inkThin for the thin wings)
  dharak: { monster: 'models/dharak/monster.glb', fly: true, scale: 2.3, length: 1.7, stage: 1.6 },
  // made from an anime picture (sent by the player); its wings are crystal sheets, so the outline
  // skips thin spots (inkThin); skinned and inked
  rubanoid: { monster: 'models/rubanoid/monster.glb', length: 1.6 },
}
for (const b of ROSTER) if (ROSTER_MODELS[b.id]) b.models = ROSTER_MODELS[b.id]
const magma = ROSTER.find((b) => b.id === 'wilda')?.evolutions.find((e) => e.name === 'Magma Wilda')
const angelo = ROSTER.find((b) => b.id === 'preyas-diablo')?.evolutions.find((e) => e.name === 'Preyas Angelo')
if (angelo) angelo.models = { monster: 'models/preyas-diablo/angelo.glb' }
if (magma)
  // made from a picture, recoloured to the art and rigged like the others
  magma.models = { monster: 'models/wilda/magma.glb', ball: 'models/wilda/magma-ball.glb', scale: 1.2 }
const saint = ROSTER.find((b) => b.id === 'nemus')?.evolutions.find((e) => e.name === 'Saint Nemus')
if (saint) saint.models = { ...ROSTER_MODELS.nemus, ball: 'models/nemus/saint-ball.glb', scale: 1.2 }
const alto = ROSTER.find((b) => b.id === 'brontes')?.evolutions.find((e) => e.name === 'Alto Brontes')
// made from an anime still (lower legs drawn in), its face painted back from it
if (alto) alto.models = { monster: 'models/brontes/alto.glb', scale: 0.95, fill: 1.12 }
const master = ROSTER.find((b) => b.id === 'ingram')?.evolutions.find((e) => e.name === 'Master Ingram')
// made from the Wii game's render, its visor and red eyes painted back on, inked and rigged; it
// keeps Ingram's ball and stands rather than flies
if (master) master.models = { ...ROSTER_MODELS.ingram, monster: 'models/ingram/master.glb', fly: false, fill: 1.12, scale: 0.95 }
const knight = ROSTER.find((b) => b.id === 'percival')?.evolutions.find((e) => e.name === 'Knight Percival')
if (knight) knight.models = { ball: 'models/percival/knight-ball.glb' }
const omega = ROSTER.find((b) => b.id === 'leonidas')?.evolutions.find((e) => e.name === 'Omega Leonidas')
// ripped from Bakugan Battle Brawlers (Xbox 360) with the game's Darkus textures (the rip's material points at its Haos
// ones), skinned and inked, with its ball from the same game
if (omega)
  omega.models = { monster: 'models/leonidas/omega.glb', ball: 'models/leonidas/omega-ball.glb', scale: 1.15, length: 2.1 }
const battleAx = ROSTER.find((b) => b.id === 'vladitor')?.evolutions.find((e) => e.name === 'Battle Ax Vladitor')
// ripped from Bakugan Battle Brawlers (Xbox 360), its T-posed arms bent down and its axe (left standing behind its
// back in the rip) put in its right hand as in the game's art; skinned and inked, with its ball from the same game.
// The axe reaches above its head, so it is drawn a little larger to keep the body as big as Vladitor's
if (battleAx)
  battleAx.models = { monster: 'models/vladitor/battle-ax.glb', ball: 'models/vladitor/battle-ax-ball.glb', scale: 1.25 }
const minx = ROSTER.find((b) => b.id === 'elfin')?.evolutions.find((e) => e.name === 'Minx Elfin')
// made from an anime picture (sent by the player), the bits floating loose round it dropped, skinned
// (small pieces riding with the spot they sit on) and left without an ink outline, which broke up over it; it keeps
// Elfin's ball. Caught mid-leap, so it stands on its toes rather than hovering (floating put its head off the screen)
if (minx) minx.models = { ...ROSTER_MODELS.elfin, monster: 'models/elfin/minx.glb', fly: false, scale: 1 }
const phantom = ROSTER.find((b) => b.id === 'dharak')?.evolutions.find((e) => e.name === 'Phantom Dharak')
// made from an AI picture after the anime (sent by the owner), its wing markings brightened, cut into
// parts by where they lie (the arms reach in front of the wings) and skinned; its ball is an unused model from
// Bakugan: Defenders of the Core (DS). A giant like Dharak, standing on its legs
if (phantom)
  phantom.models = {
    monster: 'models/dharak/phantom.glb',
    ball: 'models/dharak/phantom-ball.glb',
    scale: 2.3,
    length: 1.7,
    stage: 1.25,
  }

BAKUGAN.push(...ROSTER)

export const bakuganForElement = (element: ElementId) => BAKUGAN.filter((b) => b.element === element)

/** Short label for an ability's battle effect, e.g. "+100G" or "NULLIFY". */
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
      return 'NULLIFY'
    case 'finisher':
      return 'WIN'
  }
}

/** G-Power an ability adds to its user outside of battle (the Viewer's showcase). */
export const abilitySelfBonus = (a: Ability) =>
  a.type === 'shield' || a.type === 'weaken' || a.type === 'finisher' ? 0 : a.amount

/** Plain-language summary of what an ability does in the arena. */
export function battleEffect(a: Ability) {
  switch (a.type) {
    case 'attack':
      return `Strikes the opponent at once: its G-Power drops by ${a.amount} for this battle. At 0 G it is defeated.`
    case 'boost':
      return `Raises your G-Power by ${a.amount} for this battle.`
    case 'weaken':
      return `Cuts the opponent's G-Power by ${a.amount} for this battle. At 0 G it is defeated.`
    case 'drain':
      return `Steals ${a.amount}G from the opponent for this battle: they lose it, you gain it.`
    case 'shield':
      return `Nullify: cancels the opponent's last ability card; its G change is undone.`
    case 'finisher':
      return `After two other ability cards in the same battle: wins the battle outright.`
  }
}
