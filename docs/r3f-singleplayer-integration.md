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

A fully walkable 3D attic, feature-complete with the 2D attic — and **the
default implementation** as of this branch:

- **Flag**: on by default. `?attic3d=0` in the URL, or
  `localStorage.tlr_attic_3d = '0'` (console helper: `tlrSetAttic3d(false)`)
  is the kill-switch back to the classic 2D attic and painted table;
  `?attic3d=1` still force-enables over a stored '0'. Mount failure (no
  WebGL, chunk error) → silent fallback to the classic 2D attic. While the
  lazy chunk loads, `body.attic3d-pending` suppresses the classic attic art
  (and the painted SPv2 background on the attic→table return) so the old 2D
  scene never flashes through; every failure path removes the class,
  restoring the classic visuals.
- **Sitting and standing**: the scene mounts seated at the 3D reading table —
  matching the table UI you just left — and the camera stands up over ~1.7s.
  Leaving happens by walking back to the chair and sitting down: the camera
  glides in, descends into the seated pose, and only then runs the existing
  attic→table cross-fade back to the 2D table UI. `prefers-reduced-motion`
  skips both camera moves.
- **A real room to move around in**: first-person WASD/arrow movement with
  drag-to-look on desktop. On touch the whole screen looks — there is no
  virtual stick eating glass or splitting it into invisible zones;
  tap-to-move covers locomotion. Touch look sensitivity scales with the
  screen (a full-width swipe turns ~155°), and a released swipe carries
  flick inertia (decaying spin, grab the glass to stop it dead), so turning
  away from a wall you are stuck facing is one flick instead of repeated
  sawing. Only the first finger down steers, so a second resting finger
  can't fight the camera. Collision keep-outs for the table and clutter,
  clamped room bounds, subtle head-bob.
- **Tap/click-to-move**: pressing a spot on the floor auto-walks there (a
  gold ring marks the destination); pressing an interactable — from any
  distance — walks into range, turns to face it, and uses it, so the whole
  attic is playable one-handed on a phone or point-and-click on desktop.
  The screen-space pick radius is 96px on touch (64px mouse) so items don't
  demand pixel-accurate presses. Any manual WASD input cancels an auto-walk
  instantly.
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
- **Hybrid seated table (Phase 4's first form, landed)**: after sitting down
  the 3D room stays mounted as a fixed, pointer-transparent canvas beneath
  the live SPv2 DOM. The opaque painted background comes off the body (its
  film-grain/vignette `::before` stays as free texture over the canvas), and
  the spread + hand are re-seated onto **named world-space table anchors**
  (`TABLE_ANCHORS` in atticLayout) projected through the seated camera into
  CSS variables by `src/three/tableAnchors.mjs` — no new viewport
  percentages. The cards remain the real SPv2 DOM (drag, hints, abilities,
  accessibility all untouched). Score/Threshold, menus, Discard/Purge, and
  utility chrome stay in screen space, exactly per the
  smallest-useful-prototype scoping. Because the room is live during real
  play, presentation cues (card placements, pattern resolves, threshold
  clears) visibly surge the candlelight and moonlight shaft around the table
  as you play, and a soft reading glow pools over the cloth so the play
  surface reads as the stage. `tableCameraDirector`'s CSS scale
  approximations are disabled in this mode (a WAAPI transform on
  `.spread-wrap` would break the anchored fixed positioning; the 3D scene
  supplies the response instead).
- **Portrait gets its own composition, not desktop's reprojection**: a
  dedicated portrait reading camera (`PORTRAIT_POSES.seated`) sits higher,
  ~45° top-down, and closer, so the cloth dominates the tall frame — play
  space over atmosphere, keeping the shaft's floor pool and the candle. It
  has its own anchor set and world widths (`PORTRAIT_*`), and the approach
  cinematic retargets its final keyframe to it so the reveal stays
  continuous. Anchoring escalates in the tested order: the **spread anchors
  on portrait** (`body.table3d-anchored`) while the **hand stays native**
  (Test A — the winner: anchoring the hand shrank touch targets for no
  compositional gain). The hand gate (`body.table3d-anchored-hand`) is
  always attempted on landscape/desktop and remains available on portrait
  behind `localStorage.tlr_t3d_hand_anchor_portrait = '1'` (Test B, with a
  flatter portrait fan via `--track-*` overrides) — flip it and call
  `window.__tlrT3dReproject()` to compare live. Either gate failing its fit
  check falls back to SPv2's native layout over the 3D backdrop.
- **Run-start approach (Phase 2, also landed)**: New Reading / Continue
  opens on a cinematic — you walk into the attic through its door, cross the
  room, and sit down at the table while the real game boots beneath the
  overlay. Any key or tap skips the walk. The handoff is **single-canvas**:
  once the cinematic and the boot both settle, the same root/WebGL context
  re-renders in `'table'` mode and the container morphs in place from opaque
  overlay into the pointer-transparent seated backdrop
  (`atticEntry.convertToSeated`), covered by a brief plain-DOM veil — no
  second canvas, no duplicate shader compile, which was the sit-down hitch.
  The chunk itself is prefetched from an idle callback while the player is
  still reading the menu. The overlay is gated on the boot promise (it never
  reveals a half-built table), aborts instantly if the player lands back on
  the main menu or the boot throws, carries a 14s safety ceiling so a
  stalled WebGL context can never trap the player, and is skipped (straight
  to the seated backdrop) under `prefers-reduced-motion` or when the
  chunk/WebGL is unavailable. Timeline data lives in `APPROACH_KEYFRAMES`
  (src/three/atticLayout.mjs); the flow seam is
  `src/app/tableApproachFlow.mjs`, installed right after `installMainMenu`.
- **Bundle discipline**: React + three + fiber + the scene land in one lazy
  `atticEntry` chunk (~1.1 MB minified / ~300 KB gzip) — never part of the
  menu boot. With 3D on (the default) it is warmed from an idle callback on
  the menu and otherwise fetched on first need; with the kill-switch off it
  is never fetched at all. `menuBoot.js` is unchanged (28 KB).

### Files

```
src/three/
  atticEntry.mjs      mount/unmount seams (plain JS, no JSX): mountAttic3D for
                      the attic, mountTableApproach for the run-start overlay
                      (which converts in place to the seated backdrop),
                      mountSeatedTable for the attic-return path. WebGL check,
                      hard-exit/menu observers, window.__tlrAttic3d +
                      window.__tlrTable3d + window.__tlrTableSeat debug handles
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
  tableAnchors.mjs    world-anchor -> CSS-variable projector for the hybrid
                      seated table (+ the table3d-anchored fit gate)
src/app/tableApproachFlow.mjs  wraps New Reading/Continue with the approach
                      (which converts itself into the seated backdrop) +
                      idle-prefetches the chunk from the menu
src/styles/attic3d.css  canvas layering, DOM handovers, hint, approach
                      overlay, hybrid seated-table overrides (incl. the
                      spv2.tokens-layer !important counter to SPv2's mobile
                      spread transform)
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
# open http://localhost:8080/game.html   (3D is on by default)
# New Reading plays the walk-in-and-sit approach;
# finish a reading (or press Shift+A) for the walkable attic
# ?attic3d=0 for the classic 2D presentation
```

Headless verification (also exercises the ?attic3d=0 kill-switch path):

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

### Phase 3 — Presentation cues drive the 3D scene ✅ (via the hybrid)

The cue bridge (`CueListener` + `cueEnergy()` in AtticExperience.jsx) turns
`tlr:presentation-cue` events into decaying mood surges wherever the scene is
mounted. With the hybrid seated table keeping the room live during real play,
this now fires throughout the reading itself: placements, patterns, and
threshold clears ripple the candlelight and moonlight around the table.
Cue-driven *camera* movement while seated is intentionally still off — the
anchored DOM rows assume a stationary camera; if a camera push is ever
wanted, the projector must re-run per animation frame for its duration (the
plumbing exists: `applyTableAnchors` is idempotent).

### Phase 4 — Diegetic table UI ◐ (hybrid landed, panels next)

The hybrid landed in its strongest form: the low-poly table *replaced* the
painted background outright while the interactive SPv2 DOM stays on top,
positioned by projected world anchors (see "What is already working").
Remaining stages:

- **In-world panels**: score/threshold as objects (wax seals, a brass scale)
  driven by `useTlrStore` selectors, like the candle shelf today. The
  `discard`/`purge` anchors are already projected and published as CSS
  variables for when those medallions want to sit on the cloth.
- **Full diegetic reading** (stretch, deliberately deferred): cards as
  textured meshes using the existing card-sheet atlases. Card text
  legibility, rebuilt drag/ability/hint behavior, and mobile hit-testing
  make this expensive without initially improving the game — needs drei's
  `Html` (or render-to-texture), which is the point at which adding
  `@react-three/drei` pays for itself.

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

- Portrait Test B (anchored hand) is parked, not polished: making it win
  needs a wider portrait hand world-width plus real fan-geometry design so
  cards neither shrink below comfortable touch size nor clip the dock.
  Test A (anchored spread + native hand) is the shipping portrait default.
- The attic↔table transitions no longer flash the painted 2D art
  (`attic3d-pending`/`attic3d-live` keep the body background suppressed
  across both fades), but they pass over flat dark rather than a live 3D
  view: the seated backdrop and the walkable attic never overlap, so the
  beat between them is a black interstitial. Keeping one canvas alive
  across the attic transition (as the run-start approach now does via
  `convertToSeated`) is the polish upgrade if the dark beat ever reads as a
  hitch.
- Anchor projection re-runs on mount, resize, and two settle timers; if the
  hand's card count changes the fan span (draws/discards), the scale is only
  corrected on the next re-apply. Per-deal re-projection is a trivial add if
  it ever reads as drift.
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
