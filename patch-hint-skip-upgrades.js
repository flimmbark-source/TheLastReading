const fs = require('fs');

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');
let changed = false;

const candidates = [
  `if(omenTotal){m.push(['Omen',omenTotal,0]);chips+=omenTotal;}
  if(resonanceTotal){m.push(['Resonance',resonanceTotal,0]);chips+=resonanceTotal;}`,
];
const replacement = `if(omenTotal&&!forHints){m.push(['Omen',omenTotal,0]);chips+=omenTotal;}
  if(resonanceTotal&&!forHints){m.push(['Resonance',resonanceTotal,0]);chips+=resonanceTotal;}`;

if (html.includes(replacement)) {
  console.log('Omen/Resonance hint exclusion already applied.');
} else {
  let matched = false;
  for (const candidate of candidates) {
    if (html.includes(candidate)) {
      html = html.replace(candidate, replacement);
      changed = true;
      matched = true;
      console.log('Patched Omen/Resonance to be skipped during hint calculations.');
      break;
    }
  }
  if (!matched) throw new Error('Could not find Omen/Resonance block in computeScore to patch.');
}

if (changed) {
  fs.writeFileSync(path, html);
  console.log('Stopped Omen/Resonance upgrade bonuses from showing up as pattern hints.');
} else {
  console.log('No Omen/Resonance hint changes needed.');
}
