const fs = require('fs');

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');
let changed = false;

// Guard Omen behind !forHints (flat per-card bonus, not a pattern).
// Resonance stays untouched: it's conditional on majors and tells the
// player which cards would trigger it.
const omenOriginal = `if(omenTotal){m.push(['Omen',omenTotal,0]);chips+=omenTotal;}`;
const omenPatched = `if(omenTotal&&!forHints){m.push(['Omen',omenTotal,0]);chips+=omenTotal;}`;
const resonancePatchedAccidentally = `if(resonanceTotal&&!forHints){m.push(['Resonance',resonanceTotal,0]);chips+=resonanceTotal;}`;
const resonanceOriginal = `if(resonanceTotal){m.push(['Resonance',resonanceTotal,0]);chips+=resonanceTotal;}`;

if (html.includes(omenOriginal)) {
  html = html.replace(omenOriginal, omenPatched);
  changed = true;
  console.log('Guarded Omen behind !forHints.');
} else if (html.includes(omenPatched)) {
  console.log('Omen hint exclusion already applied.');
} else {
  throw new Error('Could not find Omen block in computeScore to patch.');
}

if (html.includes(resonancePatchedAccidentally)) {
  html = html.replace(resonancePatchedAccidentally, resonanceOriginal);
  changed = true;
  console.log('Restored Resonance as a real hint (revert previous over-eager guard).');
}

if (changed) {
  fs.writeFileSync(path, html);
  console.log('Stopped Omen from showing up as a pattern hint; left Resonance intact.');
} else {
  console.log('No hint upgrade changes needed.');
}
