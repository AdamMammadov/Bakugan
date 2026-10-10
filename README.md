# Bakugan Brawl Vault

Interactive 3D Bakugan encyclopedia and brawl simulator (non-commercial fan project).
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
- Magma Wilda model: made from a picture with [TRELLIS.2](https://huggingface.co/spaces/microsoft/TRELLIS.2) (image to 3D, MIT licence), recoloured to match the art and cut into animated parts with `tools/preview/rigs.json`
- Hades model: made from a picture with [TRELLIS.2](https://huggingface.co/spaces/microsoft/TRELLIS.2) (image to 3D, MIT licence), tinted towards the art and cut into animated parts with `tools/preview/rigs.json`
- Elfin model: made from a picture with [Hunyuan3D-2.1](https://huggingface.co/spaces/tencent/Hunyuan3D-2.1) (image to 3D, Tencent Hunyuan community licence); its face painted back from the picture with `tools/ai/reproject.py`, its tail recoloured with `tools/ai/recolor_region.py`, and the tail cut out for animation with `tools/preview/rigs.json`
- Nemus model: made from a game render with [TRELLIS.2](https://huggingface.co/spaces/microsoft/TRELLIS.2) (image to 3D, MIT licence); the white armour it painted black lightened with `tools/ai/lighten_region.py`, the face painted back from the render with `tools/ai/reproject.py`, inked and cut into animated parts with `tools/preview/rigs.json`
- Leonidas model: made from a picture with [Hunyuan3D-2.1](https://huggingface.co/spaces/tencent/Hunyuan3D-2.1) (image to 3D, Tencent Hunyuan community licence); its tail mace, which came out lying flat in the wing, lifted off and stood up at the tail tip with `tools/ai/detach.py`, inked and cut into animated parts with `tools/preview/rigs.json`
- Brontes model: made with [TRELLIS.2](https://huggingface.co/spaces/microsoft/TRELLIS.2) (image to 3D, MIT licence) from a render out of *Bakugan: Defenders of the Core* (Wii), with the lower legs (cut off in the render) drawn in after the anime; the face painted back from the render with `tools/ai/reproject.py`, the colours moved towards it with `tools/ai/match_colours.py`, inked and cut into animated parts with `tools/preview/rigs.json`
- Alto Brontes model: made with [TRELLIS.2](https://huggingface.co/spaces/microsoft/TRELLIS.2) (image to 3D, MIT licence) from an anime still with the lower legs (cut off in the frame) drawn in; the face painted back from the still with `tools/ai/reproject.py`, scratches on the white armour cleaned up, inked and cut into animated parts with `tools/preview/rigs.json` (the propeller spins)
- Hydranoid, Dual Hydranoid, Tigrerra, Blade Tigrerra, Preyas, Gorem, Skyress, Storm Skyress, Ravenoid, Harpus, Sirenoid, Fourtress, Tentaclear, Hammer Gorem, Cycloid, Dragonoid, Delta Dragonoid, Preyas Diablo, Preyas Angelo and Manion models: ripped from *Bakugan Battle Brawlers* (DS), via [The Models Resource](https://models.spriters-resource.com); cut into animated parts with `tools/preview/rigs.json`
- Dan Kuso and Masquerade brawler models and portraits: ripped from *Bakugan Battle Brawlers* (DS), via [The Models Resource](https://models.spriters-resource.com); converted with `tools/preview/convert.html`
- Alice, Julie, Marucho, Runo, Shun, Klaus and Shuji brawler models and portraits: ripped from *Bakugan Battle Brawlers* (Wii), via [The Models Resource](https://models.spriters-resource.com)
- Ability card names and texts: [BakuProject card database](https://bakuproject.info/cards)
- Attribute wheel artwork: fan-made Bakugan attribute circle

---

Bakugan is a trademark of Spin Master Ltd. and Sega Toys. This project is not affiliated with or endorsed by them.
