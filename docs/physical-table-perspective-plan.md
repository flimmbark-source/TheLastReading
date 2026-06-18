# Physical table perspective implementation plan

## Goal

Give the singleplayer tarot table a convincing physical tabletop presentation while preserving the current game rules, DOM interactions, mobile behavior, accessibility, and performance.

This is not a full 3D conversion. The intended result is a 2.5D presentation built from:

- a perspective table stage behind the current interface
- restrained card transforms rather than a steeply rotated gameplay plane
- stronger contact shadows, card thickness, and landing motion
- separate desktop and portrait compositions
- readable HTML HUD elements styled as physical objects

The work is split into eight passes. Each pass should leave the game playable and should avoid mixing visual refactors with gameplay refactors.

## Non-negotiable constraints

1. Do not alter scoring, deck, ability, shop, relic, or save behavior.
2. Keep current tap/click placement and selection logic working throughout.
3. Do not introduce a real 3D engine.
4. Do not rotate the entire interactive interface onto one steep CSS plane.
5. Keep score, threshold, reserve, discards, prompts, and references readable HTML.
6. Preserve multiplayer appearance unless a pass explicitly scopes a shared card-style improvement.
7. Check portrait mobile after every layout pass.
8. Add new presentation rules in isolated files before replacing existing rules.
9. Keep reduced-motion behavior available for all new animation.
10. Every pass should be independently reviewable and reversible.

---

# Pass 1: Structural scene scaffold

## Purpose

Create the layers needed for a physical table without changing the current spread, hand, or card appearance.

## Files

Add:

- `src/styles/tableScene.css`

Modify:

- `index.html`

## Changes

- Add a non-interactive `#tableStage` behind the singleplayer spread and hand.
- Add child layers for:
  - room/table backdrop
  - table plane
  - central light pool
  - foreground darkness or table edge
- Add the new stylesheet after `base.css` and before `spread.css`.
- Ensure the new scene is hidden while main menu, loadout, matchmaking, multiplayer, modal-only screens, and attic states require it hidden.
- Keep all current interactive elements in their existing coordinate system.

## Acceptance

- Singleplayer remains fully playable.
- No card, slot, HUD, drawer, or prompt positions change yet.
- Table stage never intercepts pointer events.
- Main menu, multiplayer, loadout, matchmaking, and attic remain visually correct.
- No new horizontal scrolling appears.

## Estimated effort

One implementation pass.

---

# Pass 2: Desktop table composition

## Purpose

Recompose the desktop singleplayer screen so the spread reads as sitting farther back on a table and the hand reads as being near the player.

## Files

Modify:

- `src/styles/tableScene.css`
- `src/styles/spread.css`
- `src/styles/hand.css`
- possibly `src/styles/base.css` only for shared scene variables

## Changes

- Add CSS custom properties for:
  - table horizon
  - spread vertical position
  - hand depth
  - table angle
  - light center
- Position `.spread-wrap` within the central light pool.
- Give spread slots restrained depth variation using scale and vertical offset.
- Add subtle inward rotation to outer spread slots.
- Replace the hand dock's generic bottom gradient with a foreground table-edge treatment.
- Keep card faces close to front-facing for readability.
- Avoid changing card dimensions in this pass unless the new composition requires a small global adjustment.

## Acceptance

- Five spread positions fit without clipping at common desktop sizes.
- Existing score preview, discard, purge, and ability-target visuals stay aligned.
- Hovering and selecting hand cards still behaves correctly.
- No transformed parent breaks fixed overlays or modal positioning.
- Text remains legible at 1366x768 and larger.

## Estimated effort

One implementation pass plus one desktop correction pass if the current card spacing conflicts with the new table horizon.

---

# Pass 3: Card physicality

## Purpose

Make cards feel like physical objects contacting, lifting from, and landing on the table.

## Files

Modify:

- `src/styles/cards.css`
- `src/styles/hand.css`
- `src/styles/spread.css`
- card rendering helper only if a dedicated shadow/edge child element is necessary

## Changes

- Audit existing `::before` and `::after` use before assigning pseudo-elements.
- Add or improve:
  - short spread-card contact shadows
  - visible lower paper edge or thickness
  - softer elevated shadow for selected hand cards
  - subtle per-slot rotation irregularity
  - consistent z-index behavior during hover and ability selection
- Ensure hint glow, ability target glow, selected glow, and physical shadow can coexist.
- Keep card art and card content unchanged during this pass.

## Acceptance

- Cards look seated on the table rather than floating as flat UI panels.
- Hint and ability outlines remain clear.
- No shadow is clipped by card overflow rules.
- Selected hand card still rises above all neighboring cards.
- Performance remains smooth with a full hand and spread.

## Estimated effort

One implementation pass, likely followed by a small compatibility pass because current hint shadows are complex.

---

# Pass 4: Placement, deal, and scoring motion

## Purpose

Add the minimum set of animations that sell physical movement.

## Files

Modify as needed:

- `src/styles/cards.css`
- `src/styles/hand.css`
- `src/styles/spread.css`
- active hand/spread render modules or legacy render hooks
- `src/styles/performance.css`

## Changes

Add temporary visual state classes for:

- newly dealt card
- newly placed card
- removed/discarded card
- score resolution pulse or recoil

Animations should include:

- deal into hand
- selected card lift
- placement drop with a slight rebound
- discard exit toward the existing discard action area
- subtle score object response

Do not change the actual placement or discard state transitions. The renderer should only attach and remove visual classes around existing state changes.

Add reduced-motion alternatives:

- fade or brief highlight instead of travel/recoil

## Acceptance

- Placement cannot be double-triggered by animation.
- Ability-driven card movement does not use the wrong animation.
- Animations clean up their temporary classes.
- Reduced-motion mode removes major travel and recoil.
- Mobile animations remain smooth.

## Estimated effort

Two passes:

1. placement and deal
2. discard and score response, with edge-case cleanup

---

# Pass 5: Portrait mobile composition

## Purpose

Create a dedicated portrait layout rather than shrinking the desktop scene.

## Files

Modify:

- `src/styles/mobile.css`
- `src/styles/tableScene.css`
- possibly `src/styles/dragStability.css`

## Changes

- Widen the visual table beyond the viewport so its side edges disappear offscreen.
- Reduce apparent table angle compared with desktop.
- Reposition the score stack, references, spread, hand, prompts, and relic rack around actual mobile space constraints.
- Keep spread cards readable and avoid placing five full-size cards in one unusably compressed row.
- Decide based on live testing whether mobile spread should use:
  - one compact row
  - a shallow arc
  - a controlled overlap
- Preserve hand swipe, pinch, and drift behavior.
- Ensure selected hand cards do not collide with spread actions or prompts.

## Acceptance

Test at minimum:

- 390x844
- 412x915
- 360x800

Verify:

- no page scrolling
- all five spread slots remain reachable
- all hand cards remain selectable
- score and threshold remain readable
- scoring and abilities drawers remain usable
- ability and purge prompts do not cover required targets
- safe-area inset works on devices with home indicators

## Estimated effort

Two passes:

1. portrait composition
2. interaction and small-screen correction

---

# Pass 6: HUD and environmental integration

## Purpose

Make the existing information architecture belong to the physical scene without sacrificing clarity.

## Files

Modify:

- `src/styles/base.css`
- `src/styles/drawers.css`
- `src/styles/tableScene.css`
- potentially `index.html` for non-semantic wrapper additions only

## Changes

- Restyle `.score-stack` as a physical framed object near the rear of the table.
- Keep live values as HTML text.
- Integrate Reserve and Discards visually without replacing exact numbers with ambiguous props.
- Restyle Scoring, Abilities, Menu, and Archives pull tabs as paper, wood, or brass objects.
- Integrate discard and purge controls into the tabletop composition while keeping clear labels and hit areas.
- Keep the HUD outside the table's main perspective transform.

## Acceptance

- Every important number is immediately readable.
- Buttons still communicate enabled and disabled state.
- Keyboard focus states remain visible.
- Drawers continue to open above the table scene.
- The table looks cohesive without making controls harder to identify.

## Estimated effort

One implementation pass plus one readability correction pass.

---

# Pass 7: Art, lighting, and ambient depth

## Purpose

Replace prototype gradients and generic textures with the final visual treatment after the composition is proven.

## Files

Add assets under a dedicated directory, for example:

- `assets/table/`
- `assets/room/`
- `assets/fx/`

Modify:

- `src/styles/tableScene.css`
- `src/styles/performance.css`

## Changes

- Add final table artwork or tileable table material.
- Add dark room/attic framing.
- Add a restrained animated light overlay.
- Add dust, smoke, candle shimmer, or shadow motion only where performance allows.
- Use responsive image formats and sizes.
- Add low-motion and low-power fallbacks.
- Avoid baking score values, labels, slots, or required gameplay information into background images.

## Acceptance

- The scene works even if decorative assets fail to load.
- No large cumulative layout shift occurs during asset loading.
- Mobile does not download unnecessarily oversized desktop assets where avoidable.
- Ambient effects do not obscure cards or controls.
- Frame rate remains stable on a midrange phone.

## Estimated effort

Two or more passes depending on whether final art already exists:

1. asset integration
2. lighting and responsive crop correction
3. optional ambient polish

---

# Pass 8: Regression, performance, and cleanup

## Purpose

Stabilize the full presentation and document remaining limitations.

## Files

Modify as needed across the files touched above.

Add or update:

- validation notes
- manual visual test checklist
- performance fallbacks

## Regression areas

Singleplayer:

- new game and continue
- card selection and deselection
- placement into every spread slot
- score preview
- discard and purge
- all ability target flows
- scoring
- threshold clear and failure
- market transition
- relic rack
- drawers
- modal choices
- tutorial overlays
- attic entry and return

Other screens:

- main menu
- loadout
- matchmaking
- multiplayer duel

Responsive:

- portrait phones
- landscape phones
- tablets
- standard desktop
- short desktop viewport

Accessibility and preferences:

- keyboard focus
- reduced motion
- high zoom
- touch targets

## Acceptance

- No known gameplay regression caused by the visual conversion.
- No screen depends on decorative assets to function.
- No major layout jump occurs when cards animate.
- New CSS is documented and does not rely on unexplained high-specificity overrides.
- Temporary prototype rules are removed or clearly marked.

## Estimated effort

One full regression pass and one correction pass.

---

# Total pass estimate

## Minimum functional implementation

Eight implementation passes:

1. scene scaffold
2. desktop composition
3. card physicality
4. placement/deal animation
5. discard/scoring animation
6. first portrait composition
7. mobile correction
8. HUD integration

This produces a convincing physical-table version using provisional textures and lighting.

## Production-ready implementation

Approximately twelve to fourteen passes:

1. structural scene scaffold
2. desktop composition
3. desktop correction
4. spread-card physicality
5. hand-card physicality and hint compatibility
6. placement and deal animation
7. discard and scoring animation
8. portrait composition
9. portrait interaction correction
10. HUD and drawer integration
11. readability correction
12. final art integration
13. lighting/performance correction
14. full regression and cleanup

The exact count depends mostly on final art availability and how many current visual systems rely on competing transforms or box shadows.

---

# Recommended commit sequence

Each pass should be committed separately using a narrow scope:

1. `feat(ui): add non-interactive table scene scaffold`
2. `style(ui): compose desktop spread and hand on table`
3. `style(cards): add tabletop depth and contact shadows`
4. `feat(animation): add deal and placement motion`
5. `feat(animation): add discard and score response`
6. `style(mobile): add portrait table composition`
7. `fix(mobile): stabilize table interactions and prompts`
8. `style(ui): integrate score and drawer surfaces`
9. `feat(art): add final table and room assets`
10. `perf(ui): add ambient and reduced-motion fallbacks`
11. `fix(ui): complete physical-table regression cleanup`

---

# First implementation milestone

The first milestone should stop after Pass 3.

It should demonstrate:

- a receding table surface
- spread cards visually resting on that table
- a foreground hand with stronger depth
- unchanged gameplay behavior
- no final art requirement

This milestone is the correct point to decide whether the physical composition is strong enough before investing in animation and final environmental assets.
