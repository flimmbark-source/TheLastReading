import assert from 'node:assert/strict';
import fs from 'node:fs';

const director = fs.readFileSync(new URL('../src/app/presentationDirector.mjs', import.meta.url), 'utf8');
const bridge = fs.readFileSync(new URL('../src/ui/handSelectionVisuals.mjs', import.meta.url), 'utf8');
const adventureA11y = fs.readFileSync(new URL('../src/ui/adventurePresentationA11y.mjs', import.meta.url), 'utf8');
const utilityCss = fs.readFileSync(new URL('../src/styles/singlePlayerV2/components/utilityButtons.css', import.meta.url), 'utf8');
const presentationCss = fs.readFileSync(new URL('../src/styles/singlePlayerV2/components/presentation.css', import.meta.url), 'utf8');
const adventureCueCss = fs.readFileSync(new URL('../src/styles/singlePlayerV2/components/adventurePresentationCues.css', import.meta.url), 'utf8');
const abilityCss = fs.readFileSync(new URL('../src/styles/singlePlayerV2/components/abilityPresentation.css', import.meta.url), 'utf8');

for (const state of [
  'idle',
  'card-selected',
  'card-dragging',
  'card-placing',
  'pattern-resolving',
  'threshold-near',
  'threshold-clearing',
  'ability-reveal',
  'adventure-outcome',
  'adventure-reward',
  'adventure-recovery',
  'run-ending',
]) {
  assert.match(director, new RegExp(`['"]${state}['"]`), `Missing presentation state: ${state}`);
}

assert.match(director, /export function installPresentationDirector/);
assert.match(director, /setState: applyPrimary/);
assert.match(director, /setFlag/);
assert.match(director, /cue/);
assert.match(director, /prefers-reduced-motion/);
assert.match(director, /MutationObserver/);
assert.match(director, /cue\('pattern'/);
assert.match(director, /cue\('threshold-clear'/);
assert.match(director, /cue\('ability-reveal'/);
assert.match(director, /cue\('adventure-reward'/);
assert.match(director, /import\('\.\.\/ui\/adventurePresentationA11y\.mjs'\)/);
assert.doesNotMatch(director, /computeScore|rewardShow\s*=|dispatch\(\{type:.*PLACE_CARD/,
  'Presentation director must not own gameplay mechanics');

assert.match(bridge, /import \{ installPresentationDirector \}/);
assert.match(bridge, /presentation\?\.setFlag\('card-selected',hasSelection\)/);
assert.match(utilityCss, /^@import url\('\.\/presentation\.css'\);/);
assert.match(utilityCss, /@import url\('\.\/adventurePresentationCues\.css'\);/);
assert.match(utilityCss, /@import url\('\.\/abilityPresentation\.css'\);/);
assert.match(presentationCss, /presentation-flag-card-selected/);
// Pointer-driven states must stay cheap: selecting or dragging a card must not
// start a full-screen #roomAmbient filter transition or dim the rest of the
// hand — those repaints landed one frame into the card's own lift/drag motion
// and read as stutter on phones (see presentation.css).
assert.doesNotMatch(presentationCss, /presentation-flag-card-selected[^{]*#roomAmbient/,
  'Card selection must not restyle the room ambient layer');
assert.doesNotMatch(presentationCss, /presentation-flag-card-dragging[^{]*#roomAmbient/,
  'Card dragging must not restyle the room ambient layer');
assert.match(presentationCss, /presentation-flag-threshold-near/);
assert.match(presentationCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(adventureCueCss, /presentation-cue-adventure-outcome/);
assert.match(adventureCueCss, /presentation-cue-adventure-reward/);
assert.match(abilityCss, /presentation-flag-ability-reveal/);
assert.match(abilityCss, /presentation-cue-ability-reveal/);

assert.match(adventureA11y, /role', 'dialog/);
assert.match(adventureA11y, /aria-pressed/);
assert.match(adventureA11y, /ArrowRight/);
assert.match(adventureA11y, /card\.click\(\)/);
assert.doesNotMatch(adventureA11y, /rewardShow\s*=|rewardChoose\s*=|session\.run/,
  'Adventure accessibility bridge must not own reward mechanics');

console.log('Presentation director validation passed.');