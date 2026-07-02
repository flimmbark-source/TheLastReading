import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('Single Player V2 loads through one cascade entry point', () => {
  const html = read('../game.html');
  assert.match(html, /id="single-player-v2-index"[^>]+singlePlayerV2\/index\.css/, 'game should load the consolidated cascade entry point');
  assert.doesNotMatch(html, /singlePlayerV2LatestFixes\.css/, 'patch files should not be linked directly from game.html');
  assert.doesNotMatch(html, /single-player-v2-utility-icons/, 'utility icon CSS should be imported by the cascade entry point only');
});

test('Single Player V2 runtime loader owns only the cascade entry point', () => {
  const source = read('../src/ui/singlePlayerV2.mjs');
  assert.match(source, /single-player-v2-index/, 'runtime loader should ensure the consolidated cascade link');
  assert.doesNotMatch(source, /single-player-v2-utility-icons/, 'runtime loader should not append individual patch stylesheets');
  assert.doesNotMatch(source, /singlePlayerV2Compat\.css\?v=composition-1/, 'runtime loader should not reshuffle compatibility CSS order');
});

test('Abilities utility button is visible in Single Player V2 mobile contract', () => {
  const layout = read('../src/styles/singlePlayerV2/layout.css');
  const utilityButtons = read('../src/styles/singlePlayerV2/components/utilityButtons.css');
  const utilityIcons = read('../src/styles/singlePlayerV2/components/utilityIcons.css');
  assert.doesNotMatch(layout, /#abilitiesBtn,\s*\n\s*body\.single-player-v2\.generated-sheet-ready #mullBtn\s*\{\s*display:\s*none\s*!important/s, 'abilities must not share the legacy hidden-button rule');
  assert.doesNotMatch(layout, /#abilitiesBtn,[\s\S]*?#menuBtn\s*\{[\s\S]*?display:\s*block\s*!important/, 'layout CSS should not own utility-button display');
  assert.match(utilityButtons, /#abilitiesBtn,[\s\S]*?#menuBtn\s*\{[\s\S]*?display:\s*block\s*!important/, 'abilities should share the visible utility-button sizing/display rule');
  assert.match(utilityIcons, /#abilitiesBtn\s*\{\s*background-image:\s*var\(--spv2-option-abilities-art\)\s*!important/s, 'visible abilities button should retain its icon art');
});


test('Single Player V2 cascade contains CSS instead of forwarding imports', () => {
  const cascade = read('../src/styles/singlePlayerV2/index.css');
  assert.doesNotMatch(cascade, /@import\s+url\(/, 'cascade entry should not delegate active CSS to patch-file imports');
  assert.match(cascade, /singlePlayerV2\/tokens\.css: tokens[\s\S]*singlePlayerV2\/base\.css: base layout[\s\S]*singlePlayerV2\/components\/utilityButtons\.css: component: utility button visibility/, 'cascade entry should preserve the prior direct-link order');
});
