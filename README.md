# The Last Reading

A tarot-inspired single-player card game. Draw cards, build spreads, score readings, and visit the attic between sessions to spend obals on archive fragments.

## 3D single-player (react-three-fiber)

On by default: starting a reading walks you into the attic and sits you down
at the table (skippable cinematic), and the reading itself is played on the
3D table — the real SPv2 cards sit on the cloth via projected world anchors
while the room's candlelight answers your plays. Between sessions the attic
is a walkable first-person room — tap/click anywhere to walk there (or WASD
on desktop), drag anywhere to look around (flick to keep turning on touch),
tap a glowing object to search it, then sit back down at the chair to return
to the table. Ships as a lazy chunk and falls back to the classic attic (and
the painted table) without WebGL. Kill-switch back to the classic 2D
presentation: `?attic3d=0` on `game.html`, or `tlrSetAttic3d(false)` in the
console (persists via `localStorage.tlr_attic_3d`). Architecture, controls,
and the roadmap toward a fully 3D single-player mode:
[`docs/r3f-singleplayer-integration.md`](docs/r3f-singleplayer-integration.md).
Headless check: `npm run test:attic3d`.

## Running the game

From the repository root, run:

```sh
npm start
```

The start command restores dependencies with `npm ci` when `node_modules` is
missing, builds the generated `dist/` bundles, and then serves the game at
`http://localhost:8080`.

Do not start a fresh checkout with a plain static file server. `game.html`
loads generated files under `dist/`, and that directory is intentionally not
committed. After `npm start` or `npm run build` has generated `dist/`, another
HTTP server can serve the repository root if needed.

Opening `index.html` directly via `file://` disables ES module loading and is
not a supported run path.

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

The `npm run dev` server works for singleplayer, but it does not serve Netlify Functions.

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
npm ci             # clean dependency install
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

  three/
    atticEntry.mjs      3D attic (react-three-fiber, on by default), own lazy chunk
    ...                 see docs/r3f-singleplayer-integration.md

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
