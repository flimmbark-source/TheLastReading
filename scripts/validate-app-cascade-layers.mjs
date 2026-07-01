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
  /@layer spv2\.tokens, spv2\.base, spv2\.components, spv2\.mobile, spv2\.states, spv2\.compat, legacy;/,
  'game.html should pre-declare the app-wide cascade layer order (spv2.* tiers, then legacy) before any stylesheet link',
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
  '../src/styles/constellations.css',
  '../src/styles/mobile.css',
  '../src/styles/dragStability.css',
  '../src/styles/handDragFix.css',
  '../src/styles/attic.css',
  '../src/styles/drawers.css',
  '../src/styles/performance.css',
  '../src/styles/mainMenu.css',
  '../src/styles/loadout.css',
  '../src/styles/matchmaking.css',
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

console.log('App-wide cascade layer checks passed.');
