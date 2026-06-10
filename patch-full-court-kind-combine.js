const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '/* full court mult and combined kind patch */';
if (html.includes(marker)) {
  console.log('Full Court / combined Kind patch already present, skipping.');
  process.exit(0);
}

let changed = 0;
function rep(oldText, newText, label) {
  const count = html.split(oldText).length - 1;
  if (count > 0) {
    html = html.split(oldText).join(newText);
    changed += count;
    console.log('  ✓', label, `(${count})`);
  } else {
    console.warn('  WARN: not found —', label);
  }
}

function repRegex(pattern, newText, label) {
  const before = html;
  html = html.replace(pattern, newText);
  if (html !== before) {
    changed++;
    console.log('  ✓', label);
  } else {
    console.warn('  WARN: not found —', label);
  }
}

console.log('Full Court / combined Kind patch:');

// 3 and 4 of a Kind should be one pattern family, not two independently-stacking melds.
rep(
  `if(a.length>=3){let x=5+rankBonus;m.push(['Three of a Kind ('+rank+'s)',x,rankMult]);chips+=x;mult+=rankMult-1}
    if(a.length>=4){let x=7+rankBonus;m.push(['Four of a Kind ('+rank+'s)',x,rankMult]);chips+=x;mult+=rankMult-1}`,
  `if(a.length>=3){let isFour=a.length>=4;let x=(isFour?7:5)+rankBonus;m.push(['(3/4) of a Kind ('+rank+'s)',x,rankMult]);chips+=x;mult+=rankMult-1}`,
  'Combine 3/4 of a Kind into a single exclusive meld'
);

// Full Court should use +0.25 Mult while Royal Court keeps the current court multiplier.
rep(
  `let courtMult=1.5+(persist.up.court_mult||0)*0.25;`,
  `let fullCourtMult=1.25+(persist.up.court_mult||0)*0.25;
  let royalCourtMult=1.5+(persist.up.court_mult||0)*0.25;`,
  'Split Full Court and Royal Court mult values in scoring engine'
);
rep(
  `m.push(['Royal Court ('+tier+', '+same+')',10+courtChips,courtMult]);chips+=10+courtChips;mult+=courtMult-1;court=true;`,
  `m.push(['Royal Court ('+tier+', '+same+')',10+courtChips,royalCourtMult]);chips+=10+courtChips;mult+=royalCourtMult-1;court=true;`,
  'Royal Court uses royalCourtMult'
);
rep(
  `m.push(['Full Court ('+tier+')',10+courtChips,courtMult]);chips+=10+courtChips;mult+=courtMult-1;court=true;`,
  `m.push(['Full Court ('+tier+')',10+courtChips,fullCourtMult]);chips+=10+courtChips;mult+=fullCourtMult-1;court=true;`,
  'Full Court uses fullCourtMult'
);

// Highlighting needs to recognize the combined Kind meld name.
rep(
  `if(name.startsWith('Three of a Kind')||name.startsWith('Four of a Kind')){let rank=['Page','Knight','Queen','King'].find(r=>name.includes(r+'s'));let lim=name.startsWith('Three')?3:4;return rank?filled.filter(x=>x.c.type==='court'&&x.c.rank===rank).slice(0,lim).map(x=>x.i):[]}`,
  `if(name.startsWith('(3/4) of a Kind')){let rank=['Page','Knight','Queen','King'].find(r=>name.includes(r+'s'));return rank?filled.filter(x=>x.c.type==='court'&&x.c.rank===rank).map(x=>x.i):[]}if(name.startsWith('Three of a Kind')||name.startsWith('Four of a Kind')){let rank=['Page','Knight','Queen','King'].find(r=>name.includes(r+'s'));let lim=name.startsWith('Three')?3:4;return rank?filled.filter(x=>x.c.type==='court'&&x.c.rank===rank).slice(0,lim).map(x=>x.i):[]}`,
  'Combined Kind meld slot highlighting'
);

// Score sheet: one row for (3/4) of a Kind and a lower Full Court mult.
rep(
  `const courtMult=+(1.5+(u.court_mult||0)*0.25).toFixed(2);`,
  `const fullCourtMult=+(1.25+(u.court_mult||0)*0.25).toFixed(2);
    const royalCourtMult=+(1.5+(u.court_mult||0)*0.25).toFixed(2);`,
  'Split Full Court and Royal Court mult values in scoring sheet'
);
rep(
  `      ['Three of a Kind','3 matching court ranks','+'+(5+rankBonus),fmtBonus(rankMult-1)],
      ['Four of a Kind','4 matching court ranks','+'+(7+rankBonus),fmtBonus(rankMult-1)],
      ['Full Court (3/4)','Consecutive ranks','+'+(10+courtChips),fmtBonus(courtMult-1)],
      ['Royal Court (3/4)','Consecutive ranks, same suit','+'+(10+courtChips),fmtBonus(courtMult-1)],`,
  `      ['(3/4) of a Kind','3 or 4 matching court ranks','+'+(5+rankBonus)+' / +'+(7+rankBonus),fmtBonus(rankMult-1)],
      ['Full Court (3/4)','Consecutive ranks','+'+(10+courtChips),fmtBonus(fullCourtMult-1)],
      ['Royal Court (3/4)','Consecutive ranks, same suit','+'+(10+courtChips),fmtBonus(royalCourtMult-1)],`,
  'Score sheet rows for combined Kind and Full Court +0.25 Mult'
);

html = html.replace('</script>', `${marker}\n</script>`);
fs.writeFileSync(file, html);
console.log(`Done — ${changed} replacements applied.`);
