# Single-Source-of-Truth Migration Roadmap

The game is mid-migration from its original architecture (a single mutable
`window.state` object plus many `window.*` globals) toward the reducer/store
architecture in `src/game` and `src/multiplayer`. Both representations exist at
once today and are kept in agreement by bridge code. That dual-write design is
the root cause of subtle desyncs.

This document inventories the remaining seams and lays out a phased, low-risk
path to collapse them. Each phase is independently shippable and must keep
`npm test` and `npm run lint` green.

## Current state

- **Pure logic** lives in `src/systems`, `src/game` (singleplayer reducer), and
  `src/multiplayer` (match reducer). These are the migration target and lint
  cleanly.
- **Card-ability resolution is unified.** `systems/abilities.mjs#abilityHeldCards`
  is the single reveal computation used by the singleplayer flow, the multiplayer
  reducer, and the multiplayer UI.
- **Multiplayer ability UX now follows the singleplayer surfaces for standard
  tarot abilities.** Multiplayer relation abilities use visible hand/spread
  targets, `#abilityPrompt`, and the shared modal choice box for revealed cards.
  Multiplayer-only interaction cards keep their opponent-target behavior.
- **Legacy layer** lives in `src/app` and `src/ui`. These modules still read and
  write the shared `window.state` / `window.persist` objects and cache DOM nodes
  in module globals. They are mirrored into the store by `app/legacyBridge.mjs`
  and `app/liveMirror.mjs`.

## Seam inventory

| Seam | Where | Notes |
|---|---|---|
| Shared mutable `state` / `persist` | `src/app/*`, `src/ui/*` | Still read/written directly; mirrored to the store via `legacyBridge`. |
| Store to legacy sync | `app/legacyBridge.mjs`, `app/liveMirror.mjs`, `app/bootstrap.mjs` | `syncRunToStore`, `resolveAbilityThroughStore`, `tlrMirrorLiveState`. |
| Singleplayer hand render data | `game/selectors.mjs`, `ui/renderTable.mjs`, `ui/renderHand.mjs` | Phase 2 started: `handView(state)` now feeds `renderHand` from store-derived display data when the store is available. Purge selection is temporarily bridged from legacy until purge moves into the store. |
| Multiplayer to legacy render | `app/mpGame.mjs`, `app/mpSingleplayerAbilityFlow.mjs` | Mostly resolved. Multiplayer card piles and selection/purge are module-local match-state view models. One read of `state.selected` remains for drag-to-place from `gestureCard`. |
| Patch overlay host seam | `app/mpGameHost.mjs` | `main.mjs` no longer imports or installs `*Patch.mjs` directly. The remaining companion modules are installed behind the multiplayer host and should be folded or renamed as their flows are absorbed. |

## Phased plan

**Phase 1 — Ability subsystem (done).** Shared pure resolver; multiplayer owns
its own UI selection state. Pattern to copy for later phases: put the pure rule
in `src/systems`, give each mode a thin adapter, never cross-mutate globals.

**Phase 2 — Make the store authoritative for the run.** Have the singleplayer UI
read derived view-data from `selectors.mjs` instead of `window.state`, one
renderer at a time (`renderHand`, `renderSpread`, then `renderTable`). Keep
`legacyBridge` writing both ways until a renderer no longer touches `state`.

> _Foundation in place._ The legacy to store field contract is now a single
> source of truth (`LEGACY_RUN_FIELDS`, exported from `game/reducer.mjs`) and is
> pinned by `scripts/validate-bridge.mjs`, which fails if `syncRunToStore` and
> the reducer whitelist drift apart.
>
> _Verification anchor in place._ `scripts/validate-render.mjs` boots the real
> data globals and hint runtime against a jsdom document and asserts `renderHand`'s
> uid-keyed diffing and selection output.
>
> _Hand renderer slice started._ `game/selectors.mjs#handView` now builds the
> singleplayer hand display view, and `renderTable` passes it into `renderHand`
> when the store is available. Remaining Phase 2 work: migrate spread view data,
> migrate table-level pills/buttons/preview, then remove the hand renderer's
> fallback reads from legacy state.

**Phase 3 — Retire the legacy `state` object.** Once renderers read from the
store, replace the remaining direct `state.*` writes (in `readingFlow.mjs`,
`discardRuntime.mjs`, `placementRuntime.mjs`, etc.) with store dispatches, then
delete the `Object.defineProperty` selection bridge and `syncRunToStore`.

**Phase 4 — Multiplayer renders from match state directly.** Replace
`syncPerspectiveState`'s copy-into-`window.state` with a dedicated MP view model
so the shared hand renderer takes explicit data instead of reading a global.

> _Done with one bridge remaining._ `renderHand(ability, inPurge, view)` takes a
> display view model. Multiplayer owns its selection (`_selected`) and purge
> (`_purgeSelect`) stores. The one remaining read of `state.selected` is the
> drag-to-place handshake the singleplayer `gestureCard` layer sets; it disappears
> when that gesture layer is migrated.

**Phase 5 — Fold remaining patch overlays into their hosts.**

> _Partly done._ `main.mjs` imports only `app/mpGameHost.mjs` for multiplayer
> installation. Remaining work is to fold or rename the companion `*Patch.mjs`
> modules into real host/domain modules once their responsibilities are absorbed.

## Efficiency follow-ups (tracked, intentionally not bundled here)

- **Repo / asset size.** Large PNG/MP3 assets dominate the repo and `.git`.
  The high-leverage fix is migrating binaries to Git LFS or otherwise moving
  binaries out of normal Git history. Do this deliberately and with coordination.
  Lossless image optimization is a complementary option but should be visually
  spot-checked.
- **Runtime performance.** `mpGame.render()` re-renders the whole board on every
  sync. After Phase 4, drive renders from diffed view models. Validate with an
  in-browser profile rather than speculative changes.
