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
- **Tap/click-to-move**: pressing a spot on the floor auto-walks there (a
  gold ring marks the destination); pressing an interactable — from any
  distance — walks into range, turns to face it, and uses it, so the whole
  attic is playable one-handed on a phone or point-and-click on desktop.
  Any manual input (WASD or the stick) cancels an auto-walk instantly.
- **The game inside the world**: the three rummage props reuse their existing
  PNG art on planes (unsearched → searched states), and interacting with them
  drives the *same* `atticFlow` code path — pickup card, archive unlock,
  `DISCOVER_ARCHIVE_ITEM` into the store, tutorials. The note on the table and
  the deck browser work the same way.
- **Diegetic UI**: the obal counter is a candle shelf — one lit candle per
  obal, read live from `persist.obals` through `useTlrStore` (the DOM obal HUD
  hides in 3D mode). Entering the attic plays an ignition ceremony: your
  earned candles catch light one by one as you stand up. The "Return to
  Table" button is the chair itself. Interaction prompts float over what you
  look at ("Check pocket · E"). Moonlit window, volumetric light shaft,
  drifting dust motes (`fx/dust_mote_particle.png`).
- **The archive made physical (Phase 5, first slice)**: every discovered
  archive item stands on the trunk lid as a small framed keepsake (live from
  `persist.discoveredArchiveItems` — take a pickup and the keepsake appears),
  and the trunk itself is an interactable that opens the existing archives
  drawer over the scene.
- **Presentation cues reach the room (Phase 3, in-scene half)**: a
  `CueListener` bridges `tlr:presentation-cue` window events into the scene;
  candle flames and lights surge and the moonlight shaft shimmers on
  `card-place` / `pattern` / `threshold-clear` / `run-end` cues. During the
  run-start approach the table dealing cards underneath makes the room
  flicker in answer to the shuffle.
- **Run-start approach (Phase 2, also landed)**: with the flag on, New
  Reading / Continue opens on a cinematic — you walk into the attic through
  its door, cross the room, and sit down at the table while the real game
  boots beneath the overlay; the overlay then cross-fades into the finished
  2D table UI. Any key or tap skips the walk. The overlay is gated on the
  boot promise (it never reveals a half-built table), aborts instantly if
  the player lands back on the main menu or the boot throws, carries a 14s
  safety ceiling so a stalled WebGL context can never trap the player, and
  is skipped entirely under `prefers-reduced-motion` or when the chunk/WebGL
  is unavailable. Timeline data lives in `APPROACH_KEYFRAMES`
  (src/three/atticLayout.mjs); the flow seam is
  `src/app/tableApproachFlow.mjs`, installed right after `installMainMenu`.
- **Bundle discipline**: React + three + fiber + the scene land in one lazy
  `atticEntry` chunk (~1.1 MB minified / ~300 KB gzip) fetched only when the
  flag is on and the attic (or a run start) needs it. `menuBoot.js` is
  unchanged (28 KB).

### Files

```
src/three/
  atticEntry.mjs      mount/unmount seams (plain JS, no JSX): mountAttic3D for
                      the attic, mountTableApproach for the run-start overlay.
                      WebGL check, hard-exit/menu observers, window.__tlrAttic3d
                      + window.__tlrTable3d debug handles
  useTlrStore.mjs     useSyncExternalStore bridge onto window.tlrStore
  atticLayout.mjs     room dimensions, table/chair, prop stations, camera poses,
                      approach keyframes, collision keep-outs — the one place
                      spatial numbers live
  AtticExperience.jsx Canvas root ('attic' | 'approach' modes), adapter snapshot
                      polling, interactable registry, portrait FOV tuner
  AtticRoom.jsx       floor/walls/roof/window/door/table/chair/clutter
  Interactables.jsx   prop planes, note, deck box, focus prompt, walk marker
  Diegetics.jsx       candle-shelf obal counter, table candle, dust field
  PlayerRig.jsx       movement, input, tap-to-move, collision, focus raycast,
                      sit/stand + approach choreography, debug api
  canvasTextures.mjs  runtime canvas textures (prompt tags, glows, ring, shaft)
src/app/tableApproachFlow.mjs  wraps New Reading/Continue with the approach
src/styles/attic3d.css  canvas layering, DOM handovers, hint, approach overlay
scripts/validate-attic3d-smoke.mjs  headless end-to-end smoke (npm run test:attic3d)
```

Integration touch points in existing code are deliberately tiny: `atticFlow.mjs`
(flag check, lazy mount/unmount, the adapter object), `main.mjs` (one
`installTableApproachFlow` line), `build-bundle.mjs` (`jsx: 'automatic'`, one
CSS entry), `package.json` (deps + script).

### Trying it

```sh
npm install
npm run dev
# open http://localhost:8080/game.html?attic3d=1
# New Reading plays the walk-in-and-sit approach;
# finish a reading (or press Shift+A) for the walkable attic
```

Headless verification (also exercises the flag-off path):

```sh
npm run test:attic3d
```

The smoke drives the real loop — boot through the approach (and skip it),
enter the attic, stand up, tap-walk across the floor, auto-walk to a prop and
rummage it, take the pickup, verify the store, sit back down, land on the
table UI — and screenshots each beat into `artifacts/`.

### Debug surface

`window.__tlrAttic3d.api` while the attic is mounted: `getState()`
(phase/position/focus/autoWalk), `teleport(x, z, yaw, pitch)`,
`walkTo(x, z, interactId?)`, `tapAt(clientX, clientY)`, `interact()`,
`sit()`, `skip()`, `dumpScene()`. During a run-start approach,
`window.__tlrTable3d` exposes `skip()` and `abort()`.

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

### Phase 2 — The table as a place: approach and sit-down on run start ✅

Landed on this branch (see "What is already working"). The approach plays
over the boot's dead time, turning loading into a scene-setting beat, and the
`completeWith(bootPromise)` gate keeps the reveal honest. Polish still open:
walking sound + door creak, a slower "first ever run" variant, and easing the
final camera pose into pixel-alignment with the SPv2 table art for a truly
seamless cross-fade.

### Phase 3 — Presentation cues drive the 3D scene ◐ (in-scene half landed)

The cue bridge is in: `CueListener` (AtticExperience.jsx) captures
`tlr:presentation-cue` into a shared ref and `cueEnergy()` converts it into
decaying mood surges wherever the scene is mounted — flames, lights, and the
moonlight shaft all answer today, with a live firing source during the
approach (the booting table underneath deals cards).

The remaining half — cue-driven camera work *while seated at the reading* —
deliberately waits for Phase 4's hybrid table: the SPv2 seated view is opaque
painted art, so there is no visible 3D surface behind it yet. When the hybrid
lands, `tableCameraDirector.mjs`'s CSS scale approximations become real
camera pushes; its event contract is already the right one.

### Phase 4 — Diegetic table UI (the honest scoping)

The painted SPv2 table art is currently *better looking* than a low-poly 3D
replacement would be — swapping it wholesale would be a downgrade, so this
phase is gated on art, not engineering:

- **Hybrid (recommended next)**: the 3D room renders around/behind a
  transparent-margin version of the table art while cards/score stay DOM —
  the approach's final camera pose already lines up with the seated view, so
  the cross-fade seam is proven.
- **In-world panels**: score/threshold as objects (wax seals, a brass scale)
  driven by `useTlrStore` selectors, like the candle shelf today.
- **Full diegetic reading** (stretch): cards as textured meshes using the
  existing card-sheet atlases, drag = physical card movement. Needs drei's
  `Html` (or render-to-texture) for card text legibility — this is the point
  at which adding `@react-three/drei` pays for itself; before it, plain fiber
  keeps the dependency surface small.

### Phase 5 — More attic, more game ◐ (first slice landed)

Landed: discovered archive items accumulate as framed keepsakes on the trunk
lid (pure store selectors — take a pickup and the shelf updates live), and
the trunk is an interactable that opens the archives drawer in place.

Next content, all cheap now that the room exists: resonation memories as
objects that appear after unlocks (`persist.unlockedFragments` is already in
the store), seasonal props keyed to save state, and new searchable stations
added as data in `atticLayout.mjs` + entries in the attic prop catalog
(`src/data/atticObjects.mjs`).

### Asset pipeline (when hand-built primitives stop being enough)

- GLTF + Draco/meshopt via `useGLTF` (drei) or `GLTFLoader` directly; keep the
  PS1-budget: <5k tris per prop, nearest-filtered 256–512px textures.
- Existing 2D art stays first-class: prop PNGs on planes read beautifully in
  the lit room (see `artifacts/` screenshots from the smoke).
- KTX2 compression only if texture memory ever shows up in profiling — at the
  current scene scale it will not.

## Known limitations / polish backlog

- Portrait FOV now widens to 74° (see `FovTuner`), which keeps most prompts
  on-screen; a true screen-clamp for prompt sprites is still worth doing.
- Tap-to-walk drives straight lines with collision sliding — good enough for
  this room, but a nav-mesh (or waypoint graph) is the upgrade if the attic
  ever grows internal walls.
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
