import assert from 'node:assert/strict';
import fs from 'node:fs';

const director = fs.readFileSync(new URL('../src/app/presentationDirector.mjs', import.meta.url), 'utf8');
const bridge = fs.readFileSync(new URL('../src/ui/handSelectionVisuals.mjs', import.meta.url), 'utf8');
const utilityCss = fs.readFileSync(new URL('../src/styles/singlePlayerV2/components/utilityButtons.css', import.meta.url), 'utf8');
const presentationCss = fs.readFileSync(new URL('../src/styles/singlePlayerV2/components/presentation.css', import.meta.url), 'utf8');

for (const state of [
  'idle',
  'card-selected',
  'card-dragging',
  'card-placing',
  'pattern-resolving',
  'threshold-near',
  'threshold-clearing',
  'adventure-outcome',
  'adventure-reward',
  'adventure-recovery',
  'run-ending',
]) {
  assert.match(director, new RegExp(`['\"]${state}['\"]`), `Missing presentation state: ${state}`);
}

assert.match(director, /export function installPresentationDirector/);
assert.match(director, /setState: applyPrimary/);
assert.match(director, /setFlag/);
assert.match(director, /cue/);
assert.match(director, /prefers-reduced-motion/);
assert.match(director, /MutationObserver/);
assert.match(director, /threshold-near/);
assert.match(director, /adventure-reward/);
assert.doesNotMatch(director, /computeScore|rewardShow\s*=|dispatch\(\{type:.*PLACE_CARD/,
  'Presentation director must not own gameplay mechanics');

assert.match(bridge, /import \{ installPresentationDirector \}/);
assert.match(bridge, /presentation\?\.setFlag\('card-selected',hasSelection\)/);
assert.match(utilityCss, /^@import url\('\.\/presentation\.css'\);/);
assert.match(presentationCss, /presentation-flag-card-selected/);
assert.match(presentationCss, /presentation-flag-card-dragging/);
assert.match(presentationCss, /presentation-flag-threshold-near/);
assert.match(presentationCss, /@media \(prefers-reduced-motion: reduce\)/);

console.log('Presentation director validation passed.');
