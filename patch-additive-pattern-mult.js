const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

let changed = 0;
function rep(oldText, newText, label) {
  const count = html.split(oldText).length - 1;
  if (count > 0) {
    html = html.split(oldText).join(newText);
    console.log('  ✓', label, `(${count})`);
    changed += count;
  } else {
    console.warn('  WARN: not found —', label);
  }
}

function applyAdditivePatternMultPatch() {
  const marker = '/* additive pattern mult patch */';
  if (html.includes(marker)) {
    console.log('Additive pattern mult patch already present, skipping additive portion.');
    return;
  }

  console.log('Additive pattern mult patch:');

  // Pattern multipliers are stored as displayed total mult values: 1.25, 1.5, 2, etc.
  // Scoring should combine their bonus portions additively into one final multiplier:
  // 1 + (rankMult-1) + (courtMult-1) + ...
  rep('mult*=rankMult', 'mult+=rankMult-1', 'Rank pattern mult adds instead of compounds');
  rep('mult*=courtMult', 'mult+=courtMult-1', 'Court pattern mult adds instead of compounds');
  rep('mult*=seqMult', 'mult+=seqMult-1', 'Sequence pattern mult adds instead of compounds');
  rep('mult*=pathMult', 'mult+=pathMult-1', 'Path pattern mult adds instead of compounds');

  // Make score text match the additive model. Relics already pass mode==='add'
  // with their additive amount, while pattern entries store total values like 1.25.
  // Keep ghosts compact: +0.25 instead of +0.25 Mult.
  rep(
    `function meldStr(m){const chips=m[1],mult=m[2],additive=m[3]==='add';if(chips&&mult)return\`+\${chips} ×\${mult}\`;if(chips)return\`+\${chips}\`;if(mult)return\`×\${mult}\`;return'';}`,
    `function meldStr(m){const chips=m[1],mult=m[2],additive=m[3]==='add';const fmt=v=>('+'+Number(v).toFixed(2)).replace(/\\.?0+$/,'');const shown=additive?mult:mult-1;if(chips&&mult)return\`+\${chips} \${fmt(shown)}\`;if(chips)return\`+\${chips}\`;if(mult)return\`\${fmt(shown)}\`;return'';}`,
    'Meld text shows compact additive mult gains'
  );

  rep(
    `if(m[2]>0){const multLabel='×'+m[2];setTimeout(()=>fireMultGhost(multLabel),ghostDelay+200);}`,
    `if(m[2]>0){const _mg=m[3]==='add'?m[2]:m[2]-1;const multLabel=('+'+Number(_mg).toFixed(2)).replace(/\\.?0+$/,'');setTimeout(()=>fireMultGhost(multLabel),ghostDelay+200);}`,
    'Colored mult ghost uses compact additive gain label'
  );

  html = html.replace('</script>', `${marker}\n</script>`);
}

function applyFullCourtKindPatch() {
  const marker = '/* full court mult and combined kind patch */';
  if (html.includes(marker)) {
    console.log('Full Court / combined Kind patch already present, skipping.');
    return;
  }

  console.log('Full Court / combined Kind patch:');

  // 3 and 4 of a Kind should be one pattern family, not two independently-stacking melds.
  rep(
    `if(a.length>=3){let x=5+rankBonus;m.push(['Three of a Kind ('+rank+'s)',x,rankMult]);chips+=x;mult+=rankMult-1}\n    if(a.length>=4){let x=7+rankBonus;m.push(['Four of a Kind ('+rank+'s)',x,rankMult]);chips+=x;mult+=rankMult-1}`,
    `if(a.length>=3){let isFour=a.length>=4;let x=(isFour?7:5)+rankBonus;m.push(['(3/4) of a Kind ('+rank+'s)',x,rankMult]);chips+=x;mult+=rankMult-1}`,
    'Combine 3/4 of a Kind into a single exclusive meld'
  );

  // Full Court should use +0.25 Mult while Royal Court keeps the current court multiplier.
  rep(
    `let courtMult=1.5+(persist.up.court_mult||0)*0.25;`,
    `let fullCourtMult=1.25+(persist.up.court_mult||0)*0.25;\n  let royalCourtMult=1.5+(persist.up.court_mult||0)*0.25;`,
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
    `const fullCourtMult=+(1.25+(u.court_mult||0)*0.25).toFixed(2);\n    const royalCourtMult=+(1.5+(u.court_mult||0)*0.25).toFixed(2);`,
    'Split Full Court and Royal Court mult values in scoring sheet'
  );
  rep(
    `      ['Three of a Kind','3 matching court ranks','+'+(5+rankBonus),fmtBonus(rankMult-1)],\n      ['Four of a Kind','4 matching court ranks','+'+(7+rankBonus),fmtBonus(rankMult-1)],\n      ['Full Court (3/4)','Consecutive ranks','+'+(10+courtChips),fmtBonus(courtMult-1)],\n      ['Royal Court (3/4)','Consecutive ranks, same suit','+'+(10+courtChips),fmtBonus(courtMult-1)],`,
    `      ['(3/4) of a Kind','3 or 4 matching court ranks','+'+(5+rankBonus)+' / +'+(7+rankBonus),fmtBonus(rankMult-1)],\n      ['Full Court (3/4)','Consecutive ranks','+'+(10+courtChips),fmtBonus(fullCourtMult-1)],\n      ['Royal Court (3/4)','Consecutive ranks, same suit','+'+(10+courtChips),fmtBonus(royalCourtMult-1)],`,
    'Score sheet rows for combined Kind and Full Court +0.25 Mult'
  );

  html = html.replace('</script>', `${marker}\n</script>`);
}

applyAdditivePatternMultPatch();
applyFullCourtKindPatch();
fs.writeFileSync(file, html);
console.log(`Done — ${changed} replacements applied.`);
