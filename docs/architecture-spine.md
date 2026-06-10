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

## Proposed app modules

```txt
src/
  data/
    cards.mjs
    thresholds.mjs
    scoringPatterns.mjs
  game/
    state.mjs
    actions.mjs
    reducer.mjs
  systems/
    deck.mjs
    scoring.mjs
    hints.mjs
    abilities.mjs
    relics.mjs
  ui/
    render.mjs
    components/
  styles/
```

## Phase order

### Phase 1: safe extraction

- Add architecture docs.
- Extract card data into modules.
- Extract thresholds and scoring-pattern constants.
- Add pure deck and scoring functions.
- Add smoke checks that do not affect the live app.

### Phase 2: parallel validation

- Run the extracted scoring system beside the existing `computeScore` during development.
- Compare outputs for known spreads.
- Add regression cases for the bugs we have already seen: sequence hints, 17/18 adjacency, 5/6 adjacency, Between targeting, Mirror targeting, reserve reset.

### Phase 3: state consolidation

- Introduce a central reducer.
- Convert direct mutations like `state.hand.splice(...)` into actions.
- Route UI events through `dispatch(action)`.
- Keep old render functions until the reducer is trusted.

### Phase 4: UI split

- Extract CSS from `index.html`.
- Split UI into screen-level render modules: table, market, attic, archives.
- Remove patch scripts after their behavior exists in real source files.

## Important boundary

The attic and the reading table should communicate through save state, not DOM hooks or `window.tlr*` bridges.

```js
save.discoveredArchiveItems.push(itemId);
save.obals += scoreToObals(totalScore);
```

The table should not know how attic props render. The attic should not patch reading-table functions.
