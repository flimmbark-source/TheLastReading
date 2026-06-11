# The Last Reading

A tarot-inspired single-player card game. Draw cards, build spreads, score readings, and visit the attic between sessions to spend obals on archive fragments.

## Running the game

Serve the repo root over HTTP and open `index.html`. Any static file server works:

```sh
npx serve .
# or
python3 -m http.server 8080
```

Opening `index.html` directly via `file://` works for basic play but disables ES module loading, which means the architecture bridge (store, reducer, live mirror) will not mount. The game falls back to legacy-only mode automatically in that case.

## Validation suite

All pure-logic systems are covered by a node-based validation suite. No browser needed.

```sh
node scripts/validate-all.mjs
```

Individual suites:

| Script | What it checks |
|---|---|
| `scripts/validate-scoring-cases.mjs` | Scoring engine: melds, thresholds, upgrades, relics |
| `scripts/validate-modifier-cases.mjs` | Scoring modifiers and relic stacking |
| `scripts/validate-economy-cases.mjs` | Shop pricing, pack costs, refresh ladder, Merchant's Scale |
| `scripts/check-architecture.mjs` | Reducer smoke tests: placement, discard, scoring, abilities, market, attic |

`npm test` and `npm run build` both run `validate-all.mjs`.

## Module structure

```
src/
  app/
    main.mjs            entry point: mounts bridge, installs UI globals, boots game
    bootstrap.mjs       legacy bridge helpers (tlrSyncRunToStore, etc.)
    liveMirror.mjs      continuous store ↔ legacy sync (tlrMirrorLiveState)
    store.mjs           lightweight observable store
    save.mjs            save/load serialization

  data/
    cards.mjs           card definitions (78 cards)
    abilities.mjs       ability text and parameters
    thresholds.mjs      per-reading score thresholds
    scoringPatterns.mjs scoring meld pattern constants
    relics.mjs          relic catalog with rarity and effects
    shopItems.mjs       shop upgrade catalog
    archiveFragments.mjs  resonations, archive fragments, archive items
    atticObjects.mjs    attic prop catalog, obal score ladder

  game/
    state.mjs           state shape factories (run, persist, session)
    actions.mjs         action type constants and creators
    reducer.mjs         immutable reducer owning all game logic
    selectors.mjs       derived selectors (scoring context, archive entries, obals)

  systems/
    deck.mjs            deck construction, draw, shuffle
    scoring.mjs         pure score computation
    hints.mjs           hint detection (patterns in the current spread)
    abilities.mjs       targeting (neighbor/kin/mirror/between), ability resolution helpers
    attic.mjs           obal conversion, attic object search
    relics.mjs          relic effect application (scoring, hand size, economy)
    shop.mjs            pack offer generation, purchase helpers, refresh ladder

  ui/
    renderTable.mjs     render() orchestrator, refreshHandState, score preview
    renderHand.mjs      hand slot renderer (uid-keyed DOM reuse)
    renderSpread.mjs    spread slot renderer
    renderMarket.mjs    shop overlay, relic rack, relic callouts
    renderAbility.mjs   ability choice modal, ability/purge prompts
    renderAttic.mjs     attic obal counter and prop grid
    renderCard.mjs      shared card HTML builder
    renderGhost.mjs     meld ghost and score-ghost animations
    renderHints.mjs     hint glow renderer

  styles/
    base.css            reset, layout, typography, overlays
    spread.css          reading spread slots
    hand.css            hand rack and card drag/swipe
    cards.css           card face, back, states (selected, placed, ability-target)
    market.css          shop overlay, packs, relic rack
    mobile.css          responsive overrides
    attic.css           attic scene, props, obal display
    drawers.css         side-drawer panels and gestures
```

## Architecture

The codebase follows a strict data-flow boundary:

```
Data → Systems → State → UI
```

`src/data/` is the single source of truth for all catalog data. `src/systems/` contains pure functions with no side effects. `src/game/reducer.mjs` owns all game logic (scoring, discard rules, ability resolution, market purchases, session flow). `src/ui/` renders state and dispatches actions — it does not own rules.

`index.html` carries the markup shell, `<link>` tags for the 8 style files, the legacy display script (still used for inline data tables, hint display, audio, and animation orchestration), and `<script type="module" src="src/app/main.mjs">` which wires everything together at boot.

The legacy script and the architecture store stay in sync through:

- **`tlrArchitectureSync()`** — called after every player action; pushes legacy globals into the store via `SYNC_LEGACY_RUN` / `SYNC_LEGACY_PERSIST`.
- **`tlrMirrorLiveState()`** — continuous parity checker; readable from the browser console.

```js
// Browser console diagnostics
window.tlrStore.getState();               // architecture store snapshot
window.tlrMirrorLiveState();             // { ok: true } after any player action
window.tlrMirrorLiveState({ sync: true }); // force re-sync
```

## Deployment

The game deploys as a static site. `netlify.toml` configures the build. There is no server-side component.
