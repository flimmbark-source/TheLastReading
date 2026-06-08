const fs = require('fs');

const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');
let changed = false;

function patchOne(label, original, replacement) {
  if (html.includes(replacement)) {
    console.log(`${label} already applied.`);
    return;
  }
  if (!html.includes(original)) {
    throw new Error(`Could not find: ${label}`);
  }
  html = html.replace(original, replacement);
  changed = true;
  console.log(`Patched: ${label}`);
}

// ── Fix 1: split computeScore's single `forHints` flag into two orthogonal flags:
//   skipRelics       – don't score relic effects (for hint pass when hintSettings.relics=false)
//   skipFlatBonuses  – don't score flat per-card bonuses (Omen, Resonance) that aren't
//                      patterns and would otherwise light up every card in the hand.
//
// `skipFlatBonuses` defaults to `skipRelics` so every existing call site that passes
// `forHints=true` (the old all-exclude mode) keeps working unchanged.
//
// Omen and Resonance are gated on `!skipFlatBonuses` instead of `!forHints`.
// The relic block is gated on `!skipRelics` instead of `!forHints`.

patchOne(
  'computeScore signature + Omen/Resonance guards',
  `function computeScore(cards,spreadArr=null,forHints=false){
  const omenBonus=(persist.up.omen||0);
  const resonanceBonus=(persist.up.resonance||0)*3;
  const omenTotal=omenBonus*cards.length;
  const resonanceTotal=resonanceBonus*cards.filter(c=>c.type==='major').length;
  let chips=cards.reduce((s,c)=>s+c.points,0),base=chips,mult=1,m=[];
  if(omenTotal&&!forHints){m.push(['Omen',omenTotal,0]);chips+=omenTotal;}
  if(resonanceTotal){m.push(['Resonance',resonanceTotal,0]);chips+=resonanceTotal;}`,
  `function computeScore(cards,spreadArr=null,skipRelics=false,skipFlatBonuses=skipRelics){
  const omenBonus=(persist.up.omen||0);
  const resonanceBonus=(persist.up.resonance||0)*3;
  const omenTotal=omenBonus*cards.length;
  const resonanceTotal=resonanceBonus*cards.filter(c=>c.type==='major').length;
  let chips=cards.reduce((s,c)=>s+c.points,0),base=chips,mult=1,m=[];
  if(omenTotal&&!skipFlatBonuses){m.push(['Omen',omenTotal,0]);chips+=omenTotal;}
  if(resonanceTotal&&!skipFlatBonuses){m.push(['Resonance',resonanceTotal,0]);chips+=resonanceTotal;}`
);

// Relic block was gated on the old `forHints`; rename to `skipRelics`.
patchOne(
  'computeScore relic block gate',
  `  if(!forHints){
  const rel=persist.relics;`,
  `  if(!skipRelics){
  const rel=persist.relics;`
);

// ── Fix 2: hint diff calls always pass skipFlatBonuses=true (4th arg).
//   `skipRelics` still controls whether relic melds appear in the hint diff.
//   Previously both relics AND flat bonuses were controlled by a single flag,
//   so enabling relic hints (skipRelics=false) accidentally re-enabled Omen too.

patchOne(
  'cardHints scoring calls always skip flat bonuses',
  `  const before=new Set(computeScore(spread,null,skipRelics).melds.map(m=>m[0]));
  const after=computeScore(placed,null,skipRelics);`,
  `  const before=new Set(computeScore(spread,null,skipRelics,true).melds.map(m=>m[0]));
  const after=computeScore(placed,null,skipRelics,true);`
);

// ── Fix 3: placeCard announces every meld in newMelds via centerGhost.
//   Omen and Resonance are flat per-card bonuses — they appear in newMelds whenever
//   a card is placed (the before-score has n cards, after has n+1, so omenTotal
//   always increases). Filter them out of the big-text announcement and meld sound,
//   the same way _relicMeldNames filters relic melds.

patchOne(
  'placeCard announcement filter for Omen/Resonance',
  `if(!_relicMeldNames.has(m[0]))setTimeout(()=>{centerGhost(normMeldName(m[0]),m[2]>1.5||m[3]==='add'&&m[2]>=1.5);playSound('meld');haptic([0,10,35,12]);},delay+announceOffset);`,
  `if(!_relicMeldNames.has(m[0])&&m[0]!=='Omen'&&m[0]!=='Resonance')setTimeout(()=>{centerGhost(normMeldName(m[0]),m[2]>1.5||m[3]==='add'&&m[2]>=1.5);playSound('meld');haptic([0,10,35,12]);},delay+announceOffset);`
);

if (changed) {
  fs.writeFileSync(path, html);
  console.log('Fixed Omen/Resonance appearing in hints and as meld announcements.');
} else {
  console.log('No changes needed.');
}
