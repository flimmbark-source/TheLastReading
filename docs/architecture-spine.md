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
- Smoke checks added in `scripts/check-architecture.mjs`.
- Validation scripts added:
  - `scripts/validate-scoring-cases.mjs`
  - `scripts/validate-modifier-cases.mjs`
  - `scripts/validate-economy-cases.mjs`
  - `scripts/validate-all.mjs`

Run all current checks with:

```sh
node scripts/validate-all.mjs
```

Not done yet:

- The new modules are not wired into the live DOM UI.
- The old patch chain still exists.
- Attic/archive data is not fully extracted.
- The live browser bootstrap is not mounted from `index.html` yet.
- CSS is still embedded in `index.html`.

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

The next safe step is a live bridge mount, not full UI migration:

1. Load `src/app/bootstrap.mjs` from `index.html`.
2. Confirm `window.tlrStore.getState()` works in the browser console.
3. Mirror current live `index.html` state into the new store for diagnostics only.
4. Do not let the new store control gameplay until the mirrored snapshot is accurate.

## Important boundary

The attic and the reading table should communicate through save state, not DOM hooks or scattered `window.tlr*` bridges.

```js
save.discoveredArchiveItems.push(itemId);
save.obals += scoreToObals(totalScore);
```

The table should not know how attic props render. The attic should not patch reading-table functions.
