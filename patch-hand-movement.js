const fs = require('fs');

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');
let changed = false;

// This patch targets the whole-hand idle movement scheduler at the bottom of
// index.html. It intentionally does not change card wave/keyframe animation.
const currentHandMoveDelay = `  const pause=2000+Math.random()*4000;
  setTimeout(handAnim,dur+pause);`;

const patchedHandMoveDelay = `  const pause=2000+Math.random()*10000;
  setTimeout(handAnim,dur+pause);`;

if (html.includes(currentHandMoveDelay)) {
  html = html.replace(currentHandMoveDelay, patchedHandMoveDelay);
  changed = true;
  console.log('Patched whole-hand movement pause to 2000ms–12000ms.');
} else if (html.includes(patchedHandMoveDelay)) {
  console.log('Whole-hand movement pause is already patched.');
} else {
  throw new Error('Could not find whole-hand handAnim() pause block to patch.');
}

// Older versions of this helper briefly inserted an intermittent per-card wave.
// Remove that stale helper if it exists so this file only controls the whole
// hand movement timing the game already has.
const staleCardWaveJsRE = /\n?\/\/ intermittent hand movement patch[\s\S]*?\/\/ end intermittent hand movement patch\n?/;
if (staleCardWaveJsRE.test(html)) {
  html = html.replace(staleCardWaveJsRE, '\n');
  changed = true;
  console.log('Removed stale per-card idle wave helper.');
}

if (changed) {
  fs.writeFileSync(path, html);
  console.log('Patched hand movement timing.');
} else {
  console.log('No hand movement timing changes needed.');
}
