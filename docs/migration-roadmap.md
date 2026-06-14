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
- **Multiplayer ability UX follows the singleplayer surfaces for standard tarot
  abilities.** Relation abilities use visible hand/spread targets,
  `#abilityPrompt`, and the shared modal choice box for revealed cards.
- **Multiplayer persona ability UX now has a prompt layer.** The Surgeon-style
  spread/hand swap flow shows `#abilityPrompt`, highlights valid spread targets,
  updates after the first target, then highlights valid hand targets.
- **Multiplayer has targeted compatibility wrappers.** `mpReducerFixed.mjs`
  wraps the match reducer to keep WORLD / Reshuffle from clearing already placed
  spread cards. `mpUiStateFixes.mjs` keeps mult spans and desktop ability-button
  visibility in sync with current match state.
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
| Singleplayer table chrome and score preview | `game/selectors.mjs`, `ui/renderTable.mjs` | `tableView(state)` is now wired into `renderTable`; `scorePreview(state)` drives preview when store state is available. Legacy preview logic remains as fallback. |
| Singleplayer purge ownership | `game/reducerWithPurge.mjs`, `app/purgeRuntime.mjs`, `app/discardRuntime.mjs` | Purge actions are store-owned through a reducer wrapper and runtime installer. The wrapper is a temporary seam until purge is folded into the base reducer. |
| Singleplayer placement / gesture bridge | `ui/gestureCard.mjs`, `app/mpGame.mjs`, `app/placementRuntime.mjs` | Drag-to-place still communicates the dragged card through `state.selected` in some paths. Recent drag stability work fixed stale drop-target detection but did not remove the bridge. |
| Singleplayer ability targeting | `app/readingFlow.mjs`, `ui/renderAbility.mjs`, `ui/renderSpread.mjs`, `ui/renderHand.mjs` | Still UI-local / legacy-shaped. This is the next major Phase 2 blocker before fallback legacy reads can be removed. |
| Multiplayer match reducer wrapper | `multiplayer/mpReducerFixed.mjs`, `app/matchmakingScreen.mjs`, `multiplayer/index.mjs` | WORLD / Reshuffle preservation is currently implemented as a wrapper around `mpReducer.mjs`. This should eventually be folded into the base reducer. |
| Multiplayer UI state wrappers | `app/mpUiStateFixes.mjs`, `app/mpPersonaAbilityPrompt.mjs`, `app/mpGameHost.mjs` | Mult spans, desktop ability button visibility, and persona ability prompts are installed behind the multiplayer host. Useful and working, but still companion modules. |
| Multiplayer to legacy render | `app/mpGame.mjs`, `app/mpSingleplayerAbilityFlow.mjs` | Mostly resolved. Multiplayer card piles and selection/purge are module-local match-state view models. One read of `state.selected` remains for drag-to-place from `gestureCard`. |
| Patch overlay host seam | `app/mpGameHost.mjs` | `main.mjs` imports only `app/mpGameHost.mjs` for multiplayer installation. Remaining `*Patch.mjs` / fix modules should be folded or renamed into domain modules once stable. |

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
> _Purge progress._ Purge is now routed through store actions via
> `reducerWithPurge` and `purgeRuntime`. This is intentionally a wrapper so the
> large base reducer was not rewritten in one risky pass.
>
> _Verification anchors._ `scripts/validate-render.mjs` covers hand/spread view
> behavior, `scripts/validate-table-view.mjs` covers table chrome, and
> `scripts/validate-purge-reducer.mjs` covers the purge reducer wrapper.
>
> _Remaining Phase 2 work._ Move ability target selection to explicit store or
> mode-owned state, then migrate the remaining selection/gesture bridge. Only
> after that should renderer fallback reads from legacy state be removed.

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
> _Recent fixes._ `mpReducerFixed.mjs` preserves already placed spread cards when
> WORLD / Reshuffle is used. `mpUiStateFixes.mjs` keeps player and foe mult spans
> synced from match state and restores desktop visibility for the Ability button.
> `mpPersonaAbilityPrompt.mjs` gives persona ability use the same kind of prompt
> and targeting feedback as other abilities.
>
> _Remaining bridge._ Drag-to-place still uses the singleplayer gesture layer's
> `state.selected` handshake. That should be migrated after ability targeting is
> cleaned up.

**Phase 5 — Fold remaining patch overlays into their hosts.**

> _Partly done._ `main.mjs` imports only `app/mpGameHost.mjs` for multiplayer
> installation. The host installs the base multiplayer game plus the companion
> modules for surgeon swap, scoring feedback, score stability, singleplayer-style
> ability flow, UI state fixes, and persona ability prompts.
>
> _Remaining work._ Fold or rename stable companion modules into real host/domain
> modules. Highest-priority candidates: move WORLD / Reshuffle preservation into
> `mpReducer.mjs`; move mult-span rendering into base `mpGame.mjs#renderPills`;
> move persona ability prompt state into `mpGame.mjs` rather than observing DOM
> classes.

## Immediate next steps

1. Run local validation: `npm test`, `npm run lint`, and `npm run build`.
2. Manually smoke-test desktop multiplayer: Ability button visibility, persona
   ability prompt flow, spread/hand target glows, mult spans after placements,
   and WORLD / Reshuffle preserving already placed cards.
3. Next migration slice: ability target selection ownership.
4. After that: gesture/selection bridge migration.
5. Then remove legacy fallback reads from renderers.

## Efficiency follow-ups (tracked, intentionally not bundled here)

- **Repo / asset size.** Large PNG/MP3 assets dominate the repo and `.git`.
  The high-leverage fix is migrating binaries to Git LFS or otherwise moving
  binaries out of normal Git history. Do this deliberately and with coordination.
  Lossless image optimization is a complementary option but should be visually
  spot-checked.
- **Runtime performance.** `mpGame.render()` still re-renders broad UI areas on
  every sync. After Phase 4 is fully folded, drive renders from diffed view
  models. Validate with an in-browser profile rather than speculative changes.
