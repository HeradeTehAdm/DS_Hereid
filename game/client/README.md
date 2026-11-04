# HERADETALE client prototype

Phaser 3 + Vite client scaffold for the first vertical slice.

## Run locally

```bash
cd game/client
npm install
npm run dev
```

Build for static hosting:

```bash
npm run build
```

## Current prototype

- 640x360 pixel-art-oriented canvas with responsive FIT scaling.
- Title menu and intro sequence.
- First room placeholder with grid, obstacles, sealed exit, controllable player, Искрик dialogue, and an optional encounter.
- First turn-based battle: FIGHT timing, ACT to calm the enemy, ITEM healing, MERCY, and a short dodge phase with moving projectiles.
- Keyboard: WASD or arrow keys; ENTER/SPACE advances dialogue.

The current shapes and colors are temporary placeholders, not final production pixel-art assets. Replace them with original sprites, tiles, portraits, animation, and audio as those assets are created.
