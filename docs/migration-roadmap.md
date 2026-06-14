# Single-Source-of-Truth Migration Roadmap

The game is mid-migration from its original architecture (a single mutable
`window.state` object plus many `window.*` globals) toward the reducer/store
architecture in `src/game` and `src/multiplayer`. Both representations exist at
once today and are kept in agreement by bridge code. That dual-write design is
the root cause of subtle desyncs (most visibly, the multiplayer card-ability
instability that prompted this work).

This document inventories the remaining seams and lays out a phased, low-risk
path to collapse them. Each phase is independently shippable and must keep
`npm test` and `npm run lint` green.

## Current state (after the ability-resolver unification)

- **Pure logic** lives in `src/systems`, `src/game` (singleplayer reducer), and
  `src/multiplayer` (match reducer). These are the migration target and lint
  cleanly.
- **Card-ability resolution is unified.** `systems/abilities.mjs#abilityHeldCards`
  is the single reveal computation used by the singleplayer flow, the multiplayer
  reducer, and the multiplayer UI. Multiplayer keeps its own UI selection state
  (`buildMpAbilityChoice` in `app/mpGame.mjs`) and never mutates singleplayer
  globals. The old singleplayer-flow bridge and its dead `resultState` path are
  gone.
- **Legacy layer** lives in `src/app` and `src/ui`. These modules read and write
  the shared `window.state` / `window.persist` objects and cache DOM nodes in
  module globals. They are mirrored into the store by `app/legacyBridge.mjs` and
  `app/liveMirror.mjs`.

## Seam inventory

| Seam | Where | Notes |
|---|---|---|
| Shared mutable `state` / `persist` | `src/app/*`, `src/ui/*` | Read/written directly; mirrored to the store via `legacyBridge`. |
| Store ↔ legacy sync | `app/legacyBridge.mjs`, `app/liveMirror.mjs`, `app/bootstrap.mjs` | `syncRunToStore`, `resolveAbilityThroughStore`, `tlrMirrorLiveState`. |
| Multiplayer ↔ legacy render | `app/mpGame.mjs` `syncPerspectiveState` | Copies the MP player's piles into `window.state` each render so the shared hand renderer can draw them. |
| Remaining live patch overlays | `app/surgeonHandSwapPatch.mjs`, `app/mpScoringFeedbackPatch.mjs`, `app/mpScorePillStabilityPatch.mjs` | Still imported and installed by `main.mjs`; fold into hosts as those flows migrate. |

## Phased plan

**Phase 1 — Ability subsystem (done).** Shared pure resolver; multiplayer owns
its own UI selection state. Pattern to copy for later phases: put the pure rule
in `src/systems`, give each mode a thin adapter, never cross-mutate globals.

**Phase 2 — Make the store authoritative for the run.** Have the singleplayer UI
read derived view-data from `selectors.mjs` instead of `window.state`, one
renderer at a time (`renderHand`, `renderSpread`, then `renderTable`). Keep
`legacyBridge` writing both ways until a renderer no longer touches `state`.

> _Foundation in place._ The legacy↔store field contract is now a single source
> of truth (`LEGACY_RUN_FIELDS`, exported from `game/reducer.mjs`) and is pinned
> by `scripts/validate-bridge.mjs`, which fails if `syncRunToStore` and the
> reducer whitelist drift apart. This makes the eventual authority-flip safe to
> do incrementally. The remaining Phase 2 work (renderers reading from the store)
> changes live DOM output and needs a browser/jsdom smoke harness to verify —
> that harness is the prerequisite for Phases 2b–4 and does not exist yet.

**Phase 3 — Retire the legacy `state` object.** Once renderers read from the
store, replace the remaining direct `state.*` writes (in `readingFlow.mjs`,
`discardRuntime.mjs`, `placementRuntime.mjs`, etc.) with store dispatches, then
delete the `Object.defineProperty` selection bridge and `syncRunToStore`.

**Phase 4 — Multiplayer renders from match state directly.** Replace
`syncPerspectiveState`'s copy-into-`window.state` with a dedicated MP view model
so the shared hand renderer takes explicit data instead of reading a global.
This removes the last place where MP writes singleplayer globals.

**Phase 5 — Fold remaining patch overlays into their hosts** and delete the
`*Patch.mjs` install seam from `main.mjs`.

## Efficiency follow-ups (tracked, intentionally not bundled here)

- **Repo / asset size.** ~133 MB of PNG/MP3 assets dominate the repo and `.git`.
  The high-leverage fix is migrating binaries to **Git LFS**, which rewrites
  history and requires a coordinated force-push — do this deliberately, not as a
  side effect of a refactor. Lossless image optimization (e.g. `oxipng`,
  `zopflipng`) is a complementary, non-history-rewriting option but should be
  visually spot-checked.
- **Runtime performance.** `mpGame.render()` re-renders the whole board on every
  sync. After Phase 4, drive renders from diffed view models. Validate with an
  in-browser profile rather than speculative changes.
