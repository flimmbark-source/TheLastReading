const fs = require('fs');

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');
let changed = false;

const candidates = [
  `function _hintsKey(){return state.spread.map(c=>c?c.uid:0).join(',');}`,
];
const replacement = `function _hintsKey(){return state.spread.map(c=>c?c.uid:0).join(',')+'|'+state.hand.map(c=>c.uid).join(',');}`;

if (html.includes(replacement)) {
  console.log('Hint cache key already includes hand.');
} else {
  let matched = false;
  for (const candidate of candidates) {
    if (html.includes(candidate)) {
      html = html.replace(candidate, replacement);
      changed = true;
      matched = true;
      console.log('Patched _hintsKey to include hand uids.');
      break;
    }
  }
  if (!matched) throw new Error('Could not find _hintsKey block to patch.');
}

if (changed) {
  fs.writeFileSync(path, html);
  console.log('Updated hint cache key so hand changes invalidate stale near-hints.');
} else {
  console.log('No hint cache key changes needed.');
}
