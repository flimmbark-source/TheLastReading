import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildSinglePlayerV2Cascade, singlePlayerV2CascadeSources } from './generate-single-player-v2-cascade.mjs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

const html = read('../game.html');


const forbiddenLegacyNames = [
  'singlePlayerV2Assets.css',
  'singlePlayerV2ArtIntegration.css',
  'singlePlayerV2UtilityIcons.css',
  'singlePlayerV2RequestedFixes.css',
  'singlePlayerV2LatestFixes.css',
  'singlePlayerV2SlotMatch.css',
  'singlePlayerV2VisualFix.css',
  'singlePlayerV2GestureRestore.css',
  'singlePlayerV2FinalPlacement.css',
  'singlePlayerV2HudTablePass.css',
  'singlePlayerV2CorrectionPass.css',
  'singlePlayerV2RelicPlacement.css',
  'singlePlayerV2Compat.css',
  'src/styles/singlePlayerV2.css',
];

const legacyReferenceFiles = [
  '../game.html',
  '../src/ui/singlePlayerV2.mjs',
  '../scripts/generate-single-player-v2-cascade.mjs',
  '../docs/single-player-redesign/PHASE_2_EXECUTION_CHECKLIST.md',
  '../docs/single-player-redesign/PHASE_2_INTEGRATION_MAP.md',
  '../public/ui/single-player-v2/README.md',
];

for (const file of legacyReferenceFiles) {
  const text = read(file);
  for (const legacyName of forbiddenLegacyNames) {
    assert.equal(text.includes(legacyName), false, `${file} should not reference legacy SPv2 stylesheet ${legacyName}`);
  }
}


const importantBudget = 921;
const sourceImportantCount = singlePlayerV2CascadeSources
  .map(([path]) => read(`../src/styles/${path}`).match(/!important/g)?.length ?? 0)
  .reduce((sum, count) => sum + count, 0);
assert.ok(sourceImportantCount <= importantBudget, `Single Player V2 !important count ${sourceImportantCount} exceeds budget ${importantBudget}`);
assert.equal(read('../src/styles/singlePlayerV2/tokens.css').includes('!important'), false, 'design tokens should stay free of !important overrides');
assert.match(read('../src/styles/singlePlayerV2/tokens.css'), /^@layer spv2\.tokens \{/m, 'design tokens should live in the tokens cascade layer');
assert.match(read('../src/styles/singlePlayerV2/components/utilityButtons.css'), /^@layer spv2\.components \{/m, 'utility button visibility should live in the components cascade layer');
assert.match(read('../src/styles/singlePlayerV2/components/utilityIcons.css'), /^@layer spv2\.components \{/m, 'utility icon art should live in the components cascade layer');
assert.match(read('../src/styles/singlePlayerV2/components/relics.css'), /^@layer spv2\.components \{/m, 'relic placement should live in the components cascade layer');
assert.match(read('../src/styles/singlePlayerV2/components/hand.css'), /^@layer spv2\.components \{/m, 'hand gesture restore should live in the components cascade layer');
assert.match(read('../src/styles/singlePlayerV2/components/spreadHints.css'), /^@layer spv2\.components \{/m, 'spread hints should live in the components cascade layer');

const cascade = read('../src/styles/singlePlayerV2/index.css');
assert.equal(cascade, buildSinglePlayerV2Cascade(), 'generated cascade should match its source stylesheets');
assert.doesNotMatch(cascade, /@import\s+url\(/, 'cascade entry should contain the active SPv2 CSS instead of forwarding to patch files');
assert.match(cascade, /singlePlayerV2\/tokens\.css: tokens[\s\S]*singlePlayerV2\/base\.css: base layout[\s\S]*singlePlayerV2\/components\/utilityIcons\.css: component: utility icons/, 'cascade entry should preserve the previous direct-link order in one file');

assert.match(html, /id="single-player-v2-index"[^>]+singlePlayerV2\/index\.css/, 'game should load the consolidated cascade entry point');
assert.doesNotMatch(html, /singlePlayerV2LatestFixes\.css/, 'patch files should not be linked directly from game.html');
assert.doesNotMatch(html, /single-player-v2-utility-icons/, 'utility icon CSS should be imported by the cascade entry point only');

const source = read('../src/ui/singlePlayerV2.mjs');
assert.match(source, /single-player-v2-index/, 'runtime loader should ensure the consolidated cascade link');
assert.doesNotMatch(source, /single-player-v2-utility-icons/, 'runtime loader should not append individual patch stylesheets');
assert.doesNotMatch(source, /singlePlayerV2Compat\.css\?v=composition-1/, 'runtime loader should not reshuffle compatibility CSS order');

const layout = read('../src/styles/singlePlayerV2/layout.css');
const utilityButtons = read('../src/styles/singlePlayerV2\/components\/utilityButtons.css');
const utilityIcons = read('../src/styles/singlePlayerV2/components/utilityIcons.css');
assert.doesNotMatch(layout, /#abilitiesBtn,\s*\n\s*body\.single-player-v2\.generated-sheet-ready #mullBtn\s*\{\s*display:\s*none\s*!important/s, 'abilities must not share the legacy hidden-button rule');
assert.doesNotMatch(layout, /#abilitiesBtn,[\s\S]*?#menuBtn\s*\{[\s\S]*?display:\s*block\s*!important/, 'layout CSS should not own utility-button display');
assert.match(utilityButtons, /#abilitiesBtn,[\s\S]*?#menuBtn\s*\{[\s\S]*?display:\s*block\s*!important/, 'abilities should share the visible utility-button sizing/display rule');
assert.match(utilityIcons, /#abilitiesBtn\s*\{\s*background-image:\s*var\(--spv2-option-abilities-art\)\s*!important/s, 'visible abilities button should retain its icon art');

console.log('Single Player V2 cascade checks passed.');
