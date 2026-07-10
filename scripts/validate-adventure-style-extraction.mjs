import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  ADVENTURE_STYLE_HREF,
  ADVENTURE_STYLE_OUTPUT,
  extractAdventureCss,
  externalizeAdventureStyles,
} from './adventure-style-extraction.mjs';

const source = fs.readFileSync(new URL('../src/app/adventureModeV3.mjs', import.meta.url), 'utf8');
const buildScript = fs.readFileSync(new URL('./build-bundle.mjs', import.meta.url), 'utf8');
const css = extractAdventureCss(source);
const transformed = externalizeAdventureStyles(source);

assert.ok(css.length > 5000, 'Adventure CSS extraction should produce the full stylesheet');
assert.match(css, /#advEventDeck/);
assert.match(css, /#advHud/);
assert.match(css, /\.adv-reward-card-actions/);
assert.match(css, /@media\(max-width:640px\)/);
assert.doesNotMatch(css, /\$\{/);

assert.doesNotMatch(transformed, /style\.textContent = `/);
assert.match(transformed, new RegExp(ADVENTURE_STYLE_HREF.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(transformed, /existing\?\.tagName === 'LINK'/);
assert.match(transformed, /link\.rel = 'stylesheet'/);

assert.match(buildScript, /extractAdventureCss/);
assert.match(buildScript, /externalizeAdventureStyles/);
assert.match(buildScript, /externalize-adventure-mode-style/);
assert.match(buildScript, /ADVENTURE_STYLE_OUTPUT/);
assert.equal(ADVENTURE_STYLE_OUTPUT, 'dist/adventure-mode-v3.css');
assert.match(buildScript, /await buildAdventureCss\(\)/);
assert.match(buildScript, /plugins: \[adventureStylePlugin\(\)\]/);

console.log('Adventure style extraction validation passed.');
