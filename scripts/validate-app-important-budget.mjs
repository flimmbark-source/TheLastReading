import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

// The stylesheets game.html loads outside of the Single Player V2 cascade
// (which tracks its own budget in validate-single-player-v2-cascade.mjs).
// This mirrors that guard for the rest of the app so !important reductions
// there can't silently regress either.
const appStyleFiles = [
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
];

const importantBudget = 705;
const total = appStyleFiles
  .map(path => read(path).match(/!important/g)?.length ?? 0)
  .reduce((sum, count) => sum + count, 0);
assert.ok(total <= importantBudget, `App-wide (non-SPv2) !important count ${total} exceeds budget ${importantBudget}`);

console.log('App-wide !important budget check passed.');
