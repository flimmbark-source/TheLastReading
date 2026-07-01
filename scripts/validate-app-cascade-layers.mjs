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
  /@layer spv2\.tokens, spv2\.base, spv2\.components, spv2\.mobile, spv2\.states, spv2\.compat, constellations, dragStability, legacy, handDragFix, screens\.main-menu, screens\.loadout, screens\.matchmaking;/,
  'game.html should pre-declare the app-wide cascade layer order (spv2.* tiers, constellations, dragStability, legacy, handDragFix, then standalone screens) before any stylesheet link',
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
  '../src/styles/base.css',
  '../src/styles/spread.css',
  '../src/styles/hand.css',
  '../src/styles/cards.css',
  '../src/styles/market.css',
  '../src/styles/mobile.css',
  '../src/styles/attic.css',
  '../src/styles/drawers.css',
  '../src/styles/performance.css',
  '../src/styles/mpGame.css',
  '../src/styles/mpMobile.css',
  '../src/styles/mpSpreadCards.css',
  '../src/styles/mpFixes.css',
  '../src/styles/mpMultMobile.css',
  '../src/styles/assetLazy.css',
  '../src/styles/ps1aesthetic.css',
  '../src/styles/mpSinglePlayerIsolation.css',
  '../src/styles/actionDropTargets.css',
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

// handDragFix.css: its .handDock z-index needs to keep losing to
// actionDropTargets.css/mpGame.css's higher, state-gated z-index overrides
// in legacy. Its other declarations either have no competing declaration
// anywhere, or are already dominated unconditionally by an existing
// spv2.components !important rule -- checked individually. Declared AFTER
// `legacy` on purpose (opposite direction from dragStability); the
// assertion above already locks that relative order in.
const handDragFix = read('../src/styles/handDragFix.css');
assert.match(handDragFix, /^@layer handDragFix \{/, 'handDragFix.css should live in its own handDragFix layer');
assert.match(handDragFix.trimEnd(), /\}$/, 'handDragFix.css should close its layer wrapper');

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
