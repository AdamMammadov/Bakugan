# Bakugan Brawl Vault

Interactive 3D Bakugan encyclopedia and brawl simulator.
PC-first, English UI. Product requirements: [`docs/PRD.md`](docs/PRD.md).

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
npm run lint
```

## Flow

1. **Intro** – click/any key (also unlocks browser audio).
2. **Attribute wheel** – move the mouse around the wheel (GTA-style), click to become a brawler of that attribute. Arrow keys + Enter also work.
3. **Attribute hub** – the Bakugan roster for that attribute.
4. **Viewer** – 360° orbit/zoom, `Gate Card, Set!` → `Bakugan, Brawl!` transformation, live G-Power counter, Ability Cards with particle effects, evolution timeline.

## Stack

React 19 + TypeScript + Vite · React Three Fiber / drei / postprocessing · Zustand · Tailwind CSS v4 · Framer Motion · Howler.js

```
src/
  data/        elements.ts, bakugan.ts  ← all content lives here
  screens/     Intro, ElementWheel, ElementHub, Viewer
  three/       3D scene, ball, placeholder monster, gate card, effects
  audio/sfx.ts sound manager (real files with synthesized fallback)
public/
  wheel/       attribute wheel layers + icons
  models/      drop .glb models here
  sounds/      drop .mp3 sound effects here
```

## Adding assets

### 3D models
Put files at `public/models/<bakugan-id>/ball.glb` and `monster.glb`, then reference them in `src/data/bakugan.ts`:

```ts
models: { ball: 'models/dragonoid/ball.glb', monster: 'models/dragonoid/monster.glb' }
```

Without models the viewer shows procedural placeholders.

Model guidelines:
- Format `.glb` (glTF binary), ideally ≤ 5 MB, ≤ 50k triangles.
- Ball: ~1 unit diameter, centered at origin.
- Monster: ~3 units tall, feet at y = 0, facing +Z.
- Check each model's license (CC-BY needs credit; keep a note of the source).

### Sounds
Drop files into `public/sounds/` with these names; anything missing falls back to a synthesized placeholder:

`tick.mp3` · `select.mp3` · `start.mp3` · `gateCard.mp3` · `brawl.mp3` · `ability.mp3` · `gPower.mp3` · `hit.mp3` · `victory.mp3` · `defeat.mp3`

## Credits

- Launch roster facts (brawlers, evolutions, story): Wikipedia, *List of Bakugan* and *List of Bakugan Battle Brawlers characters*; built by `tools/data/roster.py`
- Neo Dragonoid ball model (Dragonoid's ball form): ripped from *Bakugan: Defenders of the Core* (Wii), via [The Models Resource](https://models.spriters-resource.com)
- Wilda model: ripped from *Bakugan: Defenders of the Core* (Wii), via [The Models Resource](https://models.spriters-resource.com)
- Trox, Hydorous, Howlkor and Pegatrix models: ripped from *Bakugan: Champions of Vestroia* (Switch), via [The Models Resource](https://models.spriters-resource.com)
- Titanium Trox, Titanium Dragonoid and Golden Dragonoid skin models: ripped from *Bakugan Brawl Simulator* (Roblox), via [The Models Resource](https://models.spriters-resource.com)
- Elfin, Ingram, Nemus, Saint Nemus, Magma Wilda and Knight Percival ball models: ripped from *Bakugan: Defenders of the Core* (DS), via [The Models Resource](https://models.spriters-resource.com)
- Magma Wilda model: made from a picture, recoloured to match the art and cut into animated parts with `tools/preview/rigs.json`
- Hades model: made from a picture, tinted towards the art and cut into animated parts with `tools/preview/rigs.json`
- Elfin model: made from a picture; its face, blurred in generation, drawn again (eyes, cheek marks, mouth) with `tools/ai/paint_front.py`, dark smears on the hands painted over, its tail recoloured with `tools/ai/recolor_region.py`, and the tail cut out for animation with `tools/preview/rigs.json`
- Nemus model: made from a game render; the white armour it painted black lightened with `tools/ai/lighten_region.py`, the face painted back from the render with `tools/ai/reproject.py`, inked and cut into animated parts with `tools/preview/rigs.json`
- Leonidas model: made from a picture; its tail mace, which came out lying flat in the wing, lifted off and stood up at the tail tip with `tools/ai/detach.py`, inked and cut into animated parts with `tools/preview/rigs.json`
- Brontes model: made from a render out of *Bakugan: Defenders of the Core* (Wii), with the lower legs (cut off in the render) drawn in after the anime; the face painted back from the render with `tools/ai/reproject.py`, the colours moved towards it with `tools/ai/match_colours.py`, inked and cut into animated parts with `tools/preview/rigs.json`
- Alto Brontes model: made from an anime still with the lower legs (cut off in the frame) drawn in; the face painted back from the still with `tools/ai/reproject.py`, scratches on the white armour cleaned up, inked and cut into animated parts with `tools/preview/rigs.json`
- Elico model: made from a render out of *Bakugan: Defenders of the Core* (Wii), recoloured Aquos with a foot and a blade tip (cut off in the render) drawn in; the face painted back from the render with `tools/ai/reproject.py`, the armour brightened towards it, inked and cut into animated parts with `tools/preview/rigs.json`
- Altair model: made from a render out of *Bakugan: Defenders of the Core* (Wii), with a fin tip (cut off in the render) drawn in; the visor and chest emblem, blurry in what the generator made, repainted crisp with `tools/ai/paint_front.py` and the chest cel-shaded with `tools/ai/toon_light.py`; inked and cut into animated parts with `tools/preview/rigs.json`
- Ingram model: shape made from a *Bakugan: New Vestroia* frame (background removed, tail shortened); painted from the same frame with `tools/ai/bake_views.py` (the back from a copy with the chest and face painted out), the tail striped and the face (dark mask, orange eyes) drawn on with `tools/ai/paint_front.py`, inked and skinned to animated bones (`skin=` in `tools/preview/convert.ts`, parts from `tools/preview/rigs.json`), so its joints bend instead of opening
- Master Ingram model: made from a render out of *Bakugan: Defenders of the Core* (Wii); its blurred face repainted (gold mask, dark visor, red eyes) with `tools/ai/paint_front.py`, inked and cut into animated parts with `tools/preview/rigs.json`
- Helios model: made from an anime picture; a tail blade it left floating removed; the orange spots on the black armour, lost in generation, painted back where the picture has them with `tools/ai/paint_spots.py` (placed by fits from `tools/ai/fitlocal_fast.py`) and mirrored onto the far legs; the nose horn recoloured with `tools/ai/recolor_region.py`, the eyes drawn on with `tools/ai/paint_front.py`, inked (with `inkThin`, so the outline does not speck through the paper-thin wings) and skinned to animated bones (`skin=` in `tools/preview/convert.ts`, parts from `tools/preview/rigs.json`), so its joints bend instead of opening
- Vladitor and Battle Ax Vladitor models: ripped from *Bakugan Battle Brawlers* (Xbox 360), via [The Models Resource](https://models.spriters-resource.com); their T-posed arms bent down (Battle Ax Vladitor's axe, left behind its back in the rip, put in its right hand), inked and skinned to animated bones (`skin=` in `tools/preview/convert.ts`, parts from `tools/preview/rigs.json`); both their ball forms from the same game
- Falconeer (Pyrus), Robotallion (Aquos), Saurus (Pyrus), Monarus (Ventus), Fear Ripper (Darkus), Laserman (Haos) and Omega Leonidas (Darkus) models, all but the first two with their ball forms: ripped from *Bakugan Battle Brawlers* (Xbox 360), via [The Models Resource](https://models.spriters-resource.com), with the game's own textures for that attribute; inked and skinned to animated bones (`skin=` in `tools/preview/convert.ts`, parts from `tools/preview/rigs.json`)
- Premo Vulcan model: made from a picture of Premo Vulcan; recoloured to the art's browns and near-black armour, scribbles in its brown paint cleaned up, the eye visor repainted crisp with `tools/ai/paint_front.py`, inked and skinned to animated bones (`skin=` in `tools/preview/convert.ts`, parts from `tools/preview/rigs.json`)
- Rubanoid model: made from an AI picture of Rubanoid after the anime (both sent by the player); inked (with `inkThin`, so the outline does not speck through the crystal wings) and skinned to animated bones (`skin=` in `tools/preview/convert.ts`, parts from `tools/preview/rigs.json`)
- Baliton model: made from an AI picture of Baliton drawn after two anime frames (sent by the player); a hole the generator left in its back capped, the body's brown lightened and the leg armour coloured bronze after the picture, inked and skinned to animated bones (`skin=` in `tools/preview/convert.ts`, parts from `tools/preview/rigs.json`)
- Dharak model: made from an AI picture of Dharak after the anime (sent by the player); its glowing wing markings brightened to the picture's green, inked (with `inkThin`) and skinned to animated bones (`skin=` in `tools/preview/convert.ts`, parts from `tools/preview/rigs.json`)
- Minx Elfin model: made from an anime picture (sent by the player); the pieces it left floating loose dropped with `tools/ai/drop_loose.py`, skinned (small pieces riding with the spot they sit on, `stick=`) to animated bones (`skin=` in `tools/preview/convert.ts`, parts from `tools/preview/rigs.json`)
- Neo Dragonoid model: made from an anime picture (sent by the player); split into parts by where they lie (the tail curls round in front of the legs) and skinned (its loose spikes and ribs riding with the spot they sit on, `stick=`) to animated bones (`skin=` in `tools/preview/convert.ts`, parts from `tools/preview/rigs.json`)
- Alpha Hydranoid model: made from an AI redraw of the anime art (sent by the player); its third tail, which came out short and broken off, grown again by bending a copy of another along a new path with `tools/ai/regrow_tail.py`, the colours matched to the picture with `tools/ai/match_colours.py`, inked (with `inkThin`) and skinned to animated bones (`skin=` in `tools/preview/convert.ts`, parts from `tools/preview/rigs.json`)
- Phantom Dharak model: made from an AI picture of Phantom Dharak after the anime (sent by the player); its wing markings brightened, split into parts by where they lie (the arms reach in front of the wings) and skinned to animated bones; its ball form: an unused model from *Bakugan: Defenders of the Core* (DS), via [The Models Resource](https://models.spriters-resource.com)
- Hydranoid, Dual Hydranoid, Tigrerra, Blade Tigrerra, Preyas, Gorem, Skyress, Storm Skyress, Ravenoid, Harpus, Sirenoid, Fourtress, Tentaclear, Hammer Gorem, Cycloid, Dragonoid, Delta Dragonoid, Preyas Diablo, Preyas Angelo and Manion models: ripped from *Bakugan Battle Brawlers* (DS), via [The Models Resource](https://models.spriters-resource.com); cut into animated parts with `tools/preview/rigs.json`
- Long tails curled up over the back (Delta Dragonoid, Trox, Titanium Trox) or under like a chameleon's (Preyas) with `tools/ai/curl_tail.mjs`, so they no longer stretch far behind them
- Dan Kuso and Masquerade brawler models and portraits: ripped from *Bakugan Battle Brawlers* (DS), via [The Models Resource](https://models.spriters-resource.com); converted with `tools/preview/convert.html`
- Alice, Julie, Marucho, Runo, Shun, Klaus and Shuji brawler models and portraits: ripped from *Bakugan Battle Brawlers* (Wii), via [The Models Resource](https://models.spriters-resource.com)
- Each Bakugan's own abilities from the anime and the video games (names, what they do, G values): its page on the [Bakugan Wiki](https://bakugan.fandom.com) (CC BY-SA), kept in `tools/data/anime_abilities.json`; turned into ability cards by `tools/data/roster.py`

