# The Last Reading architecture spine

This branch starts the migration from a patched single-file prototype into a game app with a stable architecture.

The current playable app still lives in `index.html`. The new `src/` modules are intentionally not wired into the UI yet. They are a safe source-of-truth layer that can be adopted one system at a time.

## Target shape

```txt
Data -> Systems -> State -> UI
```

The UI should render state and dispatch actions. It should not own scoring rules, deck rules, relic behavior, shop rules, or tutorial progress.

## Migration rules

1. Keep `index.html` playable until a replacement shell exists.
2. Stop adding new patch scripts for feature work.
3. Move stable data first: cards, thresholds, shop items, relics, tutorial copy.
4. Move pure systems next: deck building, scoring, hint detection, ability resolution.
5. Move mutable flow last: reducer/actions, screen phases, save-state bridges.
6. Only after those are stable, replace DOM rendering in chunks.

## Current status on this branch

Done:

- Card definitions extracted to `src/data/cards.mjs`.
- Ability definitions extracted to `src/data/abilities.mjs`.
- Thresholds extracted to `src/data/thresholds.mjs`.
- Scoring-pattern constants extracted to `src/data/scoringPatterns.mjs`.
- Relic catalog extracted to `src/data/relics.mjs`.
- Shop catalog extracted to `src/data/shopItems.mjs`.
- Deck construction/draw/shuffle helpers added in `src/systems/deck.mjs`.
- Pure scoring added in `src/systems/scoring.mjs`.
- Scoring now delegates relic effects to `src/systems/relics.mjs`.
- Pure scoring hints added in `src/systems/hints.mjs`.
- Pure ability targeting/reveal helpers added in `src/systems/abilities.mjs`.
- Pure shop offer/purchase helpers added in `src/systems/shop.mjs`.
- Central state factories added in `src/game/state.mjs`.
- Action names added in `src/game/actions.mjs`.
- Initial immutable reducer added in `src/game/reducer.mjs`.
- Shop purchase can now route through the reducer.
- Derived selectors added in `src/game/selectors.mjs`.
- Lightweight store added in `src/app/store.mjs`.
- Save serialization helpers added in `src/app/save.mjs`.
- Migration bridge bootstrap added in `src/app/bootstrap.mjs`.
- Live mirror diagnostics added in `src/app/liveMirror.mjs`.
- The live mirror is mounted from `index.html` as a module script (Phase 4).
- `index.html` installs `window.tlrReadLiveSnapshot` to read legacy globals.
- Legacy code re-syncs the architecture store after every player action via
  `tlrArchitectureSync()` hooks in `render()`, `refreshHandState()`,
  `showOverlay()`, `clearOverlay()`, and the ability `choice()` modal (Phase 5).
- Smoke checks added in `scripts/check-architecture.mjs`.
- Validation scripts added:
  - `scripts/validate-scoring-cases.mjs`
  - `scripts/validate-modifier-cases.mjs`
  - `scripts/validate-economy-cases.mjs`
  - `scripts/validate-all.mjs`

Gameplay migrated into the reducer/systems (Phases 6-14). The legacy
`render()` and DOM are unchanged; every original mutation remains in place
as a fallback that only runs if the module bridge fails to load:

- Phase 6: `state.selected` is an accessor over the store — reads come from
  `run.selectedCardId`, writes dispatch `SELECT_CARD`/`CLEAR_SELECTION`.
- Phase 7: `PLACE_CARD` owns hand-to-spread movement via the
  `SYNC_LEGACY_RUN`/`SYNC_LEGACY_PERSIST` check-in pattern: legacy pushes its
  run into the store, dispatches, and reads the result back.
- Phase 8: `DISCARD_SELECTED` owns discard rules (charge spend, Gilded
  Discard first-free, sight_cost charges, hanged_coin/quick_release
  tracking); the discarded card's ability resolution follows separately.
- Phase 9: `SCORE_READING` resolves through `src/systems/scoring.mjs`
  (verified score-identical to the inline engine over randomized spreads,
  upgrades, and relics); the reducer owns threshold pass/fail, score carry,
  Miser/World/relic-earned, market open, and session end. The inline score
  is now display-only and warns on any parity mismatch.
- Phase 10: ability targeting (neighbor/kin/mirror/between) goes through
  `src/systems/abilities.mjs`, verified target-identical across all cards
  and anchor pairs.
- Phase 11: `START_ABILITY`/`RESOLVE_ABILITY`/`CANCEL_ABILITY` own ability
  results: draws (with reshuffle), takes (rest to deck bottom), search,
  Full Reset, Chosen tracking, and Thread Bond chips.
- Phase 12: the market runs on `src/systems/shop.mjs` (pack offers/costs,
  rebuy escalation, refresh ladder, Merchant's Scale, rarity-weighted relic
  cache) and `BUY_MARKET_ITEM` purchases (reserve spends, upgrade picks,
  relic add/replace with duplicate and slot rules); `LEAVE_MARKET` owns the
  next-reading transition.
- Phase 13: `START_READING` owns the reading reset (deal with all hand-size
  modifiers, discards/mulligan, offering income, threshold-bonus rollover);
  `END_SESSION` and `RESET_SESSION` own session end/restart with permanent
  progress preserved.
- Phase 14: attic/archive data extracted (`src/data/archiveFragments.mjs`,
  `src/data/atticObjects.mjs`), attic system added, archive unlock
  selectors added, obal grants and archive unlocks land in store save
  state, attic entry/exit dispatches through the reducer.

Run all current checks with:

```sh
node scripts/validate-all.mjs
```

Not done yet:

- Rendering still lives in `index.html` (Phase 15: split into `src/ui/`).
- `index.html` is still the app rather than a shell (Phase 16).
- CSS is still embedded in `index.html` (Phase 17).
- The old patch chain still exists and the inline fallback copies of
  migrated logic are still present; both go away in Phase 18 once the UI
  modules are live.
- Archive/attic rendering still reads the inline data literals; the
  extracted data modules are verified byte-identical and become the only
  source when rendering moves to `src/ui/`.

## Proposed app modules

```txt
src/
  app/
    bootstrap.mjs
    store.mjs
    save.mjs
  data/
    abilities.mjs
    cards.mjs
    relics.mjs
    shopItems.mjs
    thresholds.mjs
    scoringPatterns.mjs
  game/
    state.mjs
    actions.mjs
    reducer.mjs
    selectors.mjs
  systems/
    deck.mjs
    scoring.mjs
    hints.mjs
    abilities.mjs
    relics.mjs
    shop.mjs
  ui/
    render.mjs
    components/
  styles/
```

## Next phase

Gameplay state and rules are reducer/system-owned (Phases 6-14 complete).
Verify in the browser console:

```js
window.tlrStore.getState();                   // architecture state
window.tlrMirrorLiveState();                  // ok: true after any player action
window.tlrMirrorLiveState({ sync: true });    // force a re-sync, ok: true
```

The next safe step is Phase 15: split rendering into `src/ui/` modules
(renderTable/renderHand/renderSpread/renderMarket/renderAbility/renderAttic
plus shared card/ghost/hint renderers) with the DOM structure and visuals
unchanged. Only after the UI modules are live should the inline functions,
fallback copies, and patch chain be deleted (Phases 16-18).

## Important boundary

The attic and the reading table should communicate through save state, not DOM hooks or scattered `window.tlr*` bridges.

```js
save.discoveredArchiveItems.push(itemId);
save.obals += scoreToObals(totalScore);
```

The table should not know how attic props render. The attic should not patch reading-table functions.
