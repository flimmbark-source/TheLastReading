# Single-Source-of-Truth Migration Roadmap

The game is mid-migration from its original architecture (a single mutable
`window.state` object plus many `window.*` globals) toward reducer/store-backed
state in `src/game` and match-state-backed multiplayer in `src/multiplayer`.
Both representations still exist in places, and bridge code keeps them in sync.
That dual-write / dual-read design is still the main source of subtle desyncs.

This document inventories the remaining seams and lays out a phased, low-risk
path to collapse them. Each phase is independently shippable. Validation scripts
should be kept green; local `npm test`, `npm run lint`, and `npm run build` still
need to be run after each larger slice.

## Current state

- **Pure logic** lives in `src/systems`, `src/game` (singleplayer reducer), and
  `src/multiplayer` (match reducer). These are the migration targets.
- **Card-ability reveal logic is unified.** `systems/abilities.mjs#abilityHeldCards`
  is the shared reveal computation used by singleplayer, the multiplayer reducer,
  and multiplayer UI choice flows.
- **Singleplayer rendering is partially selector-backed.** `handView`,
  `spreadView`, `tableView`, and `scorePreview` now feed the main render path
  when the store is available.
- **Singleplayer purge has a store-owned path.** `game/reducerWithPurge.mjs`
  wraps the base reducer for purge actions, and `app/purgeRuntime.mjs` routes the
  old global purge functions through store dispatches while legacy state still
  needs to be mirrored for older render/runtime code.
- **Singleplayer ability targeting has a store-owned picked-target path.**
  `game/reducerWithPurge.mjs` owns `run.ability.targeting`, and
  `app/abilityTargetBridge.mjs` mirrors that state into the legacy
  `state.abilitySelect` shape that the current UI still expects.
- **Singleplayer placement now supports explicit card placement.**
  `placementRuntime.mjs` exposes `placeCardUid(cardUid, slotIndex)`, and the hand
  drag gesture uses it when available instead of always communicating placement
  through `state.selected` first.
- **Multiplayer ability UX follows the singleplayer surfaces for standard tarot
  abilities.** Relation abilities use visible hand/spread targets,
  `#abilityPrompt`, and the shared modal choice box for revealed cards.
- **Multiplayer reducer fixes are folded into the base reducer.** WORLD /
  Reshuffle now reshuffles from deck, discard, and hand, preserving already
  placed spread cards. Between reveal resolution is capped by `ability.count` in
  `mpReducer.mjs`.
- **Multiplayer extension installs are centralized.** `mpGameHost.mjs` installs
  the base multiplayer game and then one ordered `mpGameExtensions.mjs` seam. The
  extensions still exist, but the host no longer imports each patch directly.
- **Legacy layer** still lives in `src/app` and `src/ui`. Some modules still read
  and write `window.state` / `window.persist` and cache DOM nodes in module
  globals. These are mirrored into the store by `app/legacyBridge.mjs` and
  `app/liveMirror.mjs`.

## Seam inventory

| Seam | Where | Notes |
|---|---|---|
| Shared mutable `state` / `persist` | `src/app/*`, `src/ui/*` | Still read/written directly in parts of the singleplayer runtime; mirrored to the store via `legacyBridge`. |
| Store to legacy sync | `app/legacyBridge.mjs`, `app/liveMirror.mjs`, `app/bootstrap.mjs` | `syncRunToStore`, `resolveAbilityThroughStore`, `tlrMirrorLiveState`. Still needed until renderers and runtimes stop relying on legacy fields. |
| Singleplayer hand/spread render data | `game/selectors.mjs`, `ui/renderTable.mjs`, `ui/renderHand.mjs`, `ui/renderSpread.mjs` | `handView(state)` feeds `renderHand`; `spreadView(state)` feeds `renderSpread`; `renderTable` passes both when the store is available. |
| Singleplayer table chrome and score preview | `game/selectors.mjs`, `ui/renderTable.mjs` | `tableView(state)` is wired into `renderTable`; `scorePreview(state)` drives preview when store state is available. Legacy preview logic remains as fallback. |
| Singleplayer purge ownership | `game/reducerWithPurge.mjs`, `app/purgeRuntime.mjs`, `app/discardRuntime.mjs` | Purge actions are store-owned through a reducer wrapper and runtime installer. The wrapper is a temporary seam until purge is folded into the base reducer. |
| Singleplayer ability targeting | `game/reducerWithPurge.mjs`, `app/abilityTargetBridge.mjs`, `app/readingFlow.mjs` | Picked targets are store-owned, but targeting is still initiated through legacy `state.abilitySelect` and mirrored back for current renderers. |
| Singleplayer placement / gesture bridge | `ui/gestureCard.mjs`, `app/placementRuntime.mjs`, `app/spreadPlacementBridge.mjs` | Drag-to-spread now calls `placeCardUid` when available. Reorder and hold-to-expand still operate on legacy runtime `state.hand` / `state.selected`. |
| Multiplayer match reducer | `multiplayer/mpReducer.mjs` | WORLD / Reshuffle spread preservation and Between reveal cap now live in the base reducer. `mpReducerFixed.mjs` remains only as a compatibility alias. |
| Multiplayer UI extension seam | `app/mpGameHost.mjs`, `app/mpGameExtensions.mjs` | The host is clean, but companion modules remain: scoring feedback, score-pill stability, singleplayer-style ability flow, UI state fixes, persona prompt, Between modal limiter, and pending placement preview. |
| Multiplayer to legacy render | `app/mpGame.mjs`, `ui/gestureCard.mjs` | Mostly resolved. Multiplayer card piles and selection/purge are module-local match-state view models. Drag placement now has an explicit UID path, but the shared gesture module still retains legacy fallback behavior. |

## Phased plan

**Phase 1 — Ability subsystem (done).** Shared pure resolver; multiplayer owns
its own UI selection state. Pattern to copy for later phases: put the pure rule
in `src/systems`, give each mode a thin adapter, never cross-mutate globals.

**Phase 2 — Make the singleplayer store authoritative for the run.** Have the
singleplayer UI read derived view-data from `selectors.mjs` instead of
`window.state`, one renderer/runtime slice at a time. Keep `legacyBridge` writing
both ways until a renderer or runtime no longer touches legacy state.

> _Foundation in place._ The legacy to store field contract is centralized by
> `LEGACY_RUN_FIELDS` and pinned by `scripts/validate-bridge.mjs`.
>
> _Renderer progress._ `handView`, `spreadView`, `tableView`, and `scorePreview`
> now feed the main render path when the store is available. `renderHand` and
> `renderSpread` accept explicit view data; `renderTable` passes store-derived
> hand/spread views and uses store-derived table chrome and score preview.
>
> _Purge progress._ Purge is routed through store actions via `reducerWithPurge`
> and `purgeRuntime`. This is intentionally still a wrapper so the large base
> reducer was not rewritten in one risky pass.
>
> _Ability targeting progress._ Picked ability targets are stored under
> `run.ability.targeting`. The current UI is still bridged from and to
> `state.abilitySelect`, so this is not yet store-native.
>
> _Gesture progress._ Spread placement supports explicit `placeCardUid(cardUid,
> slotIndex)`, and drag-to-spread uses it when available. Hand reorder and
> hold-to-expand are still legacy runtime operations.
>
> _Verification anchors._ `scripts/validate-render.mjs` covers hand/spread view
> behavior, `scripts/validate-table-view.mjs` covers table chrome,
> `scripts/validate-purge-reducer.mjs` covers the purge reducer wrapper, and
> `scripts/validate-ability-targeting.mjs` covers reducer-owned target picks.
>
> _Remaining Phase 2 work._ Move ability targeting initiation out of
> `readingFlow`/`state.abilitySelect`, migrate reorder/hold selection, then remove
> renderer fallback reads from legacy state.

**Phase 3 — Retire the legacy `state` object.** Once renderers and runtimes read
from the store, replace remaining direct `state.*` writes in `readingFlow.mjs`,
`discardRuntime.mjs`, `placementRuntime.mjs`, and gesture code with store
dispatches. Then delete the `Object.defineProperty` selection bridge and
`syncRunToStore`.

**Phase 4 — Multiplayer renders from match state directly.** Replace remaining
legacy handoffs with explicit multiplayer view models and match-state selectors.

> _Mostly done._ `renderHand(ability, inPurge, view)` takes a display view model.
> Multiplayer owns selection (`_selected`) and purge (`_purgeSelect`) in
> `mpGame.mjs`, and multiplayer spread/hand rendering uses match state.
>
> _Recent fixes folded._ WORLD / Reshuffle spread preservation and Between reveal
> cap are in `mpReducer.mjs`. The local pending placement preview, persona prompt,
> mult-span sync, and score-pill stability remain UI extensions.
>
> _Remaining bridge._ The shared gesture layer still exists for multiplayer hand
> dragging, but drag-to-spread now has a direct UID placement path.

**Phase 5 — Fold remaining patch overlays into their hosts.**

> _Progress._ `main.mjs` imports only `app/mpGameHost.mjs` for multiplayer
> installation. `mpGameHost.mjs` now installs the base game and a single ordered
> `mpGameExtensions.mjs` seam. Reducer rule patches have been folded into the
> base reducer.
>
> _Remaining work._ Fold stable UI extensions into `mpGame.mjs` one at a time.
> Highest-priority candidates: pending placement preview, persona ability prompt,
> mult-span rendering, and ability-choice modal capping. After each fold, remove
> the corresponding extension installer from `mpGameExtensions.mjs`.

## Immediate next steps

1. Run local validation: `npm test`, `npm run lint`, and `npm run build`.
2. Manually smoke-test desktop multiplayer: Ability button visibility, persona
   ability prompt flow, spread/hand target glows, mult spans after placements,
   pending placement preview, and WORLD / Reshuffle preserving already placed
   cards.
3. Fold `mpPendingPlacementPreview` into `mpGame.mjs` directly.
4. Fold `mpPersonaAbilityPrompt` into `mpGame.mjs` directly.
5. Cap Between before modal rendering in the multiplayer ability-choice flow, then
   remove `mpBetweenChoiceLimit` from `mpGameExtensions.mjs`.

## Efficiency follow-ups (tracked, intentionally not bundled here)

- **Repo / asset size.** Large PNG/MP3 assets dominate the repo and `.git`.
  The high-leverage fix is migrating binaries to Git LFS or otherwise moving
  binaries out of normal Git history. Do this deliberately and with coordination.
  Lossless image optimization is a complementary option but should be visually
  spot-checked.
- **Runtime performance.** `mpGame.render()` still re-renders broad UI areas on
  every sync. After Phase 4 is fully folded, drive renders from diffed view
  models. Validate with an in-browser profile rather than speculative changes.
