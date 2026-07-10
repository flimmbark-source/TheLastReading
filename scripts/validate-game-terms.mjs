import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_TERM_IDS, GAME_TERMS, gameTermMarkup } from '../src/ui/gameTerms.mjs';

const required = [
  'chips', 'mult', 'score', 'threshold', 'reserve',
  'play', 'draw', 'discard', 'reveal', 'take', 'banish',
  'hand', 'spread', 'deck', 'ability', 'pattern', 'relic',
];

for (const id of required) {
  assert(GAME_TERM_IDS.includes(id), `Missing game term: ${id}`);
  assert(GAME_TERMS[id]?.label, `Missing label for game term: ${id}`);
  assert(GAME_TERMS[id]?.definition, `Missing definition for game term: ${id}`);
}
assert.equal(gameTermMarkup('chips'), '[[chips]]');
assert.equal(gameTermMarkup('take', 'Take 1'), '[[take|Take 1]]');

const main = fs.readFileSync(new URL('../src/app/main.mjs', import.meta.url), 'utf8');
assert.match(main, /installGameTerms/);
assert.match(main, /installGameTerms\(target\)/);

const sourceFiles = [];
function collect(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', 'coverage', '.git'].includes(entry.name)) continue;
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
  while ((match = markup.exec(text))) {
    assert(known.has(match[1].toLowerCase()), `Unknown game term "${match[1]}" in ${file}`);
  }
}

console.log('Game terminology validation passed.');
