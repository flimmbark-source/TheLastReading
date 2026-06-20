# Phase 1 Execution Checklist

## Preparation complete

- [x] Layout blueprint written
- [x] Responsive viewport targets defined
- [x] Component ownership defined
- [x] Asset/live-content boundary defined
- [x] Z-index contract defined
- [x] Shared layout tokens created
- [x] Standalone portrait wireframe created

## Implementation sequence

### 1. Review wireframe geometry

Open:

`prototypes/single-player-phase1/index.html`

Validate at:

- 360 × 740
- 375 × 812
- 390 × 844
- 412 × 915
- 430 × 932

Decisions to lock:

- [ ] HUD overall height
- [ ] HUD segment proportions
- [ ] Title height
- [ ] Five-slot spread width
- [ ] Five-slot arc depth
- [ ] Vertical distance between HUD and spread
- [ ] Default hand height
- [ ] Bottom action positions

### 2. Map current production DOM

Existing live values:

- [ ] `#pool` → Reserve
- [ ] `#current` → Score
- [ ] `#threshold` → Threshold
- [ ] `#discards` → Discards

Existing live play surfaces:

- [ ] `#spread`
- [ ] `#hand`
- [ ] `.handDock`
- [ ] `.spread-wrap`
- [ ] `.score-stack`

For each surface, decide:

- [ ] retain existing element
- [ ] wrap existing element
- [ ] replace presentation only
- [ ] move in DOM without changing state ownership

### 3. Build behind a feature class

Use a root class such as:

`body.single-player-v2`

Rules:

- [ ] Current production layout remains available during development.
- [ ] New CSS is scoped under the feature class.
- [ ] No scoring, deck, ability, or shop logic is forked.
- [ ] Existing IDs continue to receive updates from current game logic.

### 4. Build placeholder production layout

- [ ] Add new shell/grid containers
- [ ] Recompose the four HUD values
- [ ] Add live threshold progress
- [ ] Convert spread to five-slot horizontal arc
- [ ] Position utility controls
- [ ] Position bottom action rail
- [ ] Reuse current hand renderer
- [ ] Validate hand-over-HUD z-index

### 5. State validation

- [ ] Empty spread
- [ ] Partial spread
- [ ] Full spread
- [ ] Ability target selection
- [ ] Discard selection
- [ ] Purge selection
- [ ] Threshold cleared
- [ ] Shop transition
- [ ] Tutorial overlay
- [ ] Reference drawers
- [ ] Hand lifted over HUD

### 6. Responsive validation

- [ ] No horizontal page scroll
- [ ] Five slots remain visible
- [ ] Values do not truncate
- [ ] Utility buttons remain reachable
- [ ] Hand cards remain selectable
- [ ] Bottom controls respect safe area
- [ ] Compact viewport does not overlap HUD and spread

### 7. Phase 1 sign-off

Phase 1 is approved when:

- [ ] Layout geometry is accepted at all validation sizes
- [ ] Existing single-player game loop remains functional
- [ ] No final art is required to understand the screen
- [ ] Asset dimensions can be frozen for Phase 2
- [ ] Card-sheet framing requirements can be specified confidently

## Files produced

- `docs/single-player-redesign/PHASE_1_LAYOUT_BLUEPRINT.md`
- `docs/single-player-redesign/PHASE_1_COMPONENT_AND_ASSET_CONTRACT.md`
- `docs/single-player-redesign/phase1-layout-tokens.json`
- `docs/single-player-redesign/PHASE_1_EXECUTION_CHECKLIST.md`
- `prototypes/single-player-phase1/index.html`
