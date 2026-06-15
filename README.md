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

## Multiplayer with Ably

Multiplayer rooms use Ably Pub/Sub channels named `tlr:room:<ROOMCODE>`. The browser loads the Ably JavaScript SDK on demand, then requests a short-lived channel-scoped token from `/.netlify/functions/ably-token`.

Required setup:

1. Create an Ably app and API key with `publish`, `subscribe`, `presence`, and `history` permissions.
2. In Netlify, add an environment variable for the Ably key. The token function accepts either name:

```sh
ABLYAPIKEY=your-key-name:your-key-secret
# or
ABLY_API_KEY=your-key-name:your-key-secret
```

Use `ABLYAPIKEY` if the Netlify UI you are using rejects underscores in variable names.

3. Deploy the site normally. Netlify will serve `netlify/functions/ably-token.mjs` at `/.netlify/functions/ably-token`.

For local multiplayer testing, use Netlify's local dev server so the function route exists:

```sh
npx netlify dev
```

The old `npm run dev` static server still works for singleplayer, but it does not serve Netlify Functions.

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
| `scripts/validate-bridge.mjs` | Legacy↔store bridge contract: field-drift guard and round-trip mapping |
| `scripts/validate-multiplayer.mjs` | Multiplayer reducer: placement, scoring, ability resolution, rounds |
| `scripts/validate-menu.mjs` | Headless (jsdom) main-menu show path: buttons stay interactive on return |
| `scripts/validate-render.mjs` | Headless (jsdom) render smoke test: `renderHand` uid-diffing and selection |

`npm test` and `npm run build` both run `validate-all.mjs`.

## Development tooling

```sh
npm install        # one-time: installs ESLint + Prettier (dev only)
npm run lint       # correctness-focused lint over src/ and scripts/
npm run format     # Prettier (skips the terse legacy app/ modules)
```

CI (`.github/workflows/ci.yml`) runs `npm run lint` and `npm test` on every push
and pull request.

## Architecture migration

The codebase is mid-migration from a shared mutable `window.state` to the
reducer/store in `src/game` and `src/multiplayer`. The remaining seams and the
phased plan to reach a single source of truth are tracked in
[`docs/migration-roadmap.md`](docs/migration-roadmap.md).

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
```

## Deploy note

Latest deploy trigger: constellation and Set-flow cleanup.
