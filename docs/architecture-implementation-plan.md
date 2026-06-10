# Architecture implementation plan

This is the working plan for adapting The Last Reading from the current patched `index.html` prototype into the new source-driven architecture.

The goal is not to rewrite everything at once. The goal is to move one responsibility at a time from inline DOM/global code into stable modules, while keeping the game playable after every commit series.

## Non-negotiable rules

1. Keep the live game playable after each commit series.
2. Do not add new patch scripts.
3. Do not delete the existing patch chain until its behavior has been replaced by real source files.
4. Do not combine visual/CSS refactors with game-logic refactors.
5. Every migrated system needs either smoke checks or explicit manual verification notes.
6. Prefer parallel validation before replacement: new system first, bridge second, live wiring third, old code cleanup last.

## Current state

Already added on `architecture-spine`:

- `src/data/cards.mjs`
- `src/data/abilities.mjs`
- `src/data/scoringPatterns.mjs`
- `src/data/thresholds.mjs`
- `src/systems/deck.mjs`
- `src/systems/scoring.mjs`
- `src/systems/hints.mjs`
- `src/systems/abilities.mjs`
- `src/game/state.mjs`
- `src/game/actions.mjs`
- `src/game/reducer.mjs`
- `src/game/selectors.mjs`
- `src/app/store.mjs`
- `src/app/save.mjs`
- `scripts/check-architecture.mjs`

Known good check:

```sh
node scripts/check-architecture.mjs
```

## Phase 1: Validation before wiring

Purpose: prove the extracted systems match the current game before replacing live behavior.

### Commit series 1.1: scoring validation cases

Add:

- `scripts/validate-scoring-cases.mjs`

Cover:

- raw card points
- Sequence of 3
- Sequence of 4
- Sequence of 5
- Path of the Magi
- Three of a Kind
- Four of a Kind
- Full Court
- Royal Court
- Balanced Reading
- Elemental Harmony

Acceptance:

```sh
node scripts/check-architecture.mjs
node scripts/validate-scoring-cases.mjs
```

Both pass.

### Commit series 1.2: modifier validation cases

Extend `scripts/validate-scoring-cases.mjs` or add:

- `scripts/validate-modifier-cases.mjs`

Cover upgrades:

- `rank`
- `rank_mult`
- `sequence`
- `seq_mult`
- `court_chips`
- `court_mult`
- `path_chips`
- `path_mult`
- `minor_chips`
- `major_chips`
- `flat_mult`
- suit chip/mult upgrades

Cover relics currently represented in `src/systems/scoring.mjs`:

- `gilded_fool`
- `hermit_lantern`
- `mirror_shard`
- `still_pool`
- `loaded_die`

Acceptance:

```sh
node scripts/check-architecture.mjs
node scripts/validate-scoring-cases.mjs
node scripts/validate-modifier-cases.mjs
```

All pass.

### Commit series 1.3: old/new scoring bridge

Add a dev-only bridge in `index.html` or a sidecar script that can compare:

```js
oldComputeScore(cards)
newComputeScore(cards)
```

Do not replace live scoring yet.

Acceptance:

- Open the current game.
- Build several real spreads.
- Console reports either matching score objects or useful mismatch diagnostics.
- No player-facing UI change.

## Phase 2: Extract remaining data catalogs

Purpose: make the game data-driven before live behavior is migrated.

### Commit series 2.1: relic catalog

Add:

- `src/data/relics.mjs`
- `src/systems/relics.mjs`

Move relic definitions out of inline code:

- id
- name
- description
- cost/tier if applicable
- event hook or scoring hook
- usage flags
- display icon/art key

Acceptance:

- New relic data can reproduce current scoring relic behavior.
- Smoke checks cover all scoring relics.
- No live UI behavior changes yet.

### Commit series 2.2: shop catalog

Add:

- `src/data/shopItems.mjs`
- `src/systems/shop.mjs`

Move shop definitions out of inline code:

- id
- label
- description
- cost
- max level
- upgrade key
- effect summary
- whether it is a pack/relic/upgrade/special

Acceptance:

- Shop offer generation can be tested without DOM.
- Buying an item can be represented as a pure state transition.

### Commit series 2.3: tutorial/archive/attic catalogs

Add:

- `src/data/tutorialSteps.mjs`
- `src/data/archiveFragments.mjs`
- `src/data/atticObjects.mjs`

Do not rework attic UI yet.

Acceptance:

- Static content exists outside `index.html`.
- The data shape clearly separates object state from object rendering.

## Phase 3: Introduce live store bridge

Purpose: let the existing UI talk to the new reducer without replacing the whole UI.

### Commit series 3.1: browser module bootstrap

Add:

- `src/app/bootstrap.mjs`

This should create a store and expose a temporary bridge only for migration:

```js
window.tlrStore = store;
window.tlrActions = ACTIONS;
window.tlrSelectors = selectors;
```

This is temporary. It replaces uncontrolled `window.tlr*` hooks with one known bridge.

Acceptance:

- Browser loads the module without errors.
- `window.tlrStore.getState()` works in console.
- Existing gameplay still works.

### Commit series 3.2: mirror current state into new store

When a reading starts, copy the existing live state into the new store shape.

Do not let the new store control gameplay yet.

Acceptance:

- Console snapshot matches visible game state:
  - hand count
  - spread count
  - discard count
  - threshold
  - reserve
  - selected card

## Phase 4: Route table interactions one at a time

Purpose: replace direct mutation with reducer-backed actions, in the safest order.

### Commit series 4.1: selection

Replace direct selected-card mutation with:

```js
dispatch({ type: ACTIONS.SELECT_CARD, cardId })
```

Acceptance:

- Tap/click selection works.
- Deselect works.
- Score preview still works.
- Ability selection is not changed in this step.

### Commit series 4.2: place card

Replace place-card mutation with reducer-backed placement.

Acceptance:

- Card moves from hand to chosen spread slot.
- Ghost points still show.
- New meld ghost still shows.
- Hand layout still behaves on desktop/mobile.
- No random slot selection regression.

### Commit series 4.3: discard selected

Replace discard mutation with reducer-backed discard.

Acceptance:

- Discard count decrements correctly.
- Replacement draw is correct.
- Free discard relic behavior still works or is explicitly deferred to relic migration.
- Ability activation after discard still works.

### Commit series 4.4: score reading

Replace score resolution with reducer-backed score result.

Acceptance:

- Threshold pass/fail is correct.
- Score carry behavior is correct.
- Market opens only after threshold clear.
- Session end still works.

## Phase 5: Route ability flow

Purpose: move the most fragile rule/UI area into pure ability systems.

### Commit series 5.1: ability target highlighting

Use `src/systems/abilities.mjs` for valid targets.

Acceptance:

- Mirror target highlighting matches expected opposite cards.
- Between target highlighting works for valid pairs.
- Kin targets only allow matching Arcana.
- Neighbor targets are correct.

### Commit series 5.2: ability reveal generation

Use pure reveal helpers for:

- Peek
- Search
- Neighbor
- Kin
- Mirror
- Between

Acceptance:

- Draw 2 does not draw 4.
- Between discard activates correctly.
- Mirror immediately takes the reflected card when available.
- Ability modal glow uses the same hint system as the hand.

### Commit series 5.3: ability resolution through reducer

Route ability confirmation through reducer actions.

Acceptance:

- Deck/hand/discard state remains consistent.
- Taken-by-ability flags still work for scoring upgrades.
- Cancel/back behavior is preserved.

## Phase 6: Market, relics, and session economy

Purpose: move shop and relic behavior into modules after table flow is stable.

### Commit series 6.1: shop offers from `shopSystem`

Acceptance:

- Offer count is correct.
- Costs are correct.
- Merchant's Scale discount is correct.
- Existing visual market can render from the generated offers.

### Commit series 6.2: buy item through reducer

Acceptance:

- Reserve cost is deducted once.
- Upgrade levels apply correctly.
- Relics occupy correct slots.
- Rerender matches purchased state.

### Commit series 6.3: relic events

Implement relic event hooks in `src/systems/relics.mjs`.

Events to support:

- reading start
- card placed
- discard used
- scoring
- market generation
- market purchase
- session end

Acceptance:

- Existing relic behaviors are reproduced.
- Scoring relics remain covered by tests.
- One-use relic state is persisted correctly.

## Phase 7: Attic/archive separation

Purpose: stop the attic from patching table behavior.

### Commit series 7.1: attic state model

Add:

- `src/systems/attic.mjs`
- selectors for discovered objects/fragments

Acceptance:

- Attic object discovered state is represented outside DOM.
- Archives are derived from save state.

### Commit series 7.2: archive rendering from data

Existing archive UI should render from `archiveFragments.mjs` instead of inline content.

Acceptance:

- Existing fragments still appear.
- Unlock rules still work.
- No duplicate fragments.

### Commit series 7.3: obal/economy bridge

Route obal updates through save state.

Acceptance:

- Obals persist.
- Free attic actions remain free if intended.
- Leaving attic returns to the correct table state.

## Phase 8: UI module split

Purpose: only after behavior is reducer-backed, split rendering.

### Commit series 8.1: render modules

Add:

- `src/ui/renderTable.mjs`
- `src/ui/renderHand.mjs`
- `src/ui/renderSpread.mjs`
- `src/ui/renderMarket.mjs`
- `src/ui/renderAbility.mjs`
- `src/ui/renderAttic.mjs`

Acceptance:

- Rendering still uses existing DOM structure.
- Behavior remains identical.

### Commit series 8.2: component helpers

Add reusable render helpers:

- card HTML
- card art/photo application
- hint application
- ghost text
- drawer rendering

Acceptance:

- Duplicate rendering logic decreases.
- Card display stays visually stable.

## Phase 9: CSS extraction

Purpose: reduce `index.html` size without changing layout.

Extract in this order:

1. `src/styles/base.css`
2. `src/styles/cards.css`
3. `src/styles/hand.css`
4. `src/styles/spread.css`
5. `src/styles/drawers.css`
6. `src/styles/market.css`
7. `src/styles/attic.css`
8. `src/styles/mobile.css`

Acceptance:

- Visual diff is minimal.
- Mobile layout is checked after each file extraction.
- No gameplay code changes in CSS commits.

## Phase 10: Remove patch scripts

Purpose: final cleanup after behavior lives in real source files.

Remove patch scripts in groups, never all at once:

1. scoring patches
2. hint patches
3. hand rendering patches
4. spread rendering patches
5. market patches
6. attic patches
7. mobile/layout patches

Acceptance for each group:

- Delete the patch file(s).
- Remove from `package.json` script chain.
- Run smoke checks.
- Run game manually.
- Confirm the behavior still exists in source modules.

## Working commit rhythm

Each commit series should follow this structure:

1. Add or extract module.
2. Add or update smoke checks.
3. Run checks.
4. Wire one narrow behavior, if applicable.
5. Manually verify gameplay.
6. Commit with a narrow message.

## Immediate next actions

Start here:

```sh
node scripts/check-architecture.mjs
```

Then add:

```txt
scripts/validate-scoring-cases.mjs
scripts/validate-modifier-cases.mjs
```

Do not begin live UI wiring until scoring, modifiers, hints, and ability targeting have validation coverage.
