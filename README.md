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
- Elfin and Ingram ball models: ripped from *Bakugan: Defenders of the Core* (DS), via [The Models Resource](https://models.spriters-resource.com)
- Hydranoid, Dual Hydranoid, Tigrerra, Blade Tigrerra, Preyas, Gorem, Skyress, Storm Skyress, Ravenoid, Harpus, Sirenoid, Fourtress, Tentaclear, Hammer Gorem, Cycloid, Dragonoid and Delta Dragonoid models: ripped from *Bakugan Battle Brawlers* (DS), via [The Models Resource](https://models.spriters-resource.com); cut into animated parts with `tools/preview/rigs.json`
- Dan Kuso and Masquerade brawler models and portraits: ripped from *Bakugan Battle Brawlers* (DS), via [The Models Resource](https://models.spriters-resource.com); converted with `tools/preview/convert.html`
- Alice, Julie, Marucho, Runo, Shun, Klaus and Shuji brawler models and portraits: ripped from *Bakugan Battle Brawlers* (Wii), via [The Models Resource](https://models.spriters-resource.com)
- Ability card names and texts: [BakuProject card database](https://bakuproject.info/cards)
- Attribute wheel artwork: fan-made Bakugan attribute circle

---

Bakugan is a trademark of Spin Master Ltd. and Sega Toys. This project is not affiliated with or endorsed by them.
