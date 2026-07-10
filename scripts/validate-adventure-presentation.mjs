import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../src/styles/singlePlayerV2/components/presentation.css', import.meta.url), 'utf8');
const mode = fs.readFileSync(new URL('../src/app/adventureModeV3.mjs', import.meta.url), 'utf8');

assert.match(css, /body\.mode-adventure\.presentation-flag-adventure-reward #summary\.show/);
assert.match(css, /body\.mode-adventure #summary\.show \.adv-rewards\s*\{[\s\S]*display:\s*grid/);
assert.match(css, /grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(css, /body\.mode-adventure #summary\.show \.adv-reward--picked/);
assert.match(css, /body\.mode-adventure #summary\.show \.adv-reward--disabled/);
assert.match(css, /body\.mode-adventure #summary\.show > \.result-panel > \.rbtns/);
assert.match(css, /env\(safe-area-inset-bottom\)/);
assert.match(css, /@media \(max-width: 365px\)/);

// Presentation must continue to consume the branch's established reward DOM
// contract rather than duplicating or replacing reward mechanics.
assert.match(mode, /class="adv-reward/);
assert.match(mode, /adv-reward--picked/);
assert.match(mode, /adv-reward--disabled/);
assert.match(mode, /Choose your reward/);
assert.match(mode, /tlrAdventureV3ConfirmRewards/);
assert.doesNotMatch(css, /onclick=|rewardShow\s*=|rewardChoose\s*=/,
  'CSS presentation layer must not contain reward behavior');

console.log('Adventure presentation validation passed.');
