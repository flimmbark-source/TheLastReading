# react-three-fiber in The Last Reading

How the 3D single-player experience — walking the attic, sitting down at and
getting up from the reading table, diegetic in-world UI — integrates with this
codebase, what already works on this branch, and the phased path to the full
vision.

## Why this codebase can host react-three-fiber cleanly

The app is vanilla JS, but every seam react-three-fiber needs already exists:

| Need | Existing seam |
|---|---|
| JSX + React compilation | esbuild bundles all JS (`scripts/build-bundle.mjs`); JSX support is the one-line `jsx: 'automatic'` option. The dev server (`scripts/serve.mjs`) always builds before serving, so dev and prod share the pipeline. |
| Not paying the 3D cost on boot | The build already code-splits lazy chunks via string-literal `import()` (adventure mode, multiplayer). The 3D layer is one more lazy chunk. |
| React reading live game state | `window.tlrStore` (src/app/store.mjs) is `getState()` + `subscribe(listener)` — exactly the contract of React's `useSyncExternalStore`. No adapter framework needed: see `src/three/useTlrStore.mjs`. |
| 3D reacting to game moments | The presentation director broadcasts `tlr:presentation-cue` / `tlr:presentation-state` window events for pattern resolves, threshold clears, run end. A 3D scene can subscribe exactly like `tableCameraDirector.mjs` does. |
| Screen flow | Attic/table transitions are body-class driven (`mode-to-attic`, `mode-attic`, `mode-to-table`, `mode-reading`) with a single owner, `src/app/atticFlow.mjs`. The 3D layer mounts and unmounts inside that flow without inventing a new one. |
| Art direction | `ps1aesthetic.css` — the game already leans low-fi. Low-poly primitives + flat Lambert shading + the existing prop PNGs on planes is the *intended* look, not a placeholder. |

The strategic decision this implies: **React islands, not a React rewrite.**
React owns exactly one subtree — the WebGL canvas — where its retained scene
graph is genuinely better than DOM patching. The reducer, the table UI, and
all game rules stay where they are. The 3D layer talks to the game through a
small adapter object and the store, honoring the repo's standing boundary:
*the attic communicates through save state, not DOM hooks.*

## What is already working on this branch (Phase 1)

An opt-in, fully walkable 3D attic, feature-complete with the 2D attic:

- **Flag**: `?attic3d=1` in the URL, or `localStorage.tlr_attic_3d = '1'`
  (console helper: `tlrSetAttic3d(true)`). Flag off → nothing loads, nothing
  changes. Mount failure (no WebGL, chunk error) → silent fallback to the
  classic 2D attic.
- **Sitting and standing**: the scene mounts seated at the 3D reading table —
  matching the table UI you just left — and the camera stands up over ~1.7s.
  Leaving happens by walking back to the chair and sitting down: the camera
  glides in, descends into the seated pose, and only then runs the existing
  attic→table cross-fade back to the 2D table UI. `prefers-reduced-motion`
  skips both camera moves.
- **A real room to move around in**: first-person WASD/arrow movement with
  drag-to-look on desktop; on touch the left 45% of the screen is a virtual
  move stick and the rest drag-look. Collision keep-outs for the table and
  clutter, clamped room bounds, subtle head-bob.
- **The game inside the world**: the three rummage props reuse their existing
  PNG art on planes (unsearched → searched states), and interacting with them
  drives the *same* `atticFlow` code path — pickup card, archive unlock,
  `DISCOVER_ARCHIVE_ITEM` into the store, tutorials. The note on the table and
  the deck browser work the same way.
- **Diegetic UI**: the obal counter is a candle shelf — one lit candle per
  obal, read live from `persist.obals` through `useTlrStore` (the DOM obal HUD
  hides in 3D mode). The "Return to Table" button is the chair itself.
  Interaction prompts float over what you look at ("Check pocket · E").
  Moonlit window, volumetric light shaft, drifting dust motes
  (`fx/dust_mote_particle.png`).
- **Bundle discipline**: React + three + fiber + the scene land in one lazy
  `atticEntry` chunk (~1.1 MB minified / ~300 KB gzip) fetched only when the
  flag is on and the attic is entered. `menuBoot.js` is unchanged (28 KB).

### Files

```
src/three/
  atticEntry.mjs      mount/unmount seam (plain JS, no JSX). WebGL check,
                      hard-exit observer, body.attic3d-live, window.__tlrAttic3d
  useTlrStore.mjs     useSyncExternalStore bridge onto window.tlrStore
  atticLayout.mjs     room dimensions, table/chair, prop stations, camera poses,
                      collision keep-outs — the one place spatial numbers live
  AtticExperience.jsx Canvas root, adapter snapshot polling, interactable registry
  AtticRoom.jsx       floor/walls/roof/window/table/chair/clutter
  Interactables.jsx   prop planes, note, deck box, focus prompt sprite
  Diegetics.jsx       candle-shelf obal counter, table candle, dust field
  PlayerRig.jsx       movement, input, collision, focus raycast, sit/stand
                      choreography, debug api
  canvasTextures.mjs  runtime canvas textures (prompt tags, glows, light shaft)
src/styles/attic3d.css  canvas layering inside #atticScene, DOM handovers, hint
scripts/validate-attic3d-smoke.mjs  headless end-to-end smoke (npm run test:attic3d)
```

Integration touch points in existing code are deliberately tiny: `atticFlow.mjs`
(flag check, lazy mount/unmount, the adapter object), `build-bundle.mjs`
(`jsx: 'automatic'`, one CSS entry), `package.json` (deps + script).

### Trying it

```sh
npm install
npm run dev
# open http://localhost:8080/game.html?attic3d=1
# play a reading to its end, or press Shift+A to jump into the attic
```

Headless verification (also exercises the flag-off path):

```sh
npm run test:attic3d
```

The smoke drives the real loop — boot, enter, stand up, focus a prop, rummage,
take the pickup, verify the store, sit back down, land on the table UI — and
screenshots each beat into `artifacts/`.

### Debug surface

`window.__tlrAttic3d.api` while mounted: `getState()` (phase/position/focus),
`teleport(x, z, yaw, pitch)`, `interact()`, `sit()`, `dumpScene()`.

## The architecture rules that keep this safe

1. **The 3D layer is presentation-only.** It never mutates game state
   directly; every action goes through the adapter into `atticFlow`, and every
   read comes from the adapter or the store. If the canvas dies, the 2D attic
   is still a complete game.
2. **One owner per flow.** `atticFlow.enter()/leave()` remain the only
   authority for attic transitions. The 3D chair calls `adapter.leave()`; it
   does not touch body classes. A `MutationObserver` in `atticEntry` handles
   the two hard-exit paths (main menu, adventure boot) that strip mode classes
   without calling `leave()`.
3. **Numbers live in `atticLayout.mjs`.** Camera poses, station positions, and
   collision keep-outs are data, so tuning the room never means spelunking
   component code.
4. **Fail closed.** Every risky boundary (WebGL creation, chunk load, texture
   load) catches and falls back to the 2D attic rather than breaking the run.

## Roadmap: from walkable attic to the full 3D single-player

### Phase 2 — The table as a place: approach and sit-down on run start

The dream sequence "approach the table and sit down" belongs to the *reading*
flow, not the attic. Reuse the identical rig:

- On `New Reading` (flag on), mount the same scene in a `table3d` mode:
  camera starts standing near the attic door, plays a short scripted approach
  (walk path → pull out chair beat → seat descent), then cross-fades into the
  existing 2D table UI exactly like the attic's sit-down already does.
- `menuBoot.launch()` is the seam: it already awaits boot work before showing
  the table; the approach plays over that load time, turning dead time into a
  scene-setting beat. Skippable by tap/keypress and by reduced-motion.
- Estimated new code: a camera-path module (curve + eased playback) plus a
  `mode-to-table-3d` guard in the flow; the room and rig are already built.

### Phase 3 — Presentation cues drive the 3D table

While seated, keep a paused (`frameloop="demand"`) canvas behind the 2D table
UI and let `tlr:presentation-cue` events drive it: `threshold-clear` pushes
candlelight intensity, `pattern` ripples the light shaft, `run-end` slowly
pulls the camera back from the table. This *replaces* today's CSS scale
approximations in `tableCameraDirector.mjs` with a true camera — the module's
event contract is already the right one; only its output changes.

### Phase 4 — Diegetic table UI

Move HUD surfaces into the world incrementally, keeping DOM for text-heavy
interactions:

- **Hybrid (recommended next)**: the 3D table renders the environment (cloth,
  candle, frame) while cards/score stay DOM — the current cross-fade already
  proves the alignment trick works.
- **In-world panels**: score/threshold as objects (wax seals, a brass scale)
  driven by `useTlrStore` selectors, like the candle shelf today.
- **Full diegetic reading** (stretch): cards as textured meshes using the
  existing card-sheet atlases, drag = physical card movement. Needs drei's
  `Html` (or render-to-texture) for card text legibility — this is the point
  at which adding `@react-three/drei` pays for itself; before it, plain fiber
  keeps the dependency surface small.

### Phase 5 — More attic, more game

The walkable room makes new single-player systems cheap to stage: resonation
memories as objects that appear after unlocks (store selectors already exist),
the archives drawer as a physical trunk, seasonal props keyed to save state,
and new searchable stations added as data in `atticLayout.mjs` + entries in
`atticFlow`'s catalog.

### Asset pipeline (when hand-built primitives stop being enough)

- GLTF + Draco/meshopt via `useGLTF` (drei) or `GLTFLoader` directly; keep the
  PS1-budget: <5k tris per prop, nearest-filtered 256–512px textures.
- Existing 2D art stays first-class: prop PNGs on planes read beautifully in
  the lit room (see `artifacts/` screenshots from the smoke).
- KTX2 compression only if texture memory ever shows up in profiling — at the
  current scene scale it will not.

## Known limitations / polish backlog

- Portrait phones have a narrow horizontal FOV, so focus prompts can sit
  off-screen; clamp prompt sprites to the view or raise portrait FOV.
- The first-visit hint is DOM, not diegetic; a later pass can carve it into
  the room (chalk on a beam).
- Candle/prop glows are billboard sprites; a bloom pass (postprocessing) would
  look richer but is deliberately deferred — it is the single biggest perf
  cliff on weak mobile GPUs.
- The deck-browse modal opens over the canvas while movement stays live
  (interaction is suppressed; walking is not). Harmless, slightly unfictional.

## Dependency and version notes

- `react@19`, `react-dom@19`, `@react-three/fiber@9` (requires React 19),
  `three@0.185`. All runtime deps are bundled; nothing loads from a CDN.
- `@react-three/drei` is intentionally **not** a dependency yet (it pulls a
  large transitive tree); Phase 4's card text is its earning point.
- ESLint currently lints `**/*.{js,mjs}` only; add a `.jsx` block with
  `ecmaFeatures: { jsx: true }` when the 3D layer graduates from experimental.
