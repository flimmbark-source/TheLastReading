const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

let changed = 0;
function rep(old, next, label) {
  if (html.includes(old)) {
    html = html.replace(old, next);
    console.log('  ✓', label);
    changed++;
  } else {
    console.warn('  WARN: not found —', label);
  }
}

console.log('Scoring rebalance:');

// ── Scoring engine (computeScore) ──────────────────────────────────────────

// Rank Match: chips 10/12 → 5/7, mult base 1.0 → 1.25
rep(
  `let rankMult=1+(persist.up.rank_mult||0)*0.25;`,
  `let rankMult=1.25+(persist.up.rank_mult||0)*0.25;`,
  'Rank Match mult base 1.0 → 1.25'
);
rep(
  `if(a.length===4){let x=12+rankBonus;`,
  `if(a.length===4){let x=7+rankBonus;`,
  'Four of a Kind chips 12 → 7'
);
rep(
  `else if(a.length===3){let x=10+rankBonus;`,
  `else if(a.length===3){let x=5+rankBonus;`,
  'Three of a Kind chips 10 → 5'
);

// Full/Royal Court: flatten to fixed chips+mult (no extra scaling per card)
rep(
  `let courtMult=1+(persist.up.court_mult||0)*0.25;`,
  `let courtMult=1.5+(persist.up.court_mult||0)*0.25;`,
  'Court mult base 1.0 → 1.5'
);
rep(
  `  if(same){
    // Royal Court: 3 same-suit courts = base; each extra rank in that suit adds chips+mult
    const extra=sameCount-3; // 0, 1
    const x=Math.round(15+extra*8+courtChips);
    const xm=+(courtMult+(extra*0.25)).toFixed(2);
    m.push(['Royal Court ('+same+')'+( extra?' ×'+(sameCount):'' ),x,xm]);chips+=x;mult*=xm;court=true;
  } else if(fullCount>=3){
    // Full Court: 3 distinct ranks = base; each rank beyond 3 adds chips+mult
    const extra=Math.min(fullCount-3,1); // cap at 4 ranks for now
    const x=Math.round(10+extra*6+courtChips);
    const xm=+(courtMult+(extra*0.25)).toFixed(2);
    m.push(['Full Court'+(extra?' ×'+fullCount:''),x,xm]);chips+=x;mult*=xm;court=true;
  }`,
  `  if(same){
    m.push(['Royal Court ('+same+')',10+courtChips,courtMult]);chips+=10+courtChips;mult*=courtMult;court=true;
  } else if(fullCount>=3){
    m.push(['Full Court',10+courtChips,courtMult]);chips+=10+courtChips;mult*=courtMult;court=true;
  }`,
  'Court scoring — flat chips/mult, no extra-card scaling'
);

// Sequence: flat chips regardless of length, mult base 2.0 → 1.25
rep(
  `let seqMult=2+(persist.up.seq_mult||0)*0.5;`,
  `let seqMult=1.25+(persist.up.seq_mult||0)*0.5;`,
  'Sequence mult base 2.0 → 1.25'
);
rep(
  `  if(best>=5){let x=18+seqBonus;m.push(['Sequence of '+best,x,seqMult]);chips+=x;mult*=seqMult}
  else if(best>=4){let x=15+seqBonus;m.push(['Sequence of '+best,x,seqMult]);chips+=x;mult*=seqMult}
  else if(best>=3){let x=10+seqBonus;m.push(['Sequence of '+best,x,seqMult]);chips+=x;mult*=seqMult}`,
  `  if(best>=3){let x=10+seqBonus;m.push(['Sequence of '+best,x,seqMult]);chips+=x;mult*=seqMult}`,
  'Sequence scoring — flat chips for any length 3+'
);

// Path of the Magi: chips 30, mult base 2.0
rep(
  `let pathMult=2+(persist.up.path_mult||0)*0.5;`,
  `let pathMult=2+(persist.up.path_mult||0)*0.5;`,
  'Magi mult base 2.0 (no change)'
);
rep(
  `{let x=10+pathChips;m.push(['Path of the Magi',x,pathMult]);`,
  `{let x=30+pathChips;m.push(['Path of the Magi',x,pathMult]);`,
  'Magi chips base 10 → 30'
);

// ── Scoring reference sheet (renderScoringSheet) ───────────────────────────

rep(
  `const rankMult=+(1+(u.rank_mult||0)*0.25).toFixed(2);`,
  `const rankMult=+(1.25+(u.rank_mult||0)*0.25).toFixed(2);`,
  '[ref] Rank Match mult base'
);
rep(
  `const courtMult=+(1+(u.court_mult||0)*0.25).toFixed(2);`,
  `const courtMult=+(1.5+(u.court_mult||0)*0.25).toFixed(2);`,
  '[ref] Court mult base'
);
rep(
  `const seqMult=+(2+(u.seq_mult||0)*0.5).toFixed(2);`,
  `const seqMult=+(1.25+(u.seq_mult||0)*0.5).toFixed(2);`,
  '[ref] Sequence mult base'
);
rep(
  `const pathMult=+(2+(u.path_mult||0)*0.5).toFixed(2);`,
  `const pathMult=+(2+(u.path_mult||0)*0.5).toFixed(2);`,
  '[ref] Magi mult base (no change)'
);
// Rewrite the rows array: per-pattern increments, mult as +N not ×N
rep(
  `  const rows=[
    ['Rank Match','Three/Four of a Kind',\`+\${5+rankBonus} / +\${7+rankBonus}\`,\`×\${rankMult}\`],
    ['Full Court (3+)','Consecutive Ranks',\`+\${10+courtChips} / +\${16+courtChips}\`,\`×\${courtMult} / ×\${+(courtMult+0.25).toFixed(2)}\`],
    ['Royal Court (3+)','Consecutive Ranks, same suit',\`+\${15+courtChips} / +\${23+courtChips}\`,\`×\${courtMult} / ×\${+(courtMult+0.25).toFixed(2)}\`],
    ['Sequence (3+)','Consecutive Arcana',\`+\${10+seqBonus} / +\${15+seqBonus} / +\${18+seqBonus}\`,\`×\${seqMult}\`],
    ['Path of the Magi','0·I·XXI in spread',\`+\${10+pathChips}\`,\`×\${pathMult}\`],
  ];`,
  `  const fmt=v=>'+'+(v-1).toFixed(2).replace(/\\.?0+$/,'');
  const rows=[
    ['Three of a Kind','3 matching court ranks',\`+\${5+rankBonus}\`,fmt(rankMult)],
    ['Four of a Kind','4 matching court ranks',\`+\${7+rankBonus}\`,fmt(rankMult)],
    ['Full Court (3+)','Consecutive ranks',\`+\${10+courtChips}\`,fmt(courtMult)],
    ['Royal Court (3+)','Consecutive ranks, same suit',\`+\${10+courtChips}\`,fmt(courtMult)],
    ['Sequence (3+)','Consecutive major arcana',\`+\${10+seqBonus}\`,fmt(seqMult)],
    ['Path of the Magi','0·I·XXI in spread',\`+\${30+pathChips}\`,fmt(pathMult)],
  ];`,
  '[ref] rows array — per-pattern increments, mult as +N'
);
rep(
  '  const minorRows=rows.slice(0,3);\n  const majorRows=rows.slice(3);',
  '  const minorRows=rows.slice(0,4);\n  const majorRows=rows.slice(4);',
  '[ref] minor/major row split (4 minor now)'
);

fs.writeFileSync(file, html);
console.log(`Done — ${changed} replacements applied.`);

// Mirror ability description (both reference table and ability prompt)
const oldMirrorDesc = 'Take the card opposite it across centerline of its Arcana.';
const newMirrorDesc = 'Take the card opposite it across the centerline of its Arcana. (Knight/Queen, 10/11)';
if (html.includes(oldMirrorDesc)) {
  html = html.split(oldMirrorDesc).join(newMirrorDesc);
  console.log('  ✓ Mirror description updated');
} else {
  console.log('  (Mirror description already updated)');
}

fs.writeFileSync(file, html);
