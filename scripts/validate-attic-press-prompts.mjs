import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../src/three/Interactables.jsx', import.meta.url), 'utf8');

assert.match(
  source,
  /const PRESS_PROMPT_MS = 2800;/,
  'attic item labels should linger for 2.8 seconds after release',
);
assert.match(
  source,
  /onPointerDown:[\s\S]*?hover\.press\(id, event\.pointerId\)/,
  'a direct pointer-down should reveal the item label immediately',
);
assert.match(
  source,
  /onPointerUp:[\s\S]*?hover\.release\(id, event\.pointerId\)/,
  'pointer-up should start the post-release linger',
);
assert.match(
  source,
  /onPointerCancel:[\s\S]*?hover\.release\(id, event\.pointerId\)/,
  'a cancelled press should still finish through the release path',
);
assert.doesNotMatch(
  source,
  /onPointerOver|onPointerEnter/,
  'looking or hovering over an attic item must not reveal its label',
);
assert.match(
  source,
  /const target = interactables\.find\(item => item\.id === hoverId\) \|\| null;/,
  'the visible prompt should be selected only from direct-press state',
);
assert.doesNotMatch(
  source,
  /hoverId\s*\|\|\s*focusId|focusId\s*\|\|\s*hoverId/,
  'camera focus must not be used as a fallback prompt trigger',
);

const pressBlock = source.match(/press\(id, pointerId\) \{([\s\S]*?)\n      \},\n      release/)?.[1] || '';
const releaseBlock = source.match(/release\(id, pointerId\) \{([\s\S]*?)\n      \},\n      dispose/)?.[1] || '';
assert.doesNotMatch(pressBlock, /setTimeout/, 'the label must not begin expiring while the pointer is held');
assert.match(releaseBlock, /setTimeout/, 'the 2.8-second expiry must begin only after release');

console.log('Attic direct-press prompt validation passed.');
