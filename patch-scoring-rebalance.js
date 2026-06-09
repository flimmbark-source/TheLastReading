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

// Full/Royal Court: chips and mult base
rep(
  `let courtMult=1+(persist.up.court_mult||0)*0.25;`,
  `let courtMult=1.25+(persist.up.court_mult||0)*0.25;`,
  'Court mult base 1.0 → 1.25'
);
rep(
  `const x=Math.round(20+extra*8+courtChips);`,
  `const x=Math.round(15+extra*8+courtChips);`,
  'Royal Court chips base 20 → 15'
);
rep(
  `const x=Math.round(14+extra*6+courtChips);`,
  `const x=Math.round(10+extra*6+courtChips);`,
  'Full Court chips base 14 → 10'
);

// Sequence: mult base 2.0 → 1.25
rep(
  `let seqMult=2+(persist.up.seq_mult||0)*0.5;`,
  `let seqMult=1.25+(persist.up.seq_mult||0)*0.5;`,
  'Sequence mult base 2.0 → 1.25'
);

// Path of the Magi: chips base 30 → 10, mult base 2.0 → 1.5
rep(
  `let pathMult=2+(persist.up.path_mult||0)*0.5;`,
  `let pathMult=1.5+(persist.up.path_mult||0)*0.5;`,
  'Magi mult base 2.0 → 1.5'
);
rep(
  `{let x=30+pathChips;m.push(['Path of the Magi',x,pathMult]);`,
  `{let x=10+pathChips;m.push(['Path of the Magi',x,pathMult]);`,
  'Magi chips base 30 → 10'
);

// ── Scoring reference sheet (renderScoringSheet) ───────────────────────────

rep(
  `const rankMult=+(1+(u.rank_mult||0)*0.25).toFixed(2);`,
  `const rankMult=+(1.25+(u.rank_mult||0)*0.25).toFixed(2);`,
  '[ref] Rank Match mult base'
);
rep(
  `const courtMult=+(1+(u.court_mult||0)*0.25).toFixed(2);`,
  `const courtMult=+(1.25+(u.court_mult||0)*0.25).toFixed(2);`,
  '[ref] Court mult base'
);
rep(
  `const seqMult=+(2+(u.seq_mult||0)*0.5).toFixed(2);`,
  `const seqMult=+(1.25+(u.seq_mult||0)*0.5).toFixed(2);`,
  '[ref] Sequence mult base'
);
rep(
  `const pathMult=+(2+(u.path_mult||0)*0.5).toFixed(2);`,
  `const pathMult=+(1.5+(u.path_mult||0)*0.5).toFixed(2);`,
  '[ref] Magi mult base'
);
rep(
  '`+${10+rankBonus} / +${12+rankBonus}`',
  '`+${5+rankBonus} / +${7+rankBonus}`',
  '[ref] Rank Match chips display'
);
rep(
  '`+${14+courtChips} / +${20+courtChips}`',
  '`+${10+courtChips} / +${16+courtChips}`',
  '[ref] Full Court chips display'
);
rep(
  '`+${20+courtChips} / +${28+courtChips}`',
  '`+${15+courtChips} / +${23+courtChips}`',
  '[ref] Royal Court chips display'
);
rep(
  '`+${30+pathChips}`',
  '`+${10+pathChips}`',
  '[ref] Magi chips display'
);

fs.writeFileSync(file, html);
console.log(`Done — ${changed} replacements applied.`);
