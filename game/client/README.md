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

- Responsive 640x360 pixel-art-oriented canvas.
- Title menu with new game and continue.
- Intro sequence and first room with movement, obstacle collisions, sealed door, and NPC dialogue.
- Browser-local save/load for room position and encounter state.
- First turn-based battle: timing attack, ACT, healing ITEM, MERCY, and dodge phase.

Keyboard: WASD or arrows; E interacts; Enter/Space advances dialogue and confirms battle actions.

All graphics are temporary geometric placeholders. Original sprites, tilemaps, animation, audio, touch controls, and server-backed saves remain planned.
