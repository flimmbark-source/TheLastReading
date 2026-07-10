import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(path, import.meta.url), 'utf8');
const director = read('../src/app/presentationDirector.mjs');
const world = read('../src/app/worldSurfaceDirector.mjs');
const deckFx = read('../src/app/adventureDeckActionFx.mjs');
const camera = read('../src/app/tableCameraDirector.mjs');
const worldCss = read('../src/styles/presentation/worldSurfaces.css');
const deckCss = read('../src/styles/presentation/adventureDeckActionFx.css');
const cameraCss = read('../src/styles/presentation/tableCamera.css');
const capture = read('./capture-presentation-states.mjs');

assert.match(director, /import\('\.\/worldSurfaceDirector\.mjs'\)/);
assert.match(director, /import\('\.\/tableCameraDirector\.mjs'\)/);
assert.match(director, /import\('\.\/adventureDeckActionFx\.mjs'\)/);
assert.match(director, /cue\('card-place'/);
assert.match(director, /summaryHeading === 'the reading ends'/);
assert.match(director, /runEnding \? 'run-ending'/);

for (const surface of ['market', 'archives', 'archive-detail', 'score-result', 'run-end']) {
  assert.match(worldCss, new RegExp(`presentation-surface-${surface}`), `Missing world surface CSS: ${surface}`);
}
for (const cue of ['market-open', 'archives-open', 'archive-detail', 'score-result', 'run-end']) {
  assert.match(worldCss, new RegExp(`presentation-cue-${cue}`), `Missing world cue CSS: ${cue}`);
}

assert.match(world, /store-front-shell/);
assert.match(world, /#invWrap\.open/);
assert.match(world, /the reading ends/);
assert.match(world, /threshold cleared/);
assert.match(world, /Reading result/);
assert.match(world, /event\.key !== 'Escape'/);
assert.match(world, /tlr:presentation-cue/);
assert.doesNotMatch(world, /SCORE_READING|ADD_CARD|REMOVE_CARD|rewardChoose|session\.run|persist\./,
  'World surface director must not own gameplay mechanics');

for (const kind of ['echo', 'upgrade', 'seal', 'banish', 'transmute']) {
  assert.match(deckFx, new RegExp(`${kind}:`), `Missing deck action kind: ${kind}`);
  assert.match(deckCss, new RegExp(`data-kind=[\\"]${kind}[\\"]`), `Missing deck action animation: ${kind}`);
}
assert.match(deckFx, /adv-reward-card-selected/);
assert.match(deckFx, /addEventListener\('click', onClick, true\)/);
assert.doesNotMatch(deckFx, /addCardToAdventureDeck|removeCardFromAdventureDeck|cardBonuses|sealedCards|sigilOverrides|rewardState/,
  'Deck action FX must observe reward confirmation without applying rewards');

assert.match(camera, /tlr:presentation-cue/);
assert.doesNotMatch(camera, /name === 'card-place'/,
  'Card placement must not animate fixed layout containers');
assert.match(camera, /name === 'pattern'/);
assert.match(camera, /name === 'threshold-clear'/);
assert.match(cameraCss, /presentation-card-selected/);
assert.match(cameraCss, /presentation-card-dragging/);
assert.match(cameraCss, /#scorePreview\s*\{[\s\S]*position:\s*absolute/,
  'The score preview must overlay the spread instead of changing wrapper height');
assert.match(cameraCss, /presentation-flag-card-selected \.spread-wrap,[\s\S]*presentation-flag-card-dragging \.spread-wrap\s*\{[\s\S]*translate:\s*0 0/,
  'Selection and drag flags must leave spread translation at zero');
assert.doesNotMatch(camera, /dispatch\(|PLACE_CARD|SCORE_READING|session\.run/,
  'Camera director must remain presentation-only');

assert.match(capture, /const outputPath = \(label, state\) =>/);
assert.match(capture, /readSpreadGeometry/);
assert.match(capture, /assertSelectionKeepsSpreadFixed/);
assert.match(capture, /Selecting a card moved the play geometry/);
for (const captureName of ['archives-open', 'archive-detail', 'market', 'score-result', 'run-ending']) {
  assert.match(capture, new RegExp(`outputPath\\(label, ['"]${captureName}['"]\\)`), `Capture harness missing ${captureName}`);
}

console.log('World surface, deck-action, and selection-geometry validation passed.');