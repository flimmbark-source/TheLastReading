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
  '../src/styles/components/relicRack.css',
  '../src/styles/components/handSwipeZone.css',
  '../src/styles/components/tutTip.css',
  '../src/styles/components/invWrap.css',
  '../src/styles/components/invTab.css',
  '../src/styles/components/titleWrap.css',
  '../src/styles/components/atticFade.css',
];

// Budget jumped 693 -> 706 not from new !important declarations but from
// closing a tracking gap: components/relicRack.css (31) and
// components/handSwipeZone.css (17) carried their consolidated declarations
// out of files that were tracked here (market.css, mobile.css, attic.css,
// ps1aesthetic.css, handDragFix.css) into two new files that weren't. The
// actual app-wide count didn't change; the check just stopped being blind
// to it. Every future component-consolidation pilot must add its new file
// here in the same commit, or this check silently stops covering it again.
// components/tutTip.css (706, unchanged) moved its 4 declarations out of
// market.css wholesale -- a net wash, tracked here from the start.
// components/invWrap.css (6) and components/invTab.css (1) split out of
// mobile.css/attic.css, both already tracked -- another net wash, total
// stays 706.
// components/titleWrap.css (711, a REAL +5) is different: it partitions
// #titleWrap/.score-stack's selectors out of a shared comma-selector rule
// in attic.css, but the two rules still each need their own full copy of
// the same opacity/transform/filter/pointer-events/transition values (the
// remaining rule in attic.css keeps its copy; this file gets its own).
// Selectors are partitioned, declaration values are duplicated -- so this
// is a genuine, deliberate increase, not a tracking-gap artifact.
// components/atticFade.css (716, another REAL +5) does the same partition
// for the rule's remaining four elements (.spread-wrap/.handDock/
// #relicRack/.refs-layer), leaving only #invWrap's single-selector line
// behind in attic.css. Same duplication trade, same reasoning.
const importantBudget = 716;
const total = appStyleFiles
  .map(path => read(path).match(/!important/g)?.length ?? 0)
  .reduce((sum, count) => sum + count, 0);
assert.ok(total <= importantBudget, `App-wide (non-SPv2) !important count ${total} exceeds budget ${importantBudget}`);

console.log('App-wide !important budget check passed.');
