import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { GAME_TERM_IDS, GAME_TERMS, applyGameTerms, gameTermMarkup, registerGameTermsLocale } from '../src/ui/gameTerms.mjs';
import { renderAbilitySheet } from '../src/app/referenceControls.mjs';
import { ABILITIES } from '../src/data/abilities.mjs';
import { RELIC_LIST } from '../src/data/relics.mjs';
import { SHOP_ITEMS } from '../src/data/shopItems.mjs';
import { STATUS_LIST } from '../src/data/adventure/statuses.mjs';
import { ADVENTURE_ITEMS } from '../src/data/adventure/adventureContentV3.mjs';
import { INTERACTION_CARD_DEFS } from '../src/multiplayer/interactionCards.mjs';
import { PERSONAS } from '../src/multiplayer/personas.mjs';
import { ARCHIVE_FRAGMENTS, ARCHIVE_ITEMS } from '../src/data/archiveFragments.mjs';

const required = ['chips','mult','score','threshold','reserve','play','draw','discard','reveal','take','banish','echo','upgrade','seal','transmute','hand','spread','deck','ability','pattern','relic','status','reading','resolve','event','potency'];
for (const id of required) {
  assert(GAME_TERM_IDS.includes(id), `Missing game term: ${id}`);
  assert(GAME_TERMS[id]?.label, `Missing label for game term: ${id}`);
  assert(GAME_TERMS[id]?.definition, `Missing definition for game term: ${id}`);
}
assert.equal(gameTermMarkup('chips'), '[[chips]]');
assert.equal(gameTermMarkup('take', 'Take 1'), '[[take|Take 1]]');
assert(registerGameTermsLocale('test', { chips: { label: 'Test Chips' } }));

const dom = new JSDOM('<main><p id="mechanic">[[chips]] and Mult</p><p id="archive" data-game-terms="off">[[chips]] stays literal</p></main>');
const mechanic = dom.window.document.getElementById('mechanic');
applyGameTerms(mechanic, { auto: true });
assert.equal(mechanic.querySelectorAll('.game-term').length, 2, 'explicit and automatic terms render');
const archive = dom.window.document.getElementById('archive');
applyGameTerms(archive, { auto: true });
assert.equal(archive.querySelectorAll('.game-term').length, 0, 'archive opt-out blocks tokens');
assert.match(archive.textContent, /\[\[chips\]\]/);

const titleDom = new JSDOM('<main><h2 id="heading">Threshold</h2><div id="resultTitle" class="result-title">[[score|Final Score]]</div><div id="hudLabel" class="spv2-label">Threshold</div><p id="explanation">Reach the Threshold to continue.</p></main>');
const titleRoot = titleDom.window.document.querySelector('main');
applyGameTerms(titleRoot, { auto: true });
assert.equal(titleDom.window.document.querySelector('#heading .game-term'), null, 'semantic headings stay plain');
assert.equal(titleDom.window.document.getElementById('heading').textContent, 'Threshold');
assert.equal(titleDom.window.document.querySelector('#resultTitle .game-term'), null, 'title classes stay plain');
assert.equal(titleDom.window.document.getElementById('resultTitle').textContent, 'Final Score', 'explicit title markup becomes normal text');
assert.equal(titleDom.window.document.querySelector('#hudLabel .game-term'), null, 'HUD labels stay plain');
assert.equal(titleDom.window.document.querySelectorAll('#explanation .game-term').length, 1, 'explanatory copy keeps term treatment');
const priorToken = titleDom.window.document.createElement('h3');
const priorTokenSpan = titleDom.window.document.createElement('span');
priorTokenSpan.className = ['game', 'term'].join('-');
priorTokenSpan.dataset.termId = 'threshold';
priorTokenSpan.textContent = 'Threshold';
priorToken.appendChild(priorTokenSpan);
titleRoot.appendChild(priorToken);
applyGameTerms(titleRoot, { auto: true });
assert.equal(priorToken.querySelector('.game-term'), null, 'existing title tokens are normalized back to text');
assert.equal(priorToken.textContent, 'Threshold');

const abilityDom = new JSDOM('<div id="abilityRef"></div>');
let abilityTermRenderCalls = 0;
abilityDom.window.tlrGetGameTerm = id => GAME_TERMS[id] || null;
abilityDom.window.tlrApplyGameTerms = () => { abilityTermRenderCalls += 1; };
renderAbilitySheet(abilityDom.window);
const abilityRef = abilityDom.window.document.getElementById('abilityRef');
assert.equal(abilityRef.dataset.gameTerms, 'off', 'Ability reference opts out of interactive game terms');
assert.equal(abilityTermRenderCalls, 0, 'Ability reference does not invoke the interactive term renderer');
assert.equal(abilityRef.querySelectorAll('.game-term').length, 0, 'Ability descriptions contain no term links');
assert.doesNotMatch(abilityRef.textContent, /\[\[/, 'Ability descriptions do not expose term markup');
assert.match(abilityRef.textContent, /Reveal the listed number of cards\. Take 1\./, 'Ability descriptions retain canonical wording as plain text');

const sourceFiles = [];
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules','dist','coverage','.git'].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(full);
    else if (/\.(?:mjs|js|html|md)$/.test(entry.name)) sourceFiles.push(full);
  }
}
collect(fileURLToPath(new URL('../src/', import.meta.url)));
collect(fileURLToPath(new URL('../scripts/', import.meta.url)));
const known = new Set(GAME_TERM_IDS);
const markup = /\[\[([a-z0-9_-]+)(?:\|[^\]]+)?\]\]/gi;
for (const file of sourceFiles) {
  const text = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = markup.exec(text))) assert(known.has(match[1].toLowerCase()), `Unknown game term "${match[1]}" in ${file}`);
  if (!file.endsWith('src/ui/gameTerms.mjs')) assert(!/<span[^>]+class=["'][^"']*game-term/.test(text), `Hand-authored game-term span in ${file}`);
}

const deprecated = /\b(?:points?|point value|multiplier|target score|pick up|put into your hand)\b/i;
const mechanical = [
  ...Object.values(ABILITIES).map(item=>item.prompt),
  ...RELIC_LIST.map(item=>item.description),
  ...SHOP_ITEMS.map(item=>item.description),
  ...STATUS_LIST.map(item=>item.description),
  ...Object.values(ADVENTURE_ITEMS).map(item=>item.text),
  ...Object.values(INTERACTION_CARD_DEFS).map(item=>item.prompt),
  ...Object.values(PERSONAS).flatMap(item=>[item.tagline,item.ability?.rules,item.ability?.reminder].filter(Boolean)),
];
for (const copy of mechanical) assert(!deprecated.test(copy), `Deprecated mechanical wording: ${copy}`);
for (const item of [...Object.values(ARCHIVE_FRAGMENTS), ...ARCHIVE_ITEMS]) {
  assert(['source','analysis'].includes(item.contentKind), `Archive item ${item.id} lacks content classification`);
  assert.equal(item.gameTerms, 'off', `Archive item ${item.id} must opt out of automatic terms`);
  assert(!/\[\[/.test(item.content), `Archive item ${item.id} contains mechanical markup`);
}
const instrumentation = fs.readFileSync(new URL('../src/app/comprehensionInstrumentation.mjs', import.meta.url), 'utf8');
assert(!instrumentation.includes('fetch(') && !instrumentation.includes('sendBeacon') && !instrumentation.includes('XMLHttpRequest'), 'Comprehension instrumentation must remain local-only');
const main = fs.readFileSync(new URL('../src/app/main.mjs', import.meta.url), 'utf8');
assert.match(main, /installGameTerms\(target\)/);
assert.match(main, /installComprehensionInstrumentation\(target\)/);
console.log('Game terminology validation passed.');
