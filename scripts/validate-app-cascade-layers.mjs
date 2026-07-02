import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

// game.html must pre-declare the whole app's layer order before any
// stylesheet loads, so that every file's later `@layer legacy { ... }` (or
// SPv2's own spv2.* layers) resolves to the same fixed position regardless
// of load order. Losing this statement -- or reordering it -- would change
// which declarations win across the whole app, not just cosmetically.
const html = read('../game.html');
assert.match(
  html,
  /@layer spv2\.tokens, spv2\.base, spv2\.components, spv2\.mobile, spv2\.states, spv2\.compat, constellations, dragStability, actionDropTargets, spread, base, cards, assetLazy, legacy, handDragFix, performance, drawers, screens\.main-menu, screens\.loadout, screens\.matchmaking;/,
  'game.html should pre-declare the app-wide cascade layer order (spv2.* tiers, constellations, dragStability, actionDropTargets, spread, base, cards, assetLazy, legacy, handDragFix, performance, drawers, then standalone screens) before any stylesheet link',
);
assert.ok(
  html.indexOf('@layer spv2.tokens') < html.indexOf('<link rel="stylesheet"'),
  'the layer order pre-declaration must appear before the first stylesheet link',
);

// Files outside the SPv2 cascade that carry cross-file !important
// dependencies on each other must all share the `legacy` layer -- splitting
// any of them into their own layer would flip which !important wins because
// cascade-layer importance reverses layer order (see validate-app-important-
// budget.mjs and the SPv2 cascade validator for the matching SPv2-side story).
const legacyLayeredFiles = [
  '../src/styles/hand.css',
  '../src/styles/market.css',
  '../src/styles/mobile.css',
  '../src/styles/attic.css',
  '../src/styles/mpGame.css',
  '../src/styles/mpMobile.css',
  '../src/styles/mpSpreadCards.css',
  '../src/styles/mpFixes.css',
  '../src/styles/mpMultMobile.css',
  '../src/styles/ps1aesthetic.css',
  '../src/styles/mpSinglePlayerIsolation.css',
  '../src/styles/drawAnimation.css',
  '../src/styles/singlePlayerV2/base.css',
  '../src/styles/singlePlayerV2/compat.css',
  '../src/styles/singlePlayerV2/desktop.css',
  '../src/styles/singlePlayerV2/assets.css',
  '../src/styles/singlePlayerV2/layout.css',
  '../src/styles/singlePlayerV2/mobile.css',
  '../src/styles/singlePlayerV2/components/spread.css',
  '../src/styles/singlePlayerV2/components/scoreHud.css',
  '../src/styles/singlePlayerV2/states.css',
  '../src/styles/singlePlayerV2/components/artIntegration.css',
];

for (const path of legacyLayeredFiles) {
  const text = read(path);
  assert.match(text, /^@layer legacy \{/, `${path} should be wrapped in the app-wide legacy cascade layer`);
  assert.match(text.trimEnd(), /\}$/, `${path} should close its legacy layer wrapper`);
}

// constellations.css: self-namespaced (.constellation-*) but NOT independent
// -- its #constellationPill/.constellation-pill element is also targeted by
// mainMenu.css's boot veil and by SPv2's base.css/relics.css for z-index and
// position. Declared before `legacy` in the master order on purpose (see
// game.html); the assertion above already locks that relative order in.
const constellations = read('../src/styles/constellations.css');
assert.match(constellations, /^@layer constellations \{/, 'constellations.css should live in its own constellations layer');
assert.match(constellations.trimEnd(), /\}$/, 'constellations.css should close its layer wrapper');

// dragStability.css: its only real interaction is mobile.css's own
// !important transition on the exact same selector -- dragStability always
// needs to win that fight (its whole purpose is disabling the transition
// while a card is actively being dragged). Its other property (will-change)
// is uncontested anywhere. Declared before `legacy` on purpose (see
// game.html); the assertion above already locks that relative order in.
const dragStability = read('../src/styles/dragStability.css');
assert.match(dragStability, /^@layer dragStability \{/, 'dragStability.css should live in its own dragStability layer');
assert.match(dragStability.trimEnd(), /\}$/, 'dragStability.css should close its layer wrapper');


// actionDropTargets.css: dynamically appended by gestureActionDrops.mjs, but
// its real cross-file conflicts are all !important-tier fixes that must keep
// beating the remaining legacy pile (drag lift z-index, contextual overlay
// stacks, SPv2 mobile action-button/drop-target states, and the generated-sheet
// background override). Normal-tier overlap hits were checked as non-conflicts:
// different target properties/pseudo-elements, identical base values, or state
// classes/elements introduced specifically for this behavior. Declared BEFORE
// `legacy` so those !important fixes keep winning even when the link is loaded
// dynamically after the initial stylesheet set.
const actionDropTargets = read('../src/styles/actionDropTargets.css');
assert.match(actionDropTargets, /^@layer actionDropTargets \{/, 'actionDropTargets.css should live in its own actionDropTargets layer');
assert.match(actionDropTargets.trimEnd(), /\}$/, 'actionDropTargets.css should close its layer wrapper');

// spread.css: every real normal-tier interaction found (market.css's mobile
// .ability-prompt/.spread/.slot/.slot .num overrides, mobile.css's
// .ability-target-slot/.ability-picked-slot highlight colors, mpMobile.css's
// mobile .slot .num, and the SPv2 bundle's normal-tier mobile/generated-sheet
// layout overrides) requires spread's declarations to keep losing against
// files still in legacy. Every !important interaction is unconditional
// importance dominance. No interaction requires spread to win against
// anything still in legacy. Declared BEFORE `legacy` on purpose (see
// game.html); the assertion above already locks that relative order in.
const spread = read('../src/styles/spread.css');
assert.match(spread, /^@layer spread \{/, 'spread.css should live in its own spread layer');
assert.match(spread.trimEnd(), /\}$/, 'spread.css should close its layer wrapper');

// base.css: the first file concatenated into legacy, so it already loses
// every normal-tier tie against every other still-in-legacy file by source
// order/specificity today. Its lone !important declaration
// (.score-preview{display:none!important}) has zero competing declarations
// anywhere. Declared BEFORE `legacy` on purpose (see game.html); the
// assertion above already locks that relative order in.
const base = read('../src/styles/base.css');
assert.match(base, /^@layer base \{/, 'base.css should live in its own base layer');
assert.match(base.trimEnd(), /\}$/, 'base.css should close its layer wrapper');

// cards.css: zero !important declarations; every real normal-tier conflict
// (market.css's mobile .title/.sym/.plaque/.seal sizing, market.css's
// .card.photo .title/.art{display:none}, mpMobile.css's mp-mode .seal
// transform) needs cards to keep losing to files still in legacy, and
// nothing anywhere needs to lose to cards. Declared BEFORE `legacy` on
// purpose (see game.html); the assertion above already locks that in.
const cards = read('../src/styles/cards.css');
assert.match(cards, /^@layer cards \{/, 'cards.css should live in its own cards layer');
assert.match(cards.trimEnd(), /\}$/, 'cards.css should close its layer wrapper');

// assetLazy.css: all rules are !important and exist specifically to override
// attic.css's normal-tier background declarations on the same elements
// (#atticScene::before/::after, #atticRoom) -- importance dominance already
// decides every current fight, and declaring it before legacy keeps it
// winning even if a competing !important ever appears in the legacy pile.
const assetLazy = read('../src/styles/assetLazy.css');
assert.match(assetLazy, /^@layer assetLazy \{/, 'assetLazy.css should live in its own assetLazy layer');
assert.match(assetLazy.trimEnd(), /\}$/, 'assetLazy.css should close its layer wrapper');

// handDragFix.css: its .handDock z-index needs to keep losing to
// actionDropTargets.css's higher, state-gated z-index in the earlier
// actionDropTargets layer and to mpGame.css's higher, state-gated z-index
// overrides in legacy. Its other declarations either have no competing declaration
// anywhere, or are already dominated unconditionally by an existing
// spv2.components !important rule -- checked individually. Declared AFTER
// `legacy` on purpose (opposite direction from dragStability); the
// assertion above already locks that relative order in.
const handDragFix = read('../src/styles/handDragFix.css');
assert.match(handDragFix, /^@layer handDragFix \{/, 'handDragFix.css should live in its own handDragFix layer');
assert.match(handDragFix.trimEnd(), /\}$/, 'handDragFix.css should close its layer wrapper');

// performance.css: its mobile/reduced-motion overrides need to keep losing to
// actionDropTargets.css's SPv2-mode background-attachment override in the
// earlier actionDropTargets layer and to ps1aesthetic.css's explicit
// "re-enable candle glow on mobile" override still in legacy. Declared AFTER `legacy` on purpose, same direction as
// handDragFix; the assertion above already locks that relative order in.
const performance_ = read('../src/styles/performance.css');
assert.match(performance_, /^@layer performance \{/, 'performance.css should live in its own performance layer');
assert.match(performance_.trimEnd(), /\}$/, 'performance.css should close its layer wrapper');

// drawers.css: needs to keep LOSING two !important ties (SPv2 desktop.css's
// display:block!important un-hide of #scoringBtn/#abilitiesBtn/#menuBtn, and
// drawAnimation.css's reduced-motion deal-in fade, both still in legacy) while
// needing to keep WINNING two normal-tier ties (handCardIdleCycle vs
// market.css's card-wave, and its #settingsPanel sizing vs mobile.css's base
// rule, both still in legacy). Declared AFTER `legacy` on purpose, same
// direction as handDragFix/performance; the assertion above already locks
// that relative order in.
const drawers = read('../src/styles/drawers.css');
assert.match(drawers, /^@layer drawers \{/, 'drawers.css should live in its own drawers layer');
assert.match(drawers.trimEnd(), /\}$/, 'drawers.css should close its layer wrapper');

// Standalone screens: every selector is scoped to that screen's own classes
// or ids (verified against the actual render/DOM-construction code, not
// inferred), so they don't need to sit in the shared legacy pile. They live
// in their own `screens.*` layer instead.
const loadout = read('../src/styles/loadout.css');
assert.match(loadout, /^@layer screens\.loadout \{/, 'loadout.css should live in its own screens.loadout layer');
assert.match(loadout.trimEnd(), /\}$/, 'loadout.css should close its layer wrapper');

const matchmaking = read('../src/styles/matchmaking.css');
assert.match(matchmaking, /^@layer screens\.matchmaking \{/, 'matchmaking.css should live in its own screens.matchmaking layer');
assert.match(matchmaking.trimEnd(), /\}$/, 'matchmaking.css should close its layer wrapper');

// mainMenu.css is split: the "boot veil" rules reach into gameplay elements
// owned by other legacy files (a real cross-file dependency), so those stay
// in `legacy`. Everything else only ever touches #mainMenu/.main-menu-* and
// moves to its own screens.main-menu layer.
const mainMenu = read('../src/styles/mainMenu.css');
assert.match(mainMenu, /^@layer legacy \{/m, 'mainMenu.css should keep its boot-veil rules in the shared legacy layer');
assert.match(mainMenu, /@layer screens\.main-menu \{/, 'mainMenu.css should move its self-contained #mainMenu rules to screens.main-menu');
const mainMenuLegacyBlock = mainMenu.slice(mainMenu.indexOf('@layer legacy {'), mainMenu.indexOf('@layer screens.main-menu {'));
assert.match(mainMenuLegacyBlock, /#titleWrap/, 'the boot-veil block should still cover the shared gameplay elements it fades');
assert.doesNotMatch(mainMenuLegacyBlock, /#mainMenu\{/, 'the legacy block should not also contain the standalone #mainMenu overlay rules');

console.log('App-wide cascade layer checks passed.');
